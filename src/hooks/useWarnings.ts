import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Warning = Tables<"warnings">;
export type WarningInsert = TablesInsert<"warnings">;

export function useWarnings(filters?: { employee_id?: string; type?: string }) {
  return useQuery({
    queryKey: ["warnings", filters],
    queryFn: async () => {
      let query = supabase
        .from("warnings")
        .select("*, employees(first_name, last_name, position, email, departments(name))")
        .order("warning_date", { ascending: false });

      if (filters?.employee_id) query = query.eq("employee_id", filters.employee_id);
      if (filters?.type) query = query.eq("type", filters.type);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateWarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (warning: WarningInsert) => {
      const { data, error } = await supabase
        .from("warnings")
        .insert(warning)
        .select("*, employees(first_name, last_name, position, email, departments(name))")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warnings"] });
      qc.invalidateQueries({ queryKey: ["warning-counts"] });
    },
  });
}

export function useDeleteWarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warnings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warnings"] });
      qc.invalidateQueries({ queryKey: ["warning-counts"] });
    },
  });
}

export function useUpdateWarningFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file_url }: { id: string; file_url: string }) => {
      const { error } = await supabase
        .from("warnings")
        .update({ file_url })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["warnings"] }),
  });
}
