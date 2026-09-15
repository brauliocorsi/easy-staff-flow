import { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  /** Só passe pesquisa se ela filtrar mesmo os dados. */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
  };
  children?: ReactNode;
  className?: string;
}

/** Barra de filtros partilhada. */
export function FilterBar({ search, children, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {search && (
        <div className="relative w-full sm:max-w-xs">
          <Label htmlFor="filter-search" className="sr-only">
            {search.label ?? "Pesquisar"}
          </Label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="filter-search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? "Pesquisar…"}
            className="pl-8"
          />
        </div>
      )}
      {children}
    </div>
  );
}
