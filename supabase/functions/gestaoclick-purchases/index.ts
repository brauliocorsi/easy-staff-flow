import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GESTAOCLICK_BASE = "https://api.gestaoclick.com/api";

class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function gestaoGet(path: string, params?: Record<string, string>) {
  const token = (Deno.env.get("GESTAOCLICK_TOKEN") || "").trim();
  const secret = (Deno.env.get("GESTAOCLICK_SECRET") || "").trim();
  if (!token || !secret) throw new Error("GestaoClick credentials not configured");

  const url = new URL(`${GESTAOCLICK_BASE}/${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  let lastStatus = 0;
  let lastText = "";

  // Retry transient upstream 5xx errors
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "access-token": token,
          "secret-access-token": secret,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        // @ts-ignore Deno-specific option
        client: Deno.createHttpClient({ http2: false }),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.ok) return res.json();

    lastStatus = res.status;
    lastText = await res.text();

    if (res.status < 500) break;
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }

  throw new UpstreamError(
    lastStatus,
    `GestaoClick API error [${lastStatus}]: ${lastText.slice(0, 300)}`,
  );
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "purchases") {
      const situacaoId = url.searchParams.get("situacao_id") || "";
      const page = url.searchParams.get("pagina") || "1";
      const lojaId = url.searchParams.get("loja_id") || "";

      const params: Record<string, string> = { pagina: page };
      if (situacaoId) params.situacao_id = situacaoId;
      if (lojaId) params.loja_id = lojaId;

      try {
        const data = await gestaoGet("compras", params);
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        // Upstream ERP often 500s on pages past the last one — end pagination gracefully
        if (err instanceof UpstreamError && err.status >= 500) {
          console.error("Upstream purchases error:", err.message);
          return new Response(
            JSON.stringify({ data: [], upstream_error: true, message: err.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        throw err;
      }
    }

    if (action === "purchases-all") {
      const storesResp = await gestaoGet("lojas");
      const stores: Array<{ id: string; nome: string }> = (storesResp?.data || []).map(
        (s: Record<string, unknown>) => {
          const l = (s as { Loja?: Record<string, unknown> }).Loja || s;
          return { id: String(l.id ?? ""), nome: String(l.nome ?? l.razao_social ?? "Loja") };
        },
      );

      const maxPages = 60;
      const concurrency = 6;
      const purchases: Array<Record<string, unknown>> = [];
      let partial = false;

      const fetchPage = async (lojaId: string, pagina: number) => {
        try {
          return await gestaoGet("compras", { pagina: String(pagina), loja_id: lojaId });
        } catch (err) {
          partial = true;
          console.error(`Falha loja ${lojaId} pág ${pagina}:`, (err as Error).message);
          return null;
        }
      };

      for (const store of stores) {
        const first = await fetchPage(store.id, 1);
        if (!first) continue;
        const items = Array.isArray(first.data) ? first.data : [];
        purchases.push(...items.map((i: Record<string, unknown>) => ({ ...i, __loja_id: store.id, __loja_nome: store.nome })));

        const total = Math.min(Number(first?.meta?.total_paginas || 1) || 1, maxPages);
        if (total < 2) continue;

        const pages = Array.from({ length: total - 1 }, (_, i) => i + 2);
        for (let i = 0; i < pages.length; i += concurrency) {
          const chunk = pages.slice(i, i + concurrency);
          const results = await Promise.all(chunk.map((p) => fetchPage(store.id, p)));
          for (const r of results) {
            const rows = Array.isArray(r?.data) ? r!.data : [];
            purchases.push(...rows.map((i2: Record<string, unknown>) => ({ ...i2, __loja_id: store.id, __loja_nome: store.nome })));
          }
        }
      }

      return new Response(JSON.stringify({ stores, purchases, partial }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }




    if (action === "purchase-statuses") {
      const data = await gestaoGet("situacoes_compras");
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "suppliers") {
      const page = url.searchParams.get("pagina") || "1";
      const data = await gestaoGet("fornecedores", { pagina: page });
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "stores") {
      const data = await gestaoGet("lojas");
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "service-orders") {
      const page = url.searchParams.get("pagina") || "1";
      const lojaId = url.searchParams.get("loja_id") || "";
      const params: Record<string, string> = { pagina: page };
      if (lojaId) params.loja_id = lojaId;
      const data = await gestaoGet("ordens_servicos", params);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
