import jsPDF from "jspdf";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

export interface PdfEpiData {
  employeeName: string;
  employeePosition: string;
  employeeDepartment: string;
  itemName: string;
  quantity: number;
  deliveryDate: string;
  expiryDate: string | null;
  notes: string | null;
}

export function generateEpiPdf(data: PdfEpiData) {
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
  doc.text("FICHA DE ENTREGA DE EPI", pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Equipamento de Proteção Individual", pageWidth / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 10;

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

  y += 4;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 10;

  // EPI details
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Dados do Equipamento", marginLeft, y);
  y += 8;

  doc.setFontSize(11);
  addField("Equipamento", data.itemName);
  addField("Quantidade", String(data.quantity));
  addField("Data de Entrega", format(new Date(data.deliveryDate), "dd 'de' MMMM 'de' yyyy", { locale: pt }));
  if (data.expiryDate) {
    addField("Validade", format(new Date(data.expiryDate), "dd 'de' MMMM 'de' yyyy", { locale: pt }));
  }

  // Notes
  if (data.notes) {
    y += 4;
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Observações", marginLeft, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(data.notes, contentWidth);
    noteLines.forEach((line: string) => {
      checkPage(6);
      doc.text(line, marginLeft, y);
      y += 5;
    });
    y += 6;
  }

  // Declaration
  y += 6;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const declaration = `Declaro que recebi o(s) equipamento(s) de proteção individual acima descrito(s), em bom estado de conservação, comprometendo-me a utilizá-lo(s) de forma adequada durante o exercício das minhas funções, conforme as normas de segurança vigentes.`;
  const declLines = doc.splitTextToSize(declaration, contentWidth);
  declLines.forEach((line: string) => {
    checkPage(6);
    doc.text(line, marginLeft, y);
    y += 5;
  });

  // Signature section
  y += 14;
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

  const filename = `epi-${data.employeeName.replace(/\s+/g, "-").toLowerCase()}-${data.itemName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(data.deliveryDate), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}
