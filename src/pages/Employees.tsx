import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Employees() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Funcionários</h1>
            <p className="text-muted-foreground mt-1">Gerencie os funcionários da empresa</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Funcionário
          </Button>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar funcionário..." className="pl-9" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Lista de Funcionários</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado ainda. Conecte o backend para começar.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
