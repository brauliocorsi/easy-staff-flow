import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VacationRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: string;
  notes: string | null;
  approved_by: string | null;
  category: string;
  year: number;
  total_entitled_days: number;
  employee_confirmed: boolean;
  admin_confirmed: boolean;
  token: string;
  enjoyed: boolean;
  created_at: string;
  updated_at: string;
  employees?: {
    first_name: string;
    last_name: string;
    email: string;
    position: string;
  };
}

export interface VacationSettings {
  id: string;
  year: number;
  category: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
}

export function useVacationRequests(year: number) {
  return useQuery({
    queryKey: ["vacation_requests", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("*, employees!vacation_requests_employee_id_fkey(first_name, last_name, email, position)")
        .eq("year", year)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as VacationRequest[];
    },
  });
}

export function useEmployeeVacations(employeeId: string, year?: number) {
  const currentYear = year || new Date().getFullYear();
  return useQuery({
    queryKey: ["employee_vacations", employeeId, currentYear],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("year", currentYear)
        .order("start_date");
      if (error) throw error;
      return data as unknown as VacationRequest[];
    },
  });
}

export function useVacationSettings(year: number) {
  return useQuery({
    queryKey: ["vacation_settings", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_settings")
        .select("*")
        .eq("year", year);
      if (error) throw error;
      return data as VacationSettings[];
    },
  });
}

export function useCreateVacationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: string;
      start_date: string;
      end_date: string;
      days_count: number;
      category: string;
      year: number;
      total_entitled_days?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vacation_requests"] }),
  });
}

export function useCreateBulkVacationRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payloads: {
      employee_id: string;
      start_date: string;
      end_date: string;
      days_count: number;
      category: string;
      year: number;
      total_entitled_days?: number;
      notes?: string;
    }[]) => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .insert(payloads)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacation_requests"] });
      qc.invalidateQueries({ queryKey: ["employee_vacations"] });
    },
  });
}

export function useUpdateVacationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from("vacation_requests")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacation_requests"] });
      qc.invalidateQueries({ queryKey: ["employee_vacations"] });
    },
  });
}

export function useDeleteVacationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vacation_requests")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacation_requests"] });
      qc.invalidateQueries({ queryKey: ["employee_vacations"] });
    },
  });
}

export function useUpsertVacationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      year: number;
      category: string;
      start_date: string;
      end_date: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("vacation_settings")
        .upsert(payload, { onConflict: "year,category" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vacation_settings"] }),
  });
}

export function useSendVacationEmail() {
  return useMutation({
    mutationFn: async (vacationId: string) => {
      const { data, error } = await supabase.functions.invoke("send-vacation-email", {
        body: { vacation_id: vacationId },
      });
      if (error) throw error;
      return data;
    },
  });
}
