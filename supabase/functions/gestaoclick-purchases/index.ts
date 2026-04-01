import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GESTAOCLICK_BASE = "https://api.gestaoclick.com/api";

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

  // Force HTTP/1.1 to avoid Deno HTTP/2 connection errors
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GestaoClick API error [${res.status}]: ${text}`);
  }

  return res.json();
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

      const data = await gestaoGet("compras", params);
      return new Response(JSON.stringify(data), {
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
      const data = await gestaoGet("assistencias", params);
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
