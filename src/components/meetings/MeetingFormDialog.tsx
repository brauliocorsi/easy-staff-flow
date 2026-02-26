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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployees } from "@/hooks/useEmployees";
import { useCreateMeeting, useUpdateMeeting } from "@/hooks/useMeetings";
import { useMeetingTypes, useCreateMeetingType } from "@/hooks/useMeetingTypes";
import { toast } from "@/hooks/use-toast";
import { Users, Plus } from "lucide-react";
import { format } from "date-fns";

interface MeetingData {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  duration_minutes?: number | null;
  meeting_type?: string | null;
  scheduled_time?: string | null;
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
  const [scheduledTime, setScheduledTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [meetingType, setMeetingType] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [showNewType, setShowNewType] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const { data: employees } = useEmployees("");
  const { data: meetingTypes } = useMeetingTypes();
  const createMeetingType = useCreateMeetingType();
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
      setMeetingType(meeting.meeting_type ?? "");
      setScheduledTime(meeting.scheduled_time ?? "");
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
    setScheduledTime("");
    setDurationMinutes("");
    setMeetingType("");
    setNewTypeName("");
    setShowNewType(false);
    setSelectedEmployees([]);
  };

  const handleAddType = async () => {
    if (!newTypeName.trim()) return;
    try {
      await createMeetingType.mutateAsync(newTypeName.trim());
      setMeetingType(newTypeName.trim());
      setNewTypeName("");
      setShowNewType(false);
      toast({ title: "Tipo de reunião adicionado!" });
    } catch (err: any) {
      toast({ title: "Erro ao adicionar tipo", description: err.message, variant: "destructive" });
    }
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
            meeting_type: meetingType || null,
            scheduled_time: scheduledTime || null,
            end_time: null,
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
            meeting_type: meetingType || null,
            scheduled_time: scheduledTime || null,
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
          {/* Meeting Type */}
          <div className="space-y-2">
            <Label>Tipo de Reunião</Label>
            {showNewType ? (
              <div className="flex gap-2">
                <Input
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Nome do novo tipo"
                  className="flex-1"
                />
                <Button type="button" size="sm" onClick={handleAddType} disabled={createMeetingType.isPending}>
                  Salvar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewType(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={meetingType} onValueChange={setMeetingType}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(meetingTypes ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="outline" onClick={() => setShowNewType(true)} title="Adicionar novo tipo">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Reunião de alinhamento" />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Horário Início</Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duração (min) *</Label>
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
