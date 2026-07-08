// Export file generation (SDD 19.3). CSV/XLSX cells beginning with formula
// characters are neutralised (SDD 17.4). Files are written to a short-lived
// directory and served through a one-time download token that expires.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export const EXPORT_DIR = path.join(os.tmpdir(), "lulafi-exports");
fs.mkdirSync(EXPORT_DIR, { recursive: true });

function neutralise(v) {
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(v)) return `'${v}`;
  return v;
}

export async function generateExportFile({ jobId, format, columns, rows, meta }) {
  const filename = `${jobId}.${format}`;
  const filePath = path.join(EXPORT_DIR, filename);

  if (format === "csv") {
    const header = columns.map((c) => c.header).join(",");
    const lines = rows.map((r) =>
      columns.map((c) => csvCell(neutralise(r[c.key]))).join(","),
    );
    const metaLines = Object.entries(meta || {}).map(([k, v]) => `# ${k}: ${csvCell(String(v))}`);
    fs.writeFileSync(filePath, [...metaLines, header, ...lines].join("\n"), "utf8");
  } else if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "lulaFi Analytics POC";
    const ws = wb.addWorksheet("Report");
    // Metadata block (SDD 19.3 report metadata).
    Object.entries(meta || {}).forEach(([k, v]) => ws.addRow([k, String(v)]));
    ws.addRow([]);
    ws.addRow(columns.map((c) => c.header)).font = { bold: true };
    rows.forEach((r) => ws.addRow(columns.map((c) => neutralise(r[c.key]))));
    ws.columns.forEach((col) => { col.width = 22; });
    await wb.xlsx.writeFile(filePath);
  } else if (format === "pdf") {
    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      doc.fontSize(16).fillColor("#123a8f").text("lulaFi Analytics Report", { continued: false });
      doc.moveDown(0.5).fontSize(9).fillColor("#555");
      Object.entries(meta || {}).forEach(([k, v]) => doc.text(`${k}: ${v}`));
      doc.moveDown(0.5).fillColor("#000").fontSize(10);
      const colWidth = (515) / columns.length;
      doc.font("Helvetica-Bold");
      let x = 40;
      const headerY = doc.y;
      columns.forEach((c) => { doc.text(c.header, x, headerY, { width: colWidth }); x += colWidth; });
      doc.moveDown(0.3).font("Helvetica");
      rows.slice(0, 400).forEach((r) => {
        const y = doc.y;
        let cx = 40;
        columns.forEach((c) => { doc.text(String(r[c.key] ?? ""), cx, y, { width: colWidth }); cx += colWidth; });
        doc.moveDown(0.2);
        if (doc.y > 780) doc.addPage();
      });
      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });
  } else {
    throw new Error(`Unsupported format ${format}`);
  }

  const { size } = fs.statSync(filePath);
  return { filePath, filename, bytes: size, rowCount: rows.length };
}

function csvCell(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
