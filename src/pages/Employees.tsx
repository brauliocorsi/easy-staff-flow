import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, Loader2 } from "lucide-react";
import { useEmployees, useDeleteEmployee, type Employee } from "@/hooks/useEmployees";
import { EmployeeFormDialog } from "@/components/employees/EmployeeFormDialog";
import { toast } from "sonner";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  inactive: { label: "Inativo", variant: "secondary" },
  on_leave: { label: "Afastado", variant: "outline" },
};

export default function Employees() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const { data: employees, isLoading, error } = useEmployees(search);
  const deleteMutation = useDeleteEmployee();

  const handleEdit = (emp: Employee) => {
    setEditing(emp);
    setDialogOpen(true);
  };

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Remover ${emp.first_name} ${emp.last_name}?`)) return;
    try {
      await deleteMutation.mutateAsync(emp.id);
      toast.success("Funcionário removido");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Funcionários</h1>
            <p className="text-muted-foreground mt-1">Gerencie os funcionários da empresa</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Funcionário
          </Button>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar funcionário..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Lista de Funcionários</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">Erro ao carregar funcionários. Verifique se você está logado.</p>
            ) : !employees?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => {
                    const initials = `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase();
                    const st = statusMap[emp.status] || statusMap.active;
                    return (
                      <TableRow key={emp.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={emp.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{emp.position}</TableCell>
                        <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(emp)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(emp)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <EmployeeFormDialog
        key={editing?.id || "new"}
        open={dialogOpen}
        onClose={handleClose}
        employee={editing}
      />
    </AppLayout>
  );
}
