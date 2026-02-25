import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Clock, AlertTriangle, Palmtree, CalendarX, Handshake, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

const stats = [
  { title: "Funcionários Ativos", value: "0", icon: Users, color: "text-primary" },
  { title: "Documentos", value: "0", icon: FileText, color: "text-info" },
  { title: "Ponto Hoje", value: "0", icon: Clock, color: "text-success" },
  { title: "Advertências", value: "0", icon: AlertTriangle, color: "text-warning" },
  { title: "Férias Ativas", value: "0", icon: Palmtree, color: "text-success" },
  { title: "Faltas do Mês", value: "0", icon: CalendarX, color: "text-destructive" },
  { title: "Reuniões Agendadas", value: "0", icon: Handshake, color: "text-primary" },
  { title: "Horas Extras", value: "0h", icon: TrendingUp, color: "text-warning" },
];

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral do sistema de RH</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Alertas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Nenhum alerta no momento.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Aniversariantes do Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Nenhum aniversariante registrado.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
