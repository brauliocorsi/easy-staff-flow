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
  clock_in: "Registar Entrada",
  lunch_out: "Saída para Almoço",
  lunch_in: "Regresso do Almoço",
  clock_out: "Registar Saída",
  complete: "Dia Completo",
};

const nextActionLabelsPartTime: Record<string, string> = {
  clock_in: "Registar Entrada",
  clock_out: "Registar Saída",
  complete: "Dia Completo",
};

const successMessages: Record<string, (time: string) => string> = {
  clock_in: (t) => `Entrada registada com sucesso às ${t}.`,
  lunch_out: (t) => `Saída para almoço registada às ${t}.`,
  lunch_in: (t) => `Regresso do almoço registado às ${t}.`,
  clock_out: (t) => `Saída registada às ${t}.`,
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

  const doPunch = async (
    pinCode: string,
    opts: { confirmEarlyLeave?: boolean } = {}
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("time-clock-punch", {
        body: {
          employee_id: employee.id,
          pin_code: pinCode,
          confirm_early_leave: opts.confirmEarlyLeave || false,
        },
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

      const msg = successMessages[data.action]?.(data.time) ?? `${data.action_label} às ${data.time}.`;
      toast.success(msg);
      setPin("");
      setSavedPin("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registar ponto");
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
    doPunch(savedPin, { confirmEarlyLeave: true });
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
            <DialogTitle className="font-display text-center">Registo de Ponto</DialogTitle>
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
                  Registar
                </Button>
              </>
            )}

            {isComplete && (
              <p className="text-sm text-muted-foreground text-center">
                Todas as picagens do dia já foram registadas.
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
