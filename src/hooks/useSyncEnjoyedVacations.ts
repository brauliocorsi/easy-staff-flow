import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sincroniza férias já gozadas para um determinado ano:
 * 1. Garante que cada funcionário ativo das categorias coletivas (factory/warehouse)
 *    tem um vacation_request aprovado para cada período definido em vacation_settings.
 * 2. Marca explicitamente como `enjoyed=true` todos os registos do ano cujo
 *    end_date < hoje, status != 'rejected' e sem sell_status.
 */
export function useSyncEnjoyedVacations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      let created = 0;
      let marked = 0;

      // --- 1. Garantir registos coletivos para cada funcionário do departamento ---
      const { data: settings } = await supabase
        .from("vacation_settings")
        .select("*")
        .eq("year", year)
        .in("category", ["factory", "warehouse"]);

      if (settings && settings.length > 0) {
        // Buscar departamentos relevantes
        const { data: depts } = await supabase
          .from("departments")
          .select("id, name")
          .in("name", ["Fábrica", "Armazém"]);
        const factoryDeptId = depts?.find((d) => d.name === "Fábrica")?.id;
        const warehouseDeptId = depts?.find((d) => d.name === "Armazém")?.id;

        // Buscar funcionários ativos por departamento
        const { data: emps } = await supabase
          .from("employees")
          .select("id, department_id")
          .eq("status", "active");

        const factoryEmps = (emps || [])
          .filter((e) => e.department_id === factoryDeptId)
          .map((e) => e.id);
        const warehouseEmps = (emps || [])
          .filter((e) => e.department_id === warehouseDeptId)
          .map((e) => e.id);

        // Buscar requests já existentes deste ano nas categorias coletivas
        const { data: existing } = await supabase
          .from("vacation_requests")
          .select("employee_id, start_date, end_date, category")
          .eq("year", year)
          .in("category", ["factory", "warehouse"]);

        const existingSet = new Set(
          (existing || []).map(
            (r) => `${r.employee_id}|${r.category}|${r.start_date}|${r.end_date}`
          )
        );

        const toInsert: any[] = [];
        for (const s of settings) {
          const empIds = s.category === "factory" ? factoryEmps : warehouseEmps;
          for (const empId of empIds) {
            const key = `${empId}|${s.category}|${s.start_date}|${s.end_date}`;
            if (existingSet.has(key)) continue;
            // Calcular dias úteis simples (excluindo fins de semana). Usamos a
            // mesma lógica básica do servidor para consistência mínima.
            const days = countWorkingDaysClient(s.start_date, s.end_date);
            toInsert.push({
              employee_id: empId,
              start_date: s.start_date,
              end_date: s.end_date,
              days_count: days,
              category: s.category,
              year,
              total_entitled_days: 22,
              status: "approved",
              admin_confirmed: true,
              notes: s.label || s.notes || null,
            });
          }
        }

        if (toInsert.length > 0) {
          const { error: insErr } = await supabase
            .from("vacation_requests")
            .insert(toInsert);
          if (insErr) throw insErr;
          created = toInsert.length;
        }
      }

      // --- 2. Marcar como gozadas todas as passadas ---
      const today = new Date().toISOString().slice(0, 10);
      const { data: toMark, error: selErr } = await supabase
        .from("vacation_requests")
        .select("id")
        .eq("year", year)
        .lt("end_date", today)
        .neq("status", "rejected")
        .is("sell_status", null)
        .eq("enjoyed", false);
      if (selErr) throw selErr;

      if (toMark && toMark.length > 0) {
        const ids = toMark.map((r) => r.id);
        const { error: updErr } = await supabase
          .from("vacation_requests")
          .update({ enjoyed: true })
          .in("id", ids);
        if (updErr) throw updErr;
        marked = ids.length;
      }

      return { created, marked };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacation_requests"] });
      qc.invalidateQueries({ queryKey: ["employee_vacations"] });
    },
  });
}

function countWorkingDaysClient(startStr: string, endStr: string): number {
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}