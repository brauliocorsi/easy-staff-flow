import { useEffect, useState, useCallback } from "react";
import { ClockDisplay } from "@/components/timeclock/ClockDisplay";
import { EmployeeCardGrid } from "@/components/timeclock/EmployeeCardGrid";
import { PinModal } from "@/components/timeclock/PinModal";
import type { EmployeeData } from "@/components/timeclock/EmployeeCard";
import { supabase } from "@/integrations/supabase/client";
import { useTimeClockAlarms } from "@/hooks/useTimeClockAlarms";
import { Loader2 } from "lucide-react";

export default function TimeClock() {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EmployeeData | null>(null);

  useTimeClockAlarms();

  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("time-clock-employees");
      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error("Failed to load employees", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <ClockDisplay />

        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">Relógio de Ponto</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Selecione seu card e digite o PIN para registrar
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <EmployeeCardGrid employees={employees} onSelect={setSelected} />
        )}

        <PinModal
          employee={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
          onSuccess={fetchEmployees}
        />
      </div>
    </div>
  );
}
