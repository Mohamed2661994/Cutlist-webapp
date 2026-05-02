import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Calculator,
  Download,
  FolderOpen,
  Info,
  Layers2,
  PanelsTopLeft,
  Plus,
  Printer,
  Ruler,
  RotateCcw,
  RotateCw,
  ScanSearch,
  Save,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildSheetLayout,
  calculateCabinetCutlist,
  cabinetTypeLabels,
  cornerHandLabels,
  cornerPlacementLabels,
  defaultInput,
  edgeBandSideLabels,
  formatCm,
  frontOptionLabels,
  grainDirectionLabels,
  materialLabels,
  partCategoryLabels,
  round2,
  type CabinetCutlistResult,
  type CutlistPart,
  type CabinetInput,
  type CabinetType,
  type CornerHand,
  type PartCategory,
  type EdgeBandProfile,
  type EdgeBandSide,
  type FrontOption,
  type GrainDirection,
  type MaterialType,
  type SheetLayoutPiece,
  type SheetLayoutResult,
  type SheetLayoutStock,
} from "@/lib/cutlist";

const CabinetPreview = lazy(async () => {
  const module = await import("@/components/cabinet-preview");
  return { default: module.CabinetPreview };
});

const ProjectPreview = lazy(async () => {
  const module = await import("@/components/cabinet-preview");
  return { default: module.ProjectPreview };
});

type CabinetUnit = CabinetInput & {
  id: string;
  title: string;
};

type CalculatedUnitView = {
  unit: CabinetUnit;
  result: CabinetCutlistResult;
  sheetLayout: SheetLayoutResult;
  frontPieceCount: number;
};

type WorkshopPartCard = {
  id: string;
  unitId: string;
  unitTitle: string;
  part: CutlistPart;
};

type ProjectPartLink = {
  partId: string;
  code: string;
  sourceKeys: string[];
  unitIds: string[];
  sheetReferences: string[];
  primarySheetReference: string | null;
};

type WorkshopExecutionCard = WorkshopPartCard & {
  operationOrder: number;
  projectPartId: string | null;
  partCode: string;
  sheetReferences: string[];
  primarySheetReference: string | null;
};

type UnitCostSummary = {
  unitId: string;
  unitTitle: string;
  panelCount: number;
  totalAreaM2: number;
  boardSheetCount: number;
  backSheetCount: number;
  boardUsedAreaM2: number;
  backUsedAreaM2: number;
  edgeBandLengthM: number;
  sheetCost: number;
  laborCost: number;
  edgeBandCost: number;
  totalCost: number;
};

type UnitPreset = {
  id: string;
  title: string;
  description: string;
  input: CabinetInput;
};

type CustomProjectPart = {
  id: string;
  title: string;
  length: number;
  width: number;
  qty: number;
  thickness: number;
  material: MaterialType;
  category: PartCategory;
  grainDirection: GrainDirection;
  edgeBanding: EdgeBandProfile;
};

type CustomProjectPartDraft = {
  title: string;
  length: string;
  width: string;
  qty: string;
  thickness: string;
  material: MaterialType;
  category: PartCategory;
  grainDirection: GrainDirection;
  edgeBanding: EdgeBandProfile;
};

type EdgeBandOverrideMap = Record<string, EdgeBandProfile>;

type AggregatedProjectPart = {
  part: CutlistPart;
  sourceKeys: string[];
};

type ProjectArrangementItem = {
  id: string;
  offsetX: number;
  offsetZ: number;
  offsetY: number;
  rotationY: number;
};

type SavedProject = {
  id: string;
  name: string;
  updatedAt: string;
  settings: ProjectSettings;
  units: CabinetUnit[];
  customParts: CustomProjectPart[];
  arrangement: ProjectArrangementItem[];
  edgeBandOverrides: EdgeBandOverrideMap;
};

type CabinetProjectSettings = Pick<
  CabinetInput,
  "material" | "boardThickness" | "backThickness"
>;

type ProjectPricingSettings = {
  boardSheetLength: number;
  boardSheetWidth: number;
  backSheetLength: number;
  backSheetWidth: number;
  cutKerf: number;
  trimMargin: number;
  boardSheetPrice: number;
  backSheetPrice: number;
  laborPricePerSquareMeter: number;
  edgeBandPricePerMeter: number;
};

type ProjectSettings = CabinetProjectSettings & ProjectPricingSettings;

type EditorNumericField = Pick<
  CabinetInput,
  | "width"
  | "height"
  | "depth"
  | "returnDepth"
  | "shelfCount"
  | "drawerCount"
  | "doorLeafCount"
>;

type EditorNumericFieldKey = keyof EditorNumericField;

type ProjectSettingsNumericDrafts = {
  boardThickness: string;
  backThickness: string;
  boardSheetLength: string;
  boardSheetWidth: string;
  backSheetLength: string;
  backSheetWidth: string;
  cutKerf: string;
  trimMargin: string;
  boardSheetPrice: string;
  backSheetPrice: string;
  laborPricePerSquareMeter: string;
  edgeBandPricePerMeter: string;
};

type WorkspaceTab = "project" | "builder" | "preview" | "results" | "library";

type BuilderTab = "unit" | "custom" | "units";

type ResultsSectionKey = "costs" | "layout" | "metrics" | "workshop" | "parts";

const projectSettingsStorageKey = "cutlist.project-settings.v1";
const savedProjectsStorageKey = "cutlist.saved-projects.v1";
const defaultBoardSheetLength = 240;
const defaultBoardSheetWidth = 120;

const defaultProjectSettings: ProjectSettings = {
  material: defaultInput.material,
  boardThickness: defaultInput.boardThickness,
  backThickness: defaultInput.backThickness,
  boardSheetLength: defaultBoardSheetLength,
  boardSheetWidth: defaultBoardSheetWidth,
  backSheetLength: defaultBoardSheetLength,
  backSheetWidth: defaultBoardSheetWidth,
  cutKerf: 0,
  trimMargin: 0,
  boardSheetPrice: 0,
  backSheetPrice: 0,
  laborPricePerSquareMeter: 0,
  edgeBandPricePerMeter: 0,
};

const unitPresets: UnitPreset[] = [
  {
    id: "base-standard",
    title: "وحدة أرضية قياسية",
    description: "هيكل بدلف بمقاس شائع للمطابخ السفلية.",
    input: {
      ...defaultInput,
      width: 60,
      height: 90,
      depth: 60,
      shelfCount: 1,
      cabinetType: "base",
      frontOption: "doors",
      doorLeafCount: 2,
    },
  },
  {
    id: "drawer-base",
    title: "وحدة أدراج",
    description: "وحدة أرضية بأربعة أدراج لتخزين المطبخ.",
    input: {
      ...defaultInput,
      width: 80,
      height: 90,
      depth: 60,
      cabinetType: "base",
      frontOption: "drawers",
      drawerCount: 4,
    },
  },
  {
    id: "sink-base",
    title: "وحدة حوض",
    description: "وحدة أرضية بدلفتين مع رفوف صفرية أسفل الحوض.",
    input: {
      ...defaultInput,
      width: 100,
      height: 90,
      depth: 60,
      cabinetType: "base",
      frontOption: "doors",
      shelfCount: 0,
      doorLeafCount: 2,
    },
  },
  {
    id: "wall-standard",
    title: "وحدة علوية",
    description: "وحدة معلقة بارتفاع متوسط ورف داخلي.",
    input: {
      ...defaultInput,
      width: 80,
      height: 70,
      depth: 35,
      cabinetType: "wall",
      frontOption: "doors",
      shelfCount: 1,
      doorLeafCount: 2,
    },
  },
  {
    id: "tall-pantry",
    title: "وحدة طويلة",
    description: "عمود تخزين كامل بارتفاع كبير وعدة رفوف.",
    input: {
      ...defaultInput,
      width: 60,
      height: 220,
      depth: 60,
      cabinetType: "tall",
      frontOption: "doors",
      shelfCount: 4,
      doorLeafCount: 2,
    },
  },
  {
    id: "corner-l-base",
    title: "ركنة زاوية 45°",
    description: "وحدة ركنة مائلة 45° لتجهيز أركان المطبخ.",
    input: {
      ...defaultInput,
      width: 100,
      height: 90,
      depth: 60,
      returnDepth: 100,
      cabinetType: "corner-l-base",
      cornerHand: "left",
      frontOption: "none",
      shelfCount: 1,
      doorLeafCount: 2,
    },
  },
];

function buildEmptyEditorInput(settings: ProjectSettings): CabinetInput {
  return {
    ...defaultInput,
    ...getCabinetProjectSettings(settings),
    width: 0,
    height: 0,
    depth: 0,
    shelfCount: 0,
    drawerCount: 0,
    doorLeafCount: 0,
  };
}

function applyProjectSettingsToInput(
  input: CabinetInput,
  settings: ProjectSettings,
): CabinetInput {
  return {
    ...input,
    ...getCabinetProjectSettings(settings),
  };
}

function getCabinetProjectSettings(
  settings: ProjectSettings,
): CabinetProjectSettings {
  return {
    material: settings.material,
    boardThickness: settings.boardThickness,
    backThickness: settings.backThickness,
  };
}

