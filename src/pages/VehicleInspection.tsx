import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Car, ClipboardCheck, LogOut, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type Employee = { id: string; first_name: string; last_name: string; avatar_url: string | null };
type Vehicle = { id: string; plate: string; brand: string | null; model: string | null; km_current: number | null };

const statusOptions = [
  { value: "ok", label: "OK ✅" },
  { value: "attention", label: "Atenção ⚠️" },
  { value: "critical", label: "Crítico ❌" },
];

const conditionOptions = [
  { value: "none", label: "Nenhum ✅" },
  { value: "minor", label: "Pequeno ⚠️" },
  { value: "major", label: "Grande ❌" },
];

async function callFn(action: string, body?: any) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/vehicle-inspection?action=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro");
  return data;
}

export default function VehicleInspection() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [vehicleId, setVehicleId] = useState("");
  const [km, setKm] = useState("");
  const [oilLevel, setOilLevel] = useState("ok");
  const [brakePads, setBrakePads] = useState("ok");
  const [brakes, setBrakes] = useState("ok");
  const [waterLevel, setWaterLevel] = useState("ok");
  const [tireCondition, setTireCondition] = useState("ok");
  const [cleanliness, setCleanliness] = useState("ok");
  const [scratches, setScratches] = useState("none");
  const [dents, setDents] = useState("none");
  const [turnSignals, setTurnSignals] = useState("ok");
  const [lights, setLights] = useState("ok");
  const [materialReturn, setMaterialReturn] = useState("ok");
  const [vest, setVest] = useState(false);
  const [jack, setJack] = useState(false);
  const [wheelWrench, setWheelWrench] = useState(false);
  const [observations, setObservations] = useState("");

  const handleLogin = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    try {
      const [authData, vehiclesData] = await Promise.all([
        callFn("auth", { pin }),
        callFn("vehicles"),
      ]);
      setEmployee(authData.employee);
      setVehicles(vehiclesData.vehicles || []);
    } catch (err: any) {
      toast.error(err.message || "PIN inválido");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!vehicleId) {
      toast.error("Selecione um veículo");
      return;
    }
    if (!km || parseInt(km) <= 0) {
      toast.error("Informe a quilometragem");
      return;
    }
    setLoading(true);
    try {
      await callFn("submit", {
        employee_id: employee!.id,
        vehicle_id: vehicleId,
        km: parseInt(km),
        oil_level: oilLevel,
        brake_pads: brakePads,
        brakes,
        water_level: waterLevel,
        tire_condition: tireCondition,
        cleanliness,
        scratches,
        dents,
        turn_signals: turnSignals,
        lights,
        material_return: materialReturn,
        vest,
        jack,
        wheel_wrench: wheelWrench,
        observations: observations || null,
      });
      setSubmitted(true);
      toast.success("Inspeção registada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao registar inspeção");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setEmployee(null);
    setPin("");
    setSubmitted(false);
    setVehicleId("");
    setKm("");
    setOilLevel("ok");
    setBrakePads("ok");
    setBrakes("ok");
    setWaterLevel("ok");
    setTireCondition("ok");
    setCleanliness("ok");
    setScratches("none");
    setDents("none");
    setTurnSignals("ok");
    setLights("ok");
    setMaterialReturn("ok");
    setVest(false);
    setJack(false);
    setWheelWrench(false);
    setObservations("");
  };

  const handleNewInspection = () => {
    setSubmitted(false);
    setVehicleId("");
    setKm("");
    setOilLevel("ok");
    setBrakePads("ok");
    setBrakes("ok");
    setWaterLevel("ok");
    setTireCondition("ok");
    setCleanliness("ok");
    setScratches("none");
    setDents("none");
    setTurnSignals("ok");
    setLights("ok");
    setMaterialReturn("ok");
    setVest(false);
    setJack(false);
    setWheelWrench(false);
    setObservations("");
  };

  const StatusSelect = ({ label, value, onChange, options = statusOptions }: { label: string; value: string; onChange: (v: string) => void; options?: typeof statusOptions }) => (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // PIN Screen
  if (!employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted/50 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <Car className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Inspeção de Veículo</CardTitle>
            <p className="text-muted-foreground text-sm">Introduza o seu PIN para continuar</p>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <InputOTP maxLength={6} value={pin} onChange={setPin}>
              <InputOTPGroup>
                {[0, 1, 2, 3].map(i => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
            <Button className="w-full" onClick={handleLogin} disabled={pin.length < 4 || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted/50 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <ClipboardCheck className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-primary">Inspeção Registada!</h2>
            <p className="text-muted-foreground">A inspeção foi registada com sucesso.</p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={handleNewInspection}>Nova Inspeção</Button>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Inspection form
  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/50 to-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Inspeção de Veículo</h1>
              <p className="text-sm text-muted-foreground">{employee.first_name} {employee.last_name} • {new Date().toLocaleDateString("pt-PT")}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Vehicle Selection & KM */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Veículo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Selecionar Veículo *</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue placeholder="Escolha o veículo..." /></SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.plate} — {v.brand} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quilometragem (KM) *</Label>
              <Input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="Ex: 125430" />
            </div>
          </CardContent>
        </Card>

        {/* Mechanical */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Mecânica</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <StatusSelect label="Nível de Óleo" value={oilLevel} onChange={setOilLevel} />
            <StatusSelect label="Pastilhas" value={brakePads} onChange={setBrakePads} />
            <StatusSelect label="Freio" value={brakes} onChange={setBrakes} />
            <StatusSelect label="Nível da Água" value={waterLevel} onChange={setWaterLevel} />
            <StatusSelect label="Estado dos Pneus" value={tireCondition} onChange={setTireCondition} />
          </CardContent>
        </Card>

        {/* Exterior / Lights */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Exterior e Luzes</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <StatusSelect label="Limpeza" value={cleanliness} onChange={setCleanliness} />
            <StatusSelect label="Riscos" value={scratches} onChange={setScratches} options={conditionOptions} />
            <StatusSelect label="Batidas" value={dents} onChange={setDents} options={conditionOptions} />
            <StatusSelect label="Pisca" value={turnSignals} onChange={setTurnSignals} />
            <StatusSelect label="Luzes" value={lights} onChange={setLights} />
            <StatusSelect label="Retorno de Material" value={materialReturn} onChange={setMaterialReturn} />
          </CardContent>
        </Card>

        {/* Emergency Kit */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Kit de Emergência</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox id="vest" checked={vest} onCheckedChange={(v) => setVest(!!v)} />
              <Label htmlFor="vest" className="cursor-pointer">Colete Refletor</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="jack" checked={jack} onCheckedChange={(v) => setJack(!!v)} />
              <Label htmlFor="jack" className="cursor-pointer">Macaco</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="wrench" checked={wheelWrench} onCheckedChange={(v) => setWheelWrench(!!v)} />
              <Label htmlFor="wrench" className="cursor-pointer">Chave de Rodas</Label>
            </div>
          </CardContent>
        </Card>

        {/* Observations */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Observações</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <Button className="w-full h-12 text-base" onClick={handleSubmit} disabled={loading}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ClipboardCheck className="h-5 w-5 mr-2" />}
          Registar Inspeção
        </Button>
      </div>
    </div>
  );
}
