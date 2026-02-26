import { AppLayout } from "@/components/layout/AppLayout";
import { ScheduleTemplateManager } from "@/components/settings/ScheduleTemplateManager";

export default function Settings() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerencie as configurações do sistema</p>
        </div>
        <ScheduleTemplateManager />
      </div>
    </AppLayout>
  );
}
