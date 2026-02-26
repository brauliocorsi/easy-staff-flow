import jsPDF from "jspdf";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface PdfMeetingData {
  title: string;
  description: string | null;
  meeting_date: string;
  duration_minutes: number | null;
  started_at: string | null;
  status: string;
  agendas: {
    title: string;
    description: string | null;
    decision: string | null;
    sort_order: number;
  }[];
  participants: {
    employees: {
      first_name: string;
      last_name: string;
      position: string;
    } | null;
    present?: boolean;
  }[];
}

export function generateMeetingPdf(meeting: PdfMeetingData) {
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

  // ── Header ──
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ATA DE REUNIÃO", pageWidth / 2, y, { align: "center" });
  y += 12;

  // ── Divider ──
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 8;

  // ── Meeting info ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Título:", marginLeft, y);
  doc.setFont("helvetica", "normal");
  doc.text(meeting.title, marginLeft + 18, y);
  y += 7;

  if (meeting.description) {
    doc.setFont("helvetica", "bold");
    doc.text("Descrição:", marginLeft, y);
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(meeting.description, contentWidth - 28);
    doc.text(descLines, marginLeft + 28, y);
    y += descLines.length * 5 + 3;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Data:", marginLeft, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    format(new Date(meeting.meeting_date), "dd 'de' MMMM 'de' yyyy", { locale: pt }),
    marginLeft + 15,
    y
  );
  y += 7;

  if (meeting.duration_minutes) {
    doc.setFont("helvetica", "bold");
    doc.text("Duração:", marginLeft, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${meeting.duration_minutes} minutos`, marginLeft + 22, y);
    y += 7;
  }

  y += 4;

  // ── Divider ──
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 8;

  // ── Agendas / Pautas ──
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Pautas e Decisões", marginLeft, y);
  y += 8;

  doc.setFontSize(10);
  meeting.agendas.forEach((agenda, i) => {
    checkPage(30);

    // Agenda title
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}. ${agenda.title}`, marginLeft, y);
    y += 6;

    // Description
    if (agenda.description) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const lines = doc.splitTextToSize(agenda.description, contentWidth - 8);
      doc.text(lines, marginLeft + 6, y);
      y += lines.length * 4.5 + 2;
    }

    // Decision
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Decisão:", marginLeft + 6, y);
    doc.setFont("helvetica", "normal");
    const decisionText = agenda.decision || "Sem decisão registrada";
    const decLines = doc.splitTextToSize(decisionText, contentWidth - 30);
    doc.text(decLines, marginLeft + 24, y);
    y += decLines.length * 4.5 + 6;
  });

  if (meeting.agendas.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.text("Nenhuma pauta registrada.", marginLeft, y);
    y += 8;
  }

  y += 4;

  // ── Divider ──
  doc.setDrawColor(180, 180, 180);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 8;

  // ── Participants / Signatures ──
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Participantes e Assinaturas", marginLeft, y);
  y += 10;

  const signatureLineWidth = 70;
  const colWidth = contentWidth / 2;

  meeting.participants.forEach((p, i) => {
    if (!p.employees) return;

    checkPage(35);

    const col = i % 2;
    const xBase = marginLeft + col * colWidth;

    // Signature line
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    doc.line(xBase, y + 15, xBase + signatureLineWidth, y + 15);

    // Name
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(
      `${p.employees.first_name.trim()} ${p.employees.last_name}`,
      xBase,
      y + 20
    );

    // Position
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(p.employees.position, xBase, y + 24);
    doc.setTextColor(0, 0, 0);

    // Presence badge
    if (p.present) {
      doc.setFontSize(7);
      doc.setTextColor(0, 128, 0);
      doc.text("● Presente", xBase + signatureLineWidth - 15, y + 20);
      doc.setTextColor(0, 0, 0);
    }

    // Move y down after every 2 participants (row complete)
    if (col === 1 || i === meeting.participants.length - 1) {
      y += 32;
    }
  });

  // ── Footer ──
  checkPage(20);
  y += 8;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Documento gerado automaticamente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );

  // Save
  const filename = `ata-${meeting.title.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(meeting.meeting_date), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}
