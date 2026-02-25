import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Settings() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerencie as configurações do sistema</p>
        </div>
        <Card>
          <CardHeader><CardTitle className="font-display">Geral</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Configurações do sistema serão exibidas aqui.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
