import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function TimeClock() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Relógio de Ponto</h1>
          <p className="text-muted-foreground mt-1">Registre a entrada e saída dos funcionários</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Registro de Ponto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Selecione seu card e digite o PIN para registrar o ponto.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
