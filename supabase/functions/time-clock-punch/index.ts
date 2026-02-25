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
    const { employee_id, pin_code } = await req.json();

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
      .select("id, first_name, last_name, pin_code")
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
    const dayOfWeek = now.getDay(); // 0=Sunday

    // Get schedule
    const { data: schedule } = await supabase
      .from("employee_schedules")
      .select("*")
      .eq("employee_id", employee_id)
      .eq("day_of_week", dayOfWeek)
      .maybeSingle();

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
    } else if (!existingRecord.lunch_out) {
      action = "lunch_out";
    } else if (!existingRecord.lunch_in) {
      action = "lunch_in";
    } else if (!existingRecord.clock_out) {
      action = "clock_out";
    } else {
      return new Response(
        JSON.stringify({ error: "Ponto já completo para hoje" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const timestamp = now.toISOString();
    let record;

    if (!existingRecord) {
      const { data, error } = await supabase
        .from("time_clock_records")
        .insert({
          employee_id,
          record_date: today,
          clock_in: timestamp,
        })
        .select()
        .single();
      if (error) throw error;
      record = data;
    } else {
      const { data, error } = await supabase
        .from("time_clock_records")
        .update({ [action]: timestamp })
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
        action_label: actionLabels[action],
        time: timeStr,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        record,
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
