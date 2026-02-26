import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMeetingTypes() {
  return useQuery({
    queryKey: ["meeting_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_types" as any)
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string }[];
    },
  });
}

export function useCreateMeetingType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("meeting_types" as any)
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_types"] }),
  });
}
