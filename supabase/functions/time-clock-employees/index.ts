import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isPartTime(tDay: any): boolean {
  if (!tDay || tDay.is_day_off) return false;
  return (
    tDay.lunch_in_time === "00:00:00" && tDay.clock_out_time === "00:00:00"
  );
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

    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, position, avatar_url, department_id, schedule_template_id, departments(name), schedule_templates(name, tolerance_late_minutes)")
      .eq("status", "active")
      .order("first_name");

    if (empError) throw empError;

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay();
    const employeeIds = employees.map((e: any) => e.id);

    const { data: records, error: recError } = await supabase
      .from("time_clock_records")
      .select("employee_id, clock_in, lunch_out, lunch_in, clock_out")
      .eq("record_date", today)
      .in("employee_id", employeeIds);

    if (recError) throw recError;

    const templateIds = [...new Set(employees.filter((e: any) => e.schedule_template_id).map((e: any) => e.schedule_template_id))];
    let templateDayMap = new Map();
    if (templateIds.length > 0) {
      const { data: tDays } = await supabase
        .from("schedule_template_days")
        .select("template_id, clock_in_time, clock_out_time, lunch_out_time, lunch_in_time, is_day_off")
        .eq("day_of_week", dayOfWeek)
        .in("template_id", templateIds);
      for (const td of tDays || []) {
        templateDayMap.set(td.template_id, td);
      }
    }

    const recordMap = new Map();
    for (const r of records || []) {
      recordMap.set(r.employee_id, r);
    }

    const result = employees.map((emp: any) => {
      const rec = recordMap.get(emp.id);
      const tDay = emp.schedule_template_id ? templateDayMap.get(emp.schedule_template_id) : null;
      const partTime = isPartTime(tDay);

      // Determine next action
      let nextAction = "clock_in";
      if (rec) {
        if (!rec.clock_in) {
          nextAction = "clock_in";
        } else if (partTime) {
          // Part-time: clock_in -> clock_out (stored in lunch_out field)
          nextAction = !rec.lunch_out ? "clock_out" : "complete";
        } else {
          if (!rec.lunch_out) nextAction = "lunch_out";
          else if (!rec.lunch_in) nextAction = "lunch_in";
          else if (!rec.clock_out) nextAction = "clock_out";
          else nextAction = "complete";
        }
      }

      let schedule_label: string | null = null;
      if (emp.schedule_templates?.name) {
        if (tDay && !tDay.is_day_off) {
          if (partTime) {
            schedule_label = `${emp.schedule_templates.name} · ${tDay.clock_in_time.slice(0,5)}-${tDay.lunch_out_time.slice(0,5)}`;
          } else {
            schedule_label = `${emp.schedule_templates.name} · ${tDay.clock_in_time.slice(0,5)}-${tDay.clock_out_time.slice(0,5)}`;
          }
        } else if (tDay?.is_day_off) {
          schedule_label = `${emp.schedule_templates.name} · Folga`;
        } else {
          schedule_label = emp.schedule_templates.name;
        }
      }

      return {
        id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        position: emp.position,
        avatar_url: emp.avatar_url,
        department: emp.departments?.name || null,
        department_id: emp.department_id || null,
        today_status: nextAction,
        schedule_label,
        is_part_time: partTime,
        scheduled_clock_in: tDay && !tDay.is_day_off ? tDay.clock_in_time : null,
        scheduled_lunch_out: tDay && !tDay.is_day_off && !partTime ? tDay.lunch_out_time : null,
        scheduled_lunch_in: tDay && !tDay.is_day_off && !partTime ? tDay.lunch_in_time : null,
        scheduled_clock_out: tDay && !tDay.is_day_off
          ? (partTime ? tDay.lunch_out_time : tDay.clock_out_time)
          : null,
        tolerance_late_minutes: emp.schedule_templates?.tolerance_late_minutes ?? null,
      };
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
