import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pin } = await req.json();
    const expectedPin = Deno.env.get("ATTENDANCE_DASHBOARD_PIN");

    if (!expectedPin || pin !== expectedPin) {
      return new Response(
        JSON.stringify({ error: "PIN inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon...

    // Get all active employees with their schedules
    const { data: employees, error: empErr } = await supabase
      .from("employees")
      .select("id, first_name, last_name, position, avatar_url")
      .eq("status", "active")
      .order("first_name");

    if (empErr) throw empErr;

    // Get today's time clock records
    const { data: records, error: recErr } = await supabase
      .from("time_clock_records")
      .select("employee_id, clock_in, lunch_out, lunch_in, clock_out")
      .eq("record_date", today);

    if (recErr) throw recErr;

    // Get employee schedules to know who works today
    const { data: schedules, error: schErr } = await supabase
      .from("employee_schedules")
      .select("employee_id, day_of_week, is_day_off, clock_in_time, clock_out_time");

    if (schErr) throw schErr;

    // Build schedule map
    const scheduleMap = new Map<string, { is_day_off: boolean; clock_in_time: string; clock_out_time: string }>();
    for (const s of schedules || []) {
      if (s.day_of_week === dayOfWeek) {
        scheduleMap.set(s.employee_id, {
          is_day_off: s.is_day_off,
          clock_in_time: s.clock_in_time,
          clock_out_time: s.clock_out_time,
        });
      }
    }

    // Build records map
    const recordMap = new Map<string, typeof records[0]>();
    for (const r of records || []) {
      recordMap.set(r.employee_id, r);
    }

    // Build response
    const attendanceList = (employees || []).map((emp) => {
      const schedule = scheduleMap.get(emp.id);
      const record = recordMap.get(emp.id);
      const isDayOff = schedule?.is_day_off ?? (dayOfWeek === 0 || dayOfWeek === 6);

      let status = "absent"; // default
      if (isDayOff) {
        status = "day_off";
      } else if (record) {
        if (record.clock_out) {
          status = "left";
        } else if (record.lunch_out && !record.lunch_in) {
          status = "lunch";
        } else if (record.clock_in) {
          status = "present";
        }
      }

      const formatTime = (ts: string | null) => {
        if (!ts) return null;
        return new Date(ts).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
      };

      return {
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        position: emp.position,
        avatar_url: emp.avatar_url,
        status,
        scheduled_in: schedule?.clock_in_time?.slice(0, 5) || null,
        scheduled_out: schedule?.clock_out_time?.slice(0, 5) || null,
        clock_in: formatTime(record?.clock_in || null),
        lunch_out: formatTime(record?.lunch_out || null),
        lunch_in: formatTime(record?.lunch_in || null),
        clock_out: formatTime(record?.clock_out || null),
      };
    });

    // Filter out day_off for stats but keep in list
    const working = attendanceList.filter((e) => e.status !== "day_off");
    const stats = {
      total: working.length,
      present: working.filter((e) => e.status === "present").length,
      lunch: working.filter((e) => e.status === "lunch").length,
      left: working.filter((e) => e.status === "left").length,
      absent: working.filter((e) => e.status === "absent").length,
    };

    return new Response(
      JSON.stringify({ attendance: attendanceList, stats, date: today }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
