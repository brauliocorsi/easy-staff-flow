import jsPDF from "jspdf";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

export interface PdfWarningData {
  employeeName: string;
  employeePosition: string;
  employeeDepartment: string;
  type: string;
  reason: string;
  description: string | null;
  warningDate: string;
  suspensionStart?: string | null;
  suspensionEnd?: string | null;
}

const typeLabels: Record<string, string> = {
  verbal: "Advertência Verbal",
  written: "Advertência Escrita",
  suspension: "Suspensão Disciplinar",
  termination: "Demissão por Justa Causa",
};

export function generateWarningPdf(data: PdfWarningData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ADVERTÊNCIA DISCIPLINAR", pageWidth / 2, y, { align: "center" });
  y += 12;

  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 10;

  // Employee info
  doc.setFontSize(11);
  const addField = (label: string, value: string) => {
    checkPage(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, marginLeft, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, marginLeft + doc.getTextWidth(`${label}: `) + 2, y);
    y += 7;
  };

  addField("Funcionário", data.employeeName);
  addField("Cargo", data.employeePosition);
  if (data.employeeDepartment) addField("Departamento", data.employeeDepartment);
  addField("Tipo", typeLabels[data.type] || data.type);
  addField("Data", format(new Date(data.warningDate), "dd 'de' MMMM 'de' yyyy", { locale: pt }));

  if (data.type === "suspension" && data.suspensionStart && data.suspensionEnd) {
    addField(
      "Período de Suspensão",
      `${format(new Date(data.suspensionStart), "dd/MM/yyyy")} a ${format(new Date(data.suspensionEnd), "dd/MM/yyyy")}`
    );
  }

  y += 4;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 10;

  // Reason
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Motivo", marginLeft, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const reasonLines = doc.splitTextToSize(data.reason, contentWidth);
  doc.text(reasonLines, marginLeft, y);
  y += reasonLines.length * 5 + 6;

  // Description
  if (data.description) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Descrição", marginLeft, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(data.description, contentWidth);
    descLines.forEach((line: string) => {
      checkPage(6);
      doc.text(line, marginLeft, y);
      y += 5;
    });
    y += 6;
  }

  // Signature section
  y += 10;
  doc.setDrawColor(180, 180, 180);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 12;

  checkPage(60);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Assinaturas", marginLeft, y);
  y += 15;

  const signWidth = 70;

  // Employee signature
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, marginLeft + signWidth, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(data.employeeName, marginLeft, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Colaborador", marginLeft, y);
  doc.setTextColor(0, 0, 0);
  y += 15;

  // Manager signature
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, marginLeft + signWidth, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Responsável", marginLeft, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Assinatura e carimbo", marginLeft, y);
  doc.setTextColor(0, 0, 0);

  // Footer
  y = doc.internal.pageSize.getHeight() - 15;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Documento gerado automaticamente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );

  const filename = `advertencia-${data.employeeName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(data.warningDate), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}
