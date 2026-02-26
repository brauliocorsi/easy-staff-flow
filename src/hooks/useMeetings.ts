import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Meeting = Tables<"meetings"> & { end_time?: string | null };
export type MeetingAgenda = Tables<"meeting_agendas">;
export type MeetingParticipant = Tables<"meeting_participants">;

export function useMeetings() {
  return useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, departments(name), meeting_participants(id, employee_id, employees(first_name, last_name, position, email))")
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: ["meeting", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, departments(name), meeting_participants(id, employee_id, employees(first_name, last_name, position, email))")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useMeetingAgendas(meetingId: string | undefined) {
  return useQuery({
    queryKey: ["meeting_agendas", meetingId],
    enabled: !!meetingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_agendas")
        .select("*")
        .eq("meeting_id", meetingId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      meeting,
      participantIds,
    }: {
      meeting: TablesInsert<"meetings"> & { end_time?: string };
      participantIds: string[];
    }) => {
      const { data, error } = await supabase
        .from("meetings")
        .insert(meeting)
        .select()
        .single();
      if (error) throw error;

      if (participantIds.length > 0) {
        const participants = participantIds.map((employee_id) => ({
          meeting_id: data.id,
          employee_id,
        }));
        const { error: pError } = await supabase
          .from("meeting_participants")
          .insert(participants);
        if (pError) throw pError;
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

export function useAddAgenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agenda: TablesInsert<"meeting_agendas">) => {
      const { data, error } = await supabase
        .from("meeting_agendas")
        .insert(agenda)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ["meeting_agendas", vars.meeting_id] }),
  });
}

export function useUpdateAgenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<MeetingAgenda> & { id: string }) => {
      const { data, error } = await supabase
        .from("meeting_agendas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) =>
      qc.invalidateQueries({ queryKey: ["meeting_agendas", data.meeting_id] }),
  });
}

export function useFinalizeMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      // Update status
      const { error } = await supabase
        .from("meetings")
        .update({ status: "completed" })
        .eq("id", meetingId);
      if (error) throw error;

      // Call edge function to send minutes
      const { error: fnError } = await supabase.functions.invoke(
        "send-meeting-minutes",
        { body: { meeting_id: meetingId } }
      );
      if (fnError) throw fnError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["meeting"] });
    },
  });
}
