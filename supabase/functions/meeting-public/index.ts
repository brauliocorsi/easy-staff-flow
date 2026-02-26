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

    const { data: meeting, error: mErr } = await supabase
      .from("meetings")
      .select("id, title, description, meeting_date, duration_minutes, started_at, paused_at, paused_seconds, status")
      .eq("id", meeting_id)
      .single();

    if (mErr || !meeting) {
      return new Response(JSON.stringify({ error: "Meeting not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: participants } = await supabase
      .from("meeting_participants")
      .select("id, employee_id, present, employees(first_name, last_name, position)")
      .eq("meeting_id", meeting_id);

    const { data: agendas } = await supabase
      .from("meeting_agendas")
      .select("id, title, description, decision, sort_order, meeting_id, created_at")
      .eq("meeting_id", meeting_id)
      .order("sort_order");

    // Strip emails from public response
    const safeParticipants = (participants ?? []).map((p: any) => ({
      id: p.id,
      employee_id: p.employee_id,
      present: p.present,
      employees: p.employees
        ? {
            first_name: p.employees.first_name,
            last_name: p.employees.last_name,
            position: p.employees.position,
            email: "", // hidden
          }
        : null,
    }));

    return new Response(
      JSON.stringify({
        ...meeting,
        participants: safeParticipants,
        agendas: agendas ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
