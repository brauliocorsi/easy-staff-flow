import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { pin, action, employee_id, suggestion } = await req.json();

    // Action: authenticate with PIN
    if (action === "login") {
      if (!pin || pin.length !== 4) {
        return new Response(JSON.stringify({ error: "PIN inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: emp, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email, phone, position, status, hire_date, birth_date, avatar_url, nif, niss, morada, cidade, distrito, codigo_postal, departments(name)")
        .eq("pin_code", pin)
        .eq("status", "active")
        .maybeSingle();

      if (error || !emp) {
        return new Response(JSON.stringify({ error: "PIN não encontrado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch related data
      const [absences, warnings, vacations, meetings, contracts] = await Promise.all([
        supabase.from("absences").select("*").eq("employee_id", emp.id).order("absence_date", { ascending: false }),
        supabase.from("warnings").select("*").eq("employee_id", emp.id).order("warning_date", { ascending: false }),
        supabase.from("vacation_requests").select("*").eq("employee_id", emp.id).order("year", { ascending: false }),
        supabase.from("meeting_participants").select("present, meetings(id, title, meeting_date, status, meeting_type)").eq("employee_id", emp.id),
        supabase.from("contracts").select("*").eq("employee_id", emp.id).order("start_date", { ascending: false }),
      ]);

      const meetingsList = (meetings.data || [])
        .filter((p: any) => p.meetings)
        .map((p: any) => ({
          id: p.meetings.id,
          title: p.meetings.title,
          meeting_date: p.meetings.meeting_date,
          status: p.meetings.status,
          meeting_type: p.meetings.meeting_type,
          present: p.present,
        }))
        .sort((a: any, b: any) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());

      return new Response(JSON.stringify({
        employee: emp,
        absences: absences.data || [],
        warnings: warnings.data || [],
        vacations: vacations.data || [],
        meetings: meetingsList,
        contracts: contracts.data || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: submit suggestion
    if (action === "submit_suggestion") {
      if (!suggestion?.message) {
        return new Response(JSON.stringify({ error: "Mensagem obrigatória" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase.from("employee_suggestions").insert({
        employee_id: suggestion.is_anonymous ? null : employee_id,
        is_anonymous: suggestion.is_anonymous || false,
        type: suggestion.type || "suggestion",
        message: suggestion.message,
        rating: suggestion.rating || null,
      });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
