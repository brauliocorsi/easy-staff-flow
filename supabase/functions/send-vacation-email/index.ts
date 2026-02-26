import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vacation_id } = await req.json();

    if (!vacation_id) {
      return new Response(JSON.stringify({ error: "vacation_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: vacation, error: vacError } = await supabase
      .from("vacation_requests")
      .select("*, employees!vacation_requests_employee_id_fkey(first_name, last_name, email)")
      .eq("id", vacation_id)
      .single();

    if (vacError || !vacation) {
      return new Response(JSON.stringify({ error: "Vacation request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const employee = vacation.employees;
    if (!employee?.email) {
      return new Response(JSON.stringify({ error: "Employee email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build public link
    const siteUrl = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", "").replace("https://", "");
    // We use the frontend URL pattern
    const publicLink = `https://id-preview--5c74799d-8e88-41dc-a444-033e3436fb75.lovable.app/ferias-publica/${vacation.token}`;

    const formatDate = (d: string) => {
      const date = new Date(d + "T00:00:00");
      return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    };

    const startFormatted = vacation.start_date ? formatDate(vacation.start_date) : "A definir";
    const endFormatted = vacation.end_date ? formatDate(vacation.end_date) : "A definir";

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">Pedido de Férias ${vacation.year}</h2>
        <p>Olá <strong>${employee.first_name} ${employee.last_name}</strong>,</p>
        <p>Foi criado um pedido de férias para si. Por favor, aceda ao link abaixo para escolher ou confirmar as suas datas de férias.</p>
        
        <div style="background: #f4f4f8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p><strong>Período sugerido:</strong> ${startFormatted} a ${endFormatted}</p>
          <p><strong>Dias:</strong> ${vacation.days_count || "A definir"}</p>
          <p><strong>Dias de direito:</strong> ${vacation.total_entitled_days}</p>
          ${vacation.notes ? `<p><strong>Observações:</strong> ${vacation.notes}</p>` : ""}
        </div>
        
        <a href="${publicLink}" 
           style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Escolher / Confirmar Férias
        </a>
        
        <p style="margin-top: 24px; color: #666; font-size: 14px;">
          Se não conseguir clicar no botão, copie e cole este link no seu navegador:<br/>
          <a href="${publicLink}">${publicLink}</a>
        </p>
      </div>
    `;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (LOVABLE_API_KEY) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Férias RH <onboarding@resend.dev>",
          to: [employee.email],
          subject: `Pedido de Férias ${vacation.year} - Escolha as suas datas`,
          html: htmlBody,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error("Email send error:", errText);
        return new Response(JSON.stringify({ error: "Failed to send email", details: errText }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
