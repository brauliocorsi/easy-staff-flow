import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle, XCircle, AlertTriangle, ExternalLink, Copy } from "lucide-react";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";

const statusLabel: Record<string, { label: string; variant: "default" | "destructive" | "secondary" }> = {
  ok: { label: "OK", variant: "default" },
  low: { label: "Baixo", variant: "destructive" },
  worn: { label: "Gasto", variant: "destructive" },
  needs_replacement: { label: "Substituir", variant: "destructive" },
  dirty: { label: "Sujo", variant: "secondary" },
  clean: { label: "Limpo", variant: "default" },
  minor: { label: "Leves", variant: "secondary" },
  major: { label: "Graves", variant: "destructive" },
  none: { label: "Nenhum", variant: "default" },
  missing: { label: "Em falta", variant: "destructive" },
  partial: { label: "Parcial", variant: "secondary" },
  complete: { label: "Completo", variant: "default" },
};

function StatusBadge({ value }: { value: string }) {
  const s = statusLabel[value] || { label: value, variant: "secondary" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function BoolBadge({ value }: { value: boolean }) {
  return value
    ? <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Sim</Badge>
    : <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Não</Badge>;
}

interface Props {
  vehicles: any[];
  filterVehicle: string;
  onFilterChange: (v: string) => void;
}

export default function VehicleInspectionsTab({ vehicles, filterVehicle, onFilterChange }: Props) {
  const [detailInspection, setDetailInspection] = useState<any>(null);

  const { data: inspections = [] } = useQuery({
    queryKey: ["vehicle_inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select("*, vehicles(plate, brand, model), employees(first_name, last_name)")
        .order("inspection_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = inspections.filter(i => filterVehicle === "all" || i.vehicle_id === filterVehicle);

  const checklistItems = [
    { key: "oil_level", label: "Nível de Óleo" },
    { key: "brake_pads", label: "Pastilhas" },
    { key: "brakes", label: "Freios" },
    { key: "water_level", label: "Nível da Água" },
    { key: "tire_condition", label: "Estado dos Pneus" },
    { key: "cleanliness", label: "Limpeza" },
    { key: "scratches", label: "Riscos" },
    { key: "dents", label: "Batidas" },
    { key: "turn_signals", label: "Piscas" },
    { key: "lights", label: "Luzes" },
    { key: "material_return", label: "Retorno de Material" },
  ];

  const boolItems = [
    { key: "vest", label: "Colete" },
    { key: "jack", label: "Macaco" },
    { key: "wheel_wrench", label: "Chave de Rodas" },
  ];

    const publicUrl = `${window.location.origin}/inspecao-veiculo`;

    const copyUrl = () => {
      navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado!");
    };

    return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Select value={filterVehicle} onValueChange={onFilterChange}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os veículos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os veículos</SelectItem>
            {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyUrl}>
            <Copy className="h-4 w-4 mr-1" /> Copiar Link
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Abrir Inspeção
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Funcionário</TableHead>
              <TableHead>KM</TableHead>
              <TableHead>Óleo</TableHead>
              <TableHead>Freios</TableHead>
              <TableHead>Pneus</TableHead>
              <TableHead>Luzes</TableHead>
              <TableHead>Kit Emerg.</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((i: any) => {
              const kitOk = i.vest && i.jack && i.wheel_wrench;
              return (
                <TableRow key={i.id}>
                  <TableCell>{format(parseISO(i.inspection_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="font-medium">{i.vehicles?.plate}</TableCell>
                  <TableCell>{i.employees ? `${i.employees.first_name} ${i.employees.last_name}` : "—"}</TableCell>
                  <TableCell>{i.km?.toLocaleString()}</TableCell>
                  <TableCell><StatusBadge value={i.oil_level} /></TableCell>
                  <TableCell><StatusBadge value={i.brakes} /></TableCell>
                  <TableCell><StatusBadge value={i.tire_condition} /></TableCell>
                  <TableCell><StatusBadge value={i.lights} /></TableCell>
                  <TableCell>
                    {kitOk
                      ? <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Completo</Badge>
                      : <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Incompleto</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setDetailInspection(i)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma inspeção registada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detailInspection} onOpenChange={() => setDetailInspection(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Inspeção — {detailInspection?.vehicles?.plate} ({detailInspection?.inspection_date ? format(parseISO(detailInspection.inspection_date), "dd/MM/yyyy") : ""})
            </DialogTitle>
          </DialogHeader>
          {detailInspection && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Funcionário</div>
                <div>{detailInspection.employees ? `${detailInspection.employees.first_name} ${detailInspection.employees.last_name}` : "—"}</div>
                <div className="text-muted-foreground">KM</div>
                <div className="font-medium">{detailInspection.km?.toLocaleString()}</div>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checklistItems.map(ci => (
                      <TableRow key={ci.key}>
                        <TableCell className="text-muted-foreground">{ci.label}</TableCell>
                        <TableCell><StatusBadge value={detailInspection[ci.key]} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h4 className="font-medium mb-2">Kit de Emergência</h4>
                <div className="flex gap-3 flex-wrap">
                  {boolItems.map(bi => (
                    <div key={bi.key} className="flex items-center gap-1.5 text-sm">
                      <span className="text-muted-foreground">{bi.label}:</span>
                      <BoolBadge value={detailInspection[bi.key]} />
                    </div>
                  ))}
                </div>
              </div>

              {detailInspection.observations && (
                <div>
                  <h4 className="font-medium mb-1">Observações</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailInspection.observations}</p>
                </div>
              )}

              {detailInspection.photos && detailInspection.photos.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Fotos ({detailInspection.photos.length})</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {detailInspection.photos.map((url: string, idx: number) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity">
                        <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-32 object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
