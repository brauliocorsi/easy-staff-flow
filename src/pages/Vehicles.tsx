import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Car, ShieldCheck, Wrench, AlertTriangle, Upload, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import VehicleFormDialog from "@/components/vehicles/VehicleFormDialog";
import VehicleDocumentFormDialog from "@/components/vehicles/VehicleDocumentFormDialog";
import VehicleMaintenanceFormDialog from "@/components/vehicles/VehicleMaintenanceFormDialog";
import VehicleInspectionsTab from "@/components/vehicles/VehicleInspectionsTab";

const fuelMap: Record<string, string> = { diesel: "Diesel", gasoline: "Gasolina", electric: "Elétrico", hybrid: "Híbrido" };
const statusMap: Record<string, string> = { active: "Ativo", inactive: "Inativo", sold: "Vendido" };
const docTypeMap: Record<string, string> = { insurance: "Seguro", inspection: "Inspeção", other: "Outro" };
const docStatusMap: Record<string, string> = { active: "Ativo", expired: "Expirado", renewed: "Renovado" };
const maintTypeMap: Record<string, string> = { preventive: "Preventiva", corrective: "Corretiva" };
const maintStatusMap: Record<string, string> = { completed: "Concluída", scheduled: "Agendada", cancelled: "Cancelada" };

function expiryBadge(expiryDate: string) {
  const days = differenceInDays(parseISO(expiryDate), new Date());
  if (days < 0) return <Badge variant="destructive">Expirado</Badge>;
  if (days <= 30) return <Badge className="bg-orange-500/90 text-primary-foreground border-0">Vence em {days}d</Badge>;
  return <Badge variant="secondary">OK</Badge>;
}

