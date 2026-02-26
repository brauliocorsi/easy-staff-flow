import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduleTemplate {
  id: string;
  name: string;
  tolerance_late_minutes: number;
  tolerance_overtime_minutes: number;
  tolerance_early_leave_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduleTemplateDay {
  id: string;
  template_id: string;
  day_of_week: number;
  clock_in_time: string;
  clock_out_time: string;
  lunch_out_time: string;
  lunch_in_time: string;
  is_day_off: boolean;
}

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export { DAY_NAMES };

export function useScheduleTemplates() {
  return useQuery({
    queryKey: ["schedule_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ScheduleTemplate[];
    },
  });
}

export function useScheduleTemplateDays(templateId: string | undefined) {
  return useQuery({
    queryKey: ["schedule_template_days", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_template_days")
        .select("*")
        .eq("template_id", templateId!)
        .order("day_of_week");
      if (error) throw error;
      return data as ScheduleTemplateDay[];
    },
  });
}

export function useCreateScheduleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, days, tolerance_late_minutes, tolerance_overtime_minutes, tolerance_early_leave_minutes }: { name: string; days: Omit<ScheduleTemplateDay, "id">[]; tolerance_late_minutes: number; tolerance_overtime_minutes: number; tolerance_early_leave_minutes: number }) => {
      const { data: template, error: tErr } = await supabase
        .from("schedule_templates")
        .insert({ name, tolerance_late_minutes, tolerance_overtime_minutes, tolerance_early_leave_minutes })
        .select()
        .single();
      if (tErr) throw tErr;

      if (days.length > 0) {
        const mapped = days.map((d) => ({ ...d, template_id: template.id }));
        const { error: dErr } = await supabase
          .from("schedule_template_days")
          .insert(mapped as any);
        if (dErr) throw dErr;
      }
      return template;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule_templates"] }),
  });
}

export function useUpdateScheduleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, days, tolerance_late_minutes, tolerance_overtime_minutes, tolerance_early_leave_minutes }: { id: string; name: string; days: Omit<ScheduleTemplateDay, "id">[]; tolerance_late_minutes: number; tolerance_overtime_minutes: number; tolerance_early_leave_minutes: number }) => {
      const { error: nErr } = await supabase
        .from("schedule_templates")
        .update({ name, tolerance_late_minutes, tolerance_overtime_minutes, tolerance_early_leave_minutes })
        .eq("id", id);
      if (nErr) throw nErr;

      // Replace days
      const { error: delErr } = await supabase
        .from("schedule_template_days")
        .delete()
        .eq("template_id", id);
      if (delErr) throw delErr;

      if (days.length > 0) {
        const mapped = days.map((d) => ({ ...d, template_id: id }));
        const { error: dErr } = await supabase
          .from("schedule_template_days")
          .insert(mapped as any);
        if (dErr) throw dErr;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["schedule_templates"] });
      qc.invalidateQueries({ queryKey: ["schedule_template_days", vars.id] });
    },
  });
}

export function useDeleteScheduleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("schedule_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule_templates"] }),
  });
}