function buildProjectPreviewUnits(
  units: CabinetUnit[],
  arrangement: ProjectArrangementItem[],
) {
  function isWallMountedUnit(unit: CabinetUnit) {
    return unit.cabinetType === "wall" || unit.cabinetType === "corner-l-wall";
  }

  function getUnitPlanWidth(unit: CabinetUnit) {
    return unit.cabinetType === "corner-l-base" ||
      unit.cabinetType === "corner-l-wall"
      ? unit.width + Math.max(unit.returnDepth - unit.boardThickness, 0)
      : unit.width;
  }

  function getUnitPlanDepth(unit: CabinetUnit) {
    return unit.cabinetType === "corner-l-base" ||
      unit.cabinetType === "corner-l-wall"
      ? Math.max(unit.depth, unit.returnDepth)
      : unit.depth;
  }

  function getUnitLengthAlongDirection(
    unit: CabinetUnit,
    directionIndex: number,
  ) {
    return directionIndex % 2 === 0
      ? getUnitPlanWidth(unit)
      : getUnitPlanDepth(unit);
  }

  function getAutoRotationForDirection(directionIndex: number) {
    return [0, 270, 180, 90][directionIndex % 4];
  }

  function isCornerUnit(unit: CabinetUnit) {
    return (
      unit.cabinetType === "corner-l-base" ||
      unit.cabinetType === "corner-l-wall"
    );
  }

  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const orderedUnits = arrangement
    .map((item) => {
      const unit = unitMap.get(item.id);
      if (!unit) {
        return undefined;
      }

      return { item, unit, result: calculateCabinetCutlist(unit) };
    })
    .filter(
      (
        entry,
      ): entry is {
        item: ProjectArrangementItem;
        unit: CabinetUnit;
        result: CabinetCutlistResult;
      } => Boolean(entry),
    );

  const gapCm = 4;
  const tallestLowerUnitCm = orderedUnits
    .filter((entry) => !isWallMountedUnit(entry.unit))
    .reduce((max, entry) => Math.max(max, entry.unit.height), 0);
  const wallBottomLiftCm = Math.max(tallestLowerUnitCm + 60, 150);
  const directionVectors = [
    { x: 1, z: 0 },
    { x: 0, z: -1 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
  ] as const;

  let directionIndex = 0;
  let cursorX = 0;
  let cursorZ = 0;

  const laidOutUnits = orderedUnits.map((entry) => {
    const autoRotationY = getAutoRotationForDirection(directionIndex);
    const direction = directionVectors[directionIndex % 4];
    const unitLengthAlongDirection = getUnitLengthAlongDirection(
      entry.unit,
      directionIndex,
    );
    const centerX = cursorX + direction.x * (unitLengthAlongDirection / 2);
    const centerZ = cursorZ + direction.z * (unitLengthAlongDirection / 2);
    const defaultY = isWallMountedUnit(entry.unit) ? wallBottomLiftCm : 0;
    cursorX += direction.x * (unitLengthAlongDirection + gapCm);
    cursorZ += direction.z * (unitLengthAlongDirection + gapCm);

    const previewUnit = {
      id: entry.unit.id,
      title: entry.unit.title,
      input: entry.unit,
      result: entry.result,
      basePosition: [centerX / 100, defaultY / 100, centerZ / 100] as [
        number,
        number,
        number,
      ],
      position: [
        (centerX + entry.item.offsetX) / 100,
        (defaultY + entry.item.offsetY) / 100,
        (centerZ + entry.item.offsetZ) / 100,
      ] as [number, number, number],
      offsetX: entry.item.offsetX,
      offsetY: entry.item.offsetY,
      offsetZ: entry.item.offsetZ,
      rotationY: (autoRotationY + entry.item.rotationY) % 360,
    };

    if (isCornerUnit(entry.unit)) {
      directionIndex += 1;
    }

    return previewUnit;
  });

  if (laidOutUnits.length === 0) {
    return laidOutUnits;
  }

  const minX = Math.min(...laidOutUnits.map((unit) => unit.basePosition[0]));
  const maxX = Math.max(...laidOutUnits.map((unit) => unit.basePosition[0]));
  const minZ = Math.min(...laidOutUnits.map((unit) => unit.basePosition[2]));
  const maxZ = Math.max(...laidOutUnits.map((unit) => unit.basePosition[2]));
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  return laidOutUnits.map((unit) => ({
    ...unit,
    basePosition: [
      round2(unit.basePosition[0] - centerX),
      unit.basePosition[1],
      round2(unit.basePosition[2] - centerZ),
    ] as [number, number, number],
    position: [
      round2(unit.position[0] - centerX),
      unit.position[1],
      round2(unit.position[2] - centerZ),
    ] as [number, number, number],
    rotationY: ((unit.rotationY % 360) + 360) % 360,
  }));
}

function createUnitId() {
  return `unit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createProjectId() {
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createUnitTitle(index: number) {
  return `وحدة ${index + 1}`;
}

function getFrontPieceCount(result: CabinetCutlistResult) {
  return result.parts
    .filter((part) => part.category === "front")
    .reduce((sum, part) => sum + part.qty, 0);
}

function getStockLabel(thickness: number, isBackStock: boolean) {
  if (isBackStock) {
    return `ألواح الظهر ${formatCm(thickness)}`;
  }

  return `ألواح الجسم والواجهات ${formatCm(thickness)}`;
}

function getStockAvailableAreaM2(stock: SheetLayoutStock) {
  return round2(
    stock.sheets.length * ((stock.boardLength * stock.boardWidth) / 10000),
  );
}

function getStockWasteAreaM2(stock: SheetLayoutStock) {
  return round2(
    Math.max(getStockAvailableAreaM2(stock) - stock.totalAreaM2, 0),
  );
}

function buildProjectWasteInsight(sheetLayout: SheetLayoutResult | null) {
  if (!sheetLayout || sheetLayout.stocks.length === 0) {
    return null;
  }

  const mostWastefulStock = [...sheetLayout.stocks]
    .map((stock) => ({
      stock,
      availableAreaM2: getStockAvailableAreaM2(stock),
      wasteAreaM2: getStockWasteAreaM2(stock),
    }))
    .sort(
      (left, right) =>
        right.wasteAreaM2 - left.wasteAreaM2 ||
        right.stock.sheets.length - left.stock.sheets.length,
    )[0];

  if (!mostWastefulStock || mostWastefulStock.wasteAreaM2 <= 0) {
    return "استغلال الألواح قريب من الكامل، ولا توجد مجموعة فيها هالك ملحوظ.";
  }

  return `${getStockLabel(mostWastefulStock.stock.thickness, mostWastefulStock.stock.isBackStock)} هي أكبر مصدر للهالك الآن: ${mostWastefulStock.stock.sheets.length} لوح بمساحة متاحة ${mostWastefulStock.availableAreaM2} م²، المستخدم منها ${mostWastefulStock.stock.totalAreaM2} م²، فالمتبقي ${mostWastefulStock.wasteAreaM2} م² غير مستغل.`;
}

function getResettableFieldValue(value: number) {
  return value === 0 ? "" : String(value);
}

function normalizeNumericInput(value: string) {
  return value.replace(/,/g, ".").replace(/٫/g, ".");
}

function formatMmFromCm(valueCm: number) {
  const valueMm = round2(valueCm * 10);
  return Number.isInteger(valueMm) ? `${valueMm} مم` : `${valueMm} مم`;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(
    round2(value),
  );
}

function formatSheetSize(length: number, width: number) {
  return `${formatCm(width)} × ${formatCm(length)}`;
}

function formatOptionalMmFromCm(valueCm: number) {
  return valueCm > 0 ? formatMmFromCm(valueCm) : "0 مم";
}

function formatProjectUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeCsvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}

function loadSavedProjects() {
  if (typeof window === "undefined") {
    return [] as SavedProject[];
  }

  try {
    const storedValue = window.localStorage.getItem(savedProjectsStorageKey);
    if (!storedValue) {
      return [] as SavedProject[];
    }

    const parsedValue = JSON.parse(storedValue) as SavedProject[];
    return parsedValue
      .map((project) => ({
        ...project,
        customParts: (project.customParts ?? []).map((part) => ({
          ...part,
          edgeBanding: part.edgeBanding ?? {},
        })),
        edgeBandOverrides: project.edgeBandOverrides ?? {},
      }))
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      );
  } catch {
    return [] as SavedProject[];
  }
}

function buildProjectArrangement(
  units: CabinetUnit[],
  arrangement: ProjectArrangementItem[],
) {
  const travelLimitCm = getProjectArrangementTravelLimit(units);
  const arrangementMap = new Map(arrangement.map((item) => [item.id, item]));

  return units.map((unit) => {
    const current = arrangementMap.get(unit.id);

    return {
      id: unit.id,
      offsetX:
        current &&
        Number.isFinite(current.offsetX) &&
        Math.abs(current.offsetX) <= travelLimitCm
          ? round2(current.offsetX)
          : 0,
      offsetY:
        current &&
        Number.isFinite(current.offsetY) &&
        Math.abs(current.offsetY) <= travelLimitCm
          ? round2(current.offsetY)
          : 0,
      offsetZ:
        current &&
        Number.isFinite(current.offsetZ) &&
        Math.abs(current.offsetZ) <= travelLimitCm
          ? round2(current.offsetZ)
          : 0,
      rotationY:
        current && Number.isFinite(current.rotationY)
          ? ((current.rotationY % 360) + 360) % 360
          : 0,
    };
  });
}

function getProjectArrangementTravelLimit(units: CabinetUnit[]) {
  const maxUnitSpan = units.reduce(
    (max, unit) =>
      Math.max(max, unit.width, unit.height, unit.depth, unit.returnDepth),
    0,
  );

  return Math.max(150, round2(maxUnitSpan * Math.max(units.length, 1.25)));
}

function buildProjectCsv(
  projectName: string,
  settings: ProjectSettings,
  parts: CutlistPart[],
  sheetLayout: SheetLayoutResult | null,
  projectPartLinkMap: Map<string, ProjectPartLink>,
) {
  const rows: string[][] = [
    ["اسم المشروع", projectName],
    ["الخامة", materialLabels[settings.material]],
    [
      "مقاس لوح 18",
      formatSheetSize(settings.boardSheetLength, settings.boardSheetWidth),
    ],
    [
      "مقاس لوح 6",
      formatSheetSize(settings.backSheetLength, settings.backSheetWidth),
    ],
    ["سمك السلاح", formatOptionalMmFromCm(settings.cutKerf)],
    ["حافة التشطيب", formatOptionalMmFromCm(settings.trimMargin)],
    [],
    [
      "كود القطعة",
      "الجزء",
      "الفئة",
      "العدد",
      "الطول",
      "العرض",
      "السمك",
      "مرجع اللوح",
      "الحواف",
      "طول الحواف",
      "الملاحظات",
    ],
    ...parts.map((part) => [
      projectPartLinkMap.get(part.id)?.code ?? "--",
      part.name,
      partCategoryLabels[part.category],
      String(part.qty),
      formatCm(part.length),
      formatCm(part.width),
      formatCm(part.thickness),
      projectPartLinkMap.get(part.id)?.primarySheetReference ?? "",
      formatPartEdgeBanding(part),
      formatCm(getPartEdgeBandLengthCm(part)),
      part.notes,
    ]),
  ];

  if (sheetLayout) {
    rows.push(
      [],
      [
        "المجموعة",
        "عدد الألواح",
        "مساحة المستخدم",
        "مساحة الهالك",
        "مقاس اللوح",
      ],
      ...sheetLayout.stocks.map((stock) => [
        getStockLabel(stock.thickness, stock.isBackStock),
        String(stock.sheets.length),
        `${stock.totalAreaM2} م²`,
        `${getStockWasteAreaM2(stock)} م²`,
        formatSheetSize(stock.boardLength, stock.boardWidth),
      ]),
    );
  }

  return `\uFEFF${rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n")}`;
}

function buildPrintDocument(
  projectName: string,
  settings: ProjectSettings,
  summary: {
    unitCount: number;
    totalPanels: number;
    totalAreaM2: number;
    totalSheets: number;
    totalProjectCost: number;
  },
  parts: CutlistPart[],
  sheetLayout: SheetLayoutResult | null,
  projectPartLinkMap: Map<string, ProjectPartLink>,
) {
  const partsMap = new Map(parts.map((part) => [part.id, part]));
  const partsRows = parts
    .map(
      (part) => `
        <tr>
          <td>${projectPartLinkMap.get(part.id)?.code ?? "--"}</td>
          <td>${part.name}</td>
          <td>${partCategoryLabels[part.category]}</td>
          <td>${part.qty}</td>
          <td>${formatCm(part.length)}</td>
          <td>${formatCm(part.width)}</td>
          <td>${formatCm(part.thickness)}</td>
          <td>${projectPartLinkMap.get(part.id)?.primarySheetReference ?? ""}</td>
          <td>${formatPartEdgeBanding(part)}</td>
          <td>${formatCm(getPartEdgeBandLengthCm(part))}</td>
          <td>${part.notes}</td>
        </tr>`,
    )
    .join("");

  const stockRows = (sheetLayout?.stocks ?? [])
    .map(
      (stock) => `
        <tr>
          <td>${getStockLabel(stock.thickness, stock.isBackStock)}</td>
          <td>${stock.sheets.length}</td>
          <td>${stock.totalAreaM2} م²</td>
          <td>${getStockWasteAreaM2(stock)} م²</td>
          <td>${formatSheetSize(stock.boardLength, stock.boardWidth)}</td>
        </tr>`,
    )
    .join("");
  const printedSheetLayouts = (sheetLayout?.stocks ?? [])
    .map(
      (stock) => `
        <section class="sheet-stock">
          <div class="stock-summary-card">
            <div>
              <h3>${getStockLabel(stock.thickness, stock.isBackStock)}</h3>
              <p>${stock.materialSummary} • ${stock.partCount} قطعة • ${stock.sheets.length} لوح • ${formatSheetSize(stock.boardLength, stock.boardWidth)}</p>
            </div>
            <div class="stock-metrics">
              <span>المستخدم ${stock.totalAreaM2} م²</span>
              <span>الهالك ${getStockWasteAreaM2(stock)} م²</span>
            </div>
          </div>
          <div class="sheet-grid">
            ${stock.sheets
              .map(
                (sheet) => `
                  <article class="sheet-card">
                    <div class="sheet-card-head">
                      <span>لوح #${sheet.index + 1}</span>
                      <span>مستخدم طوليًا ${formatCm(sheet.usedLength)} من ${formatCm(stock.boardLength)}</span>
                    </div>
                    <div class="sheet-svg-wrap">
                      ${buildPrintSheetSvg(stock, sheet, partsMap, projectPartLinkMap)}
                    </div>
                  </article>`,
              )
              .join("")}
          </div>
        </section>`,
    )
    .join("");
  const wasteInsight = buildProjectWasteInsight(sheetLayout);

  return `<!doctype html>
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <title>${projectName}</title>
      <style>
        @page { size: A4 portrait; margin: 14mm; }
        body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 24px; color: #1c1917; }
        h1, h2 { margin: 0 0 12px; }
        h3 { margin: 0; font-size: 15px; }
        p { margin: 0; }
        .meta, .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
        .card { border: 1px solid #d6cec2; border-radius: 14px; padding: 12px 14px; background: #faf8f4; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #e7dfd4; padding: 8px 10px; text-align: right; font-size: 12px; vertical-align: top; }
        th { background: #f3ece3; }
        .section { margin-top: 22px; }
        .sheet-stock { margin-top: 18px; page-break-inside: avoid; }
        .stock-summary-card { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; border: 1px solid #d6cec2; border-radius: 14px; padding: 12px 14px; background: #faf8f4; }
        .stock-summary-card p { margin-top: 4px; font-size: 12px; color: #57534e; }
        .stock-metrics { display: grid; gap: 4px; font-size: 12px; color: #57534e; text-align: left; }
        .sheet-grid { display: grid; gap: 14px; margin-top: 14px; }
        .sheet-card { border: 1px solid #e7dfd4; border-radius: 16px; padding: 12px; background: #fff; page-break-inside: avoid; }
        .sheet-card-head { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; color: #57534e; margin-bottom: 10px; }
        .sheet-svg-wrap { border: 1px solid #e7dfd4; border-radius: 14px; padding: 10px; background: linear-gradient(180deg,#f8f4ee 0%,#f2ece3 100%); }
        .sheet-svg-wrap svg { display: block; width: 100%; height: auto; border-radius: 12px; background: #fff; box-shadow: inset 0 0 0 1px rgba(214,206,194,0.9); }
        .waste-note { margin-top: 14px; border: 1px solid #f2d7a2; border-radius: 14px; padding: 12px 14px; background: #fff6df; color: #78350f; font-size: 13px; line-height: 1.8; }
        @media print {
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <h1>${projectName}</h1>
      <div class="meta">
        <div class="card">الخامة: ${materialLabels[settings.material]}</div>
        <div class="card">لوح 18: ${formatSheetSize(settings.boardSheetLength, settings.boardSheetWidth)}</div>
        <div class="card">لوح 6: ${formatSheetSize(settings.backSheetLength, settings.backSheetWidth)}</div>
        <div class="card">سلاح: ${formatOptionalMmFromCm(settings.cutKerf)} • حافة تشطيب: ${formatOptionalMmFromCm(settings.trimMargin)}</div>
      </div>
      <div class="summary">
        <div class="card">الوحدات: ${summary.unitCount}</div>
        <div class="card">إجمالي القطع: ${summary.totalPanels}</div>
        <div class="card">إجمالي الألواح: ${summary.totalSheets}</div>
        <div class="card">إجمالي الاستهلاك: ${summary.totalAreaM2} م²</div>
        <div class="card">التكلفة التقريبية: ${formatPrice(summary.totalProjectCost)}</div>
      </div>
      <div class="section">
        <h2>قائمة القطع</h2>
        <table>
          <thead>
            <tr>
              <th>كود القطعة</th>
              <th>الجزء</th>
              <th>الفئة</th>
              <th>العدد</th>
              <th>الطول</th>
              <th>العرض</th>
              <th>السمك</th>
              <th>مرجع اللوح</th>
              <th>الحواف</th>
              <th>طول الحواف</th>
              <th>الملاحظات</th>
            </tr>
          </thead>
          <tbody>${partsRows}</tbody>
        </table>
      </div>
      ${
        stockRows
          ? `<div class="section">
            <h2>ملخص الألواح</h2>
            <table>
              <thead>
                <tr>
                  <th>المجموعة</th>
                  <th>عدد الألواح</th>
                  <th>المستخدم</th>
                  <th>الهالك</th>
                  <th>مقاس اللوح</th>
                </tr>
              </thead>
              <tbody>${stockRows}</tbody>
            </table>
          </div>`
          : ""
      }
      ${
        printedSheetLayouts
          ? `<div class="section">
            <h2>تقسيم الألواح</h2>
            ${printedSheetLayouts}
            ${wasteInsight ? `<div class="waste-note"><strong>قراءة سريعة للهالك:</strong> ${wasteInsight}</div>` : ""}
          </div>`
          : ""
      }
    </body>
  </html>`;
}

function getSheetPieceFillColor(category: CutlistPart["category"]) {
  switch (category) {
    case "front":
      return "#c88f5a";
    case "back":
      return "#90a4ae";
    case "shelf":
      return "#6f8f72";
    case "support":
      return "#d8c178";
    default:
      return "#9a7b5f";
  }
}

function buildPrintSheetSvg(
  stock: SheetLayoutStock,
  sheet: SheetLayoutStock["sheets"][number],
  partsMap: Map<string, CutlistPart>,
  projectPartLinkMap: Map<string, ProjectPartLink>,
) {
  const piecesMarkup = sheet.pieces
    .map((piece) => {
      const pieceLabel = getSheetPieceLabelMode(piece);
      const displayPiece = pieceLabel.displayPiece;
      const part = partsMap.get(piece.sourcePartId);
      const projectPartLink = projectPartLinkMap.get(piece.sourcePartId);
      const edgeThickness = Math.max(
        1.4,
        Math.min(Math.min(displayPiece.width, displayPiece.height) * 0.08, 3.2),
      );
      const edgeRects = [
        {
          edge: "top" as const,
          x: displayPiece.x,
          y: displayPiece.y,
          width: displayPiece.width,
          height: edgeThickness,
        },
        {
          edge: "right" as const,
          x: displayPiece.x + displayPiece.width - edgeThickness,
          y: displayPiece.y,
          width: edgeThickness,
          height: displayPiece.height,
        },
        {
          edge: "bottom" as const,
          x: displayPiece.x,
          y: displayPiece.y + displayPiece.height - edgeThickness,
          width: displayPiece.width,
          height: edgeThickness,
        },
        {
          edge: "left" as const,
          x: displayPiece.x,
          y: displayPiece.y,
          width: edgeThickness,
          height: displayPiece.height,
        },
      ];
      const edgeMarkup = part
        ? edgeRects
            .map((edgeRect) => {
              const logicalSide = getVisualEdgeSide(piece, edgeRect.edge);
              const isActive = part.edgeBanding[logicalSide] ?? false;

              return `<rect
                x="${edgeRect.x}"
                y="${edgeRect.y}"
                width="${edgeRect.width}"
                height="${edgeRect.height}"
                rx="1"
                fill="${isActive ? "#f3b04d" : "rgba(255,255,255,0.001)"}"
                fill-opacity="${isActive ? "0.95" : "1"}"
                stroke="${isActive ? "#fff7e7" : "rgba(255,255,255,0.45)"}"
                stroke-width="${isActive ? "0.7" : "0.35"}"
              />`;
            })
            .join("")
        : "";
      const labelMarkup =
        pieceLabel.mode === "full"
          ? `<g>
              <text
                x="${displayPiece.x + displayPiece.width / 2}"
                y="${displayPiece.y + displayPiece.height / 2 - pieceLabel.nameOffset}"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="${pieceLabel.nameFontSize}"
                font-weight="700"
                fill="#fff"
                direction="rtl"
                unicode-bidi="plaintext"
                ${pieceLabel.rotate ? `transform="rotate(-90 ${displayPiece.x + displayPiece.width / 2} ${displayPiece.y + displayPiece.height / 2})"` : ""}
              >
                ${projectPartLink ? `${projectPartLink.code} • ${piece.name}` : piece.name}
              </text>
              <text
                x="${displayPiece.x + displayPiece.width / 2}"
                y="${displayPiece.y + displayPiece.height / 2 + pieceLabel.dimsOffset}"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="${pieceLabel.dimsFontSize}"
                font-weight="700"
                fill="#fff"
                ${pieceLabel.rotate ? `transform="rotate(-90 ${displayPiece.x + displayPiece.width / 2} ${displayPiece.y + displayPiece.height / 2})"` : ""}
              >
                ${round2(piece.length)} × ${round2(piece.width)} سم
              </text>
            </g>`
          : pieceLabel.mode === "dims"
            ? `<text
                x="${displayPiece.x + displayPiece.width / 2}"
                y="${displayPiece.y + displayPiece.height / 2}"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="${pieceLabel.fontSize}"
                font-weight="600"
                fill="#fff"
                ${pieceLabel.rotate ? `transform="rotate(-90 ${displayPiece.x + displayPiece.width / 2} ${displayPiece.y + displayPiece.height / 2})"` : ""}
              >
                ${round2(piece.length)} × ${round2(piece.width)}
              </text>`
            : "";

      return `<g>
        <rect
          x="${displayPiece.x}"
          y="${displayPiece.y}"
          width="${displayPiece.width}"
          height="${displayPiece.height}"
          fill="${getSheetPieceFillColor(piece.category)}"
          fill-opacity="0.82"
          stroke="#fff"
          stroke-width="0.8"
          rx="1.5"
        />
        ${edgeMarkup}
        ${labelMarkup}
      </g>`;
    })
    .join("");

  return `<svg
    viewBox="-18 -18 ${stock.boardWidth + 36} ${stock.boardLength + 36}"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label="${stock.key} sheet ${sheet.index + 1} layout"
  >
    <line x1="0" y1="-10" x2="${stock.boardWidth}" y2="-10" stroke="#9b8a75" stroke-width="0.9" />
    <line x1="0" y1="-13.5" x2="0" y2="-6.5" stroke="#9b8a75" stroke-width="0.9" />
    <line x1="${stock.boardWidth}" y1="-13.5" x2="${stock.boardWidth}" y2="-6.5" stroke="#9b8a75" stroke-width="0.9" />
    <text x="${stock.boardWidth / 2}" y="-12.5" text-anchor="middle" dominant-baseline="ideographic" font-size="5.2" font-weight="700" fill="#6b5a45">
      عرض اللوح ${formatCm(stock.boardWidth)}
    </text>
    <line x1="${stock.boardWidth + 10}" y1="0" x2="${stock.boardWidth + 10}" y2="${stock.boardLength}" stroke="#9b8a75" stroke-width="0.9" />
    <line x1="${stock.boardWidth + 6.5}" y1="0" x2="${stock.boardWidth + 13.5}" y2="0" stroke="#9b8a75" stroke-width="0.9" />
    <line x1="${stock.boardWidth + 6.5}" y1="${stock.boardLength}" x2="${stock.boardWidth + 13.5}" y2="${stock.boardLength}" stroke="#9b8a75" stroke-width="0.9" />
    <text x="${stock.boardWidth + 14}" y="${stock.boardLength / 2}" text-anchor="middle" dominant-baseline="middle" font-size="5.2" font-weight="700" fill="#6b5a45" transform="rotate(90 ${stock.boardWidth + 14} ${stock.boardLength / 2})">
      طول اللوح ${formatCm(stock.boardLength)}
    </text>
    <rect x="0" y="0" width="${stock.boardWidth}" height="${stock.boardLength}" fill="#fcfaf7" stroke="#d6cec2" stroke-width="1" rx="4" />
    ${piecesMarkup}
  </svg>`;
}

function getSheetDisplayPiece(piece: SheetLayoutPiece) {
  return {
    x: piece.y,
    y: piece.x,
    width: piece.width,
    height: piece.length,
  };
}

function clampSheetLabelFontSize(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, round2(value)));
}

function getSheetPieceLabelMode(piece: SheetLayoutPiece) {
  const displayPiece = getSheetDisplayPiece(piece);
  const shortSide = Math.min(displayPiece.width, displayPiece.height);
  const longSide = Math.max(displayPiece.width, displayPiece.height);
  const isTallPiece = displayPiece.height > displayPiece.width * 2.05;

  if (shortSide < 6 || longSide < 16) {
    return { displayPiece, mode: "none" as const };
  }

  if (shortSide >= 16 && longSide >= 34) {
    const fullNameFontSize = isTallPiece
      ? clampSheetLabelFontSize(
          Math.min(shortSide / 8.6, longSide / 14.5),
          2.8,
          4.4,
        )
      : clampSheetLabelFontSize(
          Math.min(shortSide / 5.4, longSide / 9.8),
          3.2,
          5.4,
        );
    const fullDimsFontSize = isTallPiece
      ? clampSheetLabelFontSize(
          Math.min(shortSide / 9.8, longSide / 16.5),
          2.5,
          3.8,
        )
      : clampSheetLabelFontSize(
          Math.min(shortSide / 6.3, longSide / 11.4),
          2.8,
          4.8,
        );

    return {
      displayPiece,
      mode: "full" as const,
      nameFontSize: fullNameFontSize,
      dimsFontSize: fullDimsFontSize,
      rotate: isTallPiece,
      nameOffset: isTallPiece ? fullNameFontSize * 1.05 : fullNameFontSize * 1.18,
      dimsOffset: isTallPiece ? fullDimsFontSize * 1.32 : fullDimsFontSize * 1.45,
    };
  }

  if (shortSide >= 10 && longSide >= 20) {
    return {
      displayPiece,
      mode: "dims" as const,
      fontSize: clampSheetLabelFontSize(
        Math.min(shortSide / 3.7, longSide / 6.8),
        2.8,
        4.8,
      ),
      rotate: displayPiece.height > displayPiece.width * 1.8,
    };
  }

  return { displayPiece, mode: "none" as const };
}

function calculateEdgeBandLengthMeters(parts: CutlistPart[]) {
  const totalLengthCm = parts.reduce(
    (sum, part) => sum + getPartEdgeBandLengthCm(part),
    0,
  );

  return round2(totalLengthCm / 100);
}

function getPartEdgeBandSides(part: CutlistPart) {
  return (Object.entries(part.edgeBanding) as Array<[EdgeBandSide, boolean]>)
    .filter(([, active]) => active)
    .map(([side]) => side);
}

function getPartEdgeBandLengthCm(part: CutlistPart) {
  return getPartEdgeBandSides(part).reduce((sum, side) => {
    const edgeLength =
      side === "length-start" || side === "length-end"
        ? part.length
        : part.width;

    return sum + edgeLength * part.qty;
  }, 0);
}

function formatPartEdgeBanding(part: CutlistPart) {
  const sides = getPartEdgeBandSides(part);

  if (sides.length === 0) {
    return "بدون حواف";
  }

  if (sides.length === 4) {
    return "الأربع حواف";
  }

  if (sides.length === 1 && sides[0] === "length-start") {
    return "حافة أمامية";
  }

  return sides.map((side) => edgeBandSideLabels[side]).join(" • ");
}

function buildEditorNumericDrafts(
  input: CabinetInput,
): Record<EditorNumericFieldKey, string> {
  return {
    width: getResettableFieldValue(input.width),
    height: getResettableFieldValue(input.height),
    depth: getResettableFieldValue(input.depth),
    returnDepth: getResettableFieldValue(input.returnDepth),
    shelfCount: getResettableFieldValue(input.shelfCount),
    drawerCount: getResettableFieldValue(input.drawerCount),
    doorLeafCount: getResettableFieldValue(input.doorLeafCount),
  };
}

function buildProjectSettingsDrafts(
  settings: ProjectSettings,
): ProjectSettingsNumericDrafts {
  return {
    boardThickness: String(round2(settings.boardThickness * 10)),
    backThickness: String(round2(settings.backThickness * 10)),
    boardSheetLength: String(round2(settings.boardSheetLength)),
    boardSheetWidth: String(round2(settings.boardSheetWidth)),
    backSheetLength: String(round2(settings.backSheetLength)),
    backSheetWidth: String(round2(settings.backSheetWidth)),
    cutKerf: getResettableFieldValue(round2(settings.cutKerf * 10)),
    trimMargin: getResettableFieldValue(round2(settings.trimMargin * 10)),
    boardSheetPrice: getResettableFieldValue(settings.boardSheetPrice),
    backSheetPrice: getResettableFieldValue(settings.backSheetPrice),
    laborPricePerSquareMeter: getResettableFieldValue(
      settings.laborPricePerSquareMeter,
    ),
    edgeBandPricePerMeter: getResettableFieldValue(
      settings.edgeBandPricePerMeter,
    ),
  };
}

function buildEmptyCustomPartDraft(
  settings: ProjectSettings,
): CustomProjectPartDraft {
  return {
    title: "",
    length: "",
    width: "",
    qty: "1",
    thickness: String(round2(settings.boardThickness * 10)),
    material: settings.material,
    category: "carcass",
    grainDirection: "free",
    edgeBanding: {},
  };
}

function createCustomPartId() {
  return `custom-part-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildCustomProjectCutlistPart(
  entry: CustomProjectPart,
  materialOverride?: MaterialType,
): CutlistPart {
  return {
    id: `custom-part-piece-${entry.id}`,
    kind: "custom",
    name: entry.title,
    category: entry.category,
    qty: entry.qty,
    length: entry.length,
    width: entry.width,
    thickness: entry.thickness,
    material: materialOverride ?? entry.material,
    notes:
      entry.category === "back"
        ? "مقاس حر خارج الوحدات على لوح ظهر"
        : "مقاس حر خارج الوحدات",
    edgeBanding: entry.edgeBanding ?? {},
    grainDirection: entry.grainDirection,
    allowRotation: entry.grainDirection === "free",
  };
}

function loadProjectSettings(): ProjectSettings {
  if (typeof window === "undefined") {
    return defaultProjectSettings;
  }

  try {
    const storedValue = window.localStorage.getItem(projectSettingsStorageKey);
    if (!storedValue) {
      return defaultProjectSettings;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<ProjectSettings>;

    return {
      ...defaultProjectSettings,
      ...parsedValue,
    };
  } catch {
    return defaultProjectSettings;
  }
}

function getSheetLayoutOptions(settings: ProjectSettings) {
  return {
    boardStockSize: {
      length: settings.boardSheetLength,
      width: settings.boardSheetWidth,
    },
    backStockSize: {
      length: settings.backSheetLength,
      width: settings.backSheetWidth,
    },
    cutKerf: settings.cutKerf,
    trimMargin: settings.trimMargin,
  };
}

function createUnitPartOverrideKey(unitId: string, partId: string) {
  return `${unitId}::${partId}`;
}

function buildPartCode(index: number) {
  return `P-${String(index + 1).padStart(3, "0")}`;
}

function buildProjectPartLinks(
  entries: AggregatedProjectPart[],
  sheetLayout: SheetLayoutResult | null,
): {
  links: ProjectPartLink[];
  linkMap: Map<string, ProjectPartLink>;
  sourceKeyToProjectPartId: Map<string, string>;
} {
  const links = entries.map((entry, index) => ({
    partId: entry.part.id,
    code: buildPartCode(index),
    sourceKeys: entry.sourceKeys,
    unitIds: Array.from(
      new Set(entry.sourceKeys.map((sourceKey) => sourceKey.split("::")[0])),
    ),
    sheetReferences: [] as string[],
    primarySheetReference: null as string | null,
  }));
  const linkMap = new Map(links.map((link) => [link.partId, link]));
  const sourceKeyToProjectPartId = new Map(
    entries.flatMap((entry) =>
      entry.sourceKeys.map((sourceKey) => [sourceKey, entry.part.id] as const),
    ),
  );

  sheetLayout?.stocks.forEach((stock) => {
    stock.sheets.forEach((sheet) => {
      const sheetReference = `${getStockLabel(stock.thickness, stock.isBackStock)} • لوح #${sheet.index + 1}`;

      sheet.pieces.forEach((piece) => {
        const link = linkMap.get(piece.sourcePartId);
        if (!link || link.sheetReferences.includes(sheetReference)) {
          return;
        }

        link.sheetReferences.push(sheetReference);
      });
    });
  });

  links.forEach((link) => {
    link.primarySheetReference = link.sheetReferences[0] ?? null;
  });

  return {
    links,
    linkMap,
    sourceKeyToProjectPartId,
  };
}

