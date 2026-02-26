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

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday
    const dayOfMonth = now.getDate();

    // Get active tasks due today
    const { data: tasks, error: taskErr } = await supabase
      .from("maintenance_tasks")
      .select("*, machines(name, location), employees(first_name, last_name, email)")
      .eq("is_active", true);

    if (taskErr) throw taskErr;

    const dueTasks = (tasks || []).filter((t: any) => {
      if (t.frequency === "daily") return true;
      if (t.frequency === "weekly" && t.day_of_week === dayOfWeek) return true;
      if (t.frequency === "monthly" && t.day_of_month === dayOfMonth) return true;
      return false;
    });

    const sent: string[] = [];

    for (const task of dueTasks) {
      const employee = task.employees;
      const machine = task.machines;
      if (!employee?.email) continue;

      // Check if already completed today
      const today = now.toISOString().slice(0, 10);
      const { data: existing } = await supabase
        .from("maintenance_logs")
        .select("id")
        .eq("task_id", task.id)
        .eq("completed_date", today)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Send reminder email using Resend
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "RH System <noreply@resend.dev>",
            to: [employee.email],
            subject: `Lembrete: Manutenção - ${machine?.name || "Máquina"}`,
            html: `
              <h2>Lembrete de Manutenção</h2>
              <p>Olá ${employee.first_name},</p>
              <p>Tem uma tarefa de manutenção prevista para hoje:</p>
              <ul>
                <li><strong>Tarefa:</strong> ${task.title}</li>
                <li><strong>Máquina:</strong> ${machine?.name || "—"}</li>
                <li><strong>Local:</strong> ${machine?.location || "—"}</li>
              </ul>
              <p>Por favor, aceda ao portal para preencher o formulário de manutenção.</p>
            `,
          }),
        });
      }

      sent.push(`${employee.first_name} ${employee.last_name} - ${task.title}`);
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: sent.length, details: sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
