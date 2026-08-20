"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import confetti from "canvas-confetti";

import { Button } from "@/components/ui/button";
import { exportProjectToExcel, type ExportProjectData } from "@/lib/export-excel";
import { exportProjectToPdf } from "@/lib/export-pdf";

type ExportActionsProps = {
  data: ExportProjectData;
  onPrintSnapshot?: () => void;
  variant?: "compact" | "full";
};

export function ExportActions({ data, onPrintSnapshot, variant = "full" }: ExportActionsProps) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const hasData = data.calculatedParts.length > 0;

  const handleExportPdf = () => {
    if (!hasData) return;
    setIsExportingPdf(true);
    try {
      exportProjectToPdf(data);
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.85 },
      });
    } catch (err) {
      console.error("PDF Export error:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    if (!hasData) return;
    setIsExportingExcel(true);
    try {
      exportProjectToExcel(data);
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.85 },
      });
    } catch (err) {
      console.error("Excel Export error:", err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 border-slate-700/60 bg-slate-800/80 text-xs text-slate-200 hover:bg-slate-700 hover:text-white"
          onClick={handleExportPdf}
          disabled={!hasData || isExportingPdf}
        >
          <FileText className="size-3.5 text-rose-400" />
          {isExportingPdf ? "جارٍ التصدير..." : "PDF"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 border-slate-700/60 bg-slate-800/80 text-xs text-slate-200 hover:bg-slate-700 hover:text-white"
          onClick={handleExportExcel}
          disabled={!hasData || isExportingExcel}
        >
          <FileSpreadsheet className="size-3.5 text-emerald-400" />
          {isExportingExcel ? "جارٍ التصدير..." : "Excel"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        className="h-10 gap-2 border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:text-white"
        onClick={handleExportPdf}
        disabled={!hasData || isExportingPdf}
      >
        <FileText className="size-4 text-rose-400" />
        {isExportingPdf ? "جارٍ تجهيز الـ PDF..." : "تحميل تقرير PDF"}
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-10 gap-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-white"
        onClick={handleExportExcel}
        disabled={!hasData || isExportingExcel}
      >
        <FileSpreadsheet className="size-4 text-emerald-400" />
        {isExportingExcel ? "جارٍ تجهيز ملف Excel..." : "تصدير جدول Excel (BOM)"}
      </Button>

      {onPrintSnapshot ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 gap-2 border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white"
          onClick={onPrintSnapshot}
          disabled={!hasData}
        >
          <Printer className="size-4" />
          طباعة سريعة
        </Button>
      ) : null}
    </div>
  );
}
