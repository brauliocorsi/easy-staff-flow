import jsPDF from "jspdf";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

export interface PdfTrainingData {
  employeeName: string;
  employeePosition: string;
  employeeDepartment: string;
  title: string;
  description: string | null;
  trainingDate: string;
  hours: number;
  type: string;
  trainerName: string | null;
  location: string | null;
}

const typeLabels: Record<string, string> = {
  internal: "Formação Interna",
  external: "Formação Externa",
};

export function generateTrainingPdf(data: PdfTrainingData) {
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
  doc.text("REGISTO DE FORMAÇÃO", pageWidth / 2, y, { align: "center" });
  y += 12;

  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 10;

  // Fields
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
  addField("Formação", data.title);
  addField("Tipo", typeLabels[data.type] || data.type);
  addField("Data", format(new Date(data.trainingDate + "T00:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: pt }));
  addField("Duração", `${data.hours} hora${data.hours !== 1 ? "s" : ""}`);
  if (data.trainerName) addField("Formador", data.trainerName);
  if (data.location) addField("Local", data.location);

  y += 4;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 10;

  // Description
  if (data.description) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Descrição / Conteúdo", marginLeft, y);
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

  // Trainer signature
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, marginLeft + signWidth, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(data.trainerName || "Formador", marginLeft, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Formador / Responsável", marginLeft, y);
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

  const filename = `formacao-${data.employeeName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(data.trainingDate + "T00:00:00"), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}
