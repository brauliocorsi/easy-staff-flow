import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type MuralProject = Tables<"mural_projects">;
export type MuralTask = Tables<"mural_tasks"> & {
  assignees: { user_id: string }[];
  checklist: Tables<"mural_checklist_items">[];
  comments_count?: number;
};

export function useMuralProjects() {
  return useQuery({
    queryKey: ["mural-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mural_projects")
        .select("*")
        .order("archived", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMuralTasks(projectId?: string | null) {
  return useQuery({
    queryKey: ["mural-tasks", projectId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("mural_tasks")
        .select("*, assignees:mural_task_assignees(user_id), checklist:mural_checklist_items(*)")
        .order("order_index");
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MuralTask[];
    },
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["mural-admin-users"],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (rolesErr) throw rolesErr;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [] as { id: string; display_name: string | null }[];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      if (pErr) throw pErr;
      return profiles ?? [];
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<TablesInsert<"mural_projects">, "created_by">) => {
      const { data, error } = await supabase
        .from("mural_projects")
        .insert({ ...input, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mural-projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MuralProject> & { id: string }) => {
      const { error } = await supabase.from("mural_projects").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mural-projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mural_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mural-projects"] });
      qc.invalidateQueries({ queryKey: ["mural-tasks"] });
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: TablesInsert<"mural_tasks"> & { assignee_ids?: string[] }) => {
      const { assignee_ids, ...taskData } = input;
      const { data, error } = await supabase
        .from("mural_tasks")
        .insert({ ...taskData, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      if (assignee_ids?.length) {
        const rows = assignee_ids.map((uid) => ({ task_id: data.id, user_id: uid }));
        const { error: aErr } = await supabase.from("mural_task_assignees").insert(rows);
        if (aErr) throw aErr;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mural-tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assignee_ids, ...updates }: Partial<Tables<"mural_tasks">> & { id: string; assignee_ids?: string[] }) => {
      if (updates.status === "done" && !updates.completed_at) {
        (updates as Record<string, unknown>).completed_at = new Date().toISOString();
      }
      if (updates.status && updates.status !== "done") {
        (updates as Record<string, unknown>).completed_at = null;
      }
      const { error } = await supabase.from("mural_tasks").update(updates).eq("id", id);
      if (error) throw error;
      if (assignee_ids) {
        await supabase.from("mural_task_assignees").delete().eq("task_id", id);
        if (assignee_ids.length) {
          const rows = assignee_ids.map((uid) => ({ task_id: id, user_id: uid }));
          const { error: aErr } = await supabase.from("mural_task_assignees").insert(rows);
          if (aErr) throw aErr;
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mural-tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mural_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mural-tasks"] }),
  });
}

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ["mural-comments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mural_comments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ task_id, body }: { task_id: string; body: string }) => {
      const { error } = await supabase
        .from("mural_comments")
        .insert({ task_id, body, author_id: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["mural-comments", v.task_id] }),
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ task_id, text, order_index }: { task_id: string; text: string; order_index: number }) => {
      const { error } = await supabase.from("mural_checklist_items").insert({ task_id, text, order_index });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mural-tasks"] }),
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; text?: string; done?: boolean }) => {
      const { error } = await supabase.from("mural_checklist_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mural-tasks"] }),
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mural_checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mural-tasks"] }),
  });
}