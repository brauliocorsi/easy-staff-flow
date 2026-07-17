import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTaskComments, useAddComment } from "@/hooks/useMural";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

interface Props { taskId: string; }

export function TaskComments({ taskId }: Props) {
  const [body, setBody] = useState("");
  const { data: comments = [] } = useTaskComments(taskId);
  const add = useAddComment();

  const authorIds = Array.from(new Set(comments.map((c) => c.author_id).filter(Boolean))) as string[];
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-comments", authorIds.join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name").in("id", authorIds);
      if (error) throw error;
      return data;
    },
  });
  const nameOf = (id: string | null) => profiles.find((p) => p.id === id)?.display_name || "Utilizador";

  const submit = async () => {
    if (!body.trim()) return;
    await add.mutateAsync({ task_id: taskId, body: body.trim() });
    setBody("");
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Comentários & sugestões</div>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {comments.length === 0 && <p className="text-xs text-muted-foreground">Sem comentários ainda.</p>}
        {comments.map((c) => (
          <div key={c.id} className="rounded-md border bg-muted/30 p-2 text-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-medium text-foreground">{nameOf(c.author_id)}</span>
              <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: pt })}</span>
            </div>
            <p className="whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreve um comentário ou sugestão…" rows={2} />
        <Button size="sm" onClick={submit} disabled={!body.trim() || add.isPending}>Publicar</Button>
      </div>
    </div>
  );
}