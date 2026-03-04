import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  GraduationCap, Plus, Loader2, Search, FileDown, Upload,
  Clock, CheckCircle, Building2, Globe, Trash2, Pencil
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import TrainingFormDialog from "@/components/trainings/TrainingFormDialog";
import { generateTrainingPdf } from "@/lib/generateTrainingPdf";

const ANNUAL_REQUIRED_HOURS = 40;

const typeMap: Record<string, { label: string; icon: typeof Building2 }> = {
  internal: { label: "Interna", icon: Building2 },
  external: { label: "Externa", icon: Globe },
};

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  registered: { label: "Registada", variant: "outline" },
  signed: { label: "Assinada", variant: "default" },
};

export default function Trainings() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [formOpen, setFormOpen] = useState(false);
  const [editTraining, setEditTraining] = useState<any>(null);

  const { data: trainings, isLoading } = useQuery({
    queryKey: ["trainings", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_trainings")
        .select("*, employee:employee_id(id, first_name, last_name, avatar_url, position, departments(name))")
        .eq("year", parseInt(year))
        .order("training_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Stats per employee
  const employeeStats = useMemo(() => {
    if (!trainings) return [];
    const map = new Map<string, { employee: any; totalHours: number; count: number }>();
    trainings.forEach((t: any) => {
      const empId = t.employee_id;
      if (!map.has(empId)) {
        map.set(empId, { employee: t.employee, totalHours: 0, count: 0 });
      }
      const entry = map.get(empId)!;
      entry.totalHours += Number(t.hours);
      entry.count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [trainings]);

  const totalHours = trainings?.reduce((s: number, t: any) => s + Number(t.hours), 0) || 0;
  const totalTrainings = trainings?.length || 0;
  const internalCount = trainings?.filter((t: any) => t.type === "internal").length || 0;
  const externalCount = trainings?.filter((t: any) => t.type === "external").length || 0;

  const filtered = trainings?.filter((t: any) => {
    const matchTab = tab === "all" || t.type === tab;
    const matchSearch = !search || 
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      `${t.employee?.first_name} ${t.employee?.last_name}`.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  }) || [];

  const handleDelete = async (id: string) => {
    if (!confirm("Tem a certeza que deseja eliminar esta formação?")) return;
    const { error } = await supabase.from("employee_trainings").delete().eq("id", id);
    if (error) { toast.error("Erro ao eliminar"); return; }
    toast.success("Formação eliminada");
    qc.invalidateQueries({ queryKey: ["trainings"] });
  };

  const handlePdf = (t: any) => {
    generateTrainingPdf({
      employeeName: `${t.employee?.first_name} ${t.employee?.last_name}`,
      employeePosition: t.employee?.position || "",
      employeeDepartment: (t.employee as any)?.departments?.name || "",
      title: t.title,
      description: t.description,
      trainingDate: t.training_date,
      hours: Number(t.hours),
      type: t.type,
      trainerName: t.trainer_name,
      location: t.location,
    });
  };

  const handleUploadSigned = async (trainingId: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `signed/${trainingId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("trainings").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Erro ao enviar ficheiro"); return; }
    const { data: { publicUrl } } = supabase.storage.from("trainings").getPublicUrl(path);
    const { error } = await supabase
      .from("employee_trainings")
      .update({ signed_file_url: publicUrl, status: "signed" } as any)
      .eq("id", trainingId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Documento assinado anexado");
    qc.invalidateQueries({ queryKey: ["trainings"] });
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <GraduationCap className="h-6 w-6" />
              Formações
            </h1>
            <p className="text-muted-foreground mt-1">Registo e acompanhamento de formações contínuas.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditTraining(null); setFormOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Registar Formação
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalTrainings}</p>
                <p className="text-xs text-muted-foreground">Total Formações</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalHours}h</p>
                <p className="text-xs text-muted-foreground">Horas Registadas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{internalCount}</p>
                <p className="text-xs text-muted-foreground">Internas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{externalCount}</p>
                <p className="text-xs text-muted-foreground">Externas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employee Hours Progress */}
        {employeeStats.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Horas por Funcionário — Obrigatório: {ANNUAL_REQUIRED_HOURS}h/ano</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {employeeStats.map(({ employee, totalHours, count }) => {
                  const pct = Math.min((totalHours / ANNUAL_REQUIRED_HOURS) * 100, 100);
                  const remaining = Math.max(ANNUAL_REQUIRED_HOURS - totalHours, 0);
                  const initials = employee ? `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase() : "??";
                  return (
                    <div key={employee?.id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={employee?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{employee?.first_name} {employee?.last_name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {totalHours}h / {ANNUAL_REQUIRED_HOURS}h
                            {remaining > 0 && <span className="text-destructive ml-1">({remaining}h restantes)</span>}
                            {remaining === 0 && <span className="text-green-600 ml-1">✓ Completo</span>}
                          </span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search & Tabs */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar..." className="pl-9" />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">Todas ({totalTrainings})</TabsTrigger>
            <TabsTrigger value="internal">Internas ({internalCount})</TabsTrigger>
            <TabsTrigger value="external">Externas ({externalCount})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Nenhuma formação encontrada.</p>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Formação</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Horas</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Formador</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((t: any) => {
                        const emp = t.employee;
                        const initials = emp ? `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase() : "??";
                        const tType = typeMap[t.type] || typeMap.internal;
                        const st = statusMap[t.status] || statusMap.registered;
                        return (
                          <TableRow key={t.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={emp?.avatar_url || undefined} />
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">{emp?.first_name} {emp?.last_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{t.title}</TableCell>
                            <TableCell className="text-sm">{format(new Date(t.training_date + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="text-sm font-medium">{t.hours}h</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs gap-1">
                                <tType.icon className="h-3 w-3" />
                                {tType.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{t.trainer_name || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={st.variant} className="text-xs">
                                {t.status === "signed" && <CheckCircle className="h-3 w-3 mr-1" />}
                                {st.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => { setEditTraining(t); setFormOpen(true); }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Imprimir PDF" onClick={() => handlePdf(t)}>
                                  <FileDown className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Anexar assinado" asChild>
                                  <label>
                                    <Upload className="h-3.5 w-3.5" />
                                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                                      onChange={(e) => { if (e.target.files?.[0]) handleUploadSigned(t.id, e.target.files[0]); }} />
                                  </label>
                                </Button>
                                {t.signed_file_url && (
                                  <a href={t.signed_file_url} target="_blank" rel="noopener noreferrer">
                                    <Badge variant="default" className="text-xs cursor-pointer">Ver</Badge>
                                  </a>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <TrainingFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTraining(null); }}
        training={editTraining}
      />
    </AppLayout>
  );
}
