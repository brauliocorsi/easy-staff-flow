import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface RecordData {
  id?: string;
  employee_id: string;
  record_date: string;
  clock_in: string | null;
  lunch_out: string | null;
  lunch_in: string | null;
  clock_out: string | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  record?: RecordData | null;
  date?: string;
}

function tsToTime(ts: string | null): string {
  if (!ts) return "";
  return format(new Date(ts), "HH:mm");
}

function timeToTimestamp(date: string, time: string): string | null {
  if (!time) return null;
  return `${date}T${time}:00`;
}

export function TimeClockRecordDialog({ open, onClose, employeeId, employeeName, record, date }: Props) {
  const qc = useQueryClient();
  const isEditing = !!record?.id;

  const recordDate = record?.record_date || date || format(new Date(), "yyyy-MM-dd");

  const [clockIn, setClockIn] = useState("");
  const [lunchOut, setLunchOut] = useState("");
  const [lunchIn, setLunchIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setClockIn(tsToTime(record?.clock_in ?? null));
      setLunchOut(tsToTime(record?.lunch_out ?? null));
      setLunchIn(tsToTime(record?.lunch_in ?? null));
      setClockOut(tsToTime(record?.clock_out ?? null));
      setNotes(record?.notes ?? "");
    }
  }, [open, record]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        employee_id: employeeId,
        record_date: recordDate,
        clock_in: timeToTimestamp(recordDate, clockIn),
        lunch_out: timeToTimestamp(recordDate, lunchOut),
        lunch_in: timeToTimestamp(recordDate, lunchIn),
        clock_out: timeToTimestamp(recordDate, clockOut),
        notes: notes || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("time_clock_records")
          .update(payload)
          .eq("id", record!.id!);
        if (error) throw error;
        toast.success("Registo atualizado com sucesso!");
      } else {
        // Check if record already exists for this date
        const { data: existing } = await supabase
          .from("time_clock_records")
          .select("id")
          .eq("employee_id", employeeId)
          .eq("record_date", recordDate)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("time_clock_records")
            .update(payload)
            .eq("id", existing.id);
          if (error) throw error;
          toast.success("Registo atualizado com sucesso!");
        } else {
          const { error } = await supabase
            .from("time_clock_records")
            .insert(payload);
          if (error) throw error;
          toast.success("Registo criado com sucesso!");
        }
      }

      qc.invalidateQueries({ queryKey: ["time-clock-report"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar registo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar" : "Criar"} Registo de Ponto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-xs">Funcionário</Label>
            <p className="font-medium text-sm">{employeeName}</p>
          </div>

          <div>
            <Label className="text-muted-foreground text-xs">Data</Label>
            <p className="font-medium text-sm">{format(new Date(recordDate + "T12:00:00"), "dd/MM/yyyy")}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="clock_in">Entrada</Label>
              <Input id="clock_in" type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lunch_out">Saída Almoço</Label>
              <Input id="lunch_out" type="time" value={lunchOut} onChange={(e) => setLunchOut(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lunch_in">Retorno Almoço</Label>
              <Input id="lunch_in" type="time" value={lunchIn} onChange={(e) => setLunchIn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clock_out">Saída</Label>
              <Input id="clock_out" type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo da alteração manual..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
