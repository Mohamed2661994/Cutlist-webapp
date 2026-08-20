import * as XLSX from "xlsx";

import type {
  CutlistPart,
  SheetLayoutResult,
} from "@/lib/cutlist";
import {
  materialLabels,
  partCategoryLabels,
  grainDirectionLabels,
} from "@/lib/cutlist";
import type { CabinetUnit, CustomProjectPart, ProjectSettings } from "@/lib/project-persistence";

export type ExportProjectData = {
  projectName: string;
  userName?: string;
  settings?: ProjectSettings | null;
  units: CabinetUnit[];
  customParts: CustomProjectPart[];
  calculatedParts: CutlistPart[];
  sheetLayout?: SheetLayoutResult | null;
};

export function exportProjectToExcel(data: ExportProjectData) {
  const wb = XLSX.utils.book_new();

  // 1. Project Summary Sheet
  const summaryRows = [
    ["تقرير مشروع التقطيع - Cutlist Optimizer", ""],
    ["اسم المشروع", data.projectName || "مشروع جديد"],
    ["المستخدم", data.userName || "مستخدم محلي"],
    ["تاريخ التصدير", new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })],
    ["", ""],
    ["إحصائيات المشروع", ""],
    ["إجمالي عدد الوحدات (Cabinets)", data.units.length],
    ["إجمالي المقاسات الحرة (Custom Parts)", data.customParts.length],
    ["إجمالي عدد القطع المطلوب قصها (Total Panels)", data.calculatedParts.reduce((sum, p) => sum + p.qty, 0)],
    ["", ""],
  ];

  if (data.sheetLayout) {
    const totalSheets = data.sheetLayout.stocks.reduce((sum, s) => sum + s.sheets.length, 0);
    const totalAreaM2 = data.sheetLayout.stocks.reduce((sum, s) => sum + s.totalAreaM2, 0);
    summaryRows.push(
      ["إجمالي عدد الألواح المقدرة", totalSheets],
      ["إجمالي مساحة الخشب (م²)", Number(totalAreaM2.toFixed(2))],
      ["", ""]
    );
  }

  // Cost estimates if settings exist
  if (data.settings) {
    const s = data.settings;
    const boardPrice = s.boardSheetPrice || 0;
    const backPrice = s.backSheetPrice || 0;
    const edgePrice = s.edgeBandPricePerMeter || 0;
    const laborPrice = s.laborPricePerSquareMeter || 0;

    let totalBoardSheets = 0;
    let totalBackSheets = 0;

    if (data.sheetLayout) {
      for (const stock of data.sheetLayout.stocks) {
        if (stock.isBackStock) {
          totalBackSheets += stock.sheets.length;
        } else {
          totalBoardSheets += stock.sheets.length;
        }
      }
    }

    const estimatedBoardsCost = totalBoardSheets * boardPrice;
    const estimatedBackCost = totalBackSheets * backPrice;

    summaryRows.push(
      ["تقدير التكاليف والخامات", ""],
      ["سعر لوح الهيكل / الأبواب", `${boardPrice} ج.م`],
      ["سعر لوح الظهرية", `${backPrice} ج.م`],
      ["سعر متر شريط القشاط", `${edgePrice} ج.م`],
      ["سعر المصنعية للمتر المربع", `${laborPrice} ج.م`],
      ["تكلفة الألواح التقديرية", `${estimatedBoardsCost + estimatedBackCost} ج.م`]
    );
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص المشروع");

  // 2. Cutlist Parts Sheet
  const partsHeaders = [
    "م",
    "اسم القطعة",
    "التصنيف",
    "الكمية",
    "الطول (سم)",
    "العرض (سم)",
    "السماكة (مم)",
    "الخامة",
    "شريط القشاط (Edge Banding)",
    "اتجاه الثمرة (Grain)",
    "ملاحظات",
  ];

  const partsRows: (string | number)[][] = [partsHeaders];

  data.calculatedParts.forEach((part, index) => {
    const edgeBands: string[] = [];
    if (part.edgeBanding) {
      if (part.edgeBanding["length-start"]) edgeBands.push("طول 1");
      if (part.edgeBanding["length-end"]) edgeBands.push("طول 2");
      if (part.edgeBanding["width-start"]) edgeBands.push("عرض 1");
      if (part.edgeBanding["width-end"]) edgeBands.push("عرض 2");
    }

    partsRows.push([
      index + 1,
      part.name,
      partCategoryLabels[part.category] || part.category,
      part.qty,
      part.length,
      part.width,
      part.thickness,
      materialLabels[part.material] || part.material,
      edgeBands.length > 0 ? edgeBands.join(" + ") : "بدون شريط",
      grainDirectionLabels[part.grainDirection] || part.grainDirection,
      part.notes || "-",
    ]);
  });

  const wsParts = XLSX.utils.aoa_to_sheet(partsRows);
  wsParts["!cols"] = [
    { wch: 6 },
    { wch: 26 },
    { wch: 16 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 25 },
    { wch: 16 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsParts, "جدول التقطيع");

  // 3. Sheet Layout Breakdown Sheet
  if (data.sheetLayout && data.sheetLayout.stocks.length > 0) {
    const layoutHeaders = [
      "م",
      "الخامة والسماكة",
      "رقم اللوح",
      "مقاس اللوح (سم)",
      "عدد القطع في اللوح",
      "الطول المستهلك (سم)",
      "نسبة الاستخدام التقريبية",
    ];

    const layoutRows: (string | number)[][] = [layoutHeaders];
    let rowNum = 1;

    data.sheetLayout.stocks.forEach((stock) => {
      stock.sheets.forEach((sheet) => {
        const pieceCount = sheet.pieces.length;
        const usedPercent = Math.min(100, Math.round((sheet.usedLength / stock.boardLength) * 100));
        layoutRows.push([
          rowNum++,
          `${materialLabels[stock.material] || stock.material} (${stock.thickness} مم)`,
          `لوح ${sheet.index}`,
          `${stock.boardLength} × ${stock.boardWidth}`,
          pieceCount,
          `${sheet.usedLength.toFixed(1)} سم`,
          `${usedPercent}%`,
        ]);
      });
    });

    const wsLayout = XLSX.utils.aoa_to_sheet(layoutRows);
    wsLayout["!cols"] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsLayout, "توزيع الألواح");
  }

  // Trigger download
  const safeName = (data.projectName || "cutlist-project")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  const fileName = `${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
