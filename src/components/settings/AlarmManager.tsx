import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Alarm {
  id: string;
  label: string;
  alarm_time: string;
  is_active: boolean;
}

export function AlarmManager() {
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState("12:00");

  const { data: alarms = [], isLoading } = useQuery({
    queryKey: ["time_clock_alarms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_alarms")
        .select("*")
        .order("alarm_time");
      if (error) throw error;
      return data as Alarm[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newLabel.trim()) throw new Error("Insira uma descrição");
      const { error } = await supabase.from("time_clock_alarms").insert({
        label: newLabel.trim(),
        alarm_time: newTime,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time_clock_alarms"] });
      setNewLabel("");
      setNewTime("12:00");
      toast.success("Alarme adicionado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("time_clock_alarms")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time_clock_alarms"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("time_clock_alarms")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time_clock_alarms"] });
      toast.success("Alarme removido");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Sinais Sonoros do Relógio de Ponto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure alarmes sonoros que tocam automaticamente no terminal de ponto nos horários definidos.
        </p>

        {/* Add new */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Descrição (ex: Almoço)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1"
          />
          <Input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="w-32"
          />
          <Button
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending || !newLabel.trim()}
          >
            {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : alarms.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum alarme configurado.</p>
        ) : (
          <div className="space-y-2">
            {alarms.map((alarm) => (
              <div
                key={alarm.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Switch
                    checked={alarm.is_active}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: alarm.id, is_active: checked })
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{alarm.label}</p>
                    <p className="text-xs text-muted-foreground">{alarm.alarm_time.slice(0, 5)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(alarm.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
