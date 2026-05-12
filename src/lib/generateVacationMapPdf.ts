import jsPDF from "jspdf";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import type { VacationRequest } from "@/hooks/useVacations";

interface EmployeeRow {
  name: string;
  totalEntitled: number;
  approvedDays: number;
  enjoyedDays: number;
  remaining: number;
  periods: Array<{
    start: string;
    end: string;
    days: number;
    status: string;
    enjoyed: boolean;
    category: string;
  }>;
}

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  employee_suggested: "Sugerido",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

const categoryLabel: Record<string, string> = {
  individual: "Individual",
  factory: "Fábrica",
  warehouse: "Armazém",
};

export type VacationMapScope = "all" | "individual" | "factory" | "warehouse";

const scopeTitle: Record<VacationMapScope, string> = {
  all: "Geral",
  individual: "Individual",
  factory: "Fábrica",
  warehouse: "Armazém",
};

export function generateVacationMapPdf(
  vacations: VacationRequest[],
  year: number,
  scope: VacationMapScope = "all"
) {
  // Filter by scope (category). For "individual" we also include records with
  // no category set (legacy) treated as individual.
  const filtered = scope === "all"
    ? vacations
    : vacations.filter((v) => (v.category || "individual") === scope);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 12;
  const marginRight = 12;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 14;

  // Group by employee (ignore sell-only records)
  const map = new Map<string, EmployeeRow>();
  for (const v of filtered) {
    if ((v as any).sell_status) continue;
    const name = v.employees ? `${v.employees.first_name} ${v.employees.last_name}` : "—";
    if (!map.has(v.employee_id)) {
      map.set(v.employee_id, {
        name,
        totalEntitled: 0,
        approvedDays: 0,
        enjoyedDays: 0,
        remaining: 0,
        periods: [],
      });
    }
    const row = map.get(v.employee_id)!;
    if (v.total_entitled_days > row.totalEntitled) row.totalEntitled = v.total_entitled_days;
    if (v.status === "approved" || v.enjoyed) row.approvedDays += v.days_count;
    if (v.enjoyed) row.enjoyedDays += v.days_count;
    row.periods.push({
      start: v.start_date,
      end: v.end_date,
      days: v.days_count,
      status: v.status,
      enjoyed: v.enjoyed,
      category: v.category,
    });
  }
  const employees = Array.from(map.values())
    .map((r) => ({
      ...r,
      // Ordenar períodos cronologicamente (data de início ascendente)
      periods: [...r.periods].sort((a, b) => a.start.localeCompare(b.start)),
      remaining: Math.max(0, (r.totalEntitled || 22) - r.approvedDays),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(
    `MAPA DE FÉRIAS ${scope === "all" ? "" : `— ${scopeTitle[scope].toUpperCase()} `}— ${year}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text(
    `Emitido em ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: pt })}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
  doc.setTextColor(0, 0, 0);
  y += 6;

  // Column layout
  const cols = {
    name: marginLeft,
    direito: marginLeft + 70,
    aprovados: marginLeft + 90,
    gozados: marginLeft + 110,
    restantes: marginLeft + 130,
    periods: marginLeft + 152,
  };
  const periodsWidth = pageWidth - marginRight - cols.periods;

  const drawHeader = () => {
    doc.setFillColor(240, 240, 245);
    doc.rect(marginLeft, y, contentWidth, 7, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Funcionário", cols.name + 1, y + 5);
    doc.text("Direito", cols.direito, y + 5);
    doc.text("Aprov.", cols.aprovados, y + 5);
    doc.text("Gozados", cols.gozados, y + 5);
    doc.text("Restantes", cols.restantes, y + 5);
    doc.text("Períodos (datas e dias úteis)", cols.periods, y + 5);
    y += 7;
    doc.setFont("helvetica", "normal");
  };

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - 14) {
      doc.addPage();
      y = 14;
      drawHeader();
    }
  };

  drawHeader();

  if (employees.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Nenhum pedido de férias para ${year}.`, pageWidth / 2, y + 10, { align: "center" });
  }

  doc.setFontSize(8.5);
  for (const emp of employees) {
    // Build period strings
    const periodLines: string[] = emp.periods.length === 0
      ? ["—"]
      : emp.periods.map((p) => {
          const dates = p.days === 0
            ? "Sem datas"
            : `${format(new Date(p.start + "T00:00:00"), "dd/MM")}–${format(new Date(p.end + "T00:00:00"), "dd/MM")}`;
          const tag = p.enjoyed ? "Gozada" : statusLabel[p.status] || p.status;
          const cat = p.category !== "individual" ? ` [${categoryLabel[p.category] || p.category}]` : "";
          return `• ${dates}  (${p.days}d úteis) — ${tag}${cat}`;
        });

    const wrapped: string[] = [];
    for (const line of periodLines) {
      const parts = doc.splitTextToSize(line, periodsWidth);
      wrapped.push(...parts);
    }
    const rowHeight = Math.max(8, wrapped.length * 4.2 + 3);
    checkPage(rowHeight);

    // Row background (zebra)
    const idx = employees.indexOf(emp);
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 252);
      doc.rect(marginLeft, y, contentWidth, rowHeight, "F");
    }

    doc.setFont("helvetica", "bold");
    doc.text(doc.splitTextToSize(emp.name, 67), cols.name + 1, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(`${emp.totalEntitled || 22}d`, cols.direito, y + 5);
    doc.text(`${emp.approvedDays}d`, cols.aprovados, y + 5);
    doc.text(`${emp.enjoyedDays}d`, cols.gozados, y + 5);
    doc.text(`${emp.remaining}d`, cols.restantes, y + 5);
    doc.text(wrapped, cols.periods, y + 5);

    // Bottom border
    doc.setDrawColor(220, 220, 225);
    doc.line(marginLeft, y + rowHeight, pageWidth - marginRight, y + rowHeight);

    y += rowHeight;
  }

  // Footer with page numbers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Página ${i} de ${total}`, pageWidth - marginRight, pageHeight - 6, { align: "right" });
    doc.text("RH UP Móveis — Mapa de Férias", marginLeft, pageHeight - 6);
  }

  const suffix = scope === "all" ? "" : `-${scope}`;
  doc.save(`mapa-ferias${suffix}-${year}.pdf`);
}
