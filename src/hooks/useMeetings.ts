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
        .select("*, departments(name), meeting_participants(id, employee_id, employees(first_name, last_name, position, email)), created_by_employee:employees!meetings_created_by_fkey(first_name, last_name)")
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
        .select("*, responsible_employee:employees!meeting_agendas_responsible_employee_id_fkey(id, first_name, last_name)")
        .eq("meeting_id", meetingId!)
        .order("sort_order");
      if (error) throw error;

      // Fetch multiple responsibles from junction table
      const agendaIds = data.map((a) => a.id);
      let responsiblesMap: Record<string, { id: string; employee_id: string; employees: { id: string; first_name: string; last_name: string } | null }[]> = {};
      if (agendaIds.length > 0) {
        const { data: resps } = await supabase
          .from("meeting_agenda_responsibles" as any)
          .select("id, agenda_id, employee_id, employees(id, first_name, last_name)")
          .in("agenda_id", agendaIds);
        if (resps) {
          for (const r of resps as any[]) {
            if (!responsiblesMap[r.agenda_id]) responsiblesMap[r.agenda_id] = [];
            responsiblesMap[r.agenda_id].push(r);
          }
        }
      }

      return data.map((a) => ({
        ...a,
        responsibles: responsiblesMap[a.id] ?? [],
      }));
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
      // Get current user's employee ID for created_by
      const { data: { user } } = await supabase.auth.getUser();
      let createdBy = meeting.created_by;
      if (user && !createdBy) {
        const { data: empData } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (empData) createdBy = empData.id;
      }

      const { data, error } = await supabase
        .from("meetings")
        .insert({ ...meeting, created_by: createdBy })
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

export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      meeting,
      participantIds,
    }: {
      id: string;
      meeting: Partial<Tables<"meetings">> & { end_time?: string | null };
      participantIds: string[];
    }) => {
      const { data, error } = await supabase
        .from("meetings")
        .update(meeting)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // Replace participants: delete existing, insert new
      const { error: delErr } = await supabase
        .from("meeting_participants")
        .delete()
        .eq("meeting_id", id);
      if (delErr) throw delErr;

      if (participantIds.length > 0) {
        const participants = participantIds.map((employee_id) => ({
          meeting_id: id,
          employee_id,
        }));
        const { error: pError } = await supabase
          .from("meeting_participants")
          .insert(participants);
        if (pError) throw pError;
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["meeting"] });
    },
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
      responsibleEmployeeIds,
      ...updates
    }: Partial<MeetingAgenda> & { id: string; responsibleEmployeeIds?: string[] }) => {
      const { data, error } = await supabase
        .from("meeting_agendas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // Update junction table if responsibleEmployeeIds provided
      if (responsibleEmployeeIds !== undefined) {
        // Delete existing
        await supabase
          .from("meeting_agenda_responsibles" as any)
          .delete()
          .eq("agenda_id", id);
        // Insert new
        if (responsibleEmployeeIds.length > 0) {
          await supabase
            .from("meeting_agenda_responsibles" as any)
            .insert(responsibleEmployeeIds.map((eid) => ({ agenda_id: id, employee_id: eid })));
        }
      }

      return data;
    },
    onSuccess: (data) =>
      qc.invalidateQueries({ queryKey: ["meeting_agendas", data.meeting_id] }),
  });
}

export function useStartMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("meetings")
        .update({ status: "in_progress", started_at: now })
        .eq("id", meetingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["meeting"] });
    },
  });
}

export function usePauseMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("meetings")
        .update({ paused_at: now })
        .eq("id", meetingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["meeting"] });
    },
  });
}

export function useResumeMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId, pausedAt, currentPausedSeconds }: { meetingId: string; pausedAt: string; currentPausedSeconds: number }) => {
      const additionalSeconds = Math.floor((Date.now() - new Date(pausedAt).getTime()) / 1000);
      const { error } = await supabase
        .from("meetings")
        .update({
          paused_at: null,
          paused_seconds: currentPausedSeconds + additionalSeconds,
        })
        .eq("id", meetingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["meeting"] });
    },
  });
}

export function useToggleParticipantPresence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ participantId, present }: { participantId: string; present: boolean }) => {
      const { error } = await supabase
        .from("meeting_participants")
        .update({ present })
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting"] });
    },
  });
}

export function useFinalizeMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      // Update status and save end time
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("meetings")
        .update({ status: "completed", end_time: now })
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
