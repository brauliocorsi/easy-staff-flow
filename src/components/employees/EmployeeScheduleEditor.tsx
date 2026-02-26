import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useEmployeeSchedules, useSaveSchedules, DAY_NAMES, type EmployeeSchedule } from "@/hooks/useEmployeeSchedules";

interface Props {
  employeeId: string;
}

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
  is_day_off: day === 0, // Sunday off by default
});

export function EmployeeScheduleEditor({ employeeId }: Props) {
  const { data: existing, isLoading } = useEmployeeSchedules(employeeId);
  const saveMutation = useSaveSchedules();
  const [rows, setRows] = useState<DayRow[]>([]);

  useEffect(() => {
    if (existing && existing.length > 0) {
      // Map existing data to all 7 days
      const mapped: DayRow[] = [];
      for (let d = 0; d < 7; d++) {
        const ex = existing.find((s) => s.day_of_week === d);
        if (ex) {
          mapped.push({
            day_of_week: d,
            clock_in_time: ex.clock_in_time.slice(0, 5),
            clock_out_time: ex.clock_out_time.slice(0, 5),
            lunch_out_time: ex.lunch_out_time.slice(0, 5),
            lunch_in_time: ex.lunch_in_time.slice(0, 5),
            is_day_off: ex.is_day_off,
          });
        } else {
          mapped.push(defaultRow(d));
        }
      }
      setRows(mapped);
    } else if (existing && existing.length === 0) {
      // Initialize defaults for all 7 days
      setRows(Array.from({ length: 7 }, (_, i) => defaultRow(i)));
    }
  }, [existing]);

  const updateRow = (day: number, field: keyof DayRow, value: any) => {
    setRows((prev) =>
      prev.map((r) => (r.day_of_week === day ? { ...r, [field]: value } : r))
    );
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        employeeId,
        schedules: rows.map((r) => ({
          employee_id: employeeId,
          day_of_week: r.day_of_week,
          clock_in_time: r.clock_in_time,
          clock_out_time: r.clock_out_time,
          lunch_out_time: r.lunch_out_time,
          lunch_in_time: r.lunch_in_time,
          is_day_off: r.is_day_off,
        })),
      });
      toast.success("Horários salvos com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar horários");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-base">Horário de Trabalho</CardTitle>
        <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Salvar Horários
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header */}
          <div className="grid grid-cols-[120px_1fr_1fr_1fr_1fr_80px] gap-2 text-xs font-semibold text-muted-foreground px-1">
            <span>Dia</span>
            <span>Entrada</span>
            <span>Saída Almoço</span>
            <span>Volta Almoço</span>
            <span>Saída</span>
            <span>Folga</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.day_of_week}
              className={`grid grid-cols-[120px_1fr_1fr_1fr_1fr_80px] gap-2 items-center rounded-md p-1.5 ${
                row.is_day_off ? "opacity-50 bg-muted/50" : ""
              }`}
            >
              <span className="text-sm font-medium">{DAY_NAMES[row.day_of_week]}</span>
              <Input
                type="time"
                value={row.clock_in_time}
                onChange={(e) => updateRow(row.day_of_week, "clock_in_time", e.target.value)}
                disabled={row.is_day_off}
                className="h-8 text-xs"
              />
              <Input
                type="time"
                value={row.lunch_out_time}
                onChange={(e) => updateRow(row.day_of_week, "lunch_out_time", e.target.value)}
                disabled={row.is_day_off}
                className="h-8 text-xs"
              />
              <Input
                type="time"
                value={row.lunch_in_time}
                onChange={(e) => updateRow(row.day_of_week, "lunch_in_time", e.target.value)}
                disabled={row.is_day_off}
                className="h-8 text-xs"
              />
              <Input
                type="time"
                value={row.clock_out_time}
                onChange={(e) => updateRow(row.day_of_week, "clock_out_time", e.target.value)}
                disabled={row.is_day_off}
                className="h-8 text-xs"
              />
              <div className="flex items-center justify-center">
                <Switch
                  checked={row.is_day_off}
                  onCheckedChange={(v) => updateRow(row.day_of_week, "is_day_off", v)}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
