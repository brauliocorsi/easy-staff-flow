import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function DepartmentManager() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const { data: departments, isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Nome obrigatório");
      const { error } = await supabase
        .from("departments")
        .insert({ name: newName.trim(), description: newDesc.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setNewName("");
      setNewDesc("");
      toast.success("Departamento criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description: string }) => {
      if (!name.trim()) throw new Error("Nome obrigatório");
      const { error } = await supabase
        .from("departments")
        .update({ name: name.trim(), description: description.trim() || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setEditId(null);
      toast.success("Departamento atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Departamento removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = (dept: any) => {
    setEditId(dept.id);
    setEditName(dept.name);
    setEditDesc(dept.description || "");
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Eliminar o departamento "${name}"? Funcionários associados ficarão sem departamento.`)) {
      deleteMut.mutate(id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Departamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new */}
        <div className="flex gap-2">
          <Input
            placeholder="Nome do departamento"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Descrição (opcional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => createMut.mutate()}
            disabled={!newName.trim() || createMut.isPending}
          >
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Adicionar
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
        ) : !departments?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum departamento criado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((dept) =>
                editId === dept.id ? (
                  <TableRow key={dept.id}>
                    <TableCell>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateMut.mutate({ id: dept.id, name: editName, description: editDesc })}
                          disabled={updateMut.isPending}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{dept.description || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(dept)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(dept.id, dept.name)}
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