function applyEdgeBandOverride(
  part: CutlistPart,
  override?: EdgeBandProfile,
): CutlistPart {
  if (!override) {
    return part;
  }

  return {
    ...part,
    edgeBanding: override,
  };
}

function toggleEdgeBandProfileSide(
  profile: EdgeBandProfile,
  side: EdgeBandSide,
) {
  return {
    ...profile,
    [side]: !(profile[side] ?? false),
  };
}

function getVisualEdgeSide(
  piece: SheetLayoutPiece,
  edge: "top" | "right" | "bottom" | "left",
) {
  if (!piece.rotated) {
    switch (edge) {
      case "top":
        return "length-start" as const;
      case "right":
        return "width-end" as const;
      case "bottom":
        return "length-end" as const;
      case "left":
        return "width-start" as const;
    }
  }

  switch (edge) {
    case "top":
      return "width-start" as const;
    case "right":
      return "length-end" as const;
    case "bottom":
      return "width-end" as const;
    case "left":
      return "length-start" as const;
  }
}

function aggregateProjectParts(
  entries: Array<{ sourceId: string; parts: CutlistPart[] }>,
) {
  const aggregated = new Map<string, AggregatedProjectPart>();

  entries.forEach(({ sourceId, parts }) =>
    parts.forEach((part) => {
      const key = [
        part.kind,
        part.name,
        part.category,
        part.length,
        part.width,
        part.thickness,
        part.material,
        part.notes,
        JSON.stringify(part.edgeBanding),
      ].join("|");

      const existing = aggregated.get(key);
      const sourceKey = createUnitPartOverrideKey(sourceId, part.id);

      if (existing) {
        existing.part.qty += part.qty;
        existing.sourceKeys.push(sourceKey);
        return;
      }

      aggregated.set(key, {
        part: {
          ...part,
          id: `project-part-${aggregated.size + 1}`,
        },
        sourceKeys: [sourceKey],
      });
    }),
  );

  return Array.from(aggregated.values());
}

