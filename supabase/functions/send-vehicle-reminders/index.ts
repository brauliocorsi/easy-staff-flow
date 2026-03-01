import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const today = new Date();
    const reminders: string[] = [];

    // Check vehicle documents expiring soon
    const { data: docs } = await supabase
      .from("vehicle_documents")
      .select("*, vehicles(plate, brand, model, assigned_employee_id, employees(email, first_name))")
      .eq("status", "active");

    for (const doc of docs || []) {
      const expiry = new Date(doc.expiry_date);
      const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= doc.reminder_days && daysUntil >= 0) {
        const typeLabel = doc.type === "insurance" ? "Seguro" : doc.type === "inspection" ? "Inspeção" : "Documento";
        reminders.push(`${typeLabel} do veículo ${doc.vehicles?.plate} vence em ${daysUntil} dias (${doc.expiry_date})`);
      }
    }

    // Check upcoming maintenances
    const { data: maints } = await supabase
      .from("vehicle_maintenances")
      .select("*, vehicles(plate)")
      .eq("status", "scheduled")
      .not("next_maintenance_date", "is", null);

    for (const m of maints || []) {
      const nextDate = new Date(m.next_maintenance_date);
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7 && daysUntil >= 0) {
        reminders.push(`Manutenção agendada para ${m.vehicles?.plate}: ${m.description} em ${daysUntil} dias`);
      }
    }

    if (reminders.length > 0) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        // Get admin emails
        const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
        const adminIds = (adminRoles || []).map(r => r.user_id);
        
        if (adminIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", adminIds);
          // For simplicity send to first admin via auth
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const adminEmails = users?.filter(u => adminIds.includes(u.id)).map(u => u.email).filter(Boolean) || [];
          
          if (adminEmails.length > 0) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "RH System <onboarding@resend.dev>",
                to: adminEmails,
                subject: `🚗 Alertas de Veículos - ${reminders.length} aviso(s)`,
                html: `<h2>Alertas de Veículos</h2><ul>${reminders.map(r => `<li>${r}</li>`).join("")}</ul>`,
              }),
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, reminders }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
