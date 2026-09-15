import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Cabeçalho único usado em todas as páginas. */
export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-accent">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
