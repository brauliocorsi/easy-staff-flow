import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { EmployeeData } from "./EmployeeCard";

const nextActionLabels: Record<string, string> = {
  clock_in: "Registrar Entrada",
  lunch_out: "Saída Almoço",
  lunch_in: "Retorno Almoço",
  clock_out: "Registrar Saída",
  complete: "Ponto Completo",
};

const nextActionLabelsPartTime: Record<string, string> = {
  clock_in: "Registrar Entrada",
  clock_out: "Registrar Saída",
  complete: "Ponto Completo",
};

interface Props {
  employee: EmployeeData | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface EarlyLeaveWarning {
  minutes_early: number;
  scheduled_clock_out: string;
  current_time: string;
  message: string;
}

export function PinModal({ employee, open, onClose, onSuccess }: Props) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [earlyLeaveWarning, setEarlyLeaveWarning] = useState<EarlyLeaveWarning | null>(null);
  const [savedPin, setSavedPin] = useState("");

  if (!employee) return null;

  const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
  const isComplete = employee.today_status === "complete";

  const doPunch = async (pinCode: string, confirmEarlyLeave = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("time-clock-punch", {
        body: { employee_id: employee.id, pin_code: pinCode, confirm_early_leave: confirmEarlyLeave },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setPin("");
        setLoading(false);
        return;
      }

      // Check for early leave warning
      if (data?.early_leave_warning) {
        setSavedPin(pinCode);
        setEarlyLeaveWarning(data as EarlyLeaveWarning);
        setLoading(false);
        return;
      }

      toast.success(`${data.action_label} registrada às ${data.time}`);
      setPin("");
      setSavedPin("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar ponto");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (pin.length !== 4) return;
    doPunch(pin);
  };

  const handleConfirmEarlyLeave = () => {
    setEarlyLeaveWarning(null);
    doPunch(savedPin, true);
  };

  const handleCancelEarlyLeave = () => {
    setEarlyLeaveWarning(null);
    setSavedPin("");
    setPin("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setPin("");
      setSavedPin("");
      setEarlyLeaveWarning(null);
      onClose();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-center">Registro de Ponto</DialogTitle>
            <DialogDescription className="text-center">
              Digite seu PIN de 4 dígitos para confirmar
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-5 py-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={employee.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="font-semibold text-lg text-foreground">
                {employee.first_name} {employee.last_name}
              </p>
              <p className="text-sm text-muted-foreground">{employee.position}</p>
            </div>

            <div className="rounded-lg bg-primary/5 px-4 py-2 text-center">
              <p className="text-xs text-muted-foreground">Próxima ação</p>
              <p className="font-semibold text-primary">
                {(employee.is_part_time ? nextActionLabelsPartTime : nextActionLabels)[employee.today_status] || nextActionLabels[employee.today_status]}
              </p>
            </div>

            {!isComplete && (
              <>
                <InputOTP maxLength={4} value={pin} onChange={setPin}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>

                <Button
                  onClick={handleSubmit}
                  disabled={pin.length !== 4 || loading}
                  className="w-full"
                  size="lg"
                >
                  {loading && <Loader2 className="animate-spin" />}
                  Registrar
                </Button>
              </>
            )}

            {isComplete && (
              <p className="text-sm text-muted-foreground text-center">
                Todas as batidas do dia já foram registradas.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!earlyLeaveWarning} onOpenChange={(o) => !o && handleCancelEarlyLeave()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Saída Antecipada Detectada
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{earlyLeaveWarning?.message}</p>
              <p className="text-sm font-medium">
                Esta tentativa será registrada e o administrador será notificado.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelEarlyLeave}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEarlyLeave} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Confirmar Saída
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
