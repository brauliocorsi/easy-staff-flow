import { useState } from "react";
import { HelpCircle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function BugReportButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      toast.error("Descreva o problema com pelo menos 5 caracteres.");
      return;
    }
    if (trimmed.length > 2000) {
      toast.error("Mensagem muito longa (máx. 2000 caracteres).");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("bug_reports").insert({
      user_id: user.id,
      user_email: user.email,
      page_url: window.location.pathname,
      message: trimmed,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao enviar: " + error.message);
      return;
    }
    toast.success("Obrigado! O seu relatório foi enviado.");
    setMessage("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label="Reportar problema"
          title="Reportar bug ou problema"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar Bug ou Problema</DialogTitle>
          <DialogDescription>
            Descreva o que aconteceu. A sua mensagem será enviada ao administrador para análise.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Ex: Ao clicar em guardar, a página fica em branco..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={2000}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{message.length}/2000</span>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Send />}
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
