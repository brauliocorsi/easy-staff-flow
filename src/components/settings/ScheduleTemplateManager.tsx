import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Save, X, Clock, ShieldAlert, Copy } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  useScheduleTemplates,
  useScheduleTemplateDays,
  useCreateScheduleTemplate,
  useUpdateScheduleTemplate,
  useDeleteScheduleTemplate,
  DAY_NAMES,
} from "@/hooks/useScheduleTemplates";

interface DayRow {
  day_of_week: number;
  clock_in_time: string;
  clock_out_time: string;
  lunch_out_time: string;
  lunch_in_time: string;
  is_day_off: boolean;
}

const defaultRow = (day: number): DayRow => ({
  day_of_week: day,
  clock_in_time: "08:00",
  clock_out_time: "17:00",
  lunch_out_time: "12:00",
  lunch_in_time: "13:00",
  is_day_off: day === 0,
});

interface Tolerances {
  tolerance_late_minutes: number;
  tolerance_overtime_minutes: number;
  tolerance_early_leave_minutes: number;
}

function TemplateEditor({
  initial,
  initialDays,
  initialTolerances,
  onSave,
  onCancel,
  saving,
}: {
  initial?: { id: string; name: string };
  initialDays?: DayRow[];
  initialTolerances?: Tolerances;
  onSave: (name: string, days: DayRow[], tolerances: Tolerances) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [rows, setRows] = useState<DayRow[]>(
    initialDays || Array.from({ length: 7 }, (_, i) => defaultRow(i))
  );
  const [tolerances, setTolerances] = useState<Tolerances>(
    initialTolerances || { tolerance_late_minutes: 10, tolerance_overtime_minutes: 15, tolerance_early_leave_minutes: 5 }
  );

  const updateRow = (day: number, field: keyof DayRow, value: any) => {
    setRows((prev) => prev.map((r) => (r.day_of_week === day ? { ...r, [field]: value } : r)));
  };

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Nome do modelo (ex: Fábrica, Loja...)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-xs font-medium"
        />
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (!name.trim()) return toast.error("Informe o nome do modelo");
              onSave(name.trim(), rows, tolerances);
            }}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[100px_1fr_1fr_1fr_1fr_60px_70px] gap-2 text-xs font-semibold text-muted-foreground px-1">
          <span>Dia</span>
          <span>Entrada</span>
          <span>Saída Almoço</span>
          <span>Volta Almoço</span>
          <span>Saída</span>
          <span>Total</span>
          <span>Folga</span>
        </div>
        {rows.map((row) => {
          let dailyTotal = "—";
          if (!row.is_day_off) {
            const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
            const mins = (toMin(row.clock_out_time) - toMin(row.clock_in_time)) - (toMin(row.lunch_in_time) - toMin(row.lunch_out_time));
            const val = Math.max(0, mins);
            const h = Math.floor(val / 60);
            const m = val % 60;
            dailyTotal = m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
          }
          return (
            <div
              key={row.day_of_week}
              className={`grid grid-cols-[100px_1fr_1fr_1fr_1fr_60px_70px] gap-2 items-center rounded-md p-1.5 ${
                row.is_day_off ? "opacity-50 bg-muted/50" : ""
              }`}
            >
              <span className="text-sm font-medium">{DAY_NAMES[row.day_of_week]}</span>
              <Input type="time" value={row.clock_in_time} onChange={(e) => updateRow(row.day_of_week, "clock_in_time", e.target.value)} disabled={row.is_day_off} className="h-8 text-xs" />
              <Input type="time" value={row.lunch_out_time} onChange={(e) => updateRow(row.day_of_week, "lunch_out_time", e.target.value)} disabled={row.is_day_off} className="h-8 text-xs" />
              <Input type="time" value={row.lunch_in_time} onChange={(e) => updateRow(row.day_of_week, "lunch_in_time", e.target.value)} disabled={row.is_day_off} className="h-8 text-xs" />
              <Input type="time" value={row.clock_out_time} onChange={(e) => updateRow(row.day_of_week, "clock_out_time", e.target.value)} disabled={row.is_day_off} className="h-8 text-xs" />
              <span className="text-xs font-medium text-center text-primary">{dailyTotal}</span>
              <div className="flex items-center justify-center">
                <Switch checked={row.is_day_off} onCheckedChange={(v) => updateRow(row.day_of_week, "is_day_off", v)} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tolerances */}
      <div className="space-y-2 border rounded-lg p-3 bg-background">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <ShieldAlert className="h-4 w-4" />
          Tolerâncias (minutos)
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Atraso</Label>
            <Input type="number" min={0} max={60} className="h-8 text-xs" value={tolerances.tolerance_late_minutes} onChange={(e) => setTolerances((p) => ({ ...p, tolerance_late_minutes: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hora Extra</Label>
            <Input type="number" min={0} max={60} className="h-8 text-xs" value={tolerances.tolerance_overtime_minutes} onChange={(e) => setTolerances((p) => ({ ...p, tolerance_overtime_minutes: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Atraso: minutos tolerados antes de debitar atraso · Hora Extra: minutos após saída antes de contar hora extra · Saída antecipada: sem tolerância, debitada desde o 1º minuto.</p>
      </div>
    </div>
  );
}

function calcWeeklyHours(days: any[] | undefined): string {
  if (!days) return "0h";
  let totalMinutes = 0;
  for (const d of days) {
    if (d.is_day_off) continue;
    const toMin = (t: string) => {
      const [h, m] = t.slice(0, 5).split(":").map(Number);
      return h * 60 + m;
    };
    const work = (toMin(d.clock_out_time) - toMin(d.clock_in_time)) - (toMin(d.lunch_in_time) - toMin(d.lunch_out_time));
    totalMinutes += Math.max(0, work);
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

function TemplateCard({ template, onEdit, onDelete, onDuplicate }: { template: any; onEdit: () => void; onDelete: () => void; onDuplicate: () => void }) {
  const { data: days } = useScheduleTemplateDays(template.id);
  const workDays = days?.filter((d: any) => !d.is_day_off).length ?? 0;
  const offDays = days?.filter((d: any) => d.is_day_off).length ?? 0;
  const weeklyHours = calcWeeklyHours(days);

  return (
    <div className="flex items-center justify-between border rounded-lg p-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
          <Clock className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-medium text-sm">{template.name}</p>
          <div className="flex gap-2 mt-0.5 flex-wrap">
            <Badge variant="secondary" className="text-xs">{weeklyHours}/semana</Badge>
            <Badge variant="secondary" className="text-xs">{workDays} dias trabalho</Badge>
            <Badge variant="outline" className="text-xs">{offDays} folgas</Badge>
            <Badge variant="outline" className="text-xs">Atraso: {template.tolerance_late_minutes ?? 10}min</Badge>
            <Badge variant="outline" className="text-xs">HE: {template.tolerance_overtime_minutes ?? 15}min</Badge>
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicar"><Copy className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
    </div>
  );
}

export function ScheduleTemplateManager() {
  const { data: templates, isLoading } = useScheduleTemplates();
  const createMut = useCreateScheduleTemplate();
  const updateMut = useUpdateScheduleTemplate();
  const deleteMut = useDeleteScheduleTemplate();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async (name: string, days: DayRow[], tolerances: Tolerances) => {
    try {
      await createMut.mutateAsync({
        name,
        days: days.map((d) => ({ ...d, template_id: "" })),
        ...tolerances,
      });
      toast.success("Modelo de horário criado!");
      setCreating(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar modelo");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover o modelo "${name}"?`)) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Modelo removido");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    }
  };

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const handleDuplicate = async (template: any) => {
    setDuplicatingId(template.id);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const daysQuery = await supabase
        .from("schedule_template_days")
        .select("*")
        .eq("template_id", template.id);
      const sourceDays = daysQuery.data || [];
      await createMut.mutateAsync({
        name: `${template.name} (cópia)`,
        days: sourceDays.map((d: any) => ({
          day_of_week: d.day_of_week,
          clock_in_time: d.clock_in_time.slice(0, 5),
          clock_out_time: d.clock_out_time.slice(0, 5),
          lunch_out_time: d.lunch_out_time.slice(0, 5),
          lunch_in_time: d.lunch_in_time.slice(0, 5),
          is_day_off: d.is_day_off,
          template_id: "",
        })),
        tolerance_late_minutes: template.tolerance_late_minutes ?? 10,
        tolerance_overtime_minutes: template.tolerance_overtime_minutes ?? 15,
        tolerance_early_leave_minutes: template.tolerance_early_leave_minutes ?? 5,
      });
      toast.success("Modelo duplicado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao duplicar");
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display flex items-center gap-2">
          <Clock className="h-5 w-5" /> Modelos de Horário
        </CardTitle>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Modelo
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {creating && (
          <TemplateEditor
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
            saving={createMut.isPending}
          />
        )}

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !templates?.length && !creating ? (
          <p className="text-sm text-muted-foreground">Nenhum modelo criado ainda. Crie modelos como "Fábrica", "Loja", "Armazém" para vincular aos funcionários.</p>
        ) : (
          templates?.map((t) =>
            editingId === t.id ? (
              <EditingTemplate key={t.id} template={t} onDone={() => setEditingId(null)} updateMut={updateMut} />
            ) : (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={() => setEditingId(t.id)}
                onDelete={() => handleDelete(t.id, t.name)}
                onDuplicate={() => handleDuplicate(t)}
              />
            )
          )
        )}
      </CardContent>
    </Card>
  );
}

function EditingTemplate({ template, onDone, updateMut }: { template: any; onDone: () => void; updateMut: any }) {
  const { data: existingDays } = useScheduleTemplateDays(template.id);

  if (!existingDays) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;

  const initialDays: DayRow[] = Array.from({ length: 7 }, (_, i) => {
    const ex = existingDays.find((d: any) => d.day_of_week === i);
    return ex
      ? {
          day_of_week: i,
          clock_in_time: ex.clock_in_time.slice(0, 5),
          clock_out_time: ex.clock_out_time.slice(0, 5),
          lunch_out_time: ex.lunch_out_time.slice(0, 5),
          lunch_in_time: ex.lunch_in_time.slice(0, 5),
          is_day_off: ex.is_day_off,
        }
      : defaultRow(i);
  });

  const handleSave = async (name: string, days: DayRow[], tolerances: Tolerances) => {
    try {
      await updateMut.mutateAsync({
        id: template.id,
        name,
        days: days.map((d) => ({ ...d, template_id: template.id })),
        ...tolerances,
      });
      toast.success("Modelo atualizado!");
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    }
  };

  return (
    <TemplateEditor
      initial={template}
      initialDays={initialDays}
      initialTolerances={{
        tolerance_late_minutes: template.tolerance_late_minutes ?? 10,
        tolerance_overtime_minutes: template.tolerance_overtime_minutes ?? 15,
        tolerance_early_leave_minutes: template.tolerance_early_leave_minutes ?? 5,
      }}
      onSave={handleSave}
      onCancel={onDone}
      saving={updateMut.isPending}
    />
  );
}
