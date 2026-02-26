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
  end_time?: string | null;
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
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const { data: employees } = useEmployees("");
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();

  const isEditing = !!meeting;
  const activeEmployees = employees?.filter((e) => e.status === "active") ?? [];

  // Populate form when editing
  useEffect(() => {
    if (meeting && open) {
      setTitle(meeting.title);
      setDescription(meeting.description ?? "");
      const start = new Date(meeting.meeting_date);
      setStartDate(format(start, "yyyy-MM-dd"));
      setStartTime(format(start, "HH:mm"));
      if (meeting.end_time) {
        const end = new Date(meeting.end_time);
        setEndDate(format(end, "yyyy-MM-dd"));
        setEndTime(format(end, "HH:mm"));
      } else {
        setEndDate("");
        setEndTime("");
      }
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
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setSelectedEmployees([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !startTime) {
      toast({ title: "Preencha título, data e hora de início", variant: "destructive" });
      return;
    }

    const meetingDate = new Date(`${startDate}T${startTime}`).toISOString();
    const endTimeISO = endDate && endTime ? new Date(`${endDate}T${endTime}`).toISOString() : null;

    try {
      if (isEditing) {
        await updateMeeting.mutateAsync({
          id: meeting.id,
          meeting: {
            title,
            description: description || null,
            meeting_date: meetingDate,
            end_time: endTimeISO,
          },
          participantIds: selectedEmployees,
        });
        toast({ title: "Reunião atualizada com sucesso!" });
      } else {
        await createMeeting.mutateAsync({
          meeting: {
            title,
            description: description || null,
            meeting_date: meetingDate,
            end_time: endTimeISO,
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
              <Label>Data Início *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hora Início *</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Término</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hora Término</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
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
