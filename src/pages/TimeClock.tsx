import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ClockDisplay } from "@/components/timeclock/ClockDisplay";
import { EmployeeCardGrid } from "@/components/timeclock/EmployeeCardGrid";
import { PinModal } from "@/components/timeclock/PinModal";
import type { EmployeeData } from "@/components/timeclock/EmployeeCard";
import { supabase } from "@/integrations/supabase/client";
import { useTimeClockAlarms } from "@/hooks/useTimeClockAlarms";
import { Loader2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TimeClock() {
  const [searchParams] = useSearchParams();
  const deptId = searchParams.get("dept");
  const pinFromUrl = searchParams.get("pin");

  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EmployeeData | null>(null);
  const [deptName, setDeptName] = useState<string | null>(null);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("timeclock-theme") === "dark";
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("timeclock-theme", dark ? "dark" : "light");
  }, [dark]);

  useTimeClockAlarms();

  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("time-clock-employees");
      if (error) {
        throw error;
      }
      setEmployees(data || []);

      // Resolve department name from first matching employee
      if (deptId && data?.length) {
        const match = data.find((e: any) => e.department_id === deptId);
        setDeptName(match?.department || null);
      }
    } catch (err) {
      console.error("Failed to load employees", err);
    } finally {
      setLoading(false);
    }
  }, [deptId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const filteredEmployees = useMemo(() => {
    if (!deptId) return employees;
    return employees.filter((e: any) => e.department_id === deptId);
  }, [employees, deptId]);

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDark((d) => !d)}
            className="rounded-full"
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
        <ClockDisplay />

        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">Relógio de Ponto</h1>
          {deptName && (
            <p className="text-primary font-medium text-sm mt-1">{deptName}</p>
          )}
          <p className="text-muted-foreground text-sm mt-1">
            Selecione seu card e digite o PIN para registrar
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <EmployeeCardGrid employees={filteredEmployees} onSelect={setSelected} />
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
