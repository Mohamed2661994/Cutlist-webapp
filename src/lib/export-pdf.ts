import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import type { ExportProjectData } from "@/lib/export-excel";
import { materialLabels, partCategoryLabels } from "@/lib/cutlist";

type AutoTableDoc = jsPDF & {
  lastAutoTable?: { finalY: number };
  internal: {
    pageSize: { getWidth: () => number; getHeight: () => number };
    getNumberOfPages: () => number;
  };
};

export function exportProjectToPdf(data: ExportProjectData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const autoDoc = doc as AutoTableDoc;

  const pageWidth = doc.internal.pageSize.getWidth();
  const title = data.projectName || "مشروع تقطيع خشب";
  const dateStr = new Date().toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Cutlist Workshop Report", 14, 12);

  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Project: ${title} | Date: ${dateStr}`, 14, 19);

  // Summary Metrics Section
  let currentY = 32;

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Project Summary", 14, currentY);
  currentY += 4;

  const totalPanels = data.calculatedParts.reduce((sum, p) => sum + p.qty, 0);
  const totalSheets = data.sheetLayout
    ? data.sheetLayout.stocks.reduce((sum, s) => sum + s.sheets.length, 0)
    : "--";
  const totalAreaM2 = data.sheetLayout
    ? data.sheetLayout.stocks.reduce((sum, s) => sum + s.totalAreaM2, 0).toFixed(2)
    : "--";

  autoTable(doc, {
    startY: currentY,
    theme: "grid",
    head: [["Cabinets Count", "Custom Parts", "Total Panels to Cut", "Estimated Sheets", "Total Area (m2)"]],
    body: [[
      String(data.units.length),
      String(data.customParts.length),
      String(totalPanels),
      String(totalSheets),
      String(totalAreaM2),
    ]],
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 9,
      halign: "center",
      textColor: [15, 23, 42],
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (autoDoc.lastAutoTable?.finalY ?? currentY) + 8;

  // Parts Cutlist Table
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Detailed Cutlist Parts (قائمة التقطيع)", 14, currentY);
  currentY += 4;

  const partsBody = data.calculatedParts.map((part, idx) => {
    const edgeBands: string[] = [];
    if (part.edgeBanding) {
      if (part.edgeBanding["length-start"]) edgeBands.push("L1");
      if (part.edgeBanding["length-end"]) edgeBands.push("L2");
      if (part.edgeBanding["width-start"]) edgeBands.push("W1");
      if (part.edgeBanding["width-end"]) edgeBands.push("W2");
    }

    const categoryText = partCategoryLabels[part.category] || part.category;
    const materialText = `${materialLabels[part.material] || part.material} (${part.thickness}mm)`;

    return [
      String(idx + 1),
      part.name,
      categoryText,
      String(part.qty),
      `${part.length} cm`,
      `${part.width} cm`,
      materialText,
      edgeBands.length > 0 ? edgeBands.join(" | ") : "-",
      part.grainDirection === "grain" ? "Grain (طولية)" : "Free (حر)",
    ];
  });

  autoTable(doc, {
    startY: currentY,
    theme: "striped",
    head: [[
      "#",
      "Part Name",
      "Category",
      "Qty",
      "Length",
      "Width",
      "Material & Thk",
      "Edge Banding",
      "Grain",
    ]],
    body: partsBody,
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 8,
      halign: "center",
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 35, halign: "left" },
      2: { cellWidth: 20 },
      3: { cellWidth: 10 },
      4: { cellWidth: 16 },
      5: { cellWidth: 16 },
      6: { cellWidth: 28 },
      7: { cellWidth: 24 },
      8: { cellWidth: 24 },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (autoDoc.lastAutoTable?.finalY ?? currentY) + 8;

  // Sheet Layout Breakdown if exists
  if (data.sheetLayout && data.sheetLayout.stocks.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Sheet Layout & Board Yield (توزيع الألواح)", 14, currentY);
    currentY += 4;

    const sheetRows: string[][] = [];
    data.sheetLayout.stocks.forEach((stock) => {
      stock.sheets.forEach((sheet) => {
        const usedPercent = Math.min(100, Math.round((sheet.usedLength / stock.boardLength) * 100));
        sheetRows.push([
          `${materialLabels[stock.material] || stock.material} - ${stock.thickness}mm`,
          `Sheet #${sheet.index}`,
          `${stock.boardLength} x ${stock.boardWidth} cm`,
          `${sheet.pieces.length} panels`,
          `${sheet.usedLength.toFixed(1)} cm`,
          `${usedPercent}% (Waste: ${100 - usedPercent}%)`,
        ]);
      });
    });

    autoTable(doc, {
      startY: currentY,
      theme: "grid",
      head: [["Material / Stock", "Sheet #", "Sheet Dimensions", "Placed Pieces", "Used Length", "Estimated Efficiency"]],
      body: sheetRows,
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 8,
        halign: "center",
        textColor: [15, 23, 42],
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer on all pages
  const totalPages = autoDoc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Cabinet Cut Optimizer | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  const safeName = (data.projectName || "cutlist-project")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  doc.save(`${safeName}-cutlist-${dateStr.replace(/\//g, "-")}.pdf`);
}
