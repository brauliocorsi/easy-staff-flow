import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Devolve o conjunto de dias da semana (0=Dom..6=Sáb) considerados
 * trabalhados para um departamento, com base no template de horário
 * mais usado pelos funcionários ativos desse departamento.
 *
 * Se não existir template aplicável, devolve {1,2,3,4,5} (Seg–Sex).
 */
export function useCategoryWorkingDays(deptName: string | null | undefined) {
  return useQuery({
    queryKey: ["category_working_days", deptName],
    enabled: !!deptName,
    queryFn: async (): Promise<number[]> => {
      // 1. Encontrar o departamento
      const { data: depts } = await supabase
        .from("departments")
        .select("id, name")
        .eq("name", deptName!)
        .limit(1);
      const deptId = depts?.[0]?.id;
      if (!deptId) return [1, 2, 3, 4, 5];

      // 2. Funcionários ativos com schedule_template_id
      const { data: emps } = await supabase
        .from("employees")
        .select("schedule_template_id")
        .eq("department_id", deptId)
        .eq("status", "active");

      const tplCounts = new Map<string, number>();
      (emps || []).forEach((e) => {
        if (e.schedule_template_id) {
          tplCounts.set(
            e.schedule_template_id,
            (tplCounts.get(e.schedule_template_id) || 0) + 1
          );
        }
      });

      if (tplCounts.size === 0) return [1, 2, 3, 4, 5];

      // 3. Template mais comum
      const dominantTplId = Array.from(tplCounts.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0][0];

      // 4. Buscar dias do template
      const { data: days } = await supabase
        .from("schedule_template_days")
        .select("day_of_week, is_day_off")
        .eq("template_id", dominantTplId);

      if (!days || days.length === 0) return [1, 2, 3, 4, 5];

      const working = days
        .filter((d) => !d.is_day_off)
        .map((d) => d.day_of_week);
      return working.length > 0 ? working : [1, 2, 3, 4, 5];
    },
    staleTime: 5 * 60 * 1000,
  });
}