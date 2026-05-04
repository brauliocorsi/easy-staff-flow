import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Holiday } from "@/hooks/useHolidays";

export function HolidayManager() {
  const qc = useQueryClient();
  const [holidayDate, setHolidayDate] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [recurring, setRecurring] = useState(true);

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ["holidays-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .order("holiday_date", { ascending: true });
      if (error) throw error;
      return data as Holiday[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("holidays").insert({
        holiday_date: holidayDate,
        name: name.trim(),
        description: description.trim() || null,
        recurring_yearly: recurring,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Feriado adicionado!");
      qc.invalidateQueries({ queryKey: ["holidays-admin"] });
      qc.invalidateQueries({ queryKey: ["holidays"] });
      setHolidayDate("");
      setName("");
      setDescription("");
      setRecurring(true);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar feriado"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Feriado removido!");
      qc.invalidateQueries({ queryKey: ["holidays-admin"] });
      qc.invalidateQueries({ queryKey: ["holidays"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !name.trim()) {
      toast.error("Data e nome são obrigatórios");
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Adicionar Feriado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="holiday_date">Data *</Label>
              <Input
                id="holiday_date"
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday_name">Nome *</Label>
              <Input
                id="holiday_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Sexta-feira Santa"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="holiday_description">Descrição (opcional)</Label>
              <Input
                id="holiday_description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notas adicionais"
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Checkbox
                id="recurring"
                checked={recurring}
                onCheckedChange={(c) => setRecurring(c === true)}
              />
              <Label htmlFor="recurring" className="cursor-pointer">
                Repetir todos os anos (mesmo dia/mês)
              </Label>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Feriado
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Feriados Registados ({holidays.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar...</p>
          ) : holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum feriado registado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono">
                      {h.recurring_yearly
                        ? format(parseISO(h.holiday_date), "dd 'de' MMMM", { locale: pt })
                        : format(parseISO(h.holiday_date), "dd/MM/yyyy", { locale: pt })}
                    </TableCell>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{h.description || "—"}</TableCell>
                    <TableCell>
                      {h.recurring_yearly ? (
                        <Badge variant="secondary">Anual</Badge>
                      ) : (
                        <Badge variant="outline">Único</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover feriado?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{h.name}" será removido. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(h.id)}>
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
