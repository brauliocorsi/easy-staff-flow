import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

interface AgendaInputProps {
  onAdd: (title: string, description: string) => void;
  loading?: boolean;
}

export function AgendaInput({ onAdd, loading }: AgendaInputProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), description.trim());
    setTitle("");
    setDescription("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Input
        placeholder="Título da pauta..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea
        placeholder="Descrição (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <Button type="submit" disabled={!title.trim() || loading} size="sm">
        <Plus className="h-4 w-4 mr-1" /> Adicionar Pauta
      </Button>
    </form>
  );
}
