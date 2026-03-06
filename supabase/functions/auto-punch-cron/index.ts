import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isPartTime(tDay: any): boolean {
  if (!tDay || tDay.is_day_off) return false;
  return tDay.lunch_in_time === "00:00:00" && tDay.clock_out_time === "00:00:00";
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

    // Get all auto_clock employees with schedule templates
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, schedule_template_id")
      .eq("status", "active")
      .eq("auto_clock", true)
      .not("schedule_template_id", "is", null);

    if (empError) throw empError;
    if (!employees || employees.length === 0) {
      return new Response(JSON.stringify({ message: "No auto-clock employees" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const dayOfWeek = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const employeeIds = employees.map((e: any) => e.id);
    const templateIds = [...new Set(employees.map((e: any) => e.schedule_template_id))];

    // Fetch today's records
    const { data: records } = await supabase
      .from("time_clock_records")
      .select("id, employee_id, clock_in, lunch_out, lunch_in, clock_out")
      .eq("record_date", today)
      .in("employee_id", employeeIds);

    const recordMap = new Map();
    for (const r of records || []) {
      recordMap.set(r.employee_id, r);
    }

    // Fetch template days
    const { data: tDays } = await supabase
      .from("schedule_template_days")
      .select("template_id, clock_in_time, clock_out_time, lunch_out_time, lunch_in_time, is_day_off")
      .eq("day_of_week", dayOfWeek)
      .in("template_id", templateIds);

    const templateDayMap = new Map();
    for (const td of tDays || []) {
      templateDayMap.set(td.template_id, td);
    }

    let punchedCount = 0;

    for (const emp of employees) {
      const tDay = templateDayMap.get(emp.schedule_template_id);
      if (!tDay || tDay.is_day_off) continue;

      let rec = recordMap.get(emp.id);
      const pt = isPartTime(tDay);

      // Build list of punches to make
      const times: { field: string; time: string }[] = [
        { field: "clock_in", time: tDay.clock_in_time },
      ];
      if (pt) {
        // Part-time: clock_in then lunch_out acts as clock_out
        times.push({ field: "lunch_out", time: tDay.lunch_out_time });
      } else {
        times.push({ field: "lunch_out", time: tDay.lunch_out_time });
        times.push({ field: "lunch_in", time: tDay.lunch_in_time });
        times.push({ field: "clock_out", time: tDay.clock_out_time });
      }

      for (const { field, time } of times) {
        const [h, m] = time.split(":").map(Number);
        const timeMinutes = h * 60 + m;
        if (currentMinutes < timeMinutes) break; // not yet time

        if (!rec && field === "clock_in") {
          const ts = new Date(now);
          ts.setHours(h, m, 0, 0);
          const { data: newRec } = await supabase
            .from("time_clock_records")
            .insert({ employee_id: emp.id, record_date: today, clock_in: ts.toISOString() })
            .select()
            .single();
          if (newRec) {
            recordMap.set(emp.id, newRec);
            rec = newRec;
            punchedCount++;
          }
        } else if (rec && !rec[field]) {
          const ts = new Date(now);
          ts.setHours(h, m, 0, 0);
          await supabase
            .from("time_clock_records")
            .update({ [field]: ts.toISOString() })
            .eq("id", rec.id);
          rec[field] = ts.toISOString();
          punchedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Auto-punch complete`, punched: punchedCount, employees: employees.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
