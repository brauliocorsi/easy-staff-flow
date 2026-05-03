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
    const { employee_id, pin_code, confirm_early_leave, confirm_missing_punch, missing_slot, suggested_time } = await req.json();

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
    const local = getLocalTime(now);
    const today = local.dateStr;
    const dayOfWeek = local.dayOfWeek;

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

    // ---- Missing punch detection (skip for part-time / day off) ----
    // If a slot was clearly skipped given the current time, suggest auto-fill BEFORE registering the new punch.
    if (!confirm_missing_punch && existingRecord && schedule && !schedule.is_day_off && !partTime) {
      const slots: { field: string; time: string }[] = [
        { field: "clock_in", time: schedule.clock_in_time },
        { field: "lunch_out", time: schedule.lunch_out_time },
        { field: "lunch_in", time: schedule.lunch_in_time },
        { field: "clock_out", time: schedule.clock_out_time },
      ];
      const nowMin = local.hours * 60 + local.minutes;
      for (let i = 0; i < slots.length - 1; i++) {
        const slot = slots[i];
        const next = slots[i + 1];
        const [nh, nm] = next.time.split(":").map(Number);
        const nextMin = nh * 60 + nm;
        if (!existingRecord[slot.field] && nowMin >= nextMin - 15) {
          return new Response(
            JSON.stringify({
              missing_punch_warning: true,
              missing_slot: slot.field,
              suggested_time: slot.time.slice(0, 5),
              next_action: next.field,
              message: `Faltou registar "${slot.field === 'lunch_out' ? 'Saída Almoço' : slot.field === 'lunch_in' ? 'Retorno Almoço' : slot.field === 'clock_in' ? 'Entrada' : 'Saída'}" às ${slot.time.slice(0,5)}. Deseja preencher automaticamente e continuar?`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // If user confirmed the suggested missing punch, fill it first using suggested time
    if (confirm_missing_punch && missing_slot && suggested_time && existingRecord) {
      const [sh, sm] = String(suggested_time).split(":").map(Number);
      const filled = new Date(now);
      // Set time using local timezone offset
      const tzNow = new Date(now.toLocaleString("en-US", { timeZone: TIMEZONE }));
      const offsetMs = now.getTime() - tzNow.getTime();
      filled.setHours(sh, sm, 0, 0);
      const filledTs = new Date(filled.getTime() + offsetMs).toISOString();
      await supabase
        .from("time_clock_records")
        .update({ [missing_slot]: filledTs })
        .eq("id", existingRecord.id);
      existingRecord[missing_slot] = filledTs;
    }

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
      const currentMinutes = local.hours * 60 + local.minutes;

      if (currentMinutes < scheduledOutMinutes) {
        const minutesEarly = scheduledOutMinutes - currentMinutes;
        const actualTime = local.timeStr;

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

    const timeStr = now.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TIMEZONE,
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
