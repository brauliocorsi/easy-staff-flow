import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MedicalExamFormDialog } from "@/components/medical/MedicalExamFormDialog";
import { Stethoscope, Plus, Search, CheckCircle, XCircle, AlertTriangle, Upload, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { SignedFileLink } from "@/components/storage/SignedFileLink";

const examTypeMap: Record<string, string> = {
  admission: "Admissão",
  periodic: "Periódico",
  occasional: "Ocasional",
  return: "Regresso",
  dismissal: "Cessação",
};

const resultMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  fit: { label: "Apto", variant: "default" },
  fit_conditional: { label: "Apto Condicionado", variant: "outline" },
  temporarily_unfit: { label: "Inapto Temporário", variant: "secondary" },
  unfit: { label: "Inapto", variant: "destructive" },
};

export default function MedicalExams() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();

  const currentYear = parseInt(yearFilter);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", ""],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, department_id, departments(name), status")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["medical-exams", currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_exams" as any)
        .select("*")
        .eq("year", currentYear)
        .order("exam_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Build map: employee_id -> exam
  const examsByEmployee = useMemo(() => {
    const map: Record<string, any> = {};
    exams.forEach((ex: any) => {
      if (!map[ex.employee_id]) map[ex.employee_id] = ex;
    });
    return map;
  }, [exams]);

  const filteredEmployees = useMemo(() => {
    if (!search) return employees;
    const s = search.toLowerCase();
    return employees.filter(
      (e: any) =>
        e.first_name.toLowerCase().includes(s) ||
        e.last_name.toLowerCase().includes(s)
    );
  }, [employees, search]);

  const totalActive = employees.length;
  const withExam = employees.filter((e: any) => examsByEmployee[e.id]).length;
  const withoutExam = totalActive - withExam;

  const handleUploadFile = async (examId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.jpg,.jpeg,.png";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const path = `medical/${examId}/${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
      if (upErr) {
        toast.error("Erro ao enviar ficheiro");
        return;
      }
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
      const { error } = await supabase.from("medical_exams" as any).update({ file_url: urlData.publicUrl }).eq("id", examId);
      if (error) {
        toast.error("Erro ao guardar");
        return;
      }
      toast.success("Ficheiro anexado");
      qc.invalidateQueries({ queryKey: ["medical-exams"] });
    };
    input.click();
  };

  const handleDelete = async (examId: string) => {
    if (!confirm("Eliminar este registo?")) return;
    const { error } = await supabase.from("medical_exams" as any).delete().eq("id", examId);
    if (error) {
      toast.error("Erro ao eliminar");
      return;
    }
    toast.success("Registo eliminado");
    qc.invalidateQueries({ queryKey: ["medical-exams"] });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Medicina do Trabalho</h1>
            <p className="text-muted-foreground mt-1">Controlo de exames médicos dos funcionários</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" /> Registar Exame
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Stethoscope className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalActive}</p>
                <p className="text-xs text-muted-foreground">Funcionários Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{withExam}</p>
                <p className="text-xs text-muted-foreground">Com Exame em {currentYear}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{withoutExam}</p>
                <p className="text-xs text-muted-foreground">Sem Exame em {currentYear}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar funcionário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3].map((i) => {
                const y = new Date().getFullYear() - i;
                return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="exams">Exames Registados</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Estado {currentYear}</TableHead>
                      <TableHead>Último Exame</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Próximo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((emp: any) => {
                      const exam = examsByEmployee[emp.id];
                      const res = exam ? resultMap[exam.result] || resultMap.fit : null;
                      return (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{emp.first_name} {emp.last_name}</TableCell>
                          <TableCell className="text-muted-foreground">{emp.departments?.name || "—"}</TableCell>
                          <TableCell>
                            {exam ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" /> Realizado
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" /> Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{exam ? format(new Date(exam.exam_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell>{res ? <Badge variant={res.variant}>{res.label}</Badge> : "—"}</TableCell>
                          <TableCell>
                            {exam?.next_exam_date ? format(new Date(exam.next_exam_date + "T00:00:00"), "dd/MM/yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredEmployees.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum funcionário encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exams">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Médico/Clínica</TableHead>
                      <TableHead>Ficheiro</TableHead>
                      {isAdmin && <TableHead className="w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exams.map((ex: any) => {
                      const emp = employees.find((e: any) => e.id === ex.employee_id);
                      const res = resultMap[ex.result] || resultMap.fit;
                      return (
                        <TableRow key={ex.id}>
                          <TableCell className="font-medium">{emp ? `${emp.first_name} ${emp.last_name}` : "—"}</TableCell>
                          <TableCell>{format(new Date(ex.exam_date + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{examTypeMap[ex.exam_type] || ex.exam_type}</TableCell>
                          <TableCell><Badge variant={res.variant}>{res.label}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">
                            {[ex.doctor_name, ex.provider].filter(Boolean).join(" · ") || "—"}
                          </TableCell>
                          <TableCell>
                            {ex.file_url ? (
                              <SignedFileLink bucket="documents" urlOrPath={ex.file_url} className="text-primary hover:underline text-sm">
                                Ver ficheiro
                              </SignedFileLink>
                            ) : isAdmin ? (
                              <Button variant="ghost" size="sm" onClick={() => handleUploadFile(ex.id)}>
                                <Upload className="h-3.5 w-3.5 mr-1" /> Anexar
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(ex.id)} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                    {exams.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                          Nenhum exame registado em {currentYear}.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <MedicalExamFormDialog open={showForm} onClose={() => setShowForm(false)} />
    </AppLayout>
  );
}