function App() {
  const initialProjectSettings = loadProjectSettings();
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTab>("builder");
  const [activeBuilderTab, setActiveBuilderTab] = useState<BuilderTab>("unit");
  const [isTopPanelExpanded, setIsTopPanelExpanded] = useState(false);
  const [openResultsSections, setOpenResultsSections] = useState<
    Record<ResultsSectionKey, boolean>
  >({
    costs: true,
    layout: true,
    metrics: false,
    workshop: false,
    parts: false,
  });
  const [projectName, setProjectName] = useState("مشروع جديد");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] =
    useState<SavedProject[]>(loadSavedProjects);
  const [edgeBandOverrides, setEdgeBandOverrides] =
    useState<EdgeBandOverrideMap>({});
  const [isProjectLibraryOpen, setIsProjectLibraryOpen] = useState(false);
  const [isUnitPresetOpen, setIsUnitPresetOpen] = useState(false);
  const [projectActionMessage, setProjectActionMessage] = useState<
    string | null
  >(null);
  const [editorTitle, setEditorTitle] = useState(createUnitTitle(0));
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(
    initialProjectSettings,
  );
  const [projectSettingsDrafts, setProjectSettingsDrafts] =
    useState<ProjectSettingsNumericDrafts>(
      buildProjectSettingsDrafts(initialProjectSettings),
    );
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [editorInput, setEditorInput] = useState<CabinetInput>(
    buildEmptyEditorInput(initialProjectSettings),
  );
  const [editorNumericDrafts, setEditorNumericDrafts] = useState<
    Record<EditorNumericFieldKey, string>
  >(buildEditorNumericDrafts(buildEmptyEditorInput(initialProjectSettings)));
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [units, setUnits] = useState<CabinetUnit[]>([]);
  const [customParts, setCustomParts] = useState<CustomProjectPart[]>([]);
  const [customPartDraft, setCustomPartDraft] =
    useState<CustomProjectPartDraft>(
      buildEmptyCustomPartDraft(initialProjectSettings),
    );
  const [editingCustomPartId, setEditingCustomPartId] = useState<string | null>(
    null,
  );
  const [calculatedUnits, setCalculatedUnits] = useState<CabinetUnit[]>([]);
  const [calculatedCustomParts, setCalculatedCustomParts] = useState<
    CustomProjectPart[]
  >([]);
  const [selectedCalculatedUnitId, setSelectedCalculatedUnitId] = useState<
    string | null
  >(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [projectArrangement, setProjectArrangement] = useState<
    ProjectArrangementItem[]
  >([]);
  const [activeProjectUnitId, setActiveProjectUnitId] = useState<string | null>(
    null,
  );
  const projectPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [unitFeedback, setUnitFeedback] = useState<{
    unitId: string;
    message: string;
  } | null>(null);

  const editorResult = calculateCabinetCutlist(editorInput);
  const editorFrontPieceCount = getFrontPieceCount(editorResult);
  const calculatedCustomPartEntries = calculatedCustomParts.map((entry) => {
    const basePart = buildCustomProjectCutlistPart(
      entry,
      projectSettings.material,
    );

    return {
      sourceId: entry.id,
      title: entry.title,
      part: applyEdgeBandOverride(
        basePart,
        edgeBandOverrides[createUnitPartOverrideKey(entry.id, basePart.id)],
      ),
    };
  });

  const calculatedViews: CalculatedUnitView[] = calculatedUnits.map((unit) => {
    const result = calculateCabinetCutlist(unit);
    const overriddenParts = result.parts.map((part) =>
      applyEdgeBandOverride(
        part,
        edgeBandOverrides[createUnitPartOverrideKey(unit.id, part.id)],
      ),
    );

    return {
      unit,
      result: {
        ...result,
        parts: overriddenParts,
      },
      sheetLayout: buildSheetLayout(
        overriddenParts,
        getSheetLayoutOptions(projectSettings),
      ),
      frontPieceCount: getFrontPieceCount({
        ...result,
        parts: overriddenParts,
      }),
    };
  });

  const aggregatedProjectParts = aggregateProjectParts(
    calculatedViews
      .map((view) => ({
        sourceId: view.unit.id,
        parts: view.result.parts,
      }))
      .concat(
        calculatedCustomPartEntries.map((entry) => ({
          sourceId: entry.sourceId,
          parts: [entry.part],
        })),
      ),
  );
  const projectParts = aggregatedProjectParts.map((entry) => entry.part);
  const aggregatedProjectPartMap = new Map(
    aggregatedProjectParts.map((entry) => [entry.part.id, entry]),
  );
  const projectSheetLayout =
    projectParts.length > 0
      ? buildSheetLayout(projectParts, getSheetLayoutOptions(projectSettings))
      : null;
  const {
    links: projectPartLinks,
    linkMap: projectPartLinkMap,
    sourceKeyToProjectPartId,
  } = buildProjectPartLinks(aggregatedProjectParts, projectSheetLayout);
  const projectLayoutSheetCount = projectSheetLayout
    ? projectSheetLayout.stocks.reduce(
        (sum, stock) => sum + stock.sheets.length,
        0,
      )
    : 0;
  const projectLayoutTotalAreaM2 = projectSheetLayout
    ? projectSheetLayout.stocks.reduce(
        (sum, stock) => sum + stock.totalAreaM2,
        0,
      )
    : 0;
  const projectLayoutAvailableAreaM2 = projectSheetLayout
    ? projectSheetLayout.stocks.reduce(
        (sum, stock) =>
          sum +
          stock.sheets.length *
            ((stock.boardLength * stock.boardWidth) / 10000),
        0,
      )
    : 0;
  const projectLayoutWastePercent =
    projectLayoutAvailableAreaM2 > 0
      ? round2(
          ((projectLayoutAvailableAreaM2 - projectLayoutTotalAreaM2) /
            projectLayoutAvailableAreaM2) *
            100,
        )
      : 0;
  const projectWasteInsight = buildProjectWasteInsight(projectSheetLayout);
  const projectFrontPieceCount = projectParts
    .filter((part) => part.category === "front")
    .reduce((sum, part) => sum + part.qty, 0);
  const projectMaterialSummary = materialLabels[projectSettings.material];
  const normalizedProjectArrangement = buildProjectArrangement(
    units,
    projectArrangement,
  );
  const projectArrangementTravelLimitCm =
    getProjectArrangementTravelLimit(units);
  const projectPreviewUnits = buildProjectPreviewUnits(
    units,
    normalizedProjectArrangement,
  );
  const workshopPartCards: WorkshopPartCard[] = calculatedViews
    .flatMap((view) =>
      view.result.parts.map((part, index) => ({
        id: `${view.unit.id}-${part.id}-${index}`,
        unitId: view.unit.id,
        unitTitle: view.unit.title,
        part,
      })),
    )
    .concat(
      calculatedCustomPartEntries.map((entry) => ({
        id: `${entry.sourceId}-${entry.part.id}`,
        unitId: entry.sourceId,
        unitTitle: entry.title,
        part: entry.part,
      })),
    );
  const workshopExecutionCards: WorkshopExecutionCard[] = workshopPartCards
    .map((card) => {
      const sourceKey = createUnitPartOverrideKey(card.unitId, card.part.id);
      const projectPartId = sourceKeyToProjectPartId.get(sourceKey) ?? null;
      const link = projectPartId ? projectPartLinkMap.get(projectPartId) : null;

      return {
        ...card,
        operationOrder: 0,
        projectPartId,
        partCode: link?.code ?? "--",
        sheetReferences: link?.sheetReferences ?? [],
        primarySheetReference: link?.primarySheetReference ?? null,
      };
    })
    .sort((left, right) => {
      const leftRef = left.primarySheetReference ?? "zzz";
      const rightRef = right.primarySheetReference ?? "zzz";

      return (
        leftRef.localeCompare(rightRef, "ar") ||
        left.partCode.localeCompare(right.partCode, "en") ||
        left.unitTitle.localeCompare(right.unitTitle, "ar")
      );
    })
    .map((card, index) => ({
      ...card,
      operationOrder: index + 1,
    }));
  const unitCostSummaries: UnitCostSummary[] = calculatedViews.map((view) => {
    const boardSheetCount = view.sheetLayout.stocks
      .filter((stock) => !stock.isBackStock)
      .reduce((sum, stock) => sum + stock.sheets.length, 0);
    const backSheetCount = view.sheetLayout.stocks
      .filter((stock) => stock.isBackStock)
      .reduce((sum, stock) => sum + stock.sheets.length, 0);
    const boardUsedAreaM2 = round2(
      view.sheetLayout.stocks
        .filter((stock) => !stock.isBackStock)
        .reduce((sum, stock) => sum + stock.totalAreaM2, 0),
    );
    const backUsedAreaM2 = round2(
      view.sheetLayout.stocks
        .filter((stock) => stock.isBackStock)
        .reduce((sum, stock) => sum + stock.totalAreaM2, 0),
    );
    const sheetCost = round2(
      view.sheetLayout.stocks.reduce(
        (sum, stock) =>
          sum +
          stock.sheets.length *
            (stock.isBackStock
              ? projectSettings.backSheetPrice
              : projectSettings.boardSheetPrice),
        0,
      ),
    );
    const edgeBandLengthM = calculateEdgeBandLengthMeters(view.result.parts);
    const laborCost = round2(
      view.result.metrics.totalAreaM2 *
        projectSettings.laborPricePerSquareMeter,
    );
    const edgeBandCost = round2(
      edgeBandLengthM * projectSettings.edgeBandPricePerMeter,
    );

    return {
      unitId: view.unit.id,
      unitTitle: view.unit.title,
      panelCount: view.result.metrics.totalPanels,
      totalAreaM2: view.result.metrics.totalAreaM2,
      boardSheetCount,
      backSheetCount,
      boardUsedAreaM2,
      backUsedAreaM2,
      edgeBandLengthM,
      sheetCost,
      laborCost,
      edgeBandCost,
      totalCost: round2(sheetCost + laborCost + edgeBandCost),
    };
  });
  const activeProjectPreviewUnit =
    projectPreviewUnits.find((unit) => unit.id === activeProjectUnitId) ??
    projectPreviewUnits[0];
  const isCornerBlindEditor =
    editorInput.cabinetType === "corner-l-base" ||
    editorInput.cabinetType === "corner-l-wall";
  const hasEditorCoreDimensions =
    editorInput.width > 0 && editorInput.height > 0 && editorInput.depth > 0;
  const hasEditorCompleteDimensions =
    hasEditorCoreDimensions &&
    (!isCornerBlindEditor || editorInput.returnDepth > 0);
  const editorReviewWarnings = hasEditorCompleteDimensions
    ? editorResult.warnings
    : [];
  const projectEdgeBandLengthM = calculateEdgeBandLengthMeters(projectParts);
  const projectSheetCost = projectSheetLayout
    ? round2(
        projectSheetLayout.stocks.reduce(
          (sum, stock) =>
            sum +
            stock.sheets.length *
              (stock.isBackStock
                ? projectSettings.backSheetPrice
                : projectSettings.boardSheetPrice),
          0,
        ),
      )
    : 0;
  const projectLaborCost = round2(
    projectLayoutTotalAreaM2 * projectSettings.laborPricePerSquareMeter,
  );
  const projectEdgeBandCost = round2(
    projectEdgeBandLengthM * projectSettings.edgeBandPricePerMeter,
  );
  const projectTotalCost = round2(
    projectSheetCost + projectLaborCost + projectEdgeBandCost,
  );
  const calculatedCustomPartCount = calculatedCustomParts.reduce(
    (sum, entry) => sum + entry.qty,
    0,
  );
  const calculatedCustomPartAreaM2 = round2(
    calculatedCustomParts.reduce(
      (sum, entry) => sum + (entry.length * entry.width * entry.qty) / 10000,
      0,
    ),
  );
  const projectItemCount = units.length + customParts.length;
  const hasCalculatedProject =
    calculatedViews.length > 0 || calculatedCustomParts.length > 0;
  const recentSavedProjects = savedProjects.slice(0, 3);
  const workspaceTabs: Array<{
    id: WorkspaceTab;
    label: string;
    icon: typeof Settings2;
    badge: string;
  }> = [
    {
      id: "project",
      label: "المشروع",
      icon: Settings2,
      badge: `${savedProjects.length}`,
    },
    {
      id: "builder",
      label: "الإضافة",
      icon: Plus,
      badge: `${projectItemCount}`,
    },
    {
      id: "preview",
      label: "3D",
      icon: PanelsTopLeft,
      badge: `${projectPreviewUnits.length}`,
    },
    {
      id: "results",
      label: "النتائج",
      icon: Calculator,
      badge: hasCalculatedProject ? `${projectParts.length}` : "--",
    },
    {
      id: "library",
      label: "المكتبة",
      icon: FolderOpen,
      badge: `${unitPresets.length + savedProjects.length}`,
    },
  ];
  const builderTabs: Array<{
    id: BuilderTab;
    label: string;
    description: string;
  }> = [
    {
      id: "unit",
      label: "الوحدة الحالية",
      description: "إدخال وتعديل الوحدة مع المعاينة.",
    },
    {
      id: "custom",
      label: "مقاس حر",
      description: "إضافة القطع غير المرتبطة بوحدة.",
    },
    {
      id: "units",
      label: "العناصر المضافة",
      description: "الوحدات الحالية، الترتيب، والحساب.",
    },
  ];
  const mobilePrimaryAction =
    activeWorkspaceTab === "builder"
      ? activeBuilderTab === "unit"
        ? {
            label: editingUnitId ? "حفظ تعديل الوحدة" : "إضافة وحدة",
            icon: Plus,
            onClick: saveUnit,
            disabled: false,
          }
        : activeBuilderTab === "custom"
          ? {
              label: editingCustomPartId ? "حفظ المقاس الحر" : "إضافة مقاس حر",
              icon: Plus,
              onClick: saveCustomPart,
              disabled: false,
            }
          : {
              label: "احسب المشروع",
              icon: Calculator,
              onClick: calculateUnits,
              disabled: projectItemCount === 0,
            }
      : activeWorkspaceTab === "results"
        ? hasCalculatedProject
          ? {
              label: "طباعة المشروع",
              icon: Printer,
              onClick: printProjectSummary,
              disabled: projectParts.length === 0,
            }
          : {
              label: "احسب المشروع",
              icon: Calculator,
              onClick: calculateUnits,
              disabled: projectItemCount === 0,
            }
        : activeWorkspaceTab === "preview"
          ? {
              label: "طباعة لقطة 3D",
              icon: Printer,
              onClick: printProjectPreviewSnapshot,
              disabled: projectPreviewUnits.length === 0,
            }
          : activeWorkspaceTab === "project"
            ? {
                label: "حفظ المشروع",
                icon: Save,
                onClick: saveCurrentProject,
                disabled: false,
              }
            : {
                label: "فتح المشاريع",
                icon: FolderOpen,
                onClick: () => setIsProjectLibraryOpen(true),
                disabled: false,
              };

  const projectSummary = calculatedViews.reduce(
    (summary, view) => ({
      unitCount: summary.unitCount + 1,
      totalPanels: summary.totalPanels + view.result.metrics.totalPanels,
      totalAreaM2: round2(
        summary.totalAreaM2 + view.result.metrics.totalAreaM2,
      ),
      totalSheets: projectLayoutSheetCount,
      totalSheetCost: projectSheetCost,
      totalLaborCost: projectLaborCost,
      totalEdgeBandLengthM: projectEdgeBandLengthM,
      totalEdgeBandCost: projectEdgeBandCost,
      totalProjectCost: projectTotalCost,
    }),
    {
      unitCount: 0,
      totalPanels: 0,
      totalAreaM2: 0,
      totalSheets: 0,
      totalSheetCost: 0,
      totalLaborCost: 0,
      totalEdgeBandLengthM: 0,
      totalEdgeBandCost: 0,
      totalProjectCost: 0,
    },
  );
  projectSummary.totalPanels += calculatedCustomPartCount;
  projectSummary.totalAreaM2 = round2(
    projectSummary.totalAreaM2 + calculatedCustomPartAreaM2,
  );
  projectSummary.totalSheets = projectLayoutSheetCount;
  projectSummary.totalSheetCost = projectSheetCost;
  projectSummary.totalLaborCost = projectLaborCost;
  projectSummary.totalEdgeBandLengthM = projectEdgeBandLengthM;
  projectSummary.totalEdgeBandCost = projectEdgeBandCost;
  projectSummary.totalProjectCost = projectTotalCost;

  useEffect(() => {
    window.localStorage.setItem(
      projectSettingsStorageKey,
      JSON.stringify(projectSettings),
    );
  }, [projectSettings]);

  useEffect(() => {
    window.localStorage.setItem(
      savedProjectsStorageKey,
      JSON.stringify(savedProjects),
    );
  }, [savedProjects]);

  useEffect(() => {
    if (!unitFeedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setUnitFeedback(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [unitFeedback]);

  useEffect(() => {
    if (!projectActionMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setProjectActionMessage(null);
    }, 2800);

    return () => window.clearTimeout(timeoutId);
  }, [projectActionMessage]);

  function announceUnitSaved(unitId: string, message: string) {
    setUnitFeedback({ unitId, message });
    window.requestAnimationFrame(() => {
      document
        .getElementById("project-units-list")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function updateNumber(key: EditorNumericFieldKey, value: string) {
    const normalizedValue = normalizeNumericInput(value);
    setEditorNumericDrafts((current) => ({
      ...current,
      [key]: normalizedValue,
    }));

    if (normalizedValue.trim() === "") {
      setEditorInput((current) => ({
        ...current,
        [key]: 0,
      }));
      return;
    }

    const parsedValue = Number(normalizedValue);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    setEditorInput((current) => ({
      ...current,
      [key]: parsedValue,
    }));
  }

  function updateCabinetType(value: CabinetType) {
    setEditorInput((current) => ({
      ...current,
      cabinetType: value,
      frontOption:
        (value === "corner-l-base" || value === "corner-l-wall") &&
        current.frontOption !== "none"
          ? "none"
          : current.frontOption,
      drawerCount:
        value === "corner-l-base" || value === "corner-l-wall"
          ? 0
          : current.drawerCount,
    }));

    if (value === "corner-l-base" || value === "corner-l-wall") {
      setEditorNumericDrafts((current) => ({
        ...current,
        drawerCount: "",
      }));
    }
  }

  function updateCornerPlacement(value: "base" | "wall") {
    updateCabinetType(value === "base" ? "corner-l-base" : "corner-l-wall");
  }

  function resetEditor(nextIndex = units.length, settings = projectSettings) {
    const nextInput = buildEmptyEditorInput(settings);
    setEditorTitle(createUnitTitle(nextIndex));
    setEditorInput(nextInput);
    setEditorNumericDrafts(buildEditorNumericDrafts(nextInput));
    setEditingUnitId(null);
    setSelectedPartId(null);
  }

  function resetCustomPartEditor(settings = projectSettings) {
    setCustomPartDraft(buildEmptyCustomPartDraft(settings));
    setEditingCustomPartId(null);
  }

  function updateCustomPartDraft<K extends keyof CustomProjectPartDraft>(
    key: K,
    value: CustomProjectPartDraft[K],
  ) {
    setCustomPartDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleCustomPartDraftEdgeBand(side: EdgeBandSide) {
    setCustomPartDraft((current) => ({
      ...current,
      edgeBanding: toggleEdgeBandProfileSide(current.edgeBanding, side),
    }));
  }

  function announceProjectAction(message: string) {
    setProjectActionMessage(message);
  }

  function invalidateCalculatedState() {
    setCalculatedUnits([]);
    setCalculatedCustomParts([]);
    setSelectedCalculatedUnitId(null);
    setSelectedPartId(null);
  }

  function saveCustomPart() {
    const title = customPartDraft.title.trim() || "مقاس حر";
    const length = Number(normalizeNumericInput(customPartDraft.length));
    const width = Number(normalizeNumericInput(customPartDraft.width));
    const qty = Number(normalizeNumericInput(customPartDraft.qty));
    const thicknessMm = Number(
      normalizeNumericInput(customPartDraft.thickness),
    );

    if (
      !Number.isFinite(length) ||
      !Number.isFinite(width) ||
      !Number.isFinite(qty) ||
      !Number.isFinite(thicknessMm) ||
      length <= 0 ||
      width <= 0 ||
      qty <= 0 ||
      thicknessMm <= 0
    ) {
      announceProjectAction(
        "أدخل الطول والعرض والكمية والسمك بقيم صحيحة قبل حفظ المقاس الحر.",
      );
      return;
    }

    const nextPart: CustomProjectPart = {
      id: editingCustomPartId ?? createCustomPartId(),
      title,
      length,
      width,
      qty: Math.max(1, Math.floor(qty)),
      thickness: thicknessMm / 10,
      material: projectSettings.material,
      category: customPartDraft.category,
      grainDirection: customPartDraft.grainDirection,
      edgeBanding: { ...customPartDraft.edgeBanding },
    };

    if (editingCustomPartId) {
      setCustomParts((current) =>
        current.map((part) =>
          part.id === editingCustomPartId ? nextPart : part,
        ),
      );
      announceProjectAction(`تم حفظ تعديل ${title} ضمن المقاسات الحرة.`);
    } else {
      setCustomParts((current) => [...current, nextPart]);
      announceProjectAction(`تمت إضافة ${title} إلى المقاسات الحرة.`);
    }

    invalidateCalculatedState();
    resetCustomPartEditor();
  }

  function loadCustomPartIntoEditor(entry: CustomProjectPart) {
    setActiveWorkspaceTab("builder");
    setActiveBuilderTab("custom");
    setEditingCustomPartId(entry.id);
    setCustomPartDraft({
      title: entry.title,
      length: String(round2(entry.length)),
      width: String(round2(entry.width)),
      qty: String(entry.qty),
      thickness: String(round2(entry.thickness * 10)),
      material: projectSettings.material,
      category: entry.category,
      grainDirection: entry.grainDirection,
      edgeBanding: { ...(entry.edgeBanding ?? {}) },
    });
  }

  function removeCustomPart(partId: string) {
    setCustomParts((current) => current.filter((part) => part.id !== partId));
    setEdgeBandOverrides((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => !key.startsWith(`${partId}::`),
        ),
      ),
    );
    invalidateCalculatedState();

    if (editingCustomPartId === partId) {
      resetCustomPartEditor();
    }
  }

  function saveUnit() {
    const title = editorTitle.trim() || createUnitTitle(units.length);
    const nextUnitInput = applyProjectSettingsToInput(
      editorInput,
      projectSettings,
    );

    if (editingUnitId) {
      setUnits((current) =>
        current.map((unit) =>
          unit.id === editingUnitId
            ? { ...nextUnitInput, id: editingUnitId, title }
            : unit,
        ),
      );
      setActiveProjectUnitId(editingUnitId);
      announceUnitSaved(
        editingUnitId,
        `تم حفظ تعديل ${title} داخل قائمة المشروع.`,
      );
      invalidateCalculatedState();
      resetEditor(units.length);
      return;
    }

    const nextId = createUnitId();

    setUnits((current) => [
      ...current,
      {
        ...nextUnitInput,
        id: nextId,
        title,
      },
    ]);
    setProjectArrangement((current) => [
      ...current,
      { id: nextId, offsetX: 0, offsetY: 0, offsetZ: 0, rotationY: 0 },
    ]);
    setActiveProjectUnitId(nextId);
    announceUnitSaved(nextId, `تمت إضافة ${title} إلى قائمة الوحدات.`);
    invalidateCalculatedState();
    resetEditor(units.length + 1);
  }

  function loadUnitIntoEditor(unit: CabinetUnit) {
    setActiveWorkspaceTab("builder");
    setActiveBuilderTab("unit");
    const { id, title, ...input } = unit;
    const nextInput = applyProjectSettingsToInput(input, projectSettings);
    setEditorTitle(title);
    setEditorInput(nextInput);
    setEditorNumericDrafts(buildEditorNumericDrafts(nextInput));
    setEditingUnitId(id);
    if (calculatedViews.some((view) => view.unit.id === id)) {
      setSelectedCalculatedUnitId(id);
    }
    setSelectedPartId(null);
  }

  function loadUnitPreset(preset: UnitPreset) {
    setActiveWorkspaceTab("builder");
    setActiveBuilderTab("unit");
    const nextInput = applyProjectSettingsToInput(
      preset.input,
      projectSettings,
    );

    setEditingUnitId(null);
    setEditorTitle(preset.title);
    setEditorInput(nextInput);
    setEditorNumericDrafts(buildEditorNumericDrafts(nextInput));
    setSelectedPartId(null);
    setIsUnitPresetOpen(false);
  }

  function duplicateUnit(unit: CabinetUnit) {
    const nextId = createUnitId();
    const duplicateTitle = `${unit.title} - نسخة`;

    setUnits((current) => [
      ...current,
      {
        ...unit,
        id: nextId,
        title: duplicateTitle,
      },
    ]);
    setProjectArrangement((current) => [
      ...current,
      { id: nextId, offsetX: 0, offsetY: 0, offsetZ: 0, rotationY: 0 },
    ]);
    setEdgeBandOverrides((current) => {
      const nextOverrides = { ...current };

      Object.entries(current).forEach(([key, value]) => {
        if (!key.startsWith(`${unit.id}::`)) {
          return;
        }

        nextOverrides[key.replace(`${unit.id}::`, `${nextId}::`)] = {
          ...value,
        };
      });

      return nextOverrides;
    });
    setActiveProjectUnitId(nextId);
    setActiveWorkspaceTab("builder");
    setActiveBuilderTab("units");
    invalidateCalculatedState();
    announceUnitSaved(
      nextId,
      `تم نسخ ${unit.title} كوحدة جديدة باسم ${duplicateTitle}.`,
    );
  }

  function removeUnit(unitId: string) {
    const nextUnits = units.filter((unit) => unit.id !== unitId);
    setUnits(nextUnits);
    setEdgeBandOverrides((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => !key.startsWith(`${unitId}::`),
        ),
      ),
    );
    setProjectArrangement((current) =>
      current.filter((item) => item.id !== unitId),
    );
    setActiveProjectUnitId((current) =>
      current === unitId ? (nextUnits[0]?.id ?? null) : current,
    );
    invalidateCalculatedState();

    if (editingUnitId === unitId) {
      resetEditor(nextUnits.length);
    }

    setUnitFeedback((current) => (current?.unitId === unitId ? null : current));
  }

  function calculateUnits() {
    if (units.length === 0 && customParts.length === 0) {
      return;
    }

    setActiveWorkspaceTab("results");
    setCalculatedUnits(units.map((unit) => ({ ...unit })));
    setCalculatedCustomParts(customParts.map((part) => ({ ...part })));
    setSelectedCalculatedUnitId(units[0]?.id ?? null);
    setSelectedPartId(null);
  }

  function resetProjectWorkspace() {
    if (
      (units.length > 0 || currentProjectId) &&
      !window.confirm(
        "سيتم بدء مشروع جديد وإخلاء الوحدات الحالية. هل تريد المتابعة؟",
      )
    ) {
      return;
    }

    setProjectName("مشروع جديد");
    setCurrentProjectId(null);
    setProjectSettings(defaultProjectSettings);
    setProjectSettingsDrafts(
      buildProjectSettingsDrafts(defaultProjectSettings),
    );
    setUnits([]);
    setCustomParts([]);
    setCalculatedUnits([]);
    setCalculatedCustomParts([]);
    setSelectedCalculatedUnitId(null);
    setProjectArrangement([]);
    setActiveProjectUnitId(null);
    setActiveWorkspaceTab("builder");
    setActiveBuilderTab("unit");
    setEdgeBandOverrides({});
    setUnitFeedback(null);
    resetEditor(0, defaultProjectSettings);
    resetCustomPartEditor(defaultProjectSettings);
    announceProjectAction("تم فتح مشروع جديد.");
  }

  function saveCurrentProject() {
    const trimmedName = projectName.trim() || "مشروع بدون اسم";
    const nextProjectId = currentProjectId ?? createProjectId();
    const snapshot: SavedProject = {
      id: nextProjectId,
      name: trimmedName,
      updatedAt: new Date().toISOString(),
      settings: projectSettings,
      units,
      customParts,
      arrangement: normalizedProjectArrangement,
      edgeBandOverrides,
    };

    setSavedProjects((current) =>
      [
        snapshot,
        ...current.filter((project) => project.id !== nextProjectId),
      ].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      ),
    );
    setCurrentProjectId(nextProjectId);
    setProjectName(trimmedName);
    announceProjectAction(`تم حفظ ${trimmedName}.`);
  }

  function loadSavedProject(project: SavedProject) {
    const nextArrangement = buildProjectArrangement(
      project.units,
      project.arrangement,
    );
    setCurrentProjectId(project.id);
    setProjectName(project.name);
    setProjectSettings(project.settings);
    setProjectSettingsDrafts(buildProjectSettingsDrafts(project.settings));
    setUnits(project.units);
    setCustomParts(
      (project.customParts ?? []).map((part) => ({
        ...part,
        material: project.settings.material,
        edgeBanding: part.edgeBanding ?? {},
      })),
    );
    setEdgeBandOverrides(project.edgeBandOverrides ?? {});
    setCalculatedUnits(project.units.map((unit) => ({ ...unit })));
    setCalculatedCustomParts(
      (project.customParts ?? []).map((part) => ({
        ...part,
        material: project.settings.material,
        edgeBanding: part.edgeBanding ?? {},
      })),
    );
    setSelectedCalculatedUnitId(project.units[0]?.id ?? null);
    setProjectArrangement(nextArrangement);
    setActiveWorkspaceTab("project");
    setActiveBuilderTab("units");
    setActiveProjectUnitId(
      nextArrangement[0]?.id ?? project.units[0]?.id ?? null,
    );
    setSelectedPartId(null);
    setUnitFeedback(null);
    resetEditor(project.units.length, project.settings);
    resetCustomPartEditor(project.settings);
    setIsProjectLibraryOpen(false);
    announceProjectAction(`تم تحميل ${project.name}.`);
  }

  function deleteSavedProject(projectId: string) {
    setSavedProjects((current) =>
      current.filter((project) => project.id !== projectId),
    );

    if (currentProjectId === projectId) {
      setCurrentProjectId(null);
    }
  }

  function toggleProjectPartEdgeBand(
    aggregatedPartId: string,
    side: EdgeBandSide,
  ) {
    const aggregatedPart = aggregatedProjectPartMap.get(aggregatedPartId);
    if (!aggregatedPart) {
      return;
    }

    const nextValue = !(aggregatedPart.part.edgeBanding[side] ?? false);

    setEdgeBandOverrides((current) => {
      const nextOverrides = { ...current };

      aggregatedPart.sourceKeys.forEach((sourceKey) => {
        const existingOverride =
          nextOverrides[sourceKey] ?? aggregatedPart.part.edgeBanding;
        nextOverrides[sourceKey] = {
          ...existingOverride,
          [side]: nextValue,
        };
      });

      return nextOverrides;
    });
    setSelectedPartId(aggregatedPartId);
    announceProjectAction(
      `${nextValue ? "تمت إضافة" : "تم إلغاء"} الحافة ${edgeBandSideLabels[side]} لقطعة ${aggregatedPart.part.name}.`,
    );
  }

  function exportProjectCsv() {
    if (projectParts.length === 0) {
      return;
    }

    const csv = buildProjectCsv(
      projectName.trim() || "مشروع",
      projectSettings,
      projectParts,
      projectSheetLayout,
      projectPartLinkMap,
    );

    downloadTextFile(
      `${(projectName.trim() || "project").replace(/\s+/g, "-")}-cutlist.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
    announceProjectAction("تم تصدير CSV للمشروع.");
  }

  function printProjectSummary() {
    if (projectParts.length === 0) {
      return;
    }

    const printMarkup = buildPrintDocument(
      projectName.trim() || "مشروع",
      projectSettings,
      {
        unitCount: projectSummary.unitCount,
        totalPanels: projectSummary.totalPanels,
        totalAreaM2: projectSummary.totalAreaM2,
        totalSheets: projectSummary.totalSheets,
        totalProjectCost: projectSummary.totalProjectCost,
      },
      projectParts,
      projectSheetLayout,
      projectPartLinkMap,
    );
    const printBlob = new Blob([printMarkup], {
      type: "text/html;charset=utf-8",
    });
    const printUrl = window.URL.createObjectURL(printBlob);
    const printWindow = window.open(
      printUrl,
      "_blank",
      "width=1100,height=800",
    );

    if (!printWindow) {
      window.URL.revokeObjectURL(printUrl);
      return;
    }

    function revokePrintUrl() {
      window.setTimeout(() => {
        window.URL.revokeObjectURL(printUrl);
      }, 60_000);
    }

    printWindow.addEventListener(
      "load",
      () => {
        printWindow.focus();
        window.setTimeout(() => {
          printWindow.print();
        }, 250);
      },
      { once: true },
    );
    printWindow.addEventListener("afterprint", revokePrintUrl, { once: true });
    revokePrintUrl();
  }

  const bindProjectPreviewCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      projectPreviewCanvasRef.current = canvas;
    },
    [],
  );

  function printProjectPreviewSnapshot() {
    const canvas = projectPreviewCanvasRef.current;

    if (!canvas || projectPreviewUnits.length === 0) {
      return;
    }

    const imageDataUrl = canvas.toDataURL("image/png");
    const printBlob = new Blob(
      [
        `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <title>معاينة 3D - ${projectName.trim() || "ترتيب الوحدات"}</title>
    <style>
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, sans-serif;
        background: #f5efe6;
        color: #1c1917;
      }

      main {
        padding: 24px;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }

      p {
        margin: 0 0 18px;
        color: #57534e;
      }

      .frame {
        border: 1px solid #d6d3d1;
        border-radius: 24px;
        overflow: hidden;
        background: white;
        box-shadow: 0 24px 60px -36px rgba(63, 40, 12, 0.45);
      }

      img {
        display: block;
        width: 100%;
        height: auto;
      }

      @page {
        size: landscape;
        margin: 12mm;
      }

      @media print {
        body {
          background: white;
        }

        main {
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${projectName.trim() || "ترتيب الوحدات"}</h1>
      <p>لقطة مطبوعة من مشهد 3D الحالي بعد ترتيب الوحدات.</p>
      <div class="frame">
        <img src="${imageDataUrl}" alt="معاينة ثلاثية الأبعاد لترتيب الوحدات" />
      </div>
    </main>
  </body>
</html>`,
      ],
      {
        type: "text/html;charset=utf-8",
      },
    );
    const printUrl = window.URL.createObjectURL(printBlob);
    const printWindow = window.open(
      printUrl,
      "_blank",
      "width=1200,height=900",
    );

    if (!printWindow) {
      window.URL.revokeObjectURL(printUrl);
      return;
    }

    function revokePrintUrl() {
      window.setTimeout(() => {
        window.URL.revokeObjectURL(printUrl);
      }, 60_000);
    }

    printWindow.addEventListener(
      "load",
      () => {
        printWindow.focus();
        window.setTimeout(() => {
          printWindow.print();
        }, 250);
      },
      { once: true },
    );
    printWindow.addEventListener("afterprint", revokePrintUrl, { once: true });
    revokePrintUrl();
  }

  function handlePartSelection(partId: string) {
    setSelectedPartId((current) => (current === partId ? null : partId));
  }

  function nudgeProjectUnit(
    unitId: string,
    axis: "x" | "y" | "z",
    delta: number,
  ) {
    setProjectArrangement((current) =>
      current.map((item) =>
        item.id === unitId
          ? {
              ...item,
              offsetX:
                axis === "x"
                  ? round2(
                      Math.max(
                        -projectArrangementTravelLimitCm,
                        Math.min(
                          projectArrangementTravelLimitCm,
                          (Number.isFinite(item.offsetX) ? item.offsetX : 0) +
                            delta,
                        ),
                      ),
                    )
                  : item.offsetX,
              offsetY:
                axis === "y"
                  ? round2(
                      Math.max(
                        -projectArrangementTravelLimitCm,
                        Math.min(
                          projectArrangementTravelLimitCm,
                          (Number.isFinite(item.offsetY) ? item.offsetY : 0) +
                            delta,
                        ),
                      ),
                    )
                  : item.offsetY,
              offsetZ:
                axis === "z"
                  ? round2(
                      Math.max(
                        -projectArrangementTravelLimitCm,
                        Math.min(
                          projectArrangementTravelLimitCm,
                          (Number.isFinite(item.offsetZ) ? item.offsetZ : 0) +
                            delta,
                        ),
                      ),
                    )
                  : item.offsetZ,
            }
          : item,
      ),
    );
  }

  function updateProjectUnitPosition(
    unitId: string,
    nextPosition: { x: number; z: number },
  ) {
    const previewUnit = projectPreviewUnits.find((unit) => unit.id === unitId);
    if (!previewUnit) {
      return;
    }

    const nextOffsetX = round2(
      nextPosition.x - previewUnit.basePosition[0] * 100,
    );
    const nextOffsetZ = round2(
      nextPosition.z - previewUnit.basePosition[2] * 100,
    );

    setProjectArrangement((current) =>
      current.map((item) =>
        item.id === unitId
          ? {
              ...item,
              offsetX: Math.max(
                -projectArrangementTravelLimitCm,
                Math.min(projectArrangementTravelLimitCm, nextOffsetX),
              ),
              offsetZ: Math.max(
                -projectArrangementTravelLimitCm,
                Math.min(projectArrangementTravelLimitCm, nextOffsetZ),
              ),
            }
          : item,
      ),
    );
  }

  function rotateProjectUnit(unitId: string, delta: number) {
    setProjectArrangement((current) =>
      current.map((item) =>
        item.id === unitId
          ? {
              ...item,
              rotationY: (((item.rotationY + delta) % 360) + 360) % 360,
            }
          : item,
      ),
    );
  }

  function moveProjectUnitOrder(
    unitId: string,
    direction: "backward" | "forward",
  ) {
    setProjectArrangement((current) => {
      const index = current.findIndex((item) => item.id === unitId);
      if (index === -1) {
        return current;
      }

      const targetIndex = direction === "backward" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function resetProjectArrangement() {
    setProjectArrangement((current) =>
      current.map((item) => ({
        ...item,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        rotationY: 0,
      })),
    );
  }

  function updateProjectSetting<K extends keyof ProjectSettings>(
    key: K,
    value: ProjectSettings[K],
  ) {
    const nextSettings = {
      ...projectSettings,
      [key]: value,
    };

    setProjectSettings(nextSettings);
    setProjectSettingsDrafts(buildProjectSettingsDrafts(nextSettings));
    setCustomPartDraft((current) =>
      editingCustomPartId
        ? current
        : {
            ...current,
            material:
              key === "material" ? (value as MaterialType) : current.material,
            thickness:
              key === "boardThickness"
                ? String(round2((value as number) * 10))
                : current.thickness,
          },
    );
    setEditorInput((current) =>
      applyProjectSettingsToInput(current, nextSettings),
    );
    const nextCabinetSettings = getCabinetProjectSettings(nextSettings);
    setUnits((current) =>
      current.map((unit) => ({
        ...unit,
        ...nextCabinetSettings,
      })),
    );
    invalidateCalculatedState();
  }

  function toggleResultsSection(section: ResultsSectionKey) {
    setOpenResultsSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function updateProjectSettingNumber(
    key: keyof ProjectSettingsNumericDrafts,
    value: string,
  ) {
    const normalizedValue = normalizeNumericInput(value);

    setProjectSettingsDrafts((current) => ({
      ...current,
      [key]: normalizedValue,
    }));

    if (normalizedValue.trim() === "") {
      updateProjectSetting(key, 0);
      return;
    }

    const parsedValue = Number(normalizedValue);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    updateProjectSetting(
      key,
      (key === "boardThickness" ||
      key === "backThickness" ||
      key === "cutKerf" ||
      key === "trimMargin"
        ? parsedValue / 10
        : parsedValue) as ProjectSettings[typeof key],
    );
  }

  const previewFallback = (
    <div className="flex h-72 w-full items-center justify-center rounded-[1.25rem] border border-dashed border-stone-300 bg-white/65 text-center text-sm text-stone-500">
      جارٍ تحميل المعاينة ثلاثية الأبعاد...
    </div>
  );

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(194,165,116,0.18),_transparent_32%),linear-gradient(180deg,#f6f1e7_0%,#f2ece1_34%,#ebe3d5_100%)] text-foreground"
    >
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 pb-28 sm:px-6 sm:pb-8 lg:px-8">
        {isProjectSettingsOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm">
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_30px_90px_-40px_rgba(63,40,12,0.55)] sm:max-h-[calc(100vh-3rem)]">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
                <div>
                  <h2 className="text-lg font-semibold text-stone-950">
                    إعدادات المشروع
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    الخامة وسمك اللوح وسمك الظهر ستُطبق على كل الوحدات داخل هذا
                    المشروع.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 min-w-20 shrink-0 px-4 sm:min-h-9 sm:min-w-fit sm:px-3"
                  onClick={() => setIsProjectSettingsOpen(false)}
                >
                  إغلاق
                </Button>
              </div>

              <div className="space-y-4 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-5 sm:pb-5">
                <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3 sm:p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-stone-950">
                      الخامة والسماكات
                    </h3>
                    <p className="text-xs text-stone-500">
                      إعدادات الخامة الأساسية التي تُسحب تلقائيًا على كل
                      الوحدات.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label>الخامة</Label>
                      <Select
                        value={projectSettings.material}
                        onValueChange={(value) =>
                          updateProjectSetting(
                            "material",
                            value as MaterialType,
                          )
                        }
                      >
                        <SelectTrigger className="w-full bg-white">
                          <SelectValue>
                            {materialLabels[projectSettings.material]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mdf">MDF</SelectItem>
                          <SelectItem value="melamine">ميلامين</SelectItem>
                          <SelectItem value="plywood">كونتر</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="projectBoardThickness">
                        سمك اللوح (مم)
                      </Label>
                      <Input
                        id="projectBoardThickness"
                        inputMode="decimal"
                        className="bg-white"
                        value={projectSettingsDrafts.boardThickness}
                        onChange={(event) =>
                          updateProjectSettingNumber(
                            "boardThickness",
                            event.target.value,
                          )
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="projectBackThickness">
                        سمك الظهر (مم)
                      </Label>
                      <Input
                        id="projectBackThickness"
                        inputMode="decimal"
                        className="bg-white"
                        value={projectSettingsDrafts.backThickness}
                        onChange={(event) =>
                          updateProjectSettingNumber(
                            "backThickness",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3 sm:p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-stone-950">
                      مقاسات الألواح
                    </h3>
                    <p className="text-xs text-stone-500">
                      هذه المقاسات هي التي يعتمد عليها توزيع القص لكل نوع لوح.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                    <div className="rounded-xl border border-stone-200 bg-white/85 p-3">
                      <p className="mb-3 text-sm font-medium text-stone-900">
                        لوح 18 مم
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="projectBoardSheetLength">
                            الطول (سم)
                          </Label>
                          <Input
                            id="projectBoardSheetLength"
                            inputMode="decimal"
                            className="bg-white"
                            value={projectSettingsDrafts.boardSheetLength}
                            onChange={(event) =>
                              updateProjectSettingNumber(
                                "boardSheetLength",
                                event.target.value,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="projectBoardSheetWidth">
                            العرض (سم)
                          </Label>
                          <Input
                            id="projectBoardSheetWidth"
                            inputMode="decimal"
                            className="bg-white"
                            value={projectSettingsDrafts.boardSheetWidth}
                            onChange={(event) =>
                              updateProjectSettingNumber(
                                "boardSheetWidth",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-white/85 p-3">
                      <p className="mb-3 text-sm font-medium text-stone-900">
                        لوح 6 مم
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="projectBackSheetLength">
                            الطول (سم)
                          </Label>
                          <Input
                            id="projectBackSheetLength"
                            inputMode="decimal"
                            className="bg-white"
                            value={projectSettingsDrafts.backSheetLength}
                            onChange={(event) =>
                              updateProjectSettingNumber(
                                "backSheetLength",
                                event.target.value,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="projectBackSheetWidth">
                            العرض (سم)
                          </Label>
                          <Input
                            id="projectBackSheetWidth"
                            inputMode="decimal"
                            className="bg-white"
                            value={projectSettingsDrafts.backSheetWidth}
                            onChange={(event) =>
                              updateProjectSettingNumber(
                                "backSheetWidth",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3 sm:p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-stone-950">
                      إعدادات القص
                    </h3>
                    <p className="text-xs text-stone-500">
                      سمك السلاح وحواف التشطيب التي تُخصم من المساحة القابلة
                      للقص.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="projectCutKerf">سمك السلاح (مم)</Label>
                      <Input
                        id="projectCutKerf"
                        inputMode="decimal"
                        className="bg-white"
                        value={projectSettingsDrafts.cutKerf}
                        onChange={(event) =>
                          updateProjectSettingNumber(
                            "cutKerf",
                            event.target.value,
                          )
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="projectTrimMargin">حافة تشطيب (مم)</Label>
                      <Input
                        id="projectTrimMargin"
                        inputMode="decimal"
                        className="bg-white"
                        value={projectSettingsDrafts.trimMargin}
                        onChange={(event) =>
                          updateProjectSettingNumber(
                            "trimMargin",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3 sm:p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-stone-950">
                      الأسعار والمصنعية
                    </h3>
                    <p className="text-xs text-stone-500">
                      تكلفة اللوح، المصنعية، وشريط الحافة لحساب تكلفة المشروع.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="projectBoardSheetPrice">
                        سعر لوح 18 مم
                      </Label>
                      <Input
                        id="projectBoardSheetPrice"
                        inputMode="decimal"
                        className="bg-white"
                        value={projectSettingsDrafts.boardSheetPrice}
                        onChange={(event) =>
                          updateProjectSettingNumber(
                            "boardSheetPrice",
                            event.target.value,
                          )
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="projectBackSheetPrice">
                        سعر لوح 6 مم
                      </Label>
                      <Input
                        id="projectBackSheetPrice"
                        inputMode="decimal"
                        className="bg-white"
                        value={projectSettingsDrafts.backSheetPrice}
                        onChange={(event) =>
                          updateProjectSettingNumber(
                            "backSheetPrice",
                            event.target.value,
                          )
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="projectLaborPrice">
                        مصنعية المتر المربع
                      </Label>
                      <Input
                        id="projectLaborPrice"
                        inputMode="decimal"
                        className="bg-white"
                        value={projectSettingsDrafts.laborPricePerSquareMeter}
                        onChange={(event) =>
                          updateProjectSettingNumber(
                            "laborPricePerSquareMeter",
                            event.target.value,
                          )
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="projectEdgeBandPrice">
                        سعر متر شريط الحافة
                      </Label>
                      <Input
                        id="projectEdgeBandPrice"
                        inputMode="decimal"
                        className="bg-white"
                        value={projectSettingsDrafts.edgeBandPricePerMeter}
                        onChange={(event) =>
                          updateProjectSettingNumber(
                            "edgeBandPricePerMeter",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 z-10 border-t border-stone-200 bg-stone-50/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] text-xs text-stone-500 sm:px-6 sm:py-4 sm:pb-4">
                أي تعديل هنا ينسحب فورًا على الوحدات الموجودة حاليًا وعلى أي
                وحدة جديدة تضيفها بعد ذلك.
              </div>
            </div>
          </div>
        ) : null}

        {isProjectLibraryOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm">
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_30px_90px_-40px_rgba(63,40,12,0.55)] sm:max-h-[calc(100vh-3rem)]">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
                <div>
                  <h2 className="text-lg font-semibold text-stone-950">
                    مكتبة المشاريع
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    افتح مشروعًا محفوظًا أو احذف مشروعًا قديمًا من الجهاز
                    الحالي.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 min-w-20 shrink-0 px-4 sm:min-h-9 sm:min-w-fit sm:px-3"
                  onClick={() => setIsProjectLibraryOpen(false)}
                >
                  إغلاق
                </Button>
              </div>

              <div className="grid gap-4 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-5 sm:pb-5 md:grid-cols-2">
                {savedProjects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 p-5 text-sm text-stone-500 md:col-span-2">
                    لا توجد مشاريع محفوظة بعد. احفظ أول مشروع وسيظهر هنا.
                  </div>
                ) : (
                  savedProjects.map((project) => (
                    <div
                      key={project.id}
                      className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-stone-950">
                            {project.name}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            آخر حفظ {formatProjectUpdatedAt(project.updatedAt)}
                          </p>
                        </div>
                        {currentProjectId === project.id ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            الحالي
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-stone-500 sm:grid-cols-2">
                        <p>الوحدات: {project.units.length}</p>
                        <p>
                          اللوح:{" "}
                          {formatSheetSize(
                            project.settings.boardSheetLength,
                            project.settings.boardSheetWidth,
                          )}
                        </p>
                        <p>
                          الخامة: {materialLabels[project.settings.material]}
                        </p>
                        <p>
                          سلاح:{" "}
                          {formatOptionalMmFromCm(project.settings.cutKerf)}
                        </p>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1"
                          onClick={() => loadSavedProject(project)}
                        >
                          <FolderOpen className="size-4" />
                          فتح المشروع
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => deleteSavedProject(project.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {isUnitPresetOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm">
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_30px_90px_-40px_rgba(63,40,12,0.55)] sm:max-h-[calc(100vh-3rem)]">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
                <div>
                  <h2 className="text-lg font-semibold text-stone-950">
                    مكتبة الوحدات الجاهزة
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    اختر وحدة جاهزة لتعبئة المحرر الحالي بسرعة، ثم عدّل المقاسات
                    والتفاصيل كما تريد.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 min-w-20 shrink-0 px-4 sm:min-h-9 sm:min-w-fit sm:px-3"
                  onClick={() => setIsUnitPresetOpen(false)}
                >
                  إغلاق
                </Button>
              </div>

              <div className="grid gap-4 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-5 sm:pb-5 md:grid-cols-2 xl:grid-cols-3">
                {unitPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="rounded-[1.5rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(252,250,247,0.95),rgba(243,236,227,0.82))] p-4 shadow-[0_18px_44px_-36px_rgba(63,40,12,0.4)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-950">
                          {preset.title}
                        </p>
                        <p className="mt-1 text-xs leading-6 text-stone-500">
                          {preset.description}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-stone-200 bg-white/80 text-stone-700"
                      >
                        {cabinetTypeLabels[preset.input.cabinetType]}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-white/75 p-3 ring-1 ring-stone-200">
                        <p className="text-[11px] text-stone-500">المقاس</p>
                        <p className="mt-1 font-semibold text-stone-950">
                          {formatCm(preset.input.width)} ×{" "}
                          {formatCm(preset.input.height)} ×{" "}
                          {formatCm(preset.input.depth)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/75 p-3 ring-1 ring-stone-200">
                        <p className="text-[11px] text-stone-500">الواجهة</p>
                        <p className="mt-1 font-semibold text-stone-950">
                          {frontOptionLabels[preset.input.frontOption]}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
                      <span>{preset.input.shelfCount} رف</span>
                      <span>•</span>
                      <span>{preset.input.drawerCount} درج</span>
                      <span>•</span>
                      <span>{preset.input.doorLeafCount} دلفة</span>
                    </div>

                    <Button
                      type="button"
                      className="mt-4 w-full"
                      onClick={() => loadUnitPreset(preset)}
                    >
                      تحميل في المحرر
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <section className="relative overflow-hidden rounded-[2rem] border border-black/5 bg-white/80 p-6 shadow-[0_30px_90px_-50px_rgba(63,40,12,0.45)] backdrop-blur sm:p-8">
          <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(90deg,rgba(116,84,45,0.14),rgba(210,191,162,0.08),rgba(41,64,55,0.14))]" />
          <div className="relative sm:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge
                  variant="outline"
                  className="border-amber-900/15 bg-amber-50 text-amber-950"
                >
                  Cabinet Cut Optimizer
                </Badge>
                <h1 className="mt-3 text-xl font-semibold leading-tight text-stone-950">
                  مشروع القص
                </h1>
                <p className="mt-1 text-xs leading-6 text-stone-500">
                  {projectItemCount} عنصر • {units.length} وحدة •{" "}
                  {customParts.length} مقاس حر
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setIsTopPanelExpanded((current) => !current)}
              >
                {isTopPanelExpanded ? (
                  <ArrowUp className="size-4" />
                ) : (
                  <ArrowDown className="size-4" />
                )}
                {isTopPanelExpanded ? "إخفاء" : "تفاصيل"}
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-stone-950 px-3 py-3 text-stone-50">
                <p className="text-[11px] text-stone-300">العناصر</p>
                <p className="mt-1 text-sm font-semibold">{projectItemCount}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white/90 px-3 py-3">
                <p className="text-[11px] text-stone-500">القطع</p>
                <p className="mt-1 text-sm font-semibold text-stone-900">
                  {hasCalculatedProject ? projectParts.length : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white/90 px-3 py-3">
                <p className="text-[11px] text-stone-500">الاستهلاك</p>
                <p className="mt-1 text-sm font-semibold text-stone-900">
                  {hasCalculatedProject
                    ? `${projectLayoutTotalAreaM2} م²`
                    : "--"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={saveCurrentProject}
              >
                <Save className="size-4" />
                حفظ
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsProjectSettingsOpen(true)}
              >
                <Settings2 className="size-4" />
                الإعدادات
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between",
              !isTopPanelExpanded && "hidden sm:flex",
            )}
          >
            <div className="max-w-3xl space-y-4">
              <Badge
                variant="outline"
                className="border-amber-900/15 bg-amber-50 text-amber-950"
              >
                Cabinet Cut Optimizer
              </Badge>
              <div className="space-y-3">
                <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-stone-950 sm:text-5xl">
                  كوّن مشروعك من أكثر من وحدة، ثم احسب القص بعد ما تخلص الإضافة.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
                  أضف كل وحدة بمقاساتها ونوع واجهتها، عاين شكلها في 3D أثناء
                  الإعداد، وبعدها اضغط احسب لإخراج المقاسات النهائية للوحدة
                  المختارة داخل المشروع.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[28rem]">
              <Card className="border-0 bg-stone-950 text-stone-50 ring-0">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs text-stone-300">عناصر المشروع</p>
                    <p className="mt-1 font-medium">{projectItemCount}</p>
                  </div>
                  <Box className="size-4 opacity-80" />
                </CardContent>
              </Card>
              <Card className="border-0 bg-white/90 ring-1 ring-stone-200">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs text-stone-500">القطع المحسوبة</p>
                    <p className="mt-1 font-medium text-stone-900">
                      {calculatedViews.length > 0
                        ? projectSummary.totalPanels
                        : "--"}
                    </p>
                  </div>
                  <PanelsTopLeft className="size-4 text-stone-500" />
                </CardContent>
              </Card>
              <Card className="border-0 bg-white/90 ring-1 ring-stone-200">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs text-stone-500">استهلاك المشروع</p>
                    <p className="mt-1 font-medium text-stone-900">
                      {calculatedViews.length > 0
                        ? `${projectSummary.totalAreaM2} م²`
                        : "--"}
                    </p>
                  </div>
                  <Ruler className="size-4 text-stone-500" />
                </CardContent>
              </Card>
            </div>
          </div>

          <div
            className={cn(
              "relative mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-stone-200/70 pt-4",
              !isTopPanelExpanded && "hidden sm:flex",
            )}
          >
            <div className="min-w-[18rem] flex-1 rounded-[1.6rem] border border-stone-200 bg-[linear-gradient(135deg,rgba(252,250,247,0.96),rgba(243,236,227,0.9))] p-4 shadow-[0_18px_50px_-40px_rgba(63,40,12,0.35)]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-2 lg:min-w-[16rem] lg:flex-1">
                  <Label
                    htmlFor="projectName"
                    className="text-xs text-stone-500"
                  >
                    اسم المشروع
                  </Label>
                  <Input
                    id="projectName"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    className="h-11 bg-white/90 text-base font-medium"
                  />
                  <div className="flex flex-wrap gap-2 text-xs text-stone-500">
                    <span>{units.length} وحدة</span>
                    <span>•</span>
                    <span>{customParts.length} مقاس حر</span>
                    <span>•</span>
                    <span>{savedProjects.length} مشروع محفوظ</span>
                    {currentProjectId ? (
                      <>
                        <span>•</span>
                        <span>تم ربط المشروع بالحفظ المحلي</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 xl:max-w-[42rem] xl:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 min-w-[8.75rem] justify-center whitespace-nowrap bg-white/90 px-4"
                    onClick={resetProjectWorkspace}
                  >
                    <Plus className="size-4" />
                    مشروع جديد
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 min-w-[8.75rem] justify-center whitespace-nowrap bg-white/90 px-4"
                    onClick={saveCurrentProject}
                  >
                    <Save className="size-4" />
                    حفظ المشروع
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 min-w-[8.75rem] justify-center whitespace-nowrap bg-white/90 px-4"
                    onClick={() => setIsProjectLibraryOpen(true)}
                  >
                    <FolderOpen className="size-4" />
                    المشاريع
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 min-w-[8.75rem] justify-center whitespace-nowrap bg-white/90 px-4"
                    onClick={exportProjectCsv}
                    disabled={projectParts.length === 0}
                  >
                    <Download className="size-4" />
                    تصدير CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 min-w-[8.75rem] justify-center whitespace-nowrap bg-white/90 px-4"
                    onClick={printProjectSummary}
                    disabled={projectParts.length === 0}
                  >
                    <Printer className="size-4" />
                    طباعة
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex min-h-6 flex-col gap-2 text-xs text-stone-500 md:flex-row md:items-center md:justify-between">
                <span className="leading-6">
                  {currentProjectId
                    ? "يمكنك الآن تحديث نفس المشروع أو حفظ نسخة جديدة بالاسم الحالي."
                    : "ابدأ التسمية ثم احفظ المشروع ليظهر داخل مكتبة المشاريع."}
                </span>
                {projectActionMessage ? (
                  <span className="font-medium leading-6 text-emerald-700 md:text-left">
                    {projectActionMessage}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl bg-stone-50/90 px-4 py-3 ring-1 ring-stone-200">
              <p className="text-xs text-stone-500">إعدادات المشروع الحالية</p>
              <p className="mt-1 text-sm font-medium text-stone-950">
                {materialLabels[projectSettings.material]} •{" "}
                {formatMmFromCm(projectSettings.boardThickness)} • ظهر{" "}
                {formatMmFromCm(projectSettings.backThickness)}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                لوح 18:{" "}
                {formatSheetSize(
                  projectSettings.boardSheetLength,
                  projectSettings.boardSheetWidth,
                )}{" "}
                • لوح 6:{" "}
                {formatSheetSize(
                  projectSettings.backSheetLength,
                  projectSettings.backSheetWidth,
                )}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                سلاح: {formatOptionalMmFromCm(projectSettings.cutKerf)} • حافة
                تشطيب: {formatOptionalMmFromCm(projectSettings.trimMargin)}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                لوح 18: {formatPrice(projectSettings.boardSheetPrice)} • لوح 6:{" "}
                {formatPrice(projectSettings.backSheetPrice)} • مصنعية:{" "}
                {formatPrice(projectSettings.laborPricePerSquareMeter)}/م²
              </p>
              <p className="mt-1 text-xs text-stone-500">
                شريط حافة: {formatPrice(projectSettings.edgeBandPricePerMeter)}
                /م ط
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsProjectSettingsOpen(true)}
            >
              <Settings2 className="size-4" />
              إعدادات المشروع
            </Button>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {workspaceTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeWorkspaceTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveWorkspaceTab(tab.id)}
                  className={cn(
                    "flex min-w-[10.5rem] shrink-0 items-center justify-between rounded-[1.35rem] border px-4 py-3 text-right transition-colors",
                    isActive
                      ? "border-stone-950 bg-stone-950 text-stone-50"
                      : "border-stone-200 bg-white/88 text-stone-700",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full",
                        isActive ? "bg-white/10" : "bg-stone-100",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{tab.label}</p>
                      <p
                        className={cn(
                          "text-[11px]",
                          isActive ? "text-stone-300" : "text-stone-500",
                        )}
                      >
                        {tab.badge}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {activeWorkspaceTab === "project" ? (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
              <CardHeader>
                <CardTitle>إدارة المشروع</CardTitle>
                <CardDescription>
                  اختصارات الإدارة والحفظ والإخراج مجمعة هنا بدل التنقل داخل
                  الصفحة كاملة.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="projectNamePanel">اسم المشروع</Label>
                  <Input
                    id="projectNamePanel"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    className="h-11 bg-white"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-xs text-stone-500">الوحدات الحالية</p>
                    <p className="mt-2 text-lg font-semibold text-stone-950">
                      {units.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-xs text-stone-500">المقاسات الحرة</p>
                    <p className="mt-2 text-lg font-semibold text-stone-950">
                      {customParts.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-xs text-stone-500">المحفوظات</p>
                    <p className="mt-2 text-lg font-semibold text-stone-950">
                      {savedProjects.length}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetProjectWorkspace}
                  >
                    <Plus className="size-4" />
                    مشروع جديد
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={saveCurrentProject}
                  >
                    <Save className="size-4" />
                    حفظ المشروع
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsProjectLibraryOpen(true)}
                  >
                    <FolderOpen className="size-4" />
                    المشاريع
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsProjectSettingsOpen(true)}
                  >
                    <Settings2 className="size-4" />
                    الإعدادات
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={exportProjectCsv}
                    disabled={projectParts.length === 0}
                  >
                    <Download className="size-4" />
                    CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={printProjectSummary}
                    disabled={projectParts.length === 0}
                  >
                    <Printer className="size-4" />
                    طباعة
                  </Button>
                </div>

                {projectActionMessage ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-800">
                    {projectActionMessage}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                <CardHeader>
                  <CardTitle>ملخص الإعدادات الحالية</CardTitle>
                  <CardDescription>
                    القيم التي ستُطبق على الوحدات والنتائج في هذا المشروع.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-stone-600">
                  <div className="rounded-2xl bg-stone-50/80 p-4 ring-1 ring-stone-200">
                    <p className="font-medium text-stone-950">
                      {materialLabels[projectSettings.material]} •{" "}
                      {formatMmFromCm(projectSettings.boardThickness)} • ظهر{" "}
                      {formatMmFromCm(projectSettings.backThickness)}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-stone-500">
                      لوح 18:{" "}
                      {formatSheetSize(
                        projectSettings.boardSheetLength,
                        projectSettings.boardSheetWidth,
                      )}{" "}
                      • لوح 6:{" "}
                      {formatSheetSize(
                        projectSettings.backSheetLength,
                        projectSettings.backSheetWidth,
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-stone-500">
                      سلاح: {formatOptionalMmFromCm(projectSettings.cutKerf)} •
                      حافة تشطيب:{" "}
                      {formatOptionalMmFromCm(projectSettings.trimMargin)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-stone-950 text-stone-50 ring-0">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Info className="size-4" />
                    <Layers2 className="size-4" />
                    <CardTitle>وضع المحرك الحالي</CardTitle>
                  </div>
                  <CardDescription className="text-stone-300">
                    المشروع أصبح يدعم تجميع وحدات متعددة مع أوضاع واجهات مختلفة
                    قبل تنفيذ الحساب النهائي.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </section>
        ) : null}

        {activeWorkspaceTab === "builder" ? (
          <>
            <section className="mt-6">
              <div className="grid gap-2 sm:grid-cols-3">
                {builderTabs.map((tab) => {
                  const isActive = activeBuilderTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveBuilderTab(tab.id)}
                      className={cn(
                        "rounded-[1.35rem] border p-4 text-right transition-colors",
                        isActive
                          ? "border-amber-300 bg-amber-50/80 ring-1 ring-amber-200"
                          : "border-stone-200 bg-white/88",
                      )}
                    >
                      <p className="text-sm font-semibold text-stone-950">
                        {tab.label}
                      </p>
                      <p className="mt-1 text-xs leading-6 text-stone-500">
                        {tab.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                {activeBuilderTab === "unit" ? (
                  <>
                    <CardHeader>
                      <CardTitle>
                        {editingUnitId ? "تعديل وحدة" : "إضافة وحدة"}
                      </CardTitle>
                      <CardDescription>
                        جهّز الوحدة الحالية من المقاسات ونوع الواجهة ثم أضفها
                        إلى قائمة المشروع.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="space-y-2 xl:col-span-2">
                          <Label htmlFor="unitTitle">اسم الوحدة</Label>
                          <Input
                            id="unitTitle"
                            value={editorTitle}
                            onChange={(event) =>
                              setEditorTitle(event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="width">
                            {isCornerBlindEditor ? "طول الضلع الأول" : "العرض"}
                          </Label>
                          <Input
                            id="width"
                            inputMode="decimal"
                            value={editorNumericDrafts.width}
                            onChange={(event) =>
                              updateNumber("width", event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="height">الارتفاع</Label>
                          <Input
                            id="height"
                            inputMode="decimal"
                            value={editorNumericDrafts.height}
                            onChange={(event) =>
                              updateNumber("height", event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="depth">
                            {isCornerBlindEditor ? "عرض الذراع" : "العمق"}
                          </Label>
                          <Input
                            id="depth"
                            inputMode="decimal"
                            value={editorNumericDrafts.depth}
                            onChange={(event) =>
                              updateNumber("depth", event.target.value)
                            }
                          />
                        </div>
                        {isCornerBlindEditor ? (
                          <div className="space-y-2">
                            <Label htmlFor="returnDepth">
                              طول الضلع الثاني
                            </Label>
                            <Input
                              id="returnDepth"
                              inputMode="decimal"
                              value={editorNumericDrafts.returnDepth}
                              onChange={(event) =>
                                updateNumber("returnDepth", event.target.value)
                              }
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="space-y-2">
                          <Label htmlFor="shelves">عدد الرفوف</Label>
                          <Input
                            id="shelves"
                            inputMode="numeric"
                            value={editorNumericDrafts.shelfCount}
                            onChange={(event) =>
                              updateNumber("shelfCount", event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>نوع الوحدة</Label>
                          <Select
                            value={editorInput.cabinetType}
                            onValueChange={(value) =>
                              updateCabinetType(value as CabinetType)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {cabinetTypeLabels[editorInput.cabinetType]}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="base">وحدة أرضية</SelectItem>
                              <SelectItem value="corner-l-base">
                                ركنة زاوية 45° أرضية
                              </SelectItem>
                              <SelectItem value="corner-l-wall">
                                ركنة زاوية 45° علوية
                              </SelectItem>
                              <SelectItem value="wall">وحدة معلقة</SelectItem>
                              <SelectItem value="tall">وحدة طويلة</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>الواجهة الأمامية</Label>
                          <Select
                            value={editorInput.frontOption}
                            onValueChange={(value) =>
                              setEditorInput((current) => ({
                                ...current,
                                frontOption: value as FrontOption,
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {frontOptionLabels[editorInput.frontOption]}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="doors">بدلف</SelectItem>
                              {isCornerBlindEditor ? null : (
                                <SelectItem value="drawers">أدراج</SelectItem>
                              )}
                              {isCornerBlindEditor ? null : (
                                <SelectItem value="mixed">
                                  أدراج + دلف
                                </SelectItem>
                              )}
                              <SelectItem value="none">بدون دلف</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {isCornerBlindEditor ? (
                          <div className="space-y-2">
                            <Label>موضع الزاوية</Label>
                            <Select
                              value={
                                editorInput.cabinetType === "corner-l-wall"
                                  ? "wall"
                                  : "base"
                              }
                              onValueChange={(value) =>
                                updateCornerPlacement(value as "base" | "wall")
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue>
                                  {
                                    cornerPlacementLabels[
                                      editorInput.cabinetType ===
                                      "corner-l-wall"
                                        ? "wall"
                                        : "base"
                                    ]
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="base">سفلية</SelectItem>
                                <SelectItem value="wall">علوية</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}
                        {isCornerBlindEditor ? (
                          <div className="space-y-2">
                            <Label>اتجاه الزاوية</Label>
                            <Select
                              value={editorInput.cornerHand}
                              onValueChange={(value) =>
                                setEditorInput((current) => ({
                                  ...current,
                                  cornerHand: value as CornerHand,
                                }))
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue>
                                  {cornerHandLabels[editorInput.cornerHand]}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">رجوع يسار</SelectItem>
                                <SelectItem value="right">رجوع يمين</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}
                        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 xl:col-span-2">
                          <p className="text-xs text-stone-500">
                            إعدادات المشروع
                          </p>
                          <p className="mt-1 text-sm font-medium text-stone-950">
                            {materialLabels[projectSettings.material]} •{" "}
                            {formatMmFromCm(projectSettings.boardThickness)} •
                            ظهر {formatMmFromCm(projectSettings.backThickness)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2">
                          <Label>اتجاه الثمرة</Label>
                          <Select
                            value={editorInput.grainDirection}
                            onValueChange={(value) =>
                              setEditorInput((current) => ({
                                ...current,
                                grainDirection: value as GrainDirection,
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {
                                  grainDirectionLabels[
                                    editorInput.grainDirection
                                  ]
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">حر</SelectItem>
                              <SelectItem value="length">
                                طولي مع طول اللوح
                              </SelectItem>
                              <SelectItem value="width">
                                عرضي مع عرض اللوح
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {(editorInput.frontOption === "drawers" ||
                          editorInput.frontOption === "mixed") && (
                          <div className="space-y-2">
                            <Label htmlFor="drawerCount">عدد الأدراج</Label>
                            <Input
                              id="drawerCount"
                              inputMode="numeric"
                              value={editorNumericDrafts.drawerCount}
                              onChange={(event) =>
                                updateNumber("drawerCount", event.target.value)
                              }
                            />
                          </div>
                        )}

                        {(editorInput.frontOption === "doors" ||
                          editorInput.frontOption === "mixed") && (
                          <div className="space-y-2">
                            <Label htmlFor="doorLeafCount">عدد الدلف</Label>
                            <Input
                              id="doorLeafCount"
                              inputMode="numeric"
                              value={editorNumericDrafts.doorLeafCount}
                              onChange={(event) =>
                                updateNumber(
                                  "doorLeafCount",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                        <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-stone-950">
                            <ScanSearch className="size-4" />
                            ملخص الوحدة الجاري إعدادها
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
                              <p className="text-xs text-stone-500">
                                الأبعاد الكلية
                              </p>
                              <p className="mt-1 text-sm font-medium text-stone-950">
                                {hasEditorCoreDimensions
                                  ? `${formatCm(editorInput.width)} × ${formatCm(editorInput.height)} × ${formatCm(editorInput.depth)}`
                                  : "أدخل العرض والارتفاع والعمق لعرض الملخص"}
                              </p>
                            </div>
                            {isCornerBlindEditor ? (
                              <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
                                <p className="text-xs text-stone-500">
                                  بيانات الزاوية
                                </p>
                                <p className="mt-1 text-sm font-medium text-stone-950">
                                  {hasEditorCompleteDimensions
                                    ? `${
                                        cornerPlacementLabels[
                                          editorInput.cabinetType ===
                                          "corner-l-wall"
                                            ? "wall"
                                            : "base"
                                        ]
                                      } • ${cornerHandLabels[editorInput.cornerHand]} • ضلع ثانٍ ${formatCm(editorInput.returnDepth)}`
                                    : "حدد ضلع الرجوع لإكمال معاينة الزاوية"}
                                </p>
                              </div>
                            ) : null}
                            <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
                              <p className="text-xs text-stone-500">
                                نوع الواجهة
                              </p>
                              <p className="mt-1 text-sm font-medium text-stone-950">
                                {frontOptionLabels[editorInput.frontOption]}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
                              <p className="text-xs text-stone-500">
                                عدد الواجهات الظاهرة
                              </p>
                              <p className="mt-1 text-sm font-medium text-stone-950">
                                {editorFrontPieceCount}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
                              <p className="text-xs text-stone-500">
                                الخامة المختارة
                              </p>
                              <p className="mt-1 text-sm font-medium text-stone-950">
                                {materialLabels[projectSettings.material]}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
                              <p className="text-xs text-stone-500">
                                سمك اللوح
                              </p>
                              <p className="mt-1 text-sm font-medium text-stone-950">
                                {formatMmFromCm(projectSettings.boardThickness)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
                              <p className="text-xs text-stone-500">
                                سمك الظهر
                              </p>
                              <p className="mt-1 text-sm font-medium text-stone-950">
                                {formatMmFromCm(projectSettings.backThickness)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
                              <p className="text-xs text-stone-500">
                                اتجاه الثمرة
                              </p>
                              <p className="mt-1 text-sm font-medium text-stone-950">
                                {
                                  grainDirectionLabels[
                                    editorInput.grainDirection
                                  ]
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-stone-200 bg-stone-950 p-4 text-stone-50">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Sparkles className="size-4" />
                            مراجعة قبل الإضافة
                          </div>
                          {hasEditorCompleteDimensions &&
                          editorReviewWarnings.length > 0 ? (
                            <ul className="mt-4 space-y-3 text-sm text-stone-300">
                              {editorReviewWarnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          ) : (
                            <ul className="mt-4 space-y-3 text-sm text-stone-300">
                              {hasEditorCompleteDimensions ? (
                                <>
                                  <li>
                                    المعاينة الحالية تعكس شكل الواجهة المختار
                                    بين الدلف والأدراج والمختلط.
                                  </li>
                                  <li>
                                    بعد إضافة الوحدات اضغط احسب لاستخراج مقاسات
                                    الوحدة المختارة من المشروع.
                                  </li>
                                  <li>
                                    يمكنك تحميل أي وحدة مضافة مرة أخرى إلى
                                    النموذج لتعديلها قبل الحساب.
                                  </li>
                                </>
                              ) : (
                                <>
                                  <li>
                                    ابدأ بإدخال العرض والارتفاع والعمق أولًا حتى
                                    تظهر معاينة حقيقية للوحدة بدل الحالة
                                    الافتراضية.
                                  </li>
                                  <li>
                                    لو كانت الوحدة زاوية L، أدخل طول الضلع
                                    الثاني أيضًا قبل الاعتماد على المراجعة.
                                  </li>
                                  <li>
                                    بعد اكتمال المقاسات ستظهر التحذيرات الفعلية
                                    المرتبطة بالتصميم بدل التحذيرات المبدئية.
                                  </li>
                                </>
                              )}
                            </ul>
                          )}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 border-t border-stone-200/80 bg-stone-50/80 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-stone-500">
                        أضف الوحدات أولًا، ثم احسب المشروع عند الانتهاء بدل
                        الحساب التلقائي مع كل تغيير.
                      </p>
                      <div className="flex w-full gap-2 sm:w-auto">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 sm:flex-none"
                          onClick={() => setIsUnitPresetOpen(true)}
                        >
                          <Box className="size-4" />
                          وحدات جاهزة
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 sm:flex-none"
                          onClick={() => resetEditor(units.length)}
                        >
                          إعادة ضبط النموذج
                        </Button>
                        <Button
                          type="button"
                          className="flex-1 sm:flex-none"
                          onClick={saveUnit}
                        >
                          <Plus className="size-4" />
                          {editingUnitId ? "حفظ تعديل الوحدة" : "إضافة وحدة"}
                        </Button>
                      </div>
                    </CardFooter>
                  </>
                ) : activeBuilderTab === "custom" ? (
                  <>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>مقاس حر</CardTitle>
                          <CardDescription>
                            أضف قطعة مستقلة لا ترتبط بوحدة، مثل 140 × 60 سم،
                            لتدخل مباشرة في كشف القص.
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-stone-200 bg-stone-50 text-stone-700"
                        >
                          {customParts.length} مقاس
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2 xl:col-span-2">
                          <Label htmlFor="customPartTitle">اسم القطعة</Label>
                          <Input
                            id="customPartTitle"
                            value={customPartDraft.title}
                            onChange={(event) =>
                              updateCustomPartDraft("title", event.target.value)
                            }
                            placeholder="مثال: قطعة ديكور حرة"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="customPartLength">الطول</Label>
                          <Input
                            id="customPartLength"
                            inputMode="decimal"
                            value={customPartDraft.length}
                            onChange={(event) =>
                              updateCustomPartDraft(
                                "length",
                                event.target.value,
                              )
                            }
                            placeholder="140"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="customPartWidth">العرض</Label>
                          <Input
                            id="customPartWidth"
                            inputMode="decimal"
                            value={customPartDraft.width}
                            onChange={(event) =>
                              updateCustomPartDraft("width", event.target.value)
                            }
                            placeholder="60"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="customPartQty">الكمية</Label>
                          <Input
                            id="customPartQty"
                            inputMode="numeric"
                            value={customPartDraft.qty}
                            onChange={(event) =>
                              updateCustomPartDraft("qty", event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="customPartThickness">
                            السمك (مم)
                          </Label>
                          <Input
                            id="customPartThickness"
                            inputMode="decimal"
                            value={customPartDraft.thickness}
                            onChange={(event) =>
                              updateCustomPartDraft(
                                "thickness",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>الخامة</Label>
                          <div className="flex h-10 items-center rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-700">
                            {materialLabels[projectSettings.material]}
                          </div>
                          <p className="text-xs text-stone-500">
                            المقاس الحر يستخدم خامة المشروع الحالية ويدخل مع نفس
                            تقسيم اللوح.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>فئة القطعة</Label>
                          <Select
                            value={customPartDraft.category}
                            onValueChange={(value) =>
                              updateCustomPartDraft(
                                "category",
                                value as PartCategory,
                              )
                            }
                          >
                            <SelectTrigger className="w-full bg-white">
                              <SelectValue>
                                {partCategoryLabels[customPartDraft.category]}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="carcass">هيكل</SelectItem>
                              <SelectItem value="shelf">رفوف</SelectItem>
                              <SelectItem value="support">دعامات</SelectItem>
                              <SelectItem value="back">ظهر</SelectItem>
                              <SelectItem value="front">واجهات</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>اتجاه الثمرة</Label>
                          <Select
                            value={customPartDraft.grainDirection}
                            onValueChange={(value) =>
                              updateCustomPartDraft(
                                "grainDirection",
                                value as GrainDirection,
                              )
                            }
                          >
                            <SelectTrigger className="w-full bg-white">
                              <SelectValue>
                                {
                                  grainDirectionLabels[
                                    customPartDraft.grainDirection
                                  ]
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">حر</SelectItem>
                              <SelectItem value="length">
                                طولي مع طول اللوح
                              </SelectItem>
                              <SelectItem value="width">
                                عرضي مع عرض اللوح
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2 xl:col-span-4">
                          <Label>شريط الحافة</Label>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            {(
                              [
                                "length-start",
                                "length-end",
                                "width-start",
                                "width-end",
                              ] as EdgeBandSide[]
                            ).map((side) => {
                              const isActive =
                                customPartDraft.edgeBanding[side] ?? false;

                              return (
                                <Button
                                  key={side}
                                  type="button"
                                  variant={isActive ? "default" : "outline"}
                                  className="justify-between"
                                  onClick={() =>
                                    toggleCustomPartDraftEdgeBand(side)
                                  }
                                >
                                  <span>{edgeBandSideLabels[side]}</span>
                                  <span className="text-xs opacity-80">
                                    {isActive ? "مفعّل" : "بدون"}
                                  </span>
                                </Button>
                              );
                            })}
                          </div>
                          <p className="text-xs text-stone-500">
                            اختر أي ضلع من الطول أو العرض ليُحسب ضمن شريط الحافة
                            للمقاس الحر.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-stone-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-6 text-stone-500">
                          القطعة الحرة تدخل في توزيع الألواح، التكاليف، جدول
                          القطع، والطباعة حتى لو لم تكن مرتبطة بأي وحدة.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => resetCustomPartEditor()}
                          >
                            إعادة ضبط
                          </Button>
                          <Button type="button" onClick={saveCustomPart}>
                            <Plus className="size-4" />
                            {editingCustomPartId
                              ? "حفظ المقاس الحر"
                              : "إضافة مقاس حر"}
                          </Button>
                        </div>
                      </div>

                      {customParts.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 p-6 text-center text-sm text-stone-500">
                          لم تتم إضافة أي مقاسات حرة بعد.
                        </div>
                      ) : (
                        customParts.map((part) => (
                          <div
                            key={part.id}
                            className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 ring-1 ring-stone-200"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="space-y-1">
                                <p className="font-medium text-stone-950">
                                  {part.title}
                                </p>
                                <p className="text-xs text-stone-500">
                                  {partCategoryLabels[part.category]} •{" "}
                                  {formatCm(part.length)} ×{" "}
                                  {formatCm(part.width)} • {part.qty} قطعة •{" "}
                                  {formatMmFromCm(part.thickness)}
                                </p>
                                <p className="text-xs text-stone-500">
                                  {materialLabels[projectSettings.material]} •{" "}
                                  {grainDirectionLabels[part.grainDirection]}
                                </p>
                                <p className="text-xs text-stone-500">
                                  {formatPartEdgeBanding(
                                    buildCustomProjectCutlistPart(
                                      part,
                                      projectSettings.material,
                                    ),
                                  )}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => loadCustomPartIntoEditor(part)}
                                >
                                  تحميل للتعديل
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => removeCustomPart(part.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </>
                ) : (
                  <>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>قائمة العناصر المضافة</CardTitle>
                          <CardDescription>
                            راجع الوحدات والمقاسات الحرة الحالية ثم شغّل الحساب
                            من هنا.
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-stone-200 bg-stone-50 text-stone-700"
                        >
                          {projectItemCount} عنصر
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {unitFeedback ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 ring-1 ring-emerald-100">
                          <div className="flex items-center gap-2 font-medium">
                            <Sparkles className="size-4" />
                            تم تحديث قائمة الوحدات
                          </div>
                          <p className="mt-2 text-sm leading-6 text-emerald-800">
                            {unitFeedback.message}
                          </p>
                        </div>
                      ) : null}

                      <div className="space-y-3">
                        {units.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 p-6 text-center text-sm text-stone-500">
                            أضف أول وحدة من النموذج الحالي لتبدأ تكوين المشروع.
                          </div>
                        ) : (
                          units.map((unit) => {
                            const unitResult = calculateCabinetCutlist(unit);
                            const isActive =
                              selectedCalculatedUnitId === unit.id;
                            const isRecentlySaved =
                              unitFeedback?.unitId === unit.id;

                            return (
                              <div
                                key={unit.id}
                                className={cn(
                                  "rounded-2xl border bg-stone-50/80 p-4 ring-1 transition-colors",
                                  isActive
                                    ? "border-amber-300 bg-amber-50/70 ring-amber-200"
                                    : isRecentlySaved
                                      ? "border-emerald-300 bg-emerald-50/80 ring-emerald-200"
                                      : "border-stone-200 ring-stone-200",
                                )}
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="space-y-1">
                                    <p className="font-medium text-stone-950">
                                      {unit.title}
                                    </p>
                                    <p className="text-xs text-stone-500">
                                      {cabinetTypeLabels[unit.cabinetType]} •{" "}
                                      {formatCm(unit.width)} ×{" "}
                                      {formatCm(unit.height)} ×{" "}
                                      {formatCm(unit.depth)}
                                    </p>
                                    {unit.cabinetType === "corner-l-base" ||
                                    unit.cabinetType === "corner-l-wall" ? (
                                      <p className="text-xs text-stone-500">
                                        {
                                          cornerPlacementLabels[
                                            unit.cabinetType === "corner-l-wall"
                                              ? "wall"
                                              : "base"
                                          ]
                                        }{" "}
                                        • {cornerHandLabels[unit.cornerHand]} •
                                        ضلع ثانٍ {formatCm(unit.returnDepth)}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => duplicateUnit(unit)}
                                    >
                                      نسخ الوحدة
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => loadUnitIntoEditor(unit)}
                                    >
                                      تحميل للتعديل
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => removeUnit(unit.id)}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                </div>
                                <p className="mt-2 text-xs text-stone-500">
                                  {frontOptionLabels[unit.frontOption]} •{" "}
                                  {getFrontPieceCount(unitResult)} واجهة •{" "}
                                  {unit.shelfCount} رف
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-stone-500">
                            الحساب يعتمد على الوحدات والمقاسات الحرة الموجودة
                            داخل المشروع.
                          </p>
                          <Button
                            type="button"
                            className="w-full sm:w-auto"
                            onClick={calculateUnits}
                            disabled={projectItemCount === 0}
                          >
                            <Calculator className="size-4" />
                            احسب المشروع
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </>
                )}
              </Card>

              <div className="grid gap-6">
                {activeBuilderTab === "unit" ? (
                  <>
                    <Card
                      id="project-units-list"
                      className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8"
                    >
                      <CardHeader>
                        <CardTitle>3D للوحدة الحالية</CardTitle>
                        <CardDescription>
                          المعاينة هنا خاصة بالوحدة الجاري إعدادها قبل إضافتها
                          أو تعديلها داخل المشروع.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="relative overflow-hidden rounded-[1.5rem] border border-stone-200 bg-[linear-gradient(180deg,#faf7f2_0%,#efe7db_100%)] p-6">
                          <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(97,74,42,0.12),transparent_60%)]" />
                          <div className="relative space-y-4">
                            {hasEditorCompleteDimensions ? (
                              <Suspense fallback={previewFallback}>
                                <CabinetPreview
                                  input={editorInput}
                                  result={editorResult}
                                  selectedPartId={selectedPartId}
                                />
                              </Suspense>
                            ) : (
                              <div className="flex h-72 w-full items-center justify-center rounded-[1.25rem] border border-dashed border-stone-300 bg-white/65 px-6 text-center text-sm leading-7 text-stone-500">
                                أدخل المقاسات الأساسية للوحدة لتظهر المعاينة
                                ثلاثية الأبعاد والقطع المتوقعة بشكل صحيح.
                              </div>
                            )}
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="rounded-xl bg-white/80 p-3 text-center ring-1 ring-stone-200">
                                <p className="text-xs text-stone-500">
                                  اسم الوحدة
                                </p>
                                <p className="mt-1 text-sm font-medium text-stone-950">
                                  {editorTitle}
                                </p>
                              </div>
                              <div className="rounded-xl bg-white/80 p-3 text-center ring-1 ring-stone-200">
                                <p className="text-xs text-stone-500">
                                  نوع الواجهة
                                </p>
                                <p className="mt-1 text-sm font-medium text-stone-950">
                                  {frontOptionLabels[editorInput.frontOption]}
                                </p>
                              </div>
                              <div className="rounded-xl bg-white/80 p-3 text-center ring-1 ring-stone-200">
                                <p className="text-xs text-stone-500">
                                  عدد الواجهات
                                </p>
                                <p className="mt-1 text-sm font-medium text-stone-950">
                                  {hasEditorCompleteDimensions
                                    ? editorFrontPieceCount
                                    : "--"}
                                </p>
                              </div>
                              <div className="rounded-xl bg-white/80 p-3 text-center ring-1 ring-stone-200">
                                <p className="text-xs text-stone-500">
                                  اتجاه الثمرة
                                </p>
                                <p className="mt-1 text-sm font-medium text-stone-950">
                                  {
                                    grainDirectionLabels[
                                      editorInput.grainDirection
                                    ]
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {units.length > 1 ? (
                      <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                        <CardHeader>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <CardTitle>3D لترتيب المشروع</CardTitle>
                              <CardDescription>
                                راقب شكل المشروع النهائي، اسحب الوحدة بزرار
                                الماوس الشمال لتحريكها في المكان الذي تريده،
                                واسحب بزرار الماوس اليمين لتغيير زاوية العرض قبل
                                عرضها على العميل.
                              </CardDescription>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={resetProjectArrangement}
                            >
                              إعادة ضبط الترتيب
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Suspense fallback={previewFallback}>
                            <ProjectPreview
                              units={projectPreviewUnits.map((unit) => ({
                                ...unit,
                                active:
                                  unit.id === activeProjectPreviewUnit?.id,
                              }))}
                              onSelectUnit={setActiveProjectUnitId}
                              onUnitPositionChange={updateProjectUnitPosition}
                            />
                          </Suspense>

                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {projectPreviewUnits.map((unit, index) => {
                              const isActive =
                                activeProjectPreviewUnit?.id === unit.id;

                              return (
                                <div
                                  key={unit.id}
                                  className={cn(
                                    "rounded-2xl border p-4 ring-1",
                                    isActive
                                      ? "border-amber-300 bg-amber-50/70 ring-amber-200"
                                      : "border-stone-200 bg-stone-50/80 ring-stone-200",
                                  )}
                                >
                                  <button
                                    type="button"
                                    className="w-full text-right"
                                    onClick={() =>
                                      setActiveProjectUnitId(unit.id)
                                    }
                                  >
                                    <p className="font-medium text-stone-950">
                                      {unit.title}
                                    </p>
                                    <p className="mt-1 text-xs text-stone-500">
                                      ترتيب {index + 1} • جانبي{" "}
                                      {formatCm(unit.offsetX)} • ارتفاع{" "}
                                      {formatCm(unit.offsetY)} • عمق{" "}
                                      {formatCm(unit.offsetZ)} • دوران{" "}
                                      {unit.rotationY}°
                                    </p>
                                  </button>

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        moveProjectUnitOrder(
                                          unit.id,
                                          "backward",
                                        )
                                      }
                                      disabled={index === 0}
                                    >
                                      <ArrowRight className="size-4" />
                                      تقديم
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        moveProjectUnitOrder(unit.id, "forward")
                                      }
                                      disabled={
                                        index === projectPreviewUnits.length - 1
                                      }
                                    >
                                      <ArrowLeft className="size-4" />
                                      تأخير
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        rotateProjectUnit(unit.id, -90)
                                      }
                                    >
                                      <RotateCcw className="size-4" />
                                      لف يسار
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        rotateProjectUnit(unit.id, 90)
                                      }
                                    >
                                      <RotateCw className="size-4" />
                                      لف يمين
                                    </Button>
                                  </div>

                                  <div className="mt-3 grid grid-cols-2 gap-2">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() =>
                                        nudgeProjectUnit(unit.id, "x", -10)
                                      }
                                    >
                                      <ArrowRight className="size-4" />
                                      يمين
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() =>
                                        nudgeProjectUnit(unit.id, "x", 10)
                                      }
                                    >
                                      <ArrowLeft className="size-4" />
                                      يسار
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() =>
                                        nudgeProjectUnit(unit.id, "z", -10)
                                      }
                                    >
                                      <ArrowUp className="size-4" />
                                      للأمام
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() =>
                                        nudgeProjectUnit(unit.id, "z", 10)
                                      }
                                    >
                                      <ArrowDown className="size-4" />
                                      للخلف
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() =>
                                        nudgeProjectUnit(unit.id, "y", 10)
                                      }
                                    >
                                      <ArrowUp className="size-4" />
                                      لفوق
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() =>
                                        nudgeProjectUnit(unit.id, "y", -10)
                                      }
                                    >
                                      <ArrowDown className="size-4" />
                                      لتحت
                                    </Button>
                                  </div>

                                  <p className="mt-3 text-[11px] leading-5 text-stone-500">
                                    الوحدات الأرضية تبدأ تحت تلقائيًا، والوحدات
                                    المعلقة تبدأ فوق تلقائيًا ويمكنك ضبط مكان كل
                                    وحدة كما تريد.
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}
                  </>
                ) : activeBuilderTab === "units" ? (
                  units.length > 1 ? (
                    <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                      <CardHeader>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <CardTitle>3D لترتيب المشروع</CardTitle>
                            <CardDescription>
                              راقب شكل المشروع النهائي واضبط تموضع الوحدات من
                              هذا التبويب.
                            </CardDescription>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={resetProjectArrangement}
                          >
                            إعادة ضبط الترتيب
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Suspense fallback={previewFallback}>
                          <ProjectPreview
                            units={projectPreviewUnits.map((unit) => ({
                              ...unit,
                              active: unit.id === activeProjectPreviewUnit?.id,
                            }))}
                            onSelectUnit={setActiveProjectUnitId}
                            onUnitPositionChange={updateProjectUnitPosition}
                          />
                        </Suspense>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                      <CardHeader>
                        <CardTitle>ترتيب المشروع</CardTitle>
                        <CardDescription>
                          المعاينة الجماعية تظهر عندما يكون لديك أكثر من وحدة
                          داخل المشروع.
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  )
                ) : (
                  <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                    <CardHeader>
                      <CardTitle>المقاسات الحرة الحالية</CardTitle>
                      <CardDescription>
                        راجع المقاسات الحرة الموجودة أو انتقل إلى تبويب المقاس
                        الحر لتعديلها.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {customParts.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 p-6 text-center text-sm text-stone-500">
                          لا توجد مقاسات حرة بعد.
                        </div>
                      ) : (
                        customParts.map((part) => (
                          <div
                            key={part.id}
                            className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 ring-1 ring-stone-200"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-stone-950">
                                  {part.title}
                                </p>
                                <p className="mt-1 text-xs text-stone-500">
                                  {formatCm(part.length)} ×{" "}
                                  {formatCm(part.width)} • {part.qty} قطعة
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => loadCustomPartIntoEditor(part)}
                              >
                                تعديل
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>
          </>
        ) : null}

        {activeWorkspaceTab === "preview" ? (
          <section className="mt-6 space-y-6 pb-8">
            {projectPreviewUnits.length === 0 ? (
              <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                <CardHeader>
                  <CardTitle>معاينة 3D للمشروع</CardTitle>
                  <CardDescription>
                    أضف وحدة واحدة على الأقل ليظهر مشهد 3D وتتمكن من ترتيب
                    الوحدات وطباعة لقطة من الشكل النهائي.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle>3D لترتيب كل الوحدات</CardTitle>
                      <CardDescription>
                        اسحب كل وحدة داخل المشهد أو عدّل مكانها من لوحة التحكم
                        أسفل المعاينة، ثم اطبع صورة للمشهد الحالي مباشرة.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetProjectArrangement}
                      >
                        إعادة ضبط الترتيب
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={printProjectPreviewSnapshot}
                      >
                        <Printer className="size-4" />
                        طباعة صورة الترتيب
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Suspense fallback={previewFallback}>
                    <ProjectPreview
                      units={projectPreviewUnits.map((unit) => ({
                        ...unit,
                        active: unit.id === activeProjectPreviewUnit?.id,
                      }))}
                      onSelectUnit={setActiveProjectUnitId}
                      onUnitPositionChange={updateProjectUnitPosition}
                      onCanvasReady={bindProjectPreviewCanvas}
                    />
                  </Suspense>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {projectPreviewUnits.map((unit, index) => {
                      const isActive = activeProjectPreviewUnit?.id === unit.id;

                      return (
                        <div
                          key={unit.id}
                          className={cn(
                            "rounded-2xl border p-4 ring-1",
                            isActive
                              ? "border-amber-300 bg-amber-50/70 ring-amber-200"
                              : "border-stone-200 bg-stone-50/80 ring-stone-200",
                          )}
                        >
                          <button
                            type="button"
                            className="w-full text-right"
                            onClick={() => setActiveProjectUnitId(unit.id)}
                          >
                            <p className="font-medium text-stone-950">
                              {unit.title}
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                              ترتيب {index + 1} • جانبي {formatCm(unit.offsetX)}{" "}
                              • ارتفاع {formatCm(unit.offsetY)} • عمق{" "}
                              {formatCm(unit.offsetZ)} • دوران {unit.rotationY}°
                            </p>
                          </button>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                moveProjectUnitOrder(unit.id, "backward")
                              }
                              disabled={index === 0}
                            >
                              <ArrowRight className="size-4" />
                              تقديم
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                moveProjectUnitOrder(unit.id, "forward")
                              }
                              disabled={
                                index === projectPreviewUnits.length - 1
                              }
                            >
                              <ArrowLeft className="size-4" />
                              تأخير
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => rotateProjectUnit(unit.id, -90)}
                            >
                              <RotateCcw className="size-4" />
                              لف يسار
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => rotateProjectUnit(unit.id, 90)}
                            >
                              <RotateCw className="size-4" />
                              لف يمين
                            </Button>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                nudgeProjectUnit(unit.id, "x", -10)
                              }
                            >
                              <ArrowRight className="size-4" />
                              يمين
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => nudgeProjectUnit(unit.id, "x", 10)}
                            >
                              <ArrowLeft className="size-4" />
                              يسار
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                nudgeProjectUnit(unit.id, "z", -10)
                              }
                            >
                              <ArrowUp className="size-4" />
                              للأمام
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => nudgeProjectUnit(unit.id, "z", 10)}
                            >
                              <ArrowDown className="size-4" />
                              للخلف
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => nudgeProjectUnit(unit.id, "y", 10)}
                            >
                              <ArrowUp className="size-4" />
                              لفوق
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                nudgeProjectUnit(unit.id, "y", -10)
                              }
                            >
                              <ArrowDown className="size-4" />
                              لتحت
                            </Button>
                          </div>

                          <p className="mt-3 text-[11px] leading-5 text-stone-500">
                            اضغط على الوحدة لتفعيلها، ثم حرّكها بالسحب داخل
                            المشهد أو من أزرار الضبط الدقيقة هنا.
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        ) : null}

        {activeWorkspaceTab === "results" ? (
          hasCalculatedProject ? (
            <>
              <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-8">
                <Card className="border-0 bg-white/88 ring-1 ring-stone-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-stone-500">الوحدات المحسوبة</p>
                    <p className="mt-2 text-lg font-semibold text-stone-950">
                      {projectSummary.unitCount}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-stone-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-stone-500">المقاسات الحرة</p>
                    <p className="mt-2 text-lg font-semibold text-stone-950">
                      {calculatedCustomParts.length}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-stone-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-stone-500">إجمالي القطع</p>
                    <p className="mt-2 text-lg font-semibold text-stone-950">
                      {projectSummary.totalPanels}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-stone-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-stone-500">إجمالي الألواح</p>
                    <p className="mt-2 text-lg font-semibold text-stone-950">
                      {projectSummary.totalSheets}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-stone-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-stone-500">إجمالي الاستهلاك</p>
                    <p className="mt-2 text-lg font-semibold text-stone-950">
                      {projectSummary.totalAreaM2} م²
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-stone-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-stone-500">تكلفة الألواح</p>
                    <p className="mt-2 text-lg font-semibold text-stone-950">
                      {formatPrice(projectSummary.totalSheetCost)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-stone-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-stone-500">المصنعية</p>
                    <p className="mt-2 text-lg font-semibold text-stone-950">
                      {formatPrice(projectSummary.totalLaborCost)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-stone-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-stone-500">تكلفة شريط الحافة</p>
                    <p className="mt-2 text-lg font-semibold text-stone-950">
                      {formatPrice(projectSummary.totalEdgeBandCost)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-stone-950 text-stone-50 ring-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-stone-300">إجمالي التكلفة</p>
                    <p className="mt-2 text-lg font-semibold">
                      {formatPrice(projectSummary.totalProjectCost)}
                    </p>
                  </CardContent>
                </Card>
              </section>

              <section className="mt-6">
                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                  <CardHeader>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-3 text-right sm:flex-row sm:items-center sm:justify-between"
                      onClick={() => toggleResultsSection("costs")}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-1">
                        <div>
                          <CardTitle>كشف خامات وتكلفة لكل وحدة</CardTitle>
                          <CardDescription>
                            استهلاك الخامات والتكلفة التفصيلية لكل وحدة قبل
                            تجميع المشروع بالكامل.
                          </CardDescription>
                        </div>
                        <Badge
                          variant="secondary"
                          className="w-fit bg-stone-100 text-stone-700"
                        >
                          {unitCostSummaries.length} وحدة
                        </Badge>
                      </div>
                      {openResultsSections.costs ? (
                        <ArrowUp className="size-4 text-stone-500" />
                      ) : (
                        <ArrowDown className="size-4 text-stone-500" />
                      )}
                    </button>
                  </CardHeader>
                  <CardContent
                    className={cn(!openResultsSections.costs && "hidden")}
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {unitCostSummaries.map((summary) => (
                        <div
                          key={summary.unitId}
                          className="rounded-[1.5rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(252,250,247,0.95),rgba(243,236,227,0.82))] p-4 shadow-[0_18px_44px_-36px_rgba(63,40,12,0.4)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-stone-950">
                                {summary.unitTitle}
                              </p>
                              <p className="mt-1 text-xs text-stone-500">
                                {summary.panelCount} قطعة •{" "}
                                {summary.totalAreaM2} م²
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-800"
                            >
                              {formatPrice(summary.totalCost)}
                            </Badge>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-white/75 p-3 ring-1 ring-stone-200">
                              <p className="text-[11px] text-stone-500">
                                ألواح 18 مم
                              </p>
                              <p className="mt-1 font-semibold text-stone-950">
                                {summary.boardSheetCount} لوح
                              </p>
                              <p className="mt-1 text-[11px] text-stone-500">
                                استخدام {summary.boardUsedAreaM2} م²
                              </p>
                            </div>
                            <div className="rounded-xl bg-white/75 p-3 ring-1 ring-stone-200">
                              <p className="text-[11px] text-stone-500">
                                ألواح 6 مم
                              </p>
                              <p className="mt-1 font-semibold text-stone-950">
                                {summary.backSheetCount} لوح
                              </p>
                              <p className="mt-1 text-[11px] text-stone-500">
                                استخدام {summary.backUsedAreaM2} م²
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2 rounded-xl bg-stone-950/[0.03] p-3 ring-1 ring-stone-200 text-xs text-stone-600">
                            <div className="flex items-center justify-between gap-3">
                              <span>تكلفة الألواح</span>
                              <span className="font-medium text-stone-900">
                                {formatPrice(summary.sheetCost)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>المصنعية</span>
                              <span className="font-medium text-stone-900">
                                {formatPrice(summary.laborCost)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>شريط الحافة</span>
                              <span className="font-medium text-stone-900">
                                {summary.edgeBandLengthM} م ط •{" "}
                                {formatPrice(summary.edgeBandCost)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="mt-6">
                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                  <CardHeader>
                    <CardTitle>نتيجة المشروع المجمعة</CardTitle>
                    <CardDescription>
                      النتائج التالية تجمع كل الوحدات التي كانت موجودة عند آخر
                      ضغط على زر احسب المشروع، بينما تبقى قائمة الوحدات أعلى
                      الصفحة مخصصة للتعديل فقط.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </section>

              <section className="mt-6 space-y-6">
                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                  <CardHeader>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 text-right"
                      onClick={() => toggleResultsSection("layout")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>توزيع ألواح المشروع</CardTitle>
                          <CardDescription>
                            هذا التوزيع مبني على إجمالي القطع المجمعة من كل
                            الوحدات المضافة وقت الحساب.
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-stone-200 bg-stone-50 text-stone-700"
                        >
                          {projectLayoutSheetCount} لوح /{" "}
                          {projectSheetLayout?.stocks.length ?? 0} خامة
                        </Badge>
                      </div>
                      {openResultsSections.layout ? (
                        <ArrowUp className="size-4 text-stone-500" />
                      ) : (
                        <ArrowDown className="size-4 text-stone-500" />
                      )}
                    </button>
                  </CardHeader>
                  <CardContent
                    className={cn(
                      "space-y-4",
                      !openResultsSections.layout && "hidden",
                    )}
                  >
                    {projectSheetLayout?.stocks.map((stock) => (
                      <div
                        key={stock.key}
                        className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3"
                      >
                        <div className="mb-4 flex flex-col gap-2 rounded-xl bg-white/90 p-3 ring-1 ring-stone-200 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-stone-950">
                              {getStockLabel(
                                stock.thickness,
                                stock.isBackStock,
                              )}
                            </p>
                            <p className="text-xs text-stone-500">
                              {stock.materialSummary} • {stock.partCount} قطعة •{" "}
                              {stock.sheets.length} لوح •{" "}
                              {formatSheetSize(
                                stock.boardLength,
                                stock.boardWidth,
                              )}
                            </p>
                          </div>
                          <p className="text-xs text-stone-500">
                            استهلاك هذه المجموعة {stock.totalAreaM2} م²
                          </p>
                          <p className="text-xs text-stone-500">
                            الهالك داخل هذه المجموعة{" "}
                            {getStockWasteAreaM2(stock)} م²
                          </p>
                        </div>

                        <div className="space-y-4">
                          {stock.sheets.map((sheet) => (
                            <div
                              key={`${stock.key}-${sheet.index}`}
                              className="rounded-2xl border border-stone-200 bg-white/80 p-3"
                            >
                              <div className="mb-3 flex items-center justify-between text-xs text-stone-500">
                                <span>لوح #{sheet.index + 1}</span>
                                <span>
                                  مستخدم طوليًا {formatCm(sheet.usedLength)} من{" "}
                                  {formatCm(stock.boardLength)}
                                </span>
                              </div>
                              <div className="rounded-xl border border-stone-200 bg-[linear-gradient(180deg,#f8f4ee_0%,#f2ece3_100%)] p-3">
                                <svg
                                  viewBox={`-18 -18 ${stock.boardWidth + 36} ${stock.boardLength + 36}`}
                                  className="w-full rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(214,206,194,0.9)]"
                                  preserveAspectRatio="xMidYMid meet"
                                  role="img"
                                  aria-label={`${stock.key} sheet ${sheet.index + 1} layout`}
                                >
                                  <line
                                    x1="0"
                                    y1="-10"
                                    x2={stock.boardWidth}
                                    y2="-10"
                                    stroke="#9b8a75"
                                    strokeWidth="0.9"
                                  />
                                  <line
                                    x1="0"
                                    y1="-13.5"
                                    x2="0"
                                    y2="-6.5"
                                    stroke="#9b8a75"
                                    strokeWidth="0.9"
                                  />
                                  <line
                                    x1={stock.boardWidth}
                                    y1="-13.5"
                                    x2={stock.boardWidth}
                                    y2="-6.5"
                                    stroke="#9b8a75"
                                    strokeWidth="0.9"
                                  />
                                  <text
                                    x={stock.boardWidth / 2}
                                    y="-12.5"
                                    textAnchor="middle"
                                    dominantBaseline="ideographic"
                                    fontSize="5.2"
                                    fontWeight="700"
                                    fill="#6b5a45"
                                  >
                                    عرض اللوح {formatCm(stock.boardWidth)}
                                  </text>
                                  <line
                                    x1={stock.boardWidth + 10}
                                    y1="0"
                                    x2={stock.boardWidth + 10}
                                    y2={stock.boardLength}
                                    stroke="#9b8a75"
                                    strokeWidth="0.9"
                                  />
                                  <line
                                    x1={stock.boardWidth + 6.5}
                                    y1="0"
                                    x2={stock.boardWidth + 13.5}
                                    y2="0"
                                    stroke="#9b8a75"
                                    strokeWidth="0.9"
                                  />
                                  <line
                                    x1={stock.boardWidth + 6.5}
                                    y1={stock.boardLength}
                                    x2={stock.boardWidth + 13.5}
                                    y2={stock.boardLength}
                                    stroke="#9b8a75"
                                    strokeWidth="0.9"
                                  />
                                  <text
                                    x={stock.boardWidth + 14}
                                    y={stock.boardLength / 2}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize="5.2"
                                    fontWeight="700"
                                    fill="#6b5a45"
                                    transform={`rotate(90 ${stock.boardWidth + 14} ${stock.boardLength / 2})`}
                                  >
                                    طول اللوح {formatCm(stock.boardLength)}
                                  </text>
                                  <rect
                                    x="0"
                                    y="0"
                                    width={stock.boardWidth}
                                    height={stock.boardLength}
                                    fill="#fcfaf7"
                                    stroke="#d6cec2"
                                    strokeWidth="1"
                                    rx="4"
                                  />
                                  {sheet.pieces.map((piece) => {
                                    const pieceLabel =
                                      getSheetPieceLabelMode(piece);
                                    const displayPiece =
                                      pieceLabel.displayPiece;
                                    const aggregatedPart =
                                      aggregatedProjectPartMap.get(
                                        piece.sourcePartId,
                                      );
                                    const projectPartLink =
                                      projectPartLinkMap.get(
                                        piece.sourcePartId,
                                      );
                                    const edgeThickness = Math.max(
                                      1.4,
                                      Math.min(
                                        Math.min(
                                          displayPiece.width,
                                          displayPiece.height,
                                        ) * 0.08,
                                        3.2,
                                      ),
                                    );
                                    const edgeRects = [
                                      {
                                        edge: "top" as const,
                                        x: displayPiece.x,
                                        y: displayPiece.y,
                                        width: displayPiece.width,
                                        height: edgeThickness,
                                      },
                                      {
                                        edge: "right" as const,
                                        x:
                                          displayPiece.x +
                                          displayPiece.width -
                                          edgeThickness,
                                        y: displayPiece.y,
                                        width: edgeThickness,
                                        height: displayPiece.height,
                                      },
                                      {
                                        edge: "bottom" as const,
                                        x: displayPiece.x,
                                        y:
                                          displayPiece.y +
                                          displayPiece.height -
                                          edgeThickness,
                                        width: displayPiece.width,
                                        height: edgeThickness,
                                      },
                                      {
                                        edge: "left" as const,
                                        x: displayPiece.x,
                                        y: displayPiece.y,
                                        width: edgeThickness,
                                        height: displayPiece.height,
                                      },
                                    ];

                                    return (
                                      <g key={piece.id}>
                                        <rect
                                          x={displayPiece.x}
                                          y={displayPiece.y}
                                          width={displayPiece.width}
                                          height={displayPiece.height}
                                          className="cursor-pointer"
                                          onClick={() =>
                                            handlePartSelection(
                                              piece.sourcePartId,
                                            )
                                          }
                                          fill={
                                            piece.category === "front"
                                              ? "#c88f5a"
                                              : piece.category === "back"
                                                ? "#90a4ae"
                                                : piece.category === "shelf"
                                                  ? "#6f8f72"
                                                  : piece.category === "support"
                                                    ? "#d8c178"
                                                    : "#9a7b5f"
                                          }
                                          fillOpacity={
                                            selectedPartId ===
                                            piece.sourcePartId
                                              ? "1"
                                              : "0.82"
                                          }
                                          stroke={
                                            selectedPartId ===
                                            piece.sourcePartId
                                              ? "#1f2937"
                                              : "#fff"
                                          }
                                          strokeWidth={
                                            selectedPartId ===
                                            piece.sourcePartId
                                              ? "2"
                                              : "0.8"
                                          }
                                          rx="1.5"
                                        />
                                        {aggregatedPart
                                          ? edgeRects.map((edgeRect) => {
                                              const logicalSide =
                                                getVisualEdgeSide(
                                                  piece,
                                                  edgeRect.edge,
                                                );
                                              const isActive =
                                                aggregatedPart.part.edgeBanding[
                                                  logicalSide
                                                ] ?? false;

                                              return (
                                                <rect
                                                  key={`${piece.id}-${edgeRect.edge}`}
                                                  x={edgeRect.x}
                                                  y={edgeRect.y}
                                                  width={edgeRect.width}
                                                  height={edgeRect.height}
                                                  rx="1"
                                                  className="cursor-pointer"
                                                  fill={
                                                    isActive
                                                      ? "#f3b04d"
                                                      : "rgba(255,255,255,0.001)"
                                                  }
                                                  fillOpacity={
                                                    isActive ? "0.95" : "1"
                                                  }
                                                  stroke={
                                                    isActive
                                                      ? "#fff7e7"
                                                      : "rgba(255,255,255,0.45)"
                                                  }
                                                  strokeWidth={
                                                    isActive ? "0.7" : "0.35"
                                                  }
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    toggleProjectPartEdgeBand(
                                                      piece.sourcePartId,
                                                      logicalSide,
                                                    );
                                                  }}
                                                />
                                              );
                                            })
                                          : null}
                                        {pieceLabel.mode === "full" ? (
                                          <g>
                                            <text
                                              x={
                                                displayPiece.x +
                                                displayPiece.width / 2
                                              }
                                              y={
                                                displayPiece.y +
                                                displayPiece.height / 2 -
                                                pieceLabel.nameOffset
                                              }
                                              textAnchor="middle"
                                              dominantBaseline="middle"
                                              fontSize={pieceLabel.nameFontSize}
                                              fontWeight="700"
                                              fill="#fff"
                                              direction="rtl"
                                              unicodeBidi="plaintext"
                                              transform={
                                                pieceLabel.rotate
                                                  ? `rotate(-90 ${
                                                      displayPiece.x +
                                                      displayPiece.width / 2
                                                    } ${
                                                      displayPiece.y +
                                                      displayPiece.height / 2
                                                    })`
                                                  : undefined
                                              }
                                            >
                                              {projectPartLink
                                                ? `${projectPartLink.code} • ${piece.name}`
                                                : piece.name}
                                            </text>
                                            <text
                                              x={
                                                displayPiece.x +
                                                displayPiece.width / 2
                                              }
                                              y={
                                                displayPiece.y +
                                                displayPiece.height / 2 +
                                                pieceLabel.dimsOffset
                                              }
                                              textAnchor="middle"
                                              dominantBaseline="middle"
                                              fontSize={pieceLabel.dimsFontSize}
                                              fontWeight="700"
                                              fill="#fff"
                                              transform={
                                                pieceLabel.rotate
                                                  ? `rotate(-90 ${
                                                      displayPiece.x +
                                                      displayPiece.width / 2
                                                    } ${
                                                      displayPiece.y +
                                                      displayPiece.height / 2
                                                    })`
                                                  : undefined
                                              }
                                            >
                                              {round2(piece.length)} ×{" "}
                                              {round2(piece.width)} سم
                                            </text>
                                          </g>
                                        ) : pieceLabel.mode === "dims" ? (
                                          <text
                                            x={
                                              displayPiece.x +
                                              displayPiece.width / 2
                                            }
                                            y={
                                              displayPiece.y +
                                              displayPiece.height / 2
                                            }
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fontSize={pieceLabel.fontSize}
                                            fontWeight="600"
                                            fill="#fff"
                                            transform={
                                              pieceLabel.rotate
                                                ? `rotate(-90 ${displayPiece.x + displayPiece.width / 2} ${displayPiece.y + displayPiece.height / 2})`
                                                : undefined
                                            }
                                          >
                                            {round2(piece.length)} ×{" "}
                                            {round2(piece.width)}
                                          </text>
                                        ) : null}
                                      </g>
                                    );
                                  })}
                                </svg>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {projectWasteInsight ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-7 text-amber-950 ring-1 ring-amber-100">
                        <p className="font-medium">قراءة سريعة للهالك</p>
                        <p className="mt-2 text-amber-900">
                          {projectWasteInsight}
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter className="justify-between border-t border-stone-200/80 bg-stone-50/80 text-xs text-stone-500">
                    <span>
                      توزيع المشروع يظل مفصولًا حسب سماكة اللوح لكل خامة.
                    </span>
                    <span>{projectLayoutWastePercent}% هالك تقريبي</span>
                  </CardFooter>
                </Card>

                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                  <CardHeader>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 text-right"
                      onClick={() => toggleResultsSection("metrics")}
                    >
                      <div>
                        <CardTitle>مؤشرات المشروع</CardTitle>
                        <CardDescription>
                          هذه المؤشرات تخص المشروع المجمع بالكامل.
                        </CardDescription>
                      </div>
                      {openResultsSections.metrics ? (
                        <ArrowUp className="size-4 text-stone-500" />
                      ) : (
                        <ArrowDown className="size-4 text-stone-500" />
                      )}
                    </button>
                  </CardHeader>
                  <CardContent
                    className={cn(
                      "grid gap-3 sm:grid-cols-2",
                      !openResultsSections.metrics && "hidden",
                    )}
                  >
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <p className="text-xs text-stone-500">عدد الوحدات</p>
                      <p className="mt-2 text-lg font-semibold text-stone-950">
                        {projectSummary.unitCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <p className="text-xs text-stone-500">
                        الخامات المستخدمة
                      </p>
                      <p className="mt-2 text-lg font-semibold text-stone-950">
                        {projectMaterialSummary || "--"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <p className="text-xs text-stone-500">إجمالي الواجهات</p>
                      <p className="mt-2 text-lg font-semibold text-stone-950">
                        {projectFrontPieceCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <p className="text-xs text-stone-500">الهالك التقريبي</p>
                      <p className="mt-2 text-lg font-semibold text-stone-950">
                        {projectLayoutWastePercent}%
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <p className="text-xs text-stone-500">تسعير الألواح</p>
                      <p className="mt-2 text-lg font-semibold text-stone-950">
                        18 مم: {formatPrice(projectSettings.boardSheetPrice)} •
                        6 مم: {formatPrice(projectSettings.backSheetPrice)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <p className="text-xs text-stone-500">مصنعية المتر</p>
                      <p className="mt-2 text-lg font-semibold text-stone-950">
                        {formatPrice(projectSettings.laborPricePerSquareMeter)}{" "}
                        / م²
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <p className="text-xs text-stone-500">شريط الحافة</p>
                      <p className="mt-2 text-lg font-semibold text-stone-950">
                        {projectSummary.totalEdgeBandLengthM} م ط ×{" "}
                        {formatPrice(projectSettings.edgeBandPricePerMeter)} ={" "}
                        {formatPrice(projectSummary.totalEdgeBandCost)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="mt-6">
                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                  <CardHeader>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-3 text-right sm:flex-row sm:items-center sm:justify-between"
                      onClick={() => toggleResultsSection("workshop")}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-1">
                        <div>
                          <CardTitle>أمر تشغيل الورشة</CardTitle>
                          <CardDescription>
                            بطاقات تنفيذ نهائية مرتبة للقص والتشطيب، مع كود
                            القطعة وربطها باللوح والوحدة.
                          </CardDescription>
                        </div>
                        <Badge
                          variant="secondary"
                          className="w-fit bg-stone-100 text-stone-700"
                        >
                          {workshopExecutionCards.length} بطاقة
                        </Badge>
                      </div>
                      {openResultsSections.workshop ? (
                        <ArrowUp className="size-4 text-stone-500" />
                      ) : (
                        <ArrowDown className="size-4 text-stone-500" />
                      )}
                    </button>
                  </CardHeader>
                  <CardContent
                    className={cn(!openResultsSections.workshop && "hidden")}
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {workshopExecutionCards.map((card) => (
                        <div
                          key={card.id}
                          className="rounded-[1.5rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(252,250,247,0.95),rgba(243,236,227,0.82))] p-4 shadow-[0_18px_44px_-36px_rgba(63,40,12,0.4)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-stone-950">
                                {card.part.name}
                              </p>
                              <p className="mt-1 text-xs text-stone-500">
                                {card.unitTitle} •{" "}
                                {partCategoryLabels[card.part.category]}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge
                                variant="outline"
                                className="border-stone-200 bg-white text-stone-700"
                              >
                                تشغيل #{card.operationOrder}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-amber-200 bg-amber-50 text-amber-800"
                              >
                                {card.partCode} • × {card.part.qty}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-white/75 p-3 ring-1 ring-stone-200">
                              <p className="text-[11px] text-stone-500">
                                الطول × العرض
                              </p>
                              <p className="mt-1 font-semibold text-stone-950">
                                {formatCm(card.part.length)} ×{" "}
                                {formatCm(card.part.width)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white/75 p-3 ring-1 ring-stone-200">
                              <p className="text-[11px] text-stone-500">
                                السمك
                              </p>
                              <p className="mt-1 font-semibold text-stone-950">
                                {formatCm(card.part.thickness)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 rounded-xl bg-stone-950/[0.03] p-3 ring-1 ring-stone-200">
                            <p className="text-[11px] text-stone-500">
                              ربط اللوح
                            </p>
                            <p className="mt-1 text-sm font-medium text-stone-900">
                              {card.primarySheetReference ?? "لم يُوزع بعد"}
                            </p>
                            {card.sheetReferences.length > 1 ? (
                              <p className="mt-1 text-[11px] leading-6 text-stone-500">
                                {card.sheetReferences.join(" • ")}
                              </p>
                            ) : null}
                          </div>

                          <div className="mt-3 rounded-xl bg-stone-950/[0.03] p-3 ring-1 ring-stone-200">
                            <p className="text-[11px] text-stone-500">الحواف</p>
                            <p className="mt-1 text-sm font-medium text-stone-900">
                              {formatPartEdgeBanding(card.part)}
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                              إجمالي الطول:{" "}
                              {formatCm(getPartEdgeBandLengthCm(card.part))}
                            </p>
                          </div>

                          <div className="mt-3 rounded-xl bg-white/75 p-3 ring-1 ring-stone-200">
                            <p className="text-[11px] text-stone-500">
                              ملاحظات التنفيذ
                            </p>
                            <p className="mt-1 text-xs leading-6 text-stone-600">
                              {card.part.notes}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="mt-6 pb-8">
                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                  <CardHeader>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-3 text-right sm:flex-row sm:items-center sm:justify-between"
                      onClick={() => toggleResultsSection("parts")}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-1">
                        <div>
                          <CardTitle>قائمة قطع المشروع</CardTitle>
                          <CardDescription>
                            الجدول التالي يجمع القطع المتشابهة من كل الوحدات
                            داخل المشروع ويمكنك اختيار أي صف لتمييزه داخل توزيع
                            الألواح.
                          </CardDescription>
                        </div>
                        <Badge
                          variant="secondary"
                          className="w-fit bg-stone-100 text-stone-700"
                        >
                          {selectedPartId
                            ? "جزء محدد"
                            : `${projectPartLinks.length} كود قطعة`}
                        </Badge>
                      </div>
                      {openResultsSections.parts ? (
                        <ArrowUp className="size-4 text-stone-500" />
                      ) : (
                        <ArrowDown className="size-4 text-stone-500" />
                      )}
                    </button>
                  </CardHeader>
                  <CardContent
                    className={cn(!openResultsSections.parts && "hidden")}
                  >
                    <Table className="table-fixed">
                      <colgroup>
                        <col className="w-[12%]" />
                        <col className="w-[9%]" />
                        <col className="w-[7%]" />
                        <col className="w-[10%]" />
                        <col className="w-[10%]" />
                        <col className="w-[9%]" />
                        <col className="w-[17%]" />
                        <col className="w-[26%]" />
                      </colgroup>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="px-3 text-right text-stone-700">
                            الجزء
                          </TableHead>
                          <TableHead className="px-3 text-right text-stone-700">
                            الفئة
                          </TableHead>
                          <TableHead className="px-3 text-right text-stone-700">
                            العدد
                          </TableHead>
                          <TableHead className="px-3 text-right text-stone-700">
                            الطول
                          </TableHead>
                          <TableHead className="px-3 text-right text-stone-700">
                            العرض
                          </TableHead>
                          <TableHead className="px-3 text-right text-stone-700">
                            السمك
                          </TableHead>
                          <TableHead className="px-3 text-right text-stone-700">
                            الحواف
                          </TableHead>
                          <TableHead className="px-3 text-right text-stone-700">
                            ملاحظات
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectParts.map((part) => (
                          <TableRow
                            key={part.id}
                            className={cn(
                              "cursor-pointer",
                              selectedPartId === part.id &&
                                "bg-amber-50 hover:bg-amber-50",
                            )}
                            onClick={() => handlePartSelection(part.id)}
                          >
                            <TableCell className="px-3 align-top font-medium whitespace-normal text-stone-900">
                              <span className="inline-flex min-w-16 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                {projectPartLinkMap.get(part.id)?.code ?? "--"}
                              </span>
                              <span className="mt-2 block">{part.name}</span>
                            </TableCell>
                            <TableCell className="px-3 align-top whitespace-normal">
                              {partCategoryLabels[part.category]}
                            </TableCell>
                            <TableCell className="px-3 align-top">
                              {part.qty}
                            </TableCell>
                            <TableCell className="px-3 align-top">
                              {formatCm(part.length)}
                            </TableCell>
                            <TableCell className="px-3 align-top">
                              {formatCm(part.width)}
                            </TableCell>
                            <TableCell className="px-3 align-top">
                              {formatCm(part.thickness)}
                            </TableCell>
                            <TableCell className="px-3 align-top whitespace-normal text-xs leading-6 text-stone-500">
                              {formatPartEdgeBanding(part)}
                              <span className="mt-1 block text-[11px] text-stone-400">
                                {formatCm(getPartEdgeBandLengthCm(part))}
                              </span>
                              {projectPartLinkMap.get(part.id)
                                ?.primarySheetReference ? (
                                <span className="mt-2 block text-[11px] text-stone-500">
                                  {
                                    projectPartLinkMap.get(part.id)
                                      ?.primarySheetReference
                                  }
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="px-3 align-top whitespace-normal text-xs leading-6 text-stone-500">
                              {part.notes}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                  <CardFooter className="justify-between border-t border-stone-200/80 bg-stone-50/80 text-xs text-stone-500">
                    <span>
                      نتيجة المشروع النهائية تعتمد على الوحدات التي كانت موجودة
                      عند آخر ضغط على زر احسب.
                    </span>
                    <span>
                      {selectedPartId
                        ? "الجزء المحدد ظاهر الآن في الجدول وتوزيع الألواح."
                        : `${projectSummary.totalPanels} قطعة على ${projectLayoutSheetCount} لوح للمشروع بالكامل`}
                    </span>
                  </CardFooter>
                </Card>
              </section>
            </>
          ) : (
            <section className="mt-6 pb-8">
              <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
                <CardHeader>
                  <CardTitle>بانتظار الحساب</CardTitle>
                  <CardDescription>
                    بعد إضافة الوحدات اضغط على زر احسب المشروع لعرض قائمة القطع
                    وتوزيع الألواح للمشروع بالكامل.
                  </CardDescription>
                </CardHeader>
              </Card>
            </section>
          )
        ) : null}

        {activeWorkspaceTab === "library" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
              <CardHeader>
                <CardTitle>المشاريع المحفوظة</CardTitle>
                <CardDescription>
                  وصول سريع لآخر المشاريع بدل فتح الشاشة كاملة كل مرة.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentSavedProjects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 p-6 text-center text-sm text-stone-500">
                    لا توجد مشاريع محفوظة بعد.
                  </div>
                ) : (
                  recentSavedProjects.map((project) => (
                    <div
                      key={project.id}
                      className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 ring-1 ring-stone-200"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-stone-950">
                            {project.name}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            {project.units.length} وحدة •{" "}
                            {(project.customParts ?? []).length} مقاس حر
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => loadSavedProject(project)}
                        >
                          تحميل
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsProjectLibraryOpen(true)}
                >
                  <FolderOpen className="size-4" />
                  فتح مكتبة المشاريع
                </Button>
              </CardFooter>
            </Card>

            <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(63,40,12,0.55)] ring-1 ring-stone-950/8">
              <CardHeader>
                <CardTitle>الوحدات الجاهزة</CardTitle>
                <CardDescription>
                  استخدم الوحدات المتكررة كنقطة بداية بدل إعادة إدخال كل شيء من
                  الصفر.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {unitPresets.slice(0, 4).map((preset) => (
                  <div
                    key={preset.id}
                    className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 ring-1 ring-stone-200"
                  >
                    <p className="font-medium text-stone-950">{preset.title}</p>
                    <p className="mt-1 text-xs leading-6 text-stone-500">
                      {preset.description}
                    </p>
                    <p className="mt-2 text-xs text-stone-500">
                      {formatCm(preset.input.width)} ×{" "}
                      {formatCm(preset.input.height)} ×{" "}
                      {formatCm(preset.input.depth)}
                    </p>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button type="button" onClick={() => setIsUnitPresetOpen(true)}>
                  <Box className="size-4" />
                  فتح مكتبة الوحدات
                </Button>
              </CardFooter>
            </Card>
          </section>
        ) : null}

        <div className="fixed inset-x-4 bottom-24 z-40 sm:hidden">
          <Button
            type="button"
            className="h-12 w-full rounded-[1.25rem] shadow-[0_20px_50px_-30px_rgba(63,40,12,0.65)]"
            onClick={mobilePrimaryAction.onClick}
            disabled={mobilePrimaryAction.disabled}
          >
            <mobilePrimaryAction.icon className="size-4" />
            {mobilePrimaryAction.label}
          </Button>
        </div>

        <nav className="fixed inset-x-4 bottom-4 z-40 rounded-[1.5rem] border border-stone-200 bg-white/92 p-2 shadow-[0_20px_60px_-35px_rgba(63,40,12,0.55)] backdrop-blur sm:hidden">
          <div className="grid grid-cols-5 gap-2">
            {workspaceTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeWorkspaceTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveWorkspaceTab(tab.id)}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px]",
                    isActive ? "bg-stone-950 text-stone-50" : "text-stone-600",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="mt-1">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </main>
  );
}

export default App;
