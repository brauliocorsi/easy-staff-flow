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

    const { pin, action, employee_id, suggestion, evaluation_id, evaluation_data, maintenance_log } = await req.json();

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
      const [absences, warnings, vacations, meetings, contracts, trainings, epis, tools, maintenanceLogs, maintenanceTasks, timeClockRecords] = await Promise.all([
        supabase.from("absences").select("*").eq("employee_id", emp.id).order("absence_date", { ascending: false }),
        supabase.from("warnings").select("*").eq("employee_id", emp.id).order("warning_date", { ascending: false }),
        supabase.from("vacation_requests").select("*").eq("employee_id", emp.id).order("year", { ascending: false }),
        supabase.from("meeting_participants").select("present, meetings(id, title, meeting_date, status, meeting_type)").eq("employee_id", emp.id),
        supabase.from("contracts").select("*").eq("employee_id", emp.id).order("start_date", { ascending: false }),
        supabase.from("employee_trainings").select("*").eq("employee_id", emp.id).order("training_date", { ascending: false }),
        supabase.from("epi_deliveries").select("*").eq("employee_id", emp.id).order("delivery_date", { ascending: false }),
        supabase.from("tool_assignments").select("*").eq("employee_id", emp.id).order("assigned_date", { ascending: false }),
        supabase.from("maintenance_logs").select("*, machines(id, name, checklist_template)").eq("employee_id", emp.id).order("completed_date", { ascending: false }),
        supabase.from("maintenance_tasks").select("*, machines(id, name, location, checklist_template)").eq("employee_id", emp.id).eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("time_clock_records").select("*").eq("employee_id", emp.id).order("record_date", { ascending: false }).limit(60),
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
        trainings: trainings.data || [],
        epis: epis.data || [],
        tools: tools.data || [],
        maintenance_logs: maintenanceLogs.data || [],
        maintenance_tasks: maintenanceTasks.data || [],
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

    // Action: get pending evaluations for evaluator
    if (action === "get_pending_evaluations") {
      if (!employee_id) {
        return new Response(JSON.stringify({ error: "employee_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("employee_evaluations")
        .select("*, employee:employee_id(id, first_name, last_name, avatar_url, position)")
        .eq("evaluator_id", employee_id)
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ evaluations: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: submit evaluation
    if (action === "submit_evaluation") {
      if (!evaluation_id || !evaluation_data) {
        return new Response(JSON.stringify({ error: "Dados da avaliação obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("employee_evaluations")
        .update({
          rating: evaluation_data.rating,
          performance_rating: evaluation_data.performance_rating,
          teamwork_rating: evaluation_data.teamwork_rating,
          punctuality_rating: evaluation_data.punctuality_rating,
          communication_rating: evaluation_data.communication_rating,
          strengths: evaluation_data.strengths,
          improvements: evaluation_data.improvements,
          comments: evaluation_data.comments,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", evaluation_id)
        .eq("evaluator_id", employee_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: submit maintenance log
    if (action === "submit_maintenance_log") {
      if (!employee_id || !maintenance_log?.task_id || !maintenance_log?.machine_id) {
        return new Response(JSON.stringify({ error: "Dados obrigatórios em falta" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already registered today
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("maintenance_logs")
        .select("id")
        .eq("task_id", maintenance_log.task_id)
        .eq("employee_id", employee_id)
        .eq("completed_date", today)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Esta tarefa já foi registada hoje" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase.from("maintenance_logs").insert({
        task_id: maintenance_log.task_id,
        machine_id: maintenance_log.machine_id,
        employee_id: employee_id,
        checklist_data: maintenance_log.checklist_data || {},
        notes: maintenance_log.notes || null,
        status: "completed",
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
