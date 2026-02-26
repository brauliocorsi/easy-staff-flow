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
    const { vacation_id } = await req.json();

    if (!vacation_id) {
      return new Response(JSON.stringify({ error: "vacation_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: vacation, error: vacError } = await supabase
      .from("vacation_requests")
      .select("*, employees!vacation_requests_employee_id_fkey(first_name, last_name, email)")
      .eq("id", vacation_id)
      .single();

    if (vacError || !vacation) {
      return new Response(JSON.stringify({ error: "Vacation request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const employee = vacation.employees;
    const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : "Colaborador";

    // Build public link using the project preview URL
    const publicLink = `https://id-preview--5c74799d-8e88-41dc-a444-033e3436fb75.lovable.app/ferias-publica/${vacation.token}`;

    return new Response(JSON.stringify({ 
      success: true, 
      public_link: publicLink,
      employee_name: employeeName,
      employee_email: employee?.email || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
