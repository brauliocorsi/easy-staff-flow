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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get active employees (without PIN)
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, position, avatar_url, department_id, departments(name)")
      .eq("status", "active")
      .order("first_name");

    if (empError) throw empError;

    // Get today's time clock records for all active employees
    const today = new Date().toISOString().split("T")[0];
    const employeeIds = employees.map((e: any) => e.id);

    const { data: records, error: recError } = await supabase
      .from("time_clock_records")
      .select("employee_id, clock_in, lunch_out, lunch_in, clock_out")
      .eq("record_date", today)
      .in("employee_id", employeeIds);

    if (recError) throw recError;

    const recordMap = new Map();
    for (const r of records || []) {
      recordMap.set(r.employee_id, r);
    }

    const result = employees.map((emp: any) => {
      const rec = recordMap.get(emp.id);
      let nextAction = "clock_in";
      if (rec) {
        if (!rec.clock_in) nextAction = "clock_in";
        else if (!rec.lunch_out) nextAction = "lunch_out";
        else if (!rec.lunch_in) nextAction = "lunch_in";
        else if (!rec.clock_out) nextAction = "clock_out";
        else nextAction = "complete";
      }
      return {
        id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        position: emp.position,
        avatar_url: emp.avatar_url,
        department: emp.departments?.name || null,
        today_status: nextAction,
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