export default function Vehicles() {
  const qc = useQueryClient();
  const [vehicleDialog, setVehicleDialog] = useState(false);
  const [editVehicle, setEditVehicle] = useState<any>(null);
  const [docDialog, setDocDialog] = useState(false);
  const [maintDialog, setMaintDialog] = useState(false);
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [filterDocType, setFilterDocType] = useState("all");

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles" as any).select("*, employees(first_name, last_name)").order("plate");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, first_name, last_name").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["vehicle_documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_documents" as any).select("*, vehicles(plate, brand, model)").order("expiry_date");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: maintenances = [] } = useQuery({
    queryKey: ["vehicle_maintenances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_maintenances" as any).select("*, vehicles(plate, brand, model), employees(first_name, last_name)").order("maintenance_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const savingV = useState(false);
  const createVehicle = useMutation({
    mutationFn: async (data: any) => {
      const { error } = editVehicle
        ? await supabase.from("vehicles" as any).update(data).eq("id", editVehicle.id)
        : await supabase.from("vehicles" as any).insert(data);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); setVehicleDialog(false); setEditVehicle(null); toast.success("Veículo guardado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("vehicles" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); toast.success("Veículo eliminado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const createDoc = useMutation({
    mutationFn: async (data: any) => { const { error } = await supabase.from("vehicle_documents" as any).insert(data); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_documents"] }); setDocDialog(false); toast.success("Documento guardado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("vehicle_documents" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_documents"] }); toast.success("Documento eliminado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const createMaint = useMutation({
    mutationFn: async (data: any) => { const { error } = await supabase.from("vehicle_maintenances" as any).insert(data); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_maintenances"] }); setMaintDialog(false); toast.success("Manutenção registada!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMaint = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("vehicle_maintenances" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_maintenances"] }); toast.success("Manutenção eliminada!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const insuranceExpiring = docs.filter(d => d.type === "insurance" && differenceInDays(parseISO(d.expiry_date), new Date()) <= 30 && differenceInDays(parseISO(d.expiry_date), new Date()) >= 0).length;
  const inspectionExpiring = docs.filter(d => d.type === "inspection" && differenceInDays(parseISO(d.expiry_date), new Date()) <= 30 && differenceInDays(parseISO(d.expiry_date), new Date()) >= 0).length;

  const filteredDocs = docs.filter(d => {
    if (filterVehicle !== "all" && d.vehicle_id !== filterVehicle) return false;
    if (filterDocType !== "all" && d.type !== filterDocType) return false;
    return true;
  });

  const filteredMaint = maintenances.filter(m => filterVehicle === "all" || m.vehicle_id === filterVehicle);

  const handleFileUpload = async (docId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const path = `vehicles/${docId}/${file.name}`;
      const { error: upErr } = await supabase.storage.from("equipment").upload(path, file, { upsert: true });
      if (upErr) { toast.error(upErr.message); return; }
      const { data: urlData } = supabase.storage.from("equipment").getPublicUrl(path);
      await supabase.from("vehicle_documents" as any).update({ file_url: urlData.publicUrl }).eq("id", docId);
      qc.invalidateQueries({ queryKey: ["vehicle_documents"] });
      toast.success("Ficheiro enviado!");
    };
    input.click();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Veículos</h1>
            <p className="text-muted-foreground">Gestão da frota da empresa</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Veículos</CardTitle><Car className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{vehicles.length}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Seguros a Vencer (30d)</CardTitle><ShieldCheck className="h-4 w-4 text-yellow-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{insuranceExpiring}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Inspeções a Vencer (30d)</CardTitle><AlertTriangle className="h-4 w-4 text-yellow-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{inspectionExpiring}</div></CardContent></Card>
        </div>

        <Tabs defaultValue="vehicles">
          <TabsList>
            <TabsTrigger value="vehicles">Veículos</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="maintenances">Manutenções</TabsTrigger>
            <TabsTrigger value="inspections">Inspeções</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditVehicle(null); setVehicleDialog(true); }}><Plus className="h-4 w-4 mr-1" />Adicionar Veículo</Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Matrícula</TableHead><TableHead>Marca/Modelo</TableHead><TableHead>Ano</TableHead><TableHead>KM</TableHead><TableHead>Combustível</TableHead><TableHead>Responsável</TableHead><TableHead>Estado</TableHead><TableHead>Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {vehicles.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.plate}</TableCell>
                      <TableCell>{v.brand} {v.model}</TableCell>
                      <TableCell>{v.year || "—"}</TableCell>
                      <TableCell>{v.km_current?.toLocaleString() || "—"}</TableCell>
                      <TableCell>{fuelMap[v.fuel_type] || v.fuel_type}</TableCell>
                      <TableCell>{v.employees ? `${v.employees.first_name} ${v.employees.last_name}` : "—"}</TableCell>
                      <TableCell><Badge variant={v.status === "active" ? "default" : "secondary"}>{statusMap[v.status] || v.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditVehicle(v); setVehicleDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Eliminar este veículo?")) deleteVehicle.mutate(v.id); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {vehicles.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum veículo registado</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex gap-2">
                <Select value={filterVehicle} onValueChange={setFilterVehicle}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os veículos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os veículos</SelectItem>
                    {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterDocType} onValueChange={setFilterDocType}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="insurance">Seguro</SelectItem>
                    <SelectItem value="inspection">Inspeção</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setDocDialog(true)}><Plus className="h-4 w-4 mr-1" />Adicionar Documento</Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Veículo</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Seguradora</TableHead><TableHead>Validade</TableHead><TableHead>Alerta</TableHead><TableHead>Custo</TableHead><TableHead>Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredDocs.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.vehicles?.plate}</TableCell>
                      <TableCell>{docTypeMap[d.type] || d.type}</TableCell>
                      <TableCell>{d.description}</TableCell>
                      <TableCell>{d.provider || "—"}</TableCell>
                      <TableCell>{format(parseISO(d.expiry_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{expiryBadge(d.expiry_date)}</TableCell>
                      <TableCell>{d.cost ? `${Number(d.cost).toFixed(2)} €` : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleFileUpload(d.id)}><Upload className="h-4 w-4" /></Button>
                          {d.file_url && <a href={d.file_url} target="_blank" rel="noopener noreferrer"><Button size="icon" variant="ghost"><ShieldCheck className="h-4 w-4" /></Button></a>}
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Eliminar?")) deleteDoc.mutate(d.id); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDocs.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum documento</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="maintenances" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <Select value={filterVehicle} onValueChange={setFilterVehicle}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os veículos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os veículos</SelectItem>
                  {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => setMaintDialog(true)}><Plus className="h-4 w-4 mr-1" />Registar Manutenção</Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Veículo</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Data</TableHead><TableHead>KM</TableHead><TableHead>Custo</TableHead><TableHead>Próx. Manutenção</TableHead><TableHead>Estado</TableHead><TableHead>Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredMaint.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.vehicles?.plate}</TableCell>
                      <TableCell>{maintTypeMap[m.type] || m.type}</TableCell>
                      <TableCell>{m.description}</TableCell>
                      <TableCell>{format(parseISO(m.maintenance_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{m.km_at_maintenance?.toLocaleString() || "—"}</TableCell>
                      <TableCell>{m.cost ? `${Number(m.cost).toFixed(2)} €` : "—"}</TableCell>
                      <TableCell>{m.next_maintenance_date ? format(parseISO(m.next_maintenance_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell><Badge variant={m.status === "completed" ? "default" : "secondary"}>{maintStatusMap[m.status] || m.status}</Badge></TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Eliminar?")) deleteMaint.mutate(m.id); }}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredMaint.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma manutenção</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <VehicleFormDialog open={vehicleDialog} onClose={() => { setVehicleDialog(false); setEditVehicle(null); }} onSave={d => createVehicle.mutate(d)} vehicle={editVehicle} employees={employees} saving={createVehicle.isPending} />
      <VehicleDocumentFormDialog open={docDialog} onClose={() => setDocDialog(false)} onSave={d => createDoc.mutate(d)} vehicles={vehicles} saving={createDoc.isPending} />
      <VehicleMaintenanceFormDialog open={maintDialog} onClose={() => setMaintDialog(false)} onSave={d => createMaint.mutate(d)} vehicles={vehicles} employees={employees} saving={createMaint.isPending} />
    </AppLayout>
  );
}
