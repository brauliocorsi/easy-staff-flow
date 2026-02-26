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
    const { meeting_id } = await req.json();
    if (!meeting_id) {
      return new Response(JSON.stringify({ error: "meeting_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch meeting
    const { data: meeting, error: mErr } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meeting_id)
      .single();

    if (mErr || !meeting) {
      return new Response(JSON.stringify({ error: "Meeting not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch participants with emails
    const { data: participants } = await supabase
      .from("meeting_participants")
      .select("employee_id, employees(first_name, last_name, email, position)")
      .eq("meeting_id", meeting_id);

    // Fetch agendas
    const { data: agendas } = await supabase
      .from("meeting_agendas")
      .select("*")
      .eq("meeting_id", meeting_id)
      .order("sort_order");

    // Update meeting status
    await supabase
      .from("meetings")
      .update({ status: "completed" })
      .eq("id", meeting_id);

    // Build email HTML
    const meetingDate = new Date(meeting.meeting_date).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const participantNames = (participants ?? [])
      .map((p: any) => `${p.employees?.first_name} ${p.employees?.last_name}`)
      .join(", ");

    const agendasHtml = (agendas ?? [])
      .map(
        (a: any, i: number) => `
        <div style="margin-bottom:16px;padding:12px;border-left:4px solid #3b82f6;background:#f8fafc;border-radius:4px">
          <strong>${i + 1}. ${a.title}</strong>
          ${a.description ? `<p style="color:#64748b;margin:4px 0">${a.description}</p>` : ""}
          ${a.decision ? `<p style="margin-top:8px"><strong>Decisão:</strong> ${a.decision}</p>` : `<p style="color:#94a3b8;margin-top:8px"><em>Sem decisão registrada</em></p>`}
        </div>`
      )
      .join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h1 style="color:#1e293b">Ata da Reunião: ${meeting.title}</h1>
        <p style="color:#64748b">Data: ${meetingDate}</p>
        <p style="color:#64748b">Participantes: ${participantNames}</p>
        ${meeting.description ? `<p>${meeting.description}</p>` : ""}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
        <h2 style="color:#1e293b">Pautas Discutidas</h2>
        ${agendasHtml || "<p>Nenhuma pauta registrada.</p>"}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
        <p style="color:#94a3b8;font-size:12px">Este email foi gerado automaticamente pelo sistema de reuniões.</p>
      </div>
    `;

    // Send email to each participant via Resend
    const emails = (participants ?? [])
      .map((p: any) => p.employees?.email)
      .filter(Boolean);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (emails.length > 0 && LOVABLE_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Reuniões <onboarding@resend.dev>",
          to: emails,
          subject: `Ata: ${meeting.title}`,
          html,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error("Resend error:", errBody);
      }
    }

    return new Response(
      JSON.stringify({ success: true, emails_sent: emails.length }),
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
