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
    const { token, action, start_date, end_date, notes } = await req.json();

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

      return new Response(JSON.stringify({ vacation }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Employee suggests/confirms dates
    if (action === "suggest") {
      if (!start_date || !end_date) {
        return new Response(JSON.stringify({ error: "start_date and end_date are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Calculate days count (business days approximation)
      const start = new Date(start_date);
      const end = new Date(end_date);
      let count = 0;
      const d = new Date(start);
      while (d <= end) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) count++;
        d.setDate(d.getDate() + 1);
      }

      const { error } = await supabase
        .from("vacation_requests")
        .update({
          start_date,
          end_date,
          days_count: count,
          notes: notes || null,
          employee_confirmed: true,
          status: "employee_suggested",
        })
        .eq("token", token)
        .eq("employee_confirmed", false);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Dates submitted successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Employee accepts admin's proposal
    if (action === "accept") {
      const { error } = await supabase
        .from("vacation_requests")
        .update({
          employee_confirmed: true,
          status: "approved",
        })
        .eq("token", token);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Vacation accepted" }), {
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
