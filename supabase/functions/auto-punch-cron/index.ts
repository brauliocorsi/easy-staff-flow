/**
 * Picagem automática (colaboradores com marcação automática ativa).
 *
 * Regras aplicadas (antes não eram):
 *  - horário individual tem prioridade sobre o modelo do departamento;
 *  - nunca marca presença em folga, feriado, férias aprovadas ou falta registada;
 *  - nunca escreve num mês já fechado;
 *  - grava a origem `auto` e a fotografia do horário usado.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isPartTimeSchedule, lisbonTimeToUTC } from "../_shared/attendance/engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIMEZONE = "Europe/Lisbon";

function getLocalTime(date: Date) {
  const local = new Date(date.toLocaleString("en-US", { timeZone: TIMEZONE }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return {
    hours: local.getHours(), minutes: local.getMinutes(),
    dayOfWeek: local.getDay(), dateStr: `${y}-${m}-${d}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, schedule_template_id")
      .eq("status", "active").eq("auto_clock", true);
    if (empError) throw empError;
    if (!employees?.length) {
      return new Response(JSON.stringify({ message: "No auto-clock employees" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const local = getLocalTime(now);
    const today = local.dateStr;
    const dayOfWeek = local.dayOfWeek;
    const currentMinutes = local.hours * 60 + local.minutes;
    const employeeIds = employees.map((e: any) => e.id);

    // --- Exclusões: feriado, férias, faltas, mês fechado ---------------------
    const { data: holidays } = await supabase
      .from("holidays").select("holiday_date, recurring_yearly");
    const isHoliday = (holidays || []).some((h: any) =>
      h.holiday_date === today ||
      (h.recurring_yearly && String(h.holiday_date).slice(5) === today.slice(5)));
    if (isHoliday) {
      return new Response(JSON.stringify({ message: "Feriado — sem picagem automática", punched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: vacations }, { data: absences }, { data: closures }] = await Promise.all([
      supabase.from("vacation_requests").select("employee_id")
        .eq("status", "approved").in("employee_id", employeeIds)
        .lte("start_date", today).gte("end_date", today),
      supabase.from("absences").select("employee_id")
        .in("employee_id", employeeIds).eq("absence_date", today),
      supabase.from("time_bank_monthly_closures").select("employee_id")
        .in("employee_id", employeeIds).eq("is_locked", true)
        .eq("period_year", Number(today.slice(0, 4)))
        .eq("period_month", Number(today.slice(5, 7))),
    ]);
    const excluded = new Set<string>([
      ...(vacations || []).map((v: any) => v.employee_id),
      ...(absences || []).map((a: any) => a.employee_id),
      ...(closures || []).map((c: any) => c.employee_id),
    ]);

    // --- Horários: individual > modelo ---------------------------------------
    const { data: overrides } = await supabase
      .from("employee_schedules")
      .select("employee_id, clock_in_time, lunch_out_time, lunch_in_time, clock_out_time, is_day_off")
      .in("employee_id", employeeIds).eq("day_of_week", dayOfWeek);
    const overrideMap = new Map<string, any>();
    for (const o of overrides || []) overrideMap.set(o.employee_id, o);

    const templateIds = [...new Set(employees.map((e: any) => e.schedule_template_id).filter(Boolean))];
    const templateDayMap = new Map<string, any>();
    if (templateIds.length) {
      const { data: tDays } = await supabase
        .from("schedule_template_days")
        .select("template_id, clock_in_time, clock_out_time, lunch_out_time, lunch_in_time, is_day_off")
        .eq("day_of_week", dayOfWeek).in("template_id", templateIds);
      for (const td of tDays || []) templateDayMap.set(td.template_id, td);
    }

    const { data: records } = await supabase
      .from("time_clock_records")
      .select("id, employee_id, clock_in, lunch_out, lunch_in, clock_out")
      .eq("record_date", today).in("employee_id", employeeIds);
    const recordMap = new Map<string, any>();
    for (const r of records || []) recordMap.set(r.employee_id, r);

    let punchedCount = 0;
    let skipped = 0;

    for (const emp of employees) {
      if (excluded.has(emp.id)) { skipped++; continue; }

      const schedule = overrideMap.get(emp.id)
        || (emp.schedule_template_id ? templateDayMap.get(emp.schedule_template_id) : null);
      if (!schedule || schedule.is_day_off) { skipped++; continue; }

      let rec = recordMap.get(emp.id);
      const pt = isPartTimeSchedule(schedule);
      const snapshot = {
        clock_in_time: schedule.clock_in_time, lunch_out_time: schedule.lunch_out_time,
        lunch_in_time: schedule.lunch_in_time, clock_out_time: schedule.clock_out_time,
        source: overrideMap.has(emp.id) ? "employee_schedule" : "schedule_template",
      };

      const times: { field: string; time: string }[] = [
        { field: "clock_in", time: schedule.clock_in_time },
        { field: "lunch_out", time: schedule.lunch_out_time },
      ];
      if (!pt) {
        times.push({ field: "lunch_in", time: schedule.lunch_in_time });
        times.push({ field: "clock_out", time: schedule.clock_out_time });
      }

      for (const { field, time } of times) {
        const [h, m] = time.split(":").map(Number);
        if (currentMinutes < h * 60 + m) break;
        const ts = lisbonTimeToUTC(today, h, m).toISOString();

        if (!rec && field === "clock_in") {
          const { data: newRec } = await supabase.from("time_clock_records")
            .insert({
              employee_id: emp.id, record_date: today, clock_in: ts,
              punch_origin: "auto", schedule_snapshot: snapshot,
            }).select().single();
          if (newRec) { recordMap.set(emp.id, newRec); rec = newRec; punchedCount++; }
        } else if (rec && !rec[field]) {
          await supabase.from("time_clock_records")
            .update({ [field]: ts, punch_origin: "auto", schedule_snapshot: snapshot })
            .eq("id", rec.id);
          rec[field] = ts;
          punchedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Auto-punch complete", punched: punchedCount, skipped, employees: employees.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
