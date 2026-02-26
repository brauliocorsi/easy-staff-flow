import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Trash2, FileDown, Upload, FileText, Loader2, AlertTriangle,
  MessageSquareWarning, Ban, ShieldAlert
} from "lucide-react";
import { useWarnings, useDeleteWarning, useUpdateWarningFile } from "@/hooks/useWarnings";
import { useEmployees } from "@/hooks/useEmployees";
import { generateWarningPdf } from "@/lib/generateWarningPdf";
import { WarningFormDialog } from "@/components/warnings/WarningFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

const typeConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof AlertTriangle }> = {
  verbal: { label: "Verbal", variant: "outline", icon: MessageSquareWarning },
  written: { label: "Escrita", variant: "default", icon: FileText },
  suspension: { label: "Suspensão", variant: "secondary", icon: Ban },
  termination: { label: "Justa Causa", variant: "destructive", icon: ShieldAlert },
};

export default function Warnings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const filters = {
    employee_id: filterEmployee !== "all" ? filterEmployee : undefined,
    type: filterType !== "all" ? filterType : undefined,
  };

  const { data: warnings, isLoading } = useWarnings(filters);
  const { data: employees } = useEmployees("");
  const deleteMutation = useDeleteWarning();
  const updateFileMutation = useUpdateWarningFile();

  const activeEmployees = employees?.filter((e) => e.status === "active") || [];

  // Summary counts
  const allWarnings = warnings || [];
  const counts = {
    total: allWarnings.length,
    verbal: allWarnings.filter((w) => w.type === "verbal").length,
    written: allWarnings.filter((w) => w.type === "written").length,
    suspension: allWarnings.filter((w) => w.type === "suspension").length,
    termination: allWarnings.filter((w) => w.type === "termination").length,
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success("Advertência removida");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    }
    setDeleteId(null);
  };

  const handleDownloadPdf = (w: any) => {
    const emp = w.employees;
    if (!emp) return;
    generateWarningPdf({
      employeeName: `${emp.first_name} ${emp.last_name}`,
      employeePosition: emp.position,
      employeeDepartment: emp.departments?.name || "",
      type: w.type,
      reason: w.reason,
      description: w.description,
      warningDate: w.warning_date,
    });
  };

  const handleUploadClick = (warningId: string) => {
    setUploadingId(warningId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) return;

    try {
      const path = `warnings/${uploadingId}/${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
      await updateFileMutation.mutateAsync({ id: uploadingId, file_url: urlData.publicUrl });
      toast.success("Documento assinado carregado!");
    } catch (err: any) {
      toast.error(err.message || "Erro no upload");
    }

    setUploadingId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Advertências</h1>
            <p className="text-muted-foreground mt-1">Registre e gerencie advertências disciplinares</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Advertência
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{counts.total}</p>
            </CardContent>
          </Card>
          {Object.entries(typeConfig).map(([key, cfg]) => (
            <Card key={key}>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
                <p className="text-2xl font-bold">{counts[key as keyof typeof counts]}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Funcionário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os funcionários</SelectItem>
              {activeEmployees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(typeConfig).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardHeader><CardTitle className="font-display">Histórico de Advertências</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : !allWarnings.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma advertência registrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allWarnings.map((w: any) => {
                    const cfg = typeConfig[w.type] || typeConfig.verbal;
                    const Icon = cfg.icon;
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(w.warning_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          {w.employees ? `${w.employees.first_name} ${w.employees.last_name}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant} className="gap-1">
                            <Icon className="h-3 w-3" />{cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{w.reason}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {w.type !== "verbal" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => handleDownloadPdf(w)}>
                                    <FileDown className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Baixar PDF</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleUploadClick(w.id)}>
                                  <Upload className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Carregar assinatura</TooltipContent>
                            </Tooltip>
                            {w.file_url && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" asChild>
                                    <a href={w.file_url} target="_blank" rel="noopener noreferrer">
                                      <FileText className="h-4 w-4 text-green-600" />
                                    </a>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver documento assinado</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(w.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />

      <WarningFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover advertência?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
