import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Authenticate by PIN
    if (action === "auth") {
      const { pin } = await req.json();
      if (!pin || typeof pin !== "string" || pin.length < 4) {
        return new Response(JSON.stringify({ error: "PIN inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: employee, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, avatar_url")
        .eq("pin_code", pin)
        .eq("status", "active")
        .maybeSingle();

      if (error || !employee) {
        return new Response(JSON.stringify({ error: "PIN não encontrado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ employee }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get vehicles list
    if (action === "vehicles") {
      const { data: vehicles, error } = await supabase
        .from("vehicles")
        .select("id, plate, brand, model, km_current")
        .eq("status", "active")
        .order("plate");

      if (error) throw error;

      return new Response(JSON.stringify({ vehicles }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Submit inspection
    if (action === "submit") {
      const body = await req.json();
      const {
        employee_id, vehicle_id, km, oil_level, brake_pads, brakes,
        water_level, tire_condition, cleanliness, scratches, dents,
        turn_signals, lights, material_return, vest, jack, wheel_wrench,
        observations,
      } = body;

      if (!employee_id || !vehicle_id) {
        return new Response(JSON.stringify({ error: "Dados incompletos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: insertError } = await supabase
        .from("vehicle_inspections")
        .insert({
          employee_id,
          vehicle_id,
          km: km || 0,
          oil_level: oil_level || "ok",
          brake_pads: brake_pads || "ok",
          brakes: brakes || "ok",
          water_level: water_level || "ok",
          tire_condition: tire_condition || "ok",
          cleanliness: cleanliness || "ok",
          scratches: scratches || "none",
          dents: dents || "none",
          turn_signals: turn_signals || "ok",
          lights: lights || "ok",
          material_return: material_return || "ok",
          vest: vest ?? false,
          jack: jack ?? false,
          wheel_wrench: wheel_wrench ?? false,
          observations: observations || null,
        });

      if (insertError) throw insertError;

      // Update vehicle km if provided
      if (km && km > 0) {
        await supabase
          .from("vehicles")
          .update({ km_current: km })
          .eq("id", vehicle_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
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
