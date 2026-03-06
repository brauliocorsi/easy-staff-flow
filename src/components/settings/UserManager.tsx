import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EditUserDialog } from "./EditUserDialog";
import { UserPlus, Loader2, Users, Shield, Link, Unlink, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

export function UserManager() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const queryClient = useQueryClient();
  const [editUser, setEditUser] = useState<{ id: string; display_name: string | null } | null>(null);

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, created_at, employee_id")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;
      return data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["all-employees-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const getRoles = (userId: string) => {
    return roles?.filter((r) => r.user_id === userId).map((r) => r.role) || [];
  };

  const linkedEmployeeIds = new Set(
    profiles?.filter((p) => p.employee_id).map((p) => p.employee_id) || []
  );

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    manager: "Gestor",
    employee: "Funcionário",
  };

  const roleColors: Record<string, string> = {
    admin: "bg-primary/10 text-primary border-primary/20",
    manager: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    employee: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp(email, password, displayName);
      if (error) throw error;
      toast.success("Utilizador criado! Um email de confirmação foi enviado.");
      setEmail("");
      setPassword("");
      setDisplayName("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar utilizador");
    } finally {
      setLoading(false);
    }
  };

  const handleLinkEmployee = async (userId: string, employeeId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ employee_id: employeeId })
      .eq("id", userId);
    if (error) {
      toast.error("Erro ao vincular funcionário");
      return;
    }
    toast.success("Funcionário vinculado com sucesso");
    queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  const handleUnlinkEmployee = async (userId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ employee_id: null })
      .eq("id", userId);
    if (error) {
      toast.error("Erro ao desvincular");
      return;
    }
    toast.success("Funcionário desvinculado");
    queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  const handleSetRole = async (userId: string, role: string) => {
    // Remove existing roles first, then add new one
    await supabase.from("user_roles").delete().eq("user_id", userId);
    if (role !== "none") {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: role as any });
      if (error) {
        toast.error("Erro ao atribuir papel");
        return;
      }
    }
    toast.success("Papel atualizado");
    queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
  };

  const getLinkedEmployeeName = (employeeId: string | null) => {
    if (!employeeId || !employees) return null;
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.first_name} ${emp.last_name}` : null;
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "delete", userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Utilizador removido com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover utilizador");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Registrar Novo Utilizador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="newUserName">Nome</Label>
              <Input
                id="newUserName"
                placeholder="Nome do utilizador"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newUserEmail">Email</Label>
              <Input
                id="newUserEmail"
                type="email"
                placeholder="email@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newUserPassword">Senha</Label>
              <Input
                id="newUserPassword"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Criar Utilizador
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Users className="h-5 w-5" />
            Utilizadores Ativos
            {profiles && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {profiles.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingProfiles ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !profiles?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum utilizador encontrado.</p>
          ) : (
            <div className="space-y-3">
              {profiles.map((profile) => {
                const userRoles = getRoles(profile.id);
                const linkedName = getLinkedEmployeeName(profile.employee_id);
                return (
                  <div
                    key={profile.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          {profile.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-primary">
                              {(profile.display_name || "U").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {profile.display_name || "Sem nome"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Criado {formatDistanceToNow(new Date(profile.created_at), {
                              addSuffix: true,
                              locale: pt,
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {userRoles.length > 0 ? (
                          userRoles.map((role) => (
                            <Badge
                              key={role}
                              variant="outline"
                              className={`text-xs ${roleColors[role] || ""}`}
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              {roleLabels[role] || role}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Sem papel
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditUser({ id: profile.id, display_name: profile.display_name })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover utilizador?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação é irreversível. O utilizador "{profile.display_name || "Sem nome"}" será permanentemente removido do sistema.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDeleteUser(profile.id)}
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1 border-t">
                      {/* Employee linking */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">
                          <Link className="h-3 w-3 inline mr-1" />
                          Funcionário:
                        </Label>
                        {profile.employee_id ? (
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {linkedName || "Vinculado"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleUnlinkEmployee(profile.id)}
                            >
                              <Unlink className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Select
                            onValueChange={(val) => handleLinkEmployee(profile.id, val)}
                          >
                            <SelectTrigger className="h-7 w-[180px] text-xs">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {employees
                                ?.filter((e) => !linkedEmployeeIds.has(e.id))
                                .map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id}>
                                    {emp.first_name} {emp.last_name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Role management */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">
                          <Shield className="h-3 w-3 inline mr-1" />
                          Papel:
                        </Label>
                        <Select
                          value={userRoles[0] || "none"}
                          onValueChange={(val) => handleSetRole(profile.id, val)}
                        >
                          <SelectTrigger className="h-7 w-[140px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem papel</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Gestor</SelectItem>
                            <SelectItem value="employee">Funcionário</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <EditUserDialog
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        user={editUser}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-profiles"] })}
      />
    </div>
  );
}
