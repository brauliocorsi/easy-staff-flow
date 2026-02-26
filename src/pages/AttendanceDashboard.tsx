import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users, UserCheck, UtensilsCrossed, LogOut, UserX, Lock, RefreshCw, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EmployeeAttendance {
  id: string;
  name: string;
  position: string;
  avatar_url: string | null;
  status: "present" | "lunch" | "left" | "absent" | "day_off";
  scheduled_in: string | null;
  scheduled_out: string | null;
  clock_in: string | null;
  lunch_out: string | null;
  lunch_in: string | null;
  clock_out: string | null;
}

interface Stats {
  total: number;
  present: number;
  lunch: number;
  left: number;
  absent: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof UserCheck }> = {
  present: { label: "Presente", color: "bg-green-500", icon: UserCheck },
  lunch: { label: "Almoço", color: "bg-amber-500", icon: UtensilsCrossed },
  left: { label: "Saiu", color: "bg-blue-500", icon: LogOut },
  absent: { label: "Ausente", color: "bg-red-500", icon: UserX },
  day_off: { label: "Folga", color: "bg-muted", icon: Clock },
};

export default function AttendanceDashboard() {
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attendance, setAttendance] = useState<EmployeeAttendance[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, present: 0, lunch: 0, left: 0, absent: 0 });
  const [date, setDate] = useState("");
  const [storedPin, setStoredPin] = useState("");

  const fetchData = useCallback(async (pinToUse: string) => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("attendance-dashboard", {
        body: { pin: pinToUse },
      });

      if (fnErr) throw fnErr;
      if (data?.error) {
        if (data.error === "PIN inválido") {
          setAuthenticated(false);
          setError("PIN inválido");
          return;
        }
        throw new Error(data.error);
      }

      setAttendance(data.attendance);
      setStats(data.stats);
      setDate(data.date);
      setAuthenticated(true);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return;
    setStoredPin(pin);
    await fetchData(pin);
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!authenticated || !storedPin) return;
    const interval = setInterval(() => fetchData(storedPin), 30000);
    return () => clearInterval(interval);
  }, [authenticated, storedPin, fetchData]);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Dashboard de Presença</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Insira o PIN para acessar</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitPin} className="space-y-4">
              <Input
                type="password"
                placeholder="PIN de acesso"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={10}
                className="text-center text-lg tracking-widest"
                autoFocus
              />
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || pin.length < 4}>
                {loading ? "A verificar..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formattedDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("pt-PT", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  const workingEmployees = attendance.filter((e) => e.status !== "day_off");
  const dayOffEmployees = attendance.filter((e) => e.status === "day_off");

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard de Presença</h1>
            <p className="text-muted-foreground mt-1 capitalize">{formattedDate}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => fetchData(storedPin)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={Users} label="Esperados" value={stats.total} color="text-foreground" />
          <StatCard icon={UserCheck} label="Presentes" value={stats.present} color="text-green-500" />
          <StatCard icon={UtensilsCrossed} label="Almoço" value={stats.lunch} color="text-amber-500" />
          <StatCard icon={LogOut} label="Saíram" value={stats.left} color="text-blue-500" />
          <StatCard icon={UserX} label="Ausentes" value={stats.absent} color="text-red-500" />
        </div>

        {/* Attendance Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Funcionários ({workingEmployees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {workingEmployees.map((emp) => (
                <EmployeeCard key={emp.id} employee={emp} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Day Off */}
        {dayOffEmployees.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground">De Folga ({dayOffEmployees.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {dayOffEmployees.map((emp) => (
                  <Badge key={emp.id} variant="outline" className="text-sm py-1 px-3">
                    {emp.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">Atualização automática a cada 30 segundos</p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <Icon className={`h-7 w-7 ${color}`} />
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeCard({ employee: emp }: { employee: EmployeeAttendance }) {
  const cfg = STATUS_CONFIG[emp.status] || STATUS_CONFIG.absent;
  const initials = emp.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 border rounded-lg p-3">
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarImage src={emp.avatar_url || undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{emp.name}</p>
        <p className="text-xs text-muted-foreground truncate">{emp.position}</p>
        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
          {emp.clock_in && <span>E: {emp.clock_in}</span>}
          {emp.lunch_out && <span>A: {emp.lunch_out}</span>}
          {emp.lunch_in && <span>V: {emp.lunch_in}</span>}
          {emp.clock_out && <span>S: {emp.clock_out}</span>}
          {!emp.clock_in && emp.scheduled_in && (
            <span className="text-destructive">Previsto: {emp.scheduled_in}</span>
          )}
        </div>
      </div>
    </div>
  );
}
