import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PdfColumn = {
  header: string;
  key: string;
};

type PdfRow = Record<string, string | number>;

type BuildPdfParams = {
  title: string;
  subtitle: string;
  columns: PdfColumn[];
  rows: PdfRow[];
};

const LOGO_PATH = "/logocooptransparente.png";

async function imagePathToDataUrl(path: string) {
  return await new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("No se pudo preparar el contexto del logo"));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("No se pudo cargar el logo de la cooperativa"));
    image.src = path;
  });
}

export async function buildA4TablePdf({ title, subtitle, columns, rows }: BuildPdfParams) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const generatedAt = new Date().toLocaleString("es-AR");
  const logoDataUrl = await imagePathToDataUrl(LOGO_PATH);

  doc.addImage(logoDataUrl, "PNG", 14, 10, 16, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Cooperativa Electrica de San Jose de la Dormida", 34, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Sistema de Gestion PFC - Documento exportado desde el sistema institucional", 34, 19);
  doc.setLineWidth(0.4);
  doc.setDrawColor(23, 54, 93);
  doc.line(14, 29, 196, 29);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 14, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, 14, 42);
  doc.text(`Generado: ${generatedAt}`, 14, 47);

  autoTable(doc, {
    startY: 52,
    head: [columns.map((column) => column.header)],
    body: rows.map((row) => columns.map((column) => String(row[column.key] ?? ""))),
    styles: {
      fontSize: 9,
      cellPadding: 2.4,
      valign: "middle",
      overflow: "linebreak",
      textColor: [28, 31, 36],
      lineColor: [221, 226, 235],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [23, 54, 93],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 52, right: 10, bottom: 14, left: 10 },
  });

  return doc;
}

export function downloadPdf(doc: jsPDF, fileName: string) {
  doc.save(fileName);
}

export function printPdf(doc: jsPDF) {
  const blobUrl = doc.output("bloburl");
  const printWindow = window.open(blobUrl, "_blank");
  if (!printWindow) return false;

  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
  return true;
}
