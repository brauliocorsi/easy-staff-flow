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

    // No longer skip weekends globally — rely on each employee's schedule template is_day_off

    // Skip if targetDate is a holiday (single or recurring yearly)
    const mmdd = targetDate.slice(5); // MM-DD
    const { data: holidays } = await supabase
      .from("holidays")
      .select("holiday_date, name, recurring_yearly");
    const isHoliday = (holidays || []).some((h: any) => {
      if (h.holiday_date === targetDate) return true;
      if (h.recurring_yearly && String(h.holiday_date).slice(5) === mmdd) return true;
      return false;
    });
    if (isHoliday) {
      return new Response(
        JSON.stringify({ message: "Date is a holiday — no absences detected", date: targetDate, absences_created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      .select("template_id, is_day_off, lunch_in_time, clock_out_time")
      .eq("day_of_week", dayOfWeek)
      .in("template_id", templateIds);

    const dayOffMap = new Map((templateDays || []).map((td: any) => [td.template_id, td.is_day_off]));
    // Detect part-time: if lunch_in_time and clock_out_time are both '00:00:00', it's a single-shift (part-time)
    const partTimeMap = new Map((templateDays || []).map((td: any) => [
      td.template_id,
      td.lunch_in_time === "00:00:00" && td.clock_out_time === "00:00:00",
    ]));

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

    // Get time clock records for that date (include all punch fields)
    const { data: records } = await supabase
      .from("time_clock_records")
      .select("employee_id, clock_in, lunch_out, lunch_in, clock_out")
      .eq("record_date", targetDate)
      .in("employee_id", shouldWorkIds);

    const recordMap = new Map<string, any>();
    for (const r of records || []) {
      recordMap.set(r.employee_id, r);
    }

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

    // Calculate justification deadline (5 business days from target date)
    const deadline = addBusinessDays(checkDate, 5);
    const deadlineStr = deadline.toISOString().split("T")[0];

    const absenceRows: any[] = [];
    const fullAbsent: any[] = [];
    const halfAbsent: any[] = [];

    for (const emp of shouldWork) {
      if (alreadyAbsent.has(emp.id) || onVacation.has(emp.id)) continue;

      const rec = recordMap.get(emp.id);
      const isPartTime = partTimeMap.get(emp.schedule_template_id) === true;

      if (!rec || !rec.clock_in) {
        // No clock_in at all → full day absence (or 0.5 if part-time)
        absenceRows.push({
          employee_id: emp.id,
          absence_date: targetDate,
          type: "unjustified",
          auto_detected: true,
          justified: false,
          justification_deadline: deadlineStr,
          days_count: isPartTime ? 0.5 : 1,
        });
        fullAbsent.push(emp);
      } else if (!rec.clock_out && !isPartTime) {
        // Clocked in but never clocked out (incomplete day) → half day absence
        // Only for full-time employees; part-time with clock_in + lunch_out is complete
        const hasLunchOut = !!rec.lunch_out;
        if (isPartTime && hasLunchOut) {
          // Part-time employee completed their shift (entry + lunch_out as exit) → no absence
        } else {
          absenceRows.push({
            employee_id: emp.id,
            absence_date: targetDate,
            type: "unjustified",
            auto_detected: true,
            justified: false,
            justification_deadline: deadlineStr,
            days_count: 0.5,
          });
          halfAbsent.push(emp);
        }
      }
      // If clock_in and clock_out both exist → no absence
    }

    if (!absenceRows.length) {
      return new Response(JSON.stringify({ message: "No absences detected", date: targetDate, absences_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertErr } = await supabase.from("absences").insert(absenceRows);
    if (insertErr) throw insertErr;

    // Create admin notification
    const parts: string[] = [];
    if (fullAbsent.length > 0) {
      const names = fullAbsent.map((e: any) => `${e.first_name} ${e.last_name}`).join(", ");
      parts.push(`${fullAbsent.length} falta(s) completa(s): ${names}`);
    }
    if (halfAbsent.length > 0) {
      const names = halfAbsent.map((e: any) => `${e.first_name} ${e.last_name}`).join(", ");
      parts.push(`${halfAbsent.length} meia(s) falta(s): ${names}`);
    }

    await supabase.from("admin_notifications").insert({
      title: "Faltas Detectadas",
      message: `${parts.join(". ")} em ${targetDate}. Prazo de justificação até ${deadlineStr}.`,
      type: "absence_detected",
    });

    return new Response(JSON.stringify({
      message: "Absences registered",
      date: targetDate,
      absences_created: absenceRows.length,
      full_absences: fullAbsent.length,
      half_absences: halfAbsent.length,
      deadline: deadlineStr,
      employees: [
        ...fullAbsent.map((e: any) => `${e.first_name} ${e.last_name} (1 dia)`),
        ...halfAbsent.map((e: any) => `${e.first_name} ${e.last_name} (½ dia)`),
      ],
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
