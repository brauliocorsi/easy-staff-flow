import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIMEZONE = "Europe/Lisbon";

function getLocalTime(date: Date): { hours: number; minutes: number; dayOfWeek: number; dateStr: string; timeStr: string } {
  const localStr = date.toLocaleString("en-US", { timeZone: TIMEZONE });
  const local = new Date(localStr);
  const hours = local.getHours();
  const minutes = local.getMinutes();
  const dayOfWeek = local.getDay();
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  return { hours, minutes, dayOfWeek, dateStr, timeStr };
}

function isPartTimeSchedule(schedule: any): boolean {
  if (!schedule || schedule.is_day_off) return false;
  return schedule.lunch_in_time === "00:00:00" && schedule.clock_out_time === "00:00:00";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employee_id, pin_code, confirm_early_leave } = await req.json();

    if (!employee_id || !pin_code) {
      return new Response(
        JSON.stringify({ error: "employee_id e pin_code são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate PIN
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, pin_code, schedule_template_id")
      .eq("id", employee_id)
      .eq("status", "active")
      .single();

    if (empError || !employee) {
      return new Response(
        JSON.stringify({ error: "Funcionário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!employee.pin_code || employee.pin_code !== pin_code) {
      return new Response(
        JSON.stringify({ error: "PIN incorreto" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const dayOfWeek = now.getDay();

    // Get schedule
    let schedule = null;
    let tolerances = null;
    if (employee.schedule_template_id) {
      const [{ data: schedData }, { data: templateData }] = await Promise.all([
        supabase
          .from("schedule_template_days")
          .select("*")
          .eq("template_id", employee.schedule_template_id)
          .eq("day_of_week", dayOfWeek)
          .maybeSingle(),
        supabase
          .from("schedule_templates")
          .select("tolerance_early_leave_minutes, tolerance_overtime_minutes")
          .eq("id", employee.schedule_template_id)
          .single(),
      ]);
      schedule = schedData;
      tolerances = templateData;
    } else {
      const { data } = await supabase
        .from("employee_schedules")
        .select("*")
        .eq("employee_id", employee_id)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle();
      schedule = data;
    }

    const partTime = isPartTimeSchedule(schedule);

    // Get today's record
    const { data: existingRecord } = await supabase
      .from("time_clock_records")
      .select("*")
      .eq("employee_id", employee_id)
      .eq("record_date", today)
      .maybeSingle();

    // Determine next action
    let action: string;
    if (!existingRecord) {
      action = "clock_in";
    } else if (!existingRecord.clock_in) {
      action = "clock_in";
    } else if (partTime) {
      // Part-time: after clock_in, next is clock_out (stored in lunch_out field)
      if (!existingRecord.lunch_out) {
        action = "clock_out";
      } else {
        return new Response(
          JSON.stringify({ error: "Ponto já completo para hoje" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      if (!existingRecord.lunch_out) action = "lunch_out";
      else if (!existingRecord.lunch_in) action = "lunch_in";
      else if (!existingRecord.clock_out) action = "clock_out";
      else {
        return new Response(
          JSON.stringify({ error: "Ponto já completo para hoje" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check for early leave on clock_out
    const isClockOut = action === "clock_out";
    if (isClockOut && schedule && !schedule.is_day_off && tolerances) {
      const scheduledOutTime = partTime ? schedule.lunch_out_time : schedule.clock_out_time;
      const [schH, schM] = scheduledOutTime.split(":").map(Number);
      const earlyLeaveToleranceMin = tolerances.tolerance_early_leave_minutes || 0;
      const scheduledOutMinutes = schH * 60 + schM - earlyLeaveToleranceMin;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      if (currentMinutes < scheduledOutMinutes) {
        const minutesEarly = scheduledOutMinutes - currentMinutes;
        const actualTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

        if (!confirm_early_leave) {
          return new Response(
            JSON.stringify({
              early_leave_warning: true,
              minutes_early: minutesEarly,
              scheduled_clock_out: scheduledOutTime.slice(0, 5),
              current_time: actualTime.slice(0, 5),
              message: `Saída antecipada de ${minutesEarly} minutos. Horário previsto: ${scheduledOutTime.slice(0, 5)}. Deseja confirmar?`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // User confirmed early leave
        const { data: attempt } = await supabase
          .from("early_leave_attempts")
          .insert({
            employee_id,
            attempt_date: today,
            scheduled_clock_out: scheduledOutTime,
            actual_attempt_time: actualTime,
            minutes_early: minutesEarly,
            confirmed: true,
          })
          .select()
          .single();

        await supabase.from("admin_notifications").insert({
          title: "Saída Antecipada",
          message: `${employee.first_name} ${employee.last_name} saiu ${minutesEarly} min antes do horário (${actualTime.slice(0, 5)} em vez de ${scheduledOutTime.slice(0, 5)}).`,
          type: "early_leave",
          reference_id: attempt?.id || null,
        });
      }
    }

    const timestamp = now.toISOString();
    // For part-time clock_out, store in the lunch_out DB field
    const dbField = partTime && action === "clock_out" ? "lunch_out" : action;
    let record;

    if (!existingRecord) {
      const { data, error } = await supabase
        .from("time_clock_records")
        .insert({ employee_id, record_date: today, clock_in: timestamp })
        .select()
        .single();
      if (error) throw error;
      record = data;
    } else {
      const { data, error } = await supabase
        .from("time_clock_records")
        .update({ [dbField]: timestamp })
        .eq("id", existingRecord.id)
        .select()
        .single();
      if (error) throw error;
      record = data;
    }

    const actionLabels: Record<string, string> = {
      clock_in: "Entrada",
      lunch_out: "Saída Almoço",
      lunch_in: "Retorno Almoço",
      clock_out: "Saída",
    };

    const timeStr = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    return new Response(
      JSON.stringify({
        success: true,
        action,
        action_label: actionLabels[action] || action,
        time: timeStr,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        record,
        is_part_time: partTime,
        schedule: schedule
          ? {
              clock_in_time: schedule.clock_in_time,
              lunch_out_time: schedule.lunch_out_time,
              lunch_in_time: schedule.lunch_in_time,
              clock_out_time: schedule.clock_out_time,
              is_day_off: schedule.is_day_off,
            }
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
