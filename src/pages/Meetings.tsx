import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Meetings() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Reuniões</h1>
            <p className="text-muted-foreground mt-1">Agende e gerencie reuniões com pautas</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Reunião
          </Button>
        </div>
        <Card>
          <CardHeader><CardTitle className="font-display">Reuniões Agendadas</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Nenhuma reunião agendada.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
