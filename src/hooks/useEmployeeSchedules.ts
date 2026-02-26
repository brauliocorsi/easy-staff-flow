import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export { DAY_NAMES };

export interface EmployeeSchedule {
  id: string;
  employee_id: string;
  day_of_week: number;
  clock_in_time: string;
  clock_out_time: string;
  lunch_out_time: string;
  lunch_in_time: string;
  is_day_off: boolean;
}

export function useEmployeeSchedules(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["employee_schedules", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_schedules")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("day_of_week");
      if (error) throw error;
      return data as EmployeeSchedule[];
    },
  });
}

export function useSaveSchedules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, schedules }: { employeeId: string; schedules: Omit<EmployeeSchedule, "id">[] }) => {
      // Delete existing and insert new
      const { error: delErr } = await supabase
        .from("employee_schedules")
        .delete()
        .eq("employee_id", employeeId);
      if (delErr) throw delErr;

      if (schedules.length > 0) {
        const { error } = await supabase
          .from("employee_schedules")
          .insert(schedules as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["employee_schedules", vars.employeeId] }),
  });
}
