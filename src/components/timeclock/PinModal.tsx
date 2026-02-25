import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2 } from "lucide-react";
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

interface Props {
  employee: EmployeeData | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PinModal({ employee, open, onClose, onSuccess }: Props) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  if (!employee) return null;

  const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
  const isComplete = employee.today_status === "complete";

  const handleSubmit = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("time-clock-punch", {
        body: { employee_id: employee.id, pin_code: pin },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setPin("");
        setLoading(false);
        return;
      }

      toast.success(`${data.action_label} registrada às ${data.time}`);
      setPin("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar ponto");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setPin("");
      onClose();
    }
  };

  return (
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
              {nextActionLabels[employee.today_status]}
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
  );
}
