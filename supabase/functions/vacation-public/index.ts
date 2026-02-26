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
    const { token, action, periods, notes, start_date, end_date } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // GET vacation data by token
    if (!action || action === "get") {
      const { data: vacation, error } = await supabase
        .from("vacation_requests")
        .select("id, start_date, end_date, days_count, status, category, year, total_entitled_days, employee_confirmed, admin_confirmed, notes, employee_id, employees!vacation_requests_employee_id_fkey(first_name, last_name)")
        .eq("token", token)
        .single();

      if (error || !vacation) {
        return new Response(JSON.stringify({ error: "Vacation request not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Also fetch all periods for this employee+year
      const { data: allPeriods } = await supabase
        .from("vacation_requests")
        .select("id, start_date, end_date, days_count, status, category, enjoyed")
        .eq("employee_id", vacation.employee_id)
        .eq("year", vacation.year)
        .order("start_date");

      return new Response(JSON.stringify({ vacation, all_periods: allPeriods || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Employee suggests/confirms dates - supports multiple periods
    if (action === "suggest") {
      // Get the vacation to find employee_id and year
      const { data: vacation, error: fetchError } = await supabase
        .from("vacation_requests")
        .select("id, employee_id, year, total_entitled_days")
        .eq("token", token)
        .single();

      if (fetchError || !vacation) {
        return new Response(JSON.stringify({ error: "Vacation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Support both old format (start_date/end_date) and new format (periods array)
      const periodsToCreate = periods || (start_date && end_date ? [{ start_date, end_date }] : []);

      if (periodsToCreate.length === 0) {
        return new Response(JSON.stringify({ error: "At least one period is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete existing unconfirmed individual periods for this employee+year
      await supabase
        .from("vacation_requests")
        .delete()
        .eq("employee_id", vacation.employee_id)
        .eq("year", vacation.year)
        .eq("category", "individual")
        .eq("employee_confirmed", false);

      // Create new periods
      const newRecords = periodsToCreate.map((p: any) => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        let count = 0;
        const d = new Date(start);
        while (d <= end) {
          const day = d.getDay();
          if (day !== 0 && day !== 6) count++;
          d.setDate(d.getDate() + 1);
        }
        return {
          employee_id: vacation.employee_id,
          year: vacation.year,
          start_date: p.start_date,
          end_date: p.end_date,
          days_count: count,
          category: "individual",
          total_entitled_days: vacation.total_entitled_days,
          employee_confirmed: true,
          status: "employee_suggested",
          notes: notes || null,
        };
      });

      const { error: insertError } = await supabase
        .from("vacation_requests")
        .insert(newRecords);

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Periods submitted successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Employee accepts admin's proposal - accept all periods
    if (action === "accept") {
      const { data: vacation } = await supabase
        .from("vacation_requests")
        .select("employee_id, year")
        .eq("token", token)
        .single();

      if (!vacation) {
        return new Response(JSON.stringify({ error: "Vacation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("vacation_requests")
        .update({
          employee_confirmed: true,
          status: "approved",
        })
        .eq("employee_id", vacation.employee_id)
        .eq("year", vacation.year)
        .eq("category", "individual");

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "All vacations accepted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
