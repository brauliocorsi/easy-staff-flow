import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEmployees } from "@/hooks/useEmployees";
import { useCreateMeeting, useUpdateMeeting } from "@/hooks/useMeetings";
import { toast } from "@/hooks/use-toast";
import { Users } from "lucide-react";
import { format } from "date-fns";

interface MeetingData {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  duration_minutes?: number | null;
  meeting_participants?: { employee_id: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  meeting?: MeetingData | null;
}

export function MeetingFormDialog({ open, onClose, meeting }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const { data: employees } = useEmployees("");
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();

  const isEditing = !!meeting;
  const activeEmployees = employees?.filter((e) => e.status === "active") ?? [];

  useEffect(() => {
    if (meeting && open) {
      setTitle(meeting.title);
      setDescription(meeting.description ?? "");
      setMeetingDate(format(new Date(meeting.meeting_date), "yyyy-MM-dd"));
      setDurationMinutes(meeting.duration_minutes ? String(meeting.duration_minutes) : "");
      setSelectedEmployees(
        (meeting.meeting_participants ?? []).map((p) => p.employee_id)
      );
    } else if (!meeting && open) {
      reset();
    }
  }, [meeting, open]);

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const reset = () => {
    setTitle("");
    setDescription("");
    setMeetingDate("");
    setDurationMinutes("");
    setSelectedEmployees([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !meetingDate || !durationMinutes) {
      toast({ title: "Preencha título, data e duração", variant: "destructive" });
      return;
    }

    const duration = parseInt(durationMinutes, 10);
    if (isNaN(duration) || duration <= 0) {
      toast({ title: "Duração inválida", variant: "destructive" });
      return;
    }

    // Store meeting_date as just the date (noon UTC to avoid timezone issues)
    const meetingDateISO = new Date(`${meetingDate}T12:00:00`).toISOString();

    try {
      if (isEditing) {
        await updateMeeting.mutateAsync({
          id: meeting.id,
          meeting: {
            title,
            description: description || null,
            meeting_date: meetingDateISO,
            duration_minutes: duration,
            end_time: null, // no longer used
          },
          participantIds: selectedEmployees,
        });
        toast({ title: "Reunião atualizada com sucesso!" });
      } else {
        await createMeeting.mutateAsync({
          meeting: {
            title,
            description: description || null,
            meeting_date: meetingDateISO,
            duration_minutes: duration,
            created_by: null,
          },
          participantIds: selectedEmployees,
        });
        toast({ title: "Reunião criada com sucesso!" });
      }
      reset();
      onClose();
    } catch (err: any) {
      toast({ title: isEditing ? "Erro ao atualizar" : "Erro ao criar reunião", description: err.message, variant: "destructive" });
    }
  };

  const isPending = createMeeting.isPending || updateMeeting.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{isEditing ? "Editar Reunião" : "Nova Reunião"}</DialogTitle>
          <DialogDescription>{isEditing ? "Altere os dados da reunião" : "Preencha os dados para agendar uma reunião"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Reunião de alinhamento" />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duração (minutos) *</Label>
              <Input
                type="number"
                min="1"
                placeholder="Ex: 30"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Participantes</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" type="button" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  {selectedEmployees.length > 0
                    ? `${selectedEmployees.length} selecionado(s)`
                    : "Selecionar participantes"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <ScrollArea className="h-60 p-4">
                  <div className="space-y-2">
                    {activeEmployees.map((emp) => (
                      <label
                        key={emp.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted p-1.5 rounded-md"
                      >
                        <Checkbox
                          checked={selectedEmployees.includes(emp.id)}
                          onCheckedChange={() => toggleEmployee(emp.id)}
                        />
                        <span className="text-sm">
                          {emp.first_name} {emp.last_name}
                          <span className="text-muted-foreground ml-1">· {emp.position}</span>
                        </span>
                      </label>
                    ))}
                    {activeEmployees.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum funcionário ativo.</p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isEditing ? "Salvar" : "Agendar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
