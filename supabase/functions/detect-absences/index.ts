import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Calculate business days from a date (excluding weekends)
function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check yesterday (or a specific date passed in body)
    let targetDate: string;
    try {
      const body = await req.json();
      targetDate = body?.date || "";
    } catch {
      targetDate = "";
    }

    if (!targetDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      targetDate = yesterday.toISOString().split("T")[0];
    }

    const checkDate = new Date(targetDate + "T12:00:00Z");
    const dayOfWeek = checkDate.getDay();

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(JSON.stringify({ message: "Weekend - skipped", date: targetDate, absences_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all active employees with schedule templates
    const { data: employees, error: empErr } = await supabase
      .from("employees")
      .select("id, first_name, last_name, schedule_template_id")
      .eq("status", "active")
      .not("schedule_template_id", "is", null);

    if (empErr) throw empErr;
    if (!employees?.length) {
      return new Response(JSON.stringify({ message: "No employees with schedules", absences_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get schedule template days for this day of week
    const templateIds = [...new Set(employees.map((e: any) => e.schedule_template_id))];
    const { data: templateDays } = await supabase
      .from("schedule_template_days")
      .select("template_id, is_day_off")
      .eq("day_of_week", dayOfWeek)
      .in("template_id", templateIds);

    const dayOffMap = new Map((templateDays || []).map((td: any) => [td.template_id, td.is_day_off]));

    // Filter employees who should have worked (not day off)
    const shouldWork = employees.filter((e: any) => {
      const isDayOff = dayOffMap.get(e.schedule_template_id);
      return isDayOff === false;
    });

    if (!shouldWork.length) {
      return new Response(JSON.stringify({ message: "All employees had day off", date: targetDate, absences_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shouldWorkIds = shouldWork.map((e: any) => e.id);

    // Get time clock records for that date
    const { data: records } = await supabase
      .from("time_clock_records")
      .select("employee_id, clock_in")
      .eq("record_date", targetDate)
      .in("employee_id", shouldWorkIds);

    const clockedIn = new Set((records || []).filter((r: any) => r.clock_in).map((r: any) => r.employee_id));

    // Get existing absences for that date
    const { data: existingAbsences } = await supabase
      .from("absences")
      .select("employee_id")
      .eq("absence_date", targetDate)
      .in("employee_id", shouldWorkIds);

    const alreadyAbsent = new Set((existingAbsences || []).map((a: any) => a.employee_id));

    // Check vacation requests covering that date
    const { data: vacations } = await supabase
      .from("vacation_requests")
      .select("employee_id")
      .eq("status", "approved")
      .lte("start_date", targetDate)
      .gte("end_date", targetDate)
      .in("employee_id", shouldWorkIds);

    const onVacation = new Set((vacations || []).map((v: any) => v.employee_id));

    // Find employees who didn't clock in and don't have an absence or vacation
    const absent = shouldWork.filter((e: any) => 
      !clockedIn.has(e.id) && !alreadyAbsent.has(e.id) && !onVacation.has(e.id)
    );

    if (!absent.length) {
      return new Response(JSON.stringify({ message: "No absences detected", date: targetDate, absences_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate justification deadline (5 business days from target date)
    const deadline = addBusinessDays(checkDate, 5);
    const deadlineStr = deadline.toISOString().split("T")[0];

    // Insert absences
    const absenceRows = absent.map((e: any) => ({
      employee_id: e.id,
      absence_date: targetDate,
      type: "unjustified",
      auto_detected: true,
      justified: false,
      justification_deadline: deadlineStr,
    }));

    const { error: insertErr } = await supabase.from("absences").insert(absenceRows);
    if (insertErr) throw insertErr;

    // Create admin notification
    const names = absent.map((e: any) => `${e.first_name} ${e.last_name}`).join(", ");
    await supabase.from("admin_notifications").insert({
      title: "Faltas Detectadas",
      message: `${absent.length} falta(s) detectada(s) em ${targetDate}: ${names}. Prazo de justificação até ${deadlineStr}.`,
      type: "absence_detected",
    });

    return new Response(JSON.stringify({
      message: "Absences registered",
      date: targetDate,
      absences_created: absent.length,
      deadline: deadlineStr,
      employees: absent.map((e: any) => `${e.first_name} ${e.last_name}`),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
