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
    const { token, action, periods, notes, start_date, end_date, sell_days } = await req.json();

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

    // Fetch holidays once (used for working-day count)
    const { data: holidaysData } = await supabase
      .from("holidays")
      .select("holiday_date, recurring_yearly");
    const holidays = holidaysData || [];
    const fixedHolidays = new Set<string>();
    const recurringHolidays = new Set<string>();
    for (const h of holidays) {
      if (!h?.holiday_date) continue;
      fixedHolidays.add(h.holiday_date);
      if (h.recurring_yearly) recurringHolidays.add(h.holiday_date.slice(5));
    }
    const countWorkingDays = (startStr: string, endStr: string): number => {
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;
      let count = 0;
      const d = new Date(start);
      while (d <= end) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const iso = `${yyyy}-${mm}-${dd}`;
          if (!fixedHolidays.has(iso) && !recurringHolidays.has(`${mm}-${dd}`)) count++;
        }
        d.setDate(d.getDate() + 1);
      }
      return count;
    };

    // GET vacation data by token
    if (!action || action === "get") {
      const { data: vacation, error } = await supabase
        .from("vacation_requests")
        .select("id, start_date, end_date, days_count, status, category, year, total_entitled_days, employee_confirmed, admin_confirmed, notes, employee_id, sold_days, sell_status, employees!vacation_requests_employee_id_fkey(first_name, last_name)")
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
        .select("id, start_date, end_date, days_count, status, category, enjoyed, sold_days, sell_status")
        .eq("employee_id", vacation.employee_id)
        .eq("year", vacation.year)
        .order("start_date");

      // Calculate sold days info
      const soldInfo = {
        pending_sell: 0,
        approved_sell: 0,
        rejected_sell: 0,
      };
      for (const p of allPeriods || []) {
        if (p.sell_status === "pending_sell") soldInfo.pending_sell += (p.sold_days || 0);
        if (p.sell_status === "sell_approved") soldInfo.approved_sell += (p.sold_days || 0);
        if (p.sell_status === "sell_rejected") soldInfo.rejected_sell += (p.sold_days || 0);
      }

      return new Response(JSON.stringify({ vacation, all_periods: allPeriods || [], sold_info: soldInfo, holidays }), {
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
      const newRecords = periodsToCreate.map((p: any, idx: number) => {
        const count = countWorkingDays(p.start_date, p.end_date);
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
          // Preserve the original token on the first record so the link stays valid
          ...(idx === 0 ? { token } : {}),
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

    // Employee requests to sell vacation days
    if (action === "sell") {
      if (!sell_days || sell_days <= 0) {
        return new Response(JSON.stringify({ error: "Número de dias inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      // Get all periods to calculate available days
      const { data: allPeriods } = await supabase
        .from("vacation_requests")
        .select("days_count, status, sold_days, sell_status")
        .eq("employee_id", vacation.employee_id)
        .eq("year", vacation.year);

      const scheduledDays = (allPeriods || [])
        .filter((p: any) => p.status !== "rejected" && p.days_count > 0 && !p.sell_status)
        .reduce((sum: number, p: any) => sum + p.days_count, 0);

      const alreadySoldApproved = (allPeriods || [])
        .filter((p: any) => p.sell_status === "sell_approved")
        .reduce((sum: number, p: any) => sum + (p.sold_days || 0), 0);

      const alreadySoldPending = (allPeriods || [])
        .filter((p: any) => p.sell_status === "pending_sell")
        .reduce((sum: number, p: any) => sum + (p.sold_days || 0), 0);

      const available = vacation.total_entitled_days - scheduledDays - alreadySoldApproved - alreadySoldPending;

      if (sell_days > available) {
        return new Response(JSON.stringify({ 
          error: `Só pode vender até ${available} dias. Tem ${scheduledDays} agendados e ${alreadySoldApproved + alreadySoldPending} já em venda.` 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if there's already a pending sell request - update it
      const { data: existingSell } = await supabase
        .from("vacation_requests")
        .select("id")
        .eq("employee_id", vacation.employee_id)
        .eq("year", vacation.year)
        .eq("sell_status", "pending_sell")
        .maybeSingle();

      if (existingSell) {
        const { error: updateError } = await supabase
          .from("vacation_requests")
          .update({ sold_days: sell_days })
          .eq("id", existingSell.id);

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        // Create a new sell request record
        const yearStr = String(vacation.year);
        const { error: insertError } = await supabase
          .from("vacation_requests")
          .insert({
            employee_id: vacation.employee_id,
            year: vacation.year,
            start_date: `${yearStr}-01-01`,
            end_date: `${yearStr}-01-01`,
            days_count: 0,
            category: "individual",
            total_entitled_days: vacation.total_entitled_days,
            sold_days: sell_days,
            sell_status: "pending_sell",
            status: "pending",
            employee_confirmed: true,
            notes: `Pedido de venda de ${sell_days} dias de férias`,
          });

        if (insertError) {
          return new Response(JSON.stringify({ error: insertError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Pedido de venda enviado com sucesso" }), {
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
