import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const typeLabels: Record<string, string> = {
  verbal: "Advertência Verbal",
  written: "Advertência Escrita",
  suspension: "Suspensão Disciplinar",
  termination: "Demissão por Justa Causa",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { warning_id } = await req.json();
    if (!warning_id) {
      return new Response(JSON.stringify({ error: "warning_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: warning, error: wErr } = await supabase
      .from("warnings")
      .select("*, employees!warnings_employee_id_fkey(first_name, last_name, email, position)")
      .eq("id", warning_id)
      .single();

    if (wErr || !warning) {
      return new Response(JSON.stringify({ error: "Warning not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emp = warning.employees;
    if (!emp?.email) {
      return new Response(JSON.stringify({ error: "Employee email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const warningDate = new Date(warning.warning_date).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h1 style="color:#1e293b">Notificação de Advertência</h1>
        <p>Prezado(a) <strong>${emp.first_name} ${emp.last_name}</strong>,</p>
        <p>Informamos que foi registrada uma advertência em seu nome com os seguintes detalhes:</p>
        
        <div style="background:#f8fafc;border-left:4px solid #ef4444;padding:16px;border-radius:4px;margin:16px 0">
          <p><strong>Tipo:</strong> ${typeLabels[warning.type] || warning.type}</p>
          <p><strong>Data:</strong> ${warningDate}</p>
          <p><strong>Motivo:</strong> ${warning.reason}</p>
          ${warning.description ? `<p><strong>Descrição:</strong> ${warning.description}</p>` : ""}
        </div>
        
        <p style="color:#64748b;font-size:13px">Em caso de dúvidas, entre em contacto com o departamento de recursos humanos.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
        <p style="color:#94a3b8;font-size:12px">Este email foi gerado automaticamente pelo sistema de gestão.</p>
      </div>
    `;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (LOVABLE_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Advertências <onboarding@resend.dev>",
          to: [emp.email],
          subject: `Notificação de Advertência - ${typeLabels[warning.type] || warning.type}`,
          html,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error("Resend error:", errBody);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
