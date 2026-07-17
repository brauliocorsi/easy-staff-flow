import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem } from "@/hooks/useMural";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  taskId: string;
  items: Tables<"mural_checklist_items">[];
}

export function TaskChecklist({ taskId, items }: Props) {
  const [text, setText] = useState("");
  const add = useAddChecklistItem();
  const update = useUpdateChecklistItem();
  const del = useDeleteChecklistItem();
  const sorted = [...items].sort((a, b) => a.order_index - b.order_index);
  const done = sorted.filter((i) => i.done).length;

  const handleAdd = () => {
    if (!text.trim()) return;
    add.mutate({ task_id: taskId, text: text.trim(), order_index: sorted.length });
    setText("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Checklist</span>
        <span className="text-muted-foreground text-xs">{done}/{sorted.length}</span>
      </div>
      <div className="space-y-1">
        {sorted.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <Checkbox
              checked={item.done}
              onCheckedChange={(v) => update.mutate({ id: item.id, done: !!v })}
            />
            <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>
              {item.text}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => del.mutate(item.id)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Adicionar item…"
          className="h-8 text-sm"
        />
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}