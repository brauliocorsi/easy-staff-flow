import { AppLayout } from "@/components/layout/AppLayout";
import { ScheduleTemplateManager } from "@/components/settings/ScheduleTemplateManager";
import { AlarmManager } from "@/components/settings/AlarmManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, ExternalLink, Monitor } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const baseUrl = window.location.origin;
  const attendanceLink = `${baseUrl}/presenca`;
  const timeClockLink = `${baseUrl}/ponto`;
  const portalLink = `${baseUrl}/portal`;

  const copyToClipboard = (link: string, label: string) => {
    navigator.clipboard.writeText(link);
    toast.success(`Link de ${label} copiado!`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerencie as configurações do sistema</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Links Públicos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dashboard de Presença</label>
              <div className="flex gap-2">
                <Input value={attendanceLink} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(attendanceLink, "Presença")}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={attendanceLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Protegido por PIN. Ideal para ecrãs/TVs no escritório.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Relógio de Ponto</label>
              <div className="flex gap-2">
                <Input value={timeClockLink} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(timeClockLink, "Relógio de Ponto")}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={timeClockLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Terminal de ponto para os funcionários.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Portal do Funcionário</label>
              <div className="flex gap-2">
                <Input value={portalLink} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(portalLink, "Portal")}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={portalLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">O funcionário acede com PIN para ver os seus dados e enviar sugestões.</p>
            </div>
          </CardContent>
        </Card>

        <AlarmManager />

        <ScheduleTemplateManager />
      </div>
    </AppLayout>
  );
}
