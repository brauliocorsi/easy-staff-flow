import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { EmployeeCard, type EmployeeData } from "./EmployeeCard";

interface Props {
  employees: EmployeeData[];
  onSelect: (employee: EmployeeData) => void;
}

export function EmployeeCardGrid({ employees, onSelect }: Props) {
  const [search, setSearch] = useState("");

  const filtered = employees.filter((e) => {
    const name = `${e.first_name} ${e.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar funcionário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum funcionário encontrado</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((emp) => (
            <EmployeeCard key={emp.id} employee={emp} onClick={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
