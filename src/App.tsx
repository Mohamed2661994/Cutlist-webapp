"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
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
  RotateCcw,
  RotateCw,
  ScanSearch,
  Save,
  Settings2,
  Sparkles,
  LogOut,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  CustomProjectPart,
  CustomProjectPartThicknessMode,
  PersistedUser,
  SessionBootstrap,
} from "@/lib/project-persistence";
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
import { UserAuthPanel } from "@/components/user-auth-panel";
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
  normalizeSheetStockSize,
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
  type SheetLayoutOptimizationMode,
  type SheetLayoutResult,
  type SheetLayoutStock,
} from "@/lib/cutlist";

function PreviewFallback() {
  return (
    <div className="flex h-72 w-full items-center justify-center rounded-[1.25rem] border border-dashed border-slate-300 bg-white/65 text-center text-sm text-slate-500">
      جارٍ تحميل المعاينة ثلاثية الأبعاد...
    </div>
  );
}

const CabinetPreview = dynamic(
  () =>
    import("@/components/cabinet-preview").then(
      (module) => module.CabinetPreview,
    ),
  {
    ssr: false,
    loading: () => <PreviewFallback />,
  },
);

const ProjectPreview = dynamic(
  () =>
    import("@/components/cabinet-preview").then(
      (module) => module.ProjectPreview,
    ),
  {
    ssr: false,
    loading: () => <PreviewFallback />,
  },
);

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
  hingeCount: number;
  hingeCost: number;
  totalCost: number;
};

type ProjectOptimizationRecommendation = {
  id: string;
  title: string;
  body: string;
  tone: "info" | "action";
};

type EdgeBandOverrideMap = Record<string, EdgeBandProfile>;

type AggregatedProjectPart = {
  part: CutlistPart;
  sourceKeys: string[];
};

type ProjectPartLink = {
  partId: string;
  code: string;
  sourceKeys: string[];
  unitIds: string[];
  sheetReferences: string[];
  primarySheetReference: string | null;
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

type ProjectArrangementAutosaveState = "idle" | "saving" | "saved" | "error";

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
  optimizationMode: SheetLayoutOptimizationMode;
  boardSheetPrice: number;
  backSheetPrice: number;
  laborPricePerSquareMeter: number;
  edgeBandPricePerMeter: number;
  hingePrice: number;
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
  hingePrice: string;
};

type CustomProjectPartDraft = {
  title: string;
  length: string;
  width: string;
  qty: string;
  thickness: string;
  thicknessMode: CustomProjectPartThicknessMode;
  material: MaterialType;
  category: PartCategory;
  grainDirection: GrainDirection;
  edgeBanding: EdgeBandProfile;
};

type UnitPreset = {
  id: string;
  title: string;
  description: string;
  input: CabinetInput;
};

type WorkspaceTab = "project" | "builder" | "preview" | "results" | "library";

type BuilderTab = "unit" | "custom" | "units";

function isSlowWorkspaceTab(tab: WorkspaceTab) {
  return tab === "preview" || tab === "results";
}

type ResultsSectionKey = "costs" | "layout" | "metrics" | "workshop" | "parts";

type AuthMode = "login" | "register";

type AuthStatus = "loading" | "anonymous" | "authenticated";

type AuthFormState = {
  name: string;
  email: string;
  password: string;
};

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const defaultBoardSheetLength = 240;
const defaultBoardSheetWidth = 120;

const sheetLayoutOptimizationModeLabels: Record<
  SheetLayoutOptimizationMode,
  string
> = {
  workshop: "وضع الورشة",
  yield: "أقل هادر",
  smart: "المحسن الذكي",
};

const sheetLayoutOptimizationModeDescriptions: Record<
  SheetLayoutOptimizationMode,
  string
> = {
  workshop:
    "يرجح التخطيطات الأسهل في القص والطباعة عندما يكون فرق الهدر محدودًا.",
  yield: "يركز على تقليل الهدر أولًا حتى لو زاد تعقيد خطة القص قليلًا.",
  smart:
    "يجرب أكثر من ترتيب وأسلوب قص ثم يوازن بين تقليل الهدر وتقليل الألواح شبه الفارغة وسهولة التنفيذ.",
};

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
  optimizationMode: "smart",
  boardSheetPrice: 0,
  backSheetPrice: 0,
  laborPricePerSquareMeter: 0,
  edgeBandPricePerMeter: 0,
  hingePrice: 0,
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

type ProjectPreviewLayoutUnit = ReturnType<
  typeof buildProjectPreviewUnits
>[number];

function getProjectPreviewFootprintCm(unit: ProjectPreviewLayoutUnit) {
  const baseWidth =
    unit.input.cabinetType === "corner-l-base" ||
    unit.input.cabinetType === "corner-l-wall"
      ? unit.input.width +
        Math.max(unit.input.returnDepth - unit.input.boardThickness, 0)
      : unit.input.width;
  const baseDepth =
    unit.input.cabinetType === "corner-l-base" ||
    unit.input.cabinetType === "corner-l-wall"
      ? Math.max(unit.input.depth, unit.input.returnDepth)
      : unit.input.depth;
  const normalizedRotation = ((unit.rotationY % 360) + 360) % 360;
  const isQuarterTurn = normalizedRotation === 90 || normalizedRotation === 270;

  return {
    widthCm: isQuarterTurn ? baseDepth : baseWidth,
    depthCm: isQuarterTurn ? baseWidth : baseDepth,
  };
}

function getProjectPreviewBoundsCm(unit: ProjectPreviewLayoutUnit) {
  const { widthCm, depthCm } = getProjectPreviewFootprintCm(unit);
  const centerX = unit.position[0] * 100;
  const centerZ = unit.position[2] * 100;
  const minY = unit.position[1] * 100;

  return {
    minX: centerX - widthCm / 2,
    maxX: centerX + widthCm / 2,
    minY,
    maxY: minY + unit.input.height,
    minZ: centerZ - depthCm / 2,
    maxZ: centerZ + depthCm / 2,
  };
}

function findProjectPreviewOverlap(units: ProjectPreviewLayoutUnit[]) {
  const overlapToleranceCm = 0.5;

  for (let index = 0; index < units.length; index += 1) {
    const currentUnit = units[index];
    const currentBounds = getProjectPreviewBoundsCm(currentUnit);

    for (
      let compareIndex = index + 1;
      compareIndex < units.length;
      compareIndex += 1
    ) {
      const compareUnit = units[compareIndex];
      const compareBounds = getProjectPreviewBoundsCm(compareUnit);
      const overlapsX =
        currentBounds.minX < compareBounds.maxX - overlapToleranceCm &&
        currentBounds.maxX > compareBounds.minX + overlapToleranceCm;
      const overlapsY =
        currentBounds.minY < compareBounds.maxY - overlapToleranceCm &&
        currentBounds.maxY > compareBounds.minY + overlapToleranceCm;
      const overlapsZ =
        currentBounds.minZ < compareBounds.maxZ - overlapToleranceCm &&
        currentBounds.maxZ > compareBounds.minZ + overlapToleranceCm;

      if (overlapsX && overlapsY && overlapsZ) {
        return {
          first: currentUnit,
          second: compareUnit,
        };
      }
    }
  }

  return null;
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

function getStockSheetUtilizationRatio(
  stock: SheetLayoutStock,
  sheet: SheetLayoutStock["sheets"][number],
) {
  const sheetArea = stock.boardLength * stock.boardWidth;

  if (sheetArea <= 0) {
    return 0;
  }

  const usedArea = sheet.pieces.reduce(
    (sum, piece) => sum + piece.length * piece.width,
    0,
  );

  return usedArea / sheetArea;
}

function isBackStockPart(part: CutlistPart) {
  return part.category === "back" && part.kind !== "custom";
}

function buildProjectOptimizationRecommendations(
  parts: CutlistPart[],
  sheetLayout: SheetLayoutResult | null,
  settings: ProjectSettings,
): ProjectOptimizationRecommendation[] {
  if (!sheetLayout || sheetLayout.stocks.length === 0 || parts.length === 0) {
    return [];
  }

  const recommendations: ProjectOptimizationRecommendation[] = [
    {
      id: "baseline",
      title: "كيف يفكر المحرك الآن",
      body: "المحرك يفصل المشروع أولًا حسب الخامة والسماكة، ثم يحترم اتجاه الثمرة قبل أن يحاول تقليل الهدر داخل كل مجموعة لوح.",
      tone: "info",
    },
  ];

  const totalAvailableAreaM2 = round2(
    sheetLayout.stocks.reduce(
      (sum, stock) => sum + getStockAvailableAreaM2(stock),
      0,
    ),
  );
  const totalUsedAreaM2 = round2(
    sheetLayout.stocks.reduce((sum, stock) => sum + stock.totalAreaM2, 0),
  );
  const wastePercent =
    totalAvailableAreaM2 > 0
      ? round2(
          ((totalAvailableAreaM2 - totalUsedAreaM2) / totalAvailableAreaM2) *
            100,
        )
      : 0;
  const sparseSheetCount = sheetLayout.stocks.reduce(
    (sum, stock) =>
      sum +
      stock.sheets.filter(
        (sheet) =>
          sheet.pieces.length <= 2 &&
          getStockSheetUtilizationRatio(stock, sheet) < 0.72,
      ).length,
    0,
  );
  const lockedCustomParts = parts.filter(
    (part) => part.kind === "custom" && part.grainDirection !== "free",
  );
  const mostWastefulStock = [...sheetLayout.stocks]
    .map((stock) => ({
      stock,
      wasteAreaM2: getStockWasteAreaM2(stock),
    }))
    .sort(
      (left, right) =>
        right.wasteAreaM2 - left.wasteAreaM2 ||
        right.stock.sheets.length - left.stock.sheets.length,
    )[0];

  if (
    settings.optimizationMode !== "smart" &&
    (wastePercent >= 16 || sparseSheetCount > 0)
  ) {
    recommendations.push({
      id: "switch-smart",
      title: "جرّب المحسن الذكي",
      body:
        sparseSheetCount > 0
          ? `هناك ${sparseSheetCount} لوح شبه فارغ في النتيجة الحالية، والمحسن الذكي غالبًا ينجح أكثر في دمج القطع قبل الإبقاء على هذه الألواح.`
          : `نسبة الهدر الحالية ${wastePercent}%، ولذلك من المنطقي تجربة المحسن الذكي لأنه يوازن بين تقليل الهدر وتقليل الألواح الضعيفة الاستغلال.`,
      tone: "action",
    });
  }

  if (lockedCustomParts.length > 0 && sparseSheetCount > 0) {
    const lockedLabels = [
      ...new Set(lockedCustomParts.map((part) => part.name)),
    ]
      .slice(0, 2)
      .join("، ");
    recommendations.push({
      id: "locked-grain",
      title: "راجع اتجاه الثمرة للمقاسات الحرة",
      body: `بعض المقاسات الحرة ما زالت مقيدة باتجاه ثمرة ثابت، مثل ${lockedLabels}، وهذا قد يمنع تدويرها ويدفع المحرك لترك لوح شبه فارغ أو فصلها على لوح مستقل.`,
      tone: "action",
    });
  }

  if (mostWastefulStock && mostWastefulStock.wasteAreaM2 >= 1.2) {
    const stock = mostWastefulStock.stock;
    const stockParts = parts.filter((part) => {
      if (stock.isBackStock) {
        return isBackStockPart(part) && part.thickness === stock.thickness;
      }

      return (
        !isBackStockPart(part) &&
        part.material === stock.material &&
        part.thickness === stock.thickness
      );
    });
    const largestPartLength = Math.max(
      ...stockParts.map((part) => part.length),
      0,
    );
    const largestPartWidth = Math.max(
      ...stockParts.map((part) => part.width),
      0,
    );
    const closeToBoardLimit =
      largestPartLength >= stock.boardLength * 0.82 ||
      largestPartWidth >= stock.boardWidth * 0.82;

    if (closeToBoardLimit) {
      recommendations.push({
        id: "board-size",
        title: "راجع مقاس اللوح المتاح للورشة",
        body: `${getStockLabel(stock.thickness, stock.isBackStock)} تهدر الآن ${mostWastefulStock.wasteAreaM2} م² تقريبًا، ومع وجود قطع كبيرة قريبة من حد اللوح الحالي قد يساعد لوح بمقاس أكبر أو خامة بديلة على تقليل الفصل والهدر.`,
        tone: "action",
      });
    }
  }

  if (settings.cutKerf === 0 && settings.trimMargin === 0) {
    recommendations.push({
      id: "real-world-settings",
      title: "أدخل قيم الورشة الحقيقية",
      body: "الحساب الحالي يفترض سلاح 0 مم وحافة تشطيب 0 مم. إدخال القيم الفعلية للمنشار والتشطيب يجعل توصيات التوزيع أقرب للنتيجة التنفيذية داخل الورشة.",
      tone: "info",
    });
  }

  return recommendations.slice(0, 4);
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

type SheetPrintRect = {
  x: number;
  y: number;
  length: number;
  width: number;
  areaM2: number;
};

type SheetBandPlan = {
  startX: number;
  endX: number;
  startY: number;
  endY: number;
  length: number;
  width: number;
  uniformLength: boolean;
  pieces: SheetLayoutPiece[];
};

function getUniqueSortedCoords(values: number[]) {
  return [
    ...new Set(values.map((value) => round2(value)).filter(Number.isFinite)),
  ].sort((left, right) => left - right);
}

function formatSheetAxisRange(start: number, end: number) {
  return `${formatCm(start)} إلى ${formatCm(end)}`;
}

function buildSheetFreeRects(
  stock: SheetLayoutStock,
  sheet: SheetLayoutStock["sheets"][number],
) {
  if (sheet.pieces.length === 0) {
    return [
      {
        x: 0,
        y: 0,
        length: stock.boardLength,
        width: stock.boardWidth,
        areaM2: round2((stock.boardLength * stock.boardWidth) / 10000),
      },
    ];
  }

  const tolerance = 0.05;
  const xEdges = getUniqueSortedCoords([
    0,
    stock.boardLength,
    ...sheet.pieces.flatMap((piece) => [piece.x, piece.x + piece.length]),
  ]);
  const yEdges = getUniqueSortedCoords([
    0,
    stock.boardWidth,
    ...sheet.pieces.flatMap((piece) => [piece.y, piece.y + piece.width]),
  ]);
  const freeMatrix = xEdges.slice(0, -1).map((xStart, xIndex) =>
    yEdges.slice(0, -1).map((yStart, yIndex) => {
      const xEnd = xEdges[xIndex + 1];
      const yEnd = yEdges[yIndex + 1];

      return !sheet.pieces.some(
        (piece) =>
          piece.x <= xStart + tolerance &&
          piece.x + piece.length >= xEnd - tolerance &&
          piece.y <= yStart + tolerance &&
          piece.y + piece.width >= yEnd - tolerance,
      );
    }),
  );
  const consumed = freeMatrix.map((row) => row.map(() => false));
  const freeRects: SheetPrintRect[] = [];

  for (let xIndex = 0; xIndex < freeMatrix.length; xIndex += 1) {
    for (let yIndex = 0; yIndex < freeMatrix[xIndex].length; yIndex += 1) {
      if (!freeMatrix[xIndex][yIndex] || consumed[xIndex][yIndex]) {
        continue;
      }

      let yEndIndex = yIndex + 1;
      while (
        yEndIndex < freeMatrix[xIndex].length &&
        freeMatrix[xIndex][yEndIndex] &&
        !consumed[xIndex][yEndIndex]
      ) {
        yEndIndex += 1;
      }

      let xEndIndex = xIndex + 1;
      while (xEndIndex < freeMatrix.length) {
        let canExtend = true;
        for (let yCursor = yIndex; yCursor < yEndIndex; yCursor += 1) {
          if (!freeMatrix[xEndIndex][yCursor] || consumed[xEndIndex][yCursor]) {
            canExtend = false;
            break;
          }
        }

        if (!canExtend) {
          break;
        }

        xEndIndex += 1;
      }

      for (let xCursor = xIndex; xCursor < xEndIndex; xCursor += 1) {
        for (let yCursor = yIndex; yCursor < yEndIndex; yCursor += 1) {
          consumed[xCursor][yCursor] = true;
        }
      }

      const length = round2(xEdges[xEndIndex] - xEdges[xIndex]);
      const width = round2(yEdges[yEndIndex] - yEdges[yIndex]);
      if (length <= 0 || width <= 0) {
        continue;
      }

      freeRects.push({
        x: xEdges[xIndex],
        y: yEdges[yIndex],
        length,
        width,
        areaM2: round2((length * width) / 10000),
      });
    }
  }

  return freeRects.sort(
    (left, right) =>
      right.areaM2 - left.areaM2 ||
      right.length * right.width - left.length * left.width ||
      left.x - right.x ||
      left.y - right.y,
  );
}

function isReusableSheetOffcut(rect: SheetPrintRect) {
  return Math.min(rect.length, rect.width) >= 8 && rect.areaM2 >= 0.05;
}

function buildSheetBandPlan(sheet: SheetLayoutStock["sheets"][number]) {
  if (sheet.pieces.length === 0) {
    return [] satisfies SheetBandPlan[];
  }

  const groups = new Map<string, SheetBandPlan>();

  for (const piece of sheet.pieces) {
    const key = round2(piece.x).toFixed(2);
    const current = groups.get(key);

    if (current) {
      current.endX = Math.max(current.endX, piece.x + piece.length);
      current.startY = Math.min(current.startY, piece.y);
      current.endY = Math.max(current.endY, piece.y + piece.width);
      current.pieces.push(piece);
      continue;
    }

    groups.set(key, {
      startX: round2(piece.x),
      endX: round2(piece.x + piece.length),
      startY: round2(piece.y),
      endY: round2(piece.y + piece.width),
      length: round2(piece.length),
      width: round2(piece.width),
      uniformLength: true,
      pieces: [piece],
    });
  }

  const plans = [...groups.values()]
    .map((plan) => {
      const endX = round2(
        Math.max(...plan.pieces.map((piece) => piece.x + piece.length)),
      );

      return {
        ...plan,
        endX,
        endY: round2(
          Math.max(...plan.pieces.map((piece) => piece.y + piece.width)),
        ),
        startY: round2(Math.min(...plan.pieces.map((piece) => piece.y))),
        length: round2(endX - plan.startX),
        width: round2(
          Math.max(...plan.pieces.map((piece) => piece.y + piece.width)) -
            Math.min(...plan.pieces.map((piece) => piece.y)),
        ),
        uniformLength: plan.pieces.every(
          (piece) => Math.abs(piece.x + piece.length - endX) <= 0.05,
        ),
        pieces: [...plan.pieces].sort(
          (left, right) =>
            left.y - right.y ||
            left.length - right.length ||
            left.width - right.width,
        ),
      };
    })
    .sort(
      (left, right) => left.startX - right.startX || left.endX - right.endX,
    );

  for (let index = 1; index < plans.length; index += 1) {
    if (plans[index].startX < plans[index - 1].endX - 0.05) {
      return null;
    }
  }

  return plans;
}

function buildSheetExecutionMarkup(
  stock: SheetLayoutStock,
  sheet: SheetLayoutStock["sheets"][number],
  projectPartLinkMap: Map<string, ProjectPartLink>,
) {
  const bandPlans = buildSheetBandPlan(sheet);

  if (sheet.pieces.length === 0) {
    return `
      <div class="sheet-detail-card">
        <h4>خطة التشغيل</h4>
        <p>هذا اللوح لم يُسحب منه أي قطع بعد، ويمكن اعتباره لوحًا كاملًا متاحًا للاستخدام لاحقًا.</p>
      </div>`;
  }

  if (bandPlans && bandPlans.length > 0) {
    const steps = bandPlans
      .map((plan, planIndex) => {
        const spanLabel =
          plan.startX <= 0.05
            ? `من بداية الطول حتى ${formatCm(plan.endX)}`
            : `بين ${formatCm(plan.startX)} و${formatCm(plan.endX)} من طول اللوح`;
        const pieceLines = plan.pieces
          .map((piece, pieceIndex) => {
            const partCode =
              projectPartLinkMap.get(piece.sourcePartId)?.code ?? piece.name;
            const needsFinalTrim = Math.abs(piece.length - plan.length) > 0.05;

            return `قطعة ${pieceIndex + 1}: ${partCode} ${formatCm(piece.width)} × ${formatCm(piece.length)}${needsFinalTrim ? ` ثم تشطيب نهائي على الطول إلى ${formatCm(piece.length)}` : ""}`;
          })
          .join("؛ ");

        return `
          <li>
            اسحب الشريحة ${planIndex + 1} ${spanLabel} بطول تشغيلي ${formatCm(plan.length)} وعرض مستخدم ${formatCm(plan.width)}.
            ${plan.uniformLength ? "" : " بعد ذلك افصل القطع الأقصر بتشطيب نهائي على الطول داخل نفس الشريحة."}
            ترتيب الفصل على محور العرض: ${pieceLines}.
          </li>`;
      })
      .join("");
    const trailingLength = round2(
      Math.max(stock.boardLength - sheet.usedLength, 0),
    );

    return `
      <div class="sheet-detail-card">
        <h4>خطة التشغيل</h4>
        <p class="sheet-detail-meta">${bandPlans.length} شرائح تشغيل متتابعة على محور الطول${trailingLength > 0 ? `، والمتبقي الخلفي بعد آخر شريحة ${formatCm(trailingLength)}` : ""}.</p>
        <ol>${steps}</ol>
      </div>`;
  }

  const xCuts = getUniqueSortedCoords(
    sheet.pieces.flatMap((piece) => [piece.x, piece.x + piece.length]),
  ).filter((value) => value > 0.05 && value < stock.boardLength - 0.05);
  const yCuts = getUniqueSortedCoords(
    sheet.pieces.flatMap((piece) => [piece.y, piece.y + piece.width]),
  ).filter((value) => value > 0.05 && value < stock.boardWidth - 0.05);

  return `
    <div class="sheet-detail-card">
      <h4>خطة التشغيل</h4>
      <p class="sheet-detail-meta">التخطيط الحالي مضغوط نسبيًا، لذلك تعذر استخلاص شرائح طولية مستقلة بدون تداخل.</p>
      <ol>
        <li>${xCuts.length > 0 ? `راجع خطوط القص على محور الطول عند: ${xCuts.map((value) => formatCm(value)).join("، ")}.` : "لا توجد خطوط طولية داخلية إضافية واضحة؛ اعتمد الرسم المطبوع كمرجع أساسي."}</li>
        <li>${yCuts.length > 0 ? `راجع خطوط القص على محور العرض عند: ${yCuts.map((value) => formatCm(value)).join("، ")}.` : "لا توجد خطوط عرضية داخلية إضافية واضحة؛ الترتيب الحالي يميل إلى مسارات طولية أبسط."}</li>
        <li>استخدم أكواد القطع داخل الرسم لتثبيت تسلسل الفصل النهائي قبل التشغيل، خصوصًا إذا اخترت وضع أقل هادر.</li>
      </ol>
    </div>`;
}

function buildSheetOffcutsMarkup(
  stock: SheetLayoutStock,
  sheet: SheetLayoutStock["sheets"][number],
) {
  const allOffcuts = buildSheetFreeRects(stock, sheet);
  const reusableOffcuts = allOffcuts.filter(isReusableSheetOffcut);

  if (reusableOffcuts.length === 0) {
    return `
      <div class="sheet-detail-card">
        <h4>البواقي القابلة للتخزين</h4>
        <p class="sheet-detail-meta">لا توجد بواقي كبيرة بما يكفي للتخزين المنفصل على هذا اللوح؛ المتبقي الحالي أقرب لشرائط سلاح وهوامش تشغيل صغيرة.</p>
      </div>`;
  }

  const visibleOffcuts = reusableOffcuts.slice(0, 6);
  const offcutLines = visibleOffcuts
    .map(
      (rect, index) => `
        <li>
          باقي ${index + 1}: ${formatSheetSize(rect.length, rect.width)} بمساحة ${rect.areaM2} م².
          موقعه على محور الطول ${formatSheetAxisRange(rect.x, rect.x + rect.length)}، وعلى محور العرض ${formatSheetAxisRange(rect.y, rect.y + rect.width)}.
        </li>`,
    )
    .join("");
  const hiddenOffcuts = reusableOffcuts.length - visibleOffcuts.length;

  return `
    <div class="sheet-detail-card">
      <h4>البواقي القابلة للتخزين</h4>
      <p class="sheet-detail-meta">${reusableOffcuts.length} بواقي قابلة لإعادة الاستخدام على هذا اللوح${hiddenOffcuts > 0 ? `، تم عرض أكبر ${visibleOffcuts.length} فقط` : ""}.</p>
      <ul>${offcutLines}</ul>
    </div>`;
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

function normalizeSavedProjects(projects: SavedProject[]) {
  return projects
    .map((project) => {
      const settings = normalizeProjectSettings(project.settings);

      return {
        ...project,
        settings,
        customParts: (project.customParts ?? []).map((part) =>
          syncCustomProjectPartWithSettings(part, settings),
        ),
        edgeBandOverrides: project.edgeBandOverrides ?? {},
      };
    })
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    );
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

function buildProjectArrangementAutosaveKey(
  projectId: string | null,
  arrangement: ProjectArrangementItem[],
) {
  if (!projectId) {
    return null;
  }

  return `${projectId}:${JSON.stringify(
    arrangement.map((item) => ({
      id: item.id,
      offsetX: round2(item.offsetX),
      offsetY: round2(item.offsetY),
      offsetZ: round2(item.offsetZ),
      rotationY: ((item.rotationY % 360) + 360) % 360,
    })),
  )}`;
}

function buildSavedProjectSnapshot(
  projectId: string,
  projectName: string,
  settings: ProjectSettings,
  units: CabinetUnit[],
  customParts: CustomProjectPart[],
  arrangement: ProjectArrangementItem[],
  edgeBandOverrides: EdgeBandOverrideMap,
) {
  const trimmedName = projectName.trim() || "مشروع بدون اسم";
  const snapshot: SavedProject = {
    id: projectId,
    name: trimmedName,
    updatedAt: new Date().toISOString(),
    settings,
    units,
    customParts,
    arrangement,
    edgeBandOverrides,
  };

  return {
    trimmedName,
    snapshot,
  };
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
    totalHingeCount: number;
    totalHingeCost: number;
    totalProjectCost: number;
  },
  parts: CutlistPart[],
  sheetLayout: SheetLayoutResult | null,
  projectPartLinkMap: Map<string, ProjectPartLink>,
) {
  const partsMap = new Map(parts.map((part) => [part.id, part]));
  const optimizationModeLabel =
    sheetLayoutOptimizationModeLabels[settings.optimizationMode];
  const optimizationModeDescription =
    sheetLayoutOptimizationModeDescriptions[settings.optimizationMode];
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
                    <div class="sheet-details">
                      ${buildSheetExecutionMarkup(stock, sheet, projectPartLinkMap)}
                      ${buildSheetOffcutsMarkup(stock, sheet)}
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
        .sheet-svg-wrap { border: 1px solid #e7dfd4; border-radius: 14px; padding: 10px; background: linear-gradient(180deg,#edf3f4 0%,#dbe7e7 100%); }
        .sheet-svg-wrap svg { display: block; width: 100%; height: auto; border-radius: 12px; background: #fff; box-shadow: inset 0 0 0 1px rgba(201,215,222,0.96); }
        .sheet-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
        .sheet-detail-card { border: 1px solid #e7dfd4; border-radius: 14px; padding: 10px 12px; background: #fcfaf7; }
        .sheet-detail-card h4 { margin: 0 0 8px; font-size: 13px; }
        .sheet-detail-card p, .sheet-detail-card li { font-size: 12px; line-height: 1.8; color: #44403c; }
        .sheet-detail-card ol, .sheet-detail-card ul { margin: 0; padding-inline-start: 18px; }
        .sheet-detail-card li + li { margin-top: 4px; }
        .sheet-detail-meta { margin-bottom: 8px; color: #78716c; }
        .edge-band-note { margin: 0 0 12px; border: 1px solid #d6cec2; border-radius: 12px; padding: 10px 12px; background: #fff; color: #44403c; font-size: 12px; font-weight: 700; }
        .waste-note { margin-top: 14px; border: 1px solid #f2d7a2; border-radius: 14px; padding: 12px 14px; background: #fff6df; color: #78350f; font-size: 13px; line-height: 1.8; }
        .mode-note { margin-top: 14px; border: 1px solid #d6cec2; border-radius: 14px; padding: 12px 14px; background: #faf8f4; color: #44403c; font-size: 13px; line-height: 1.8; }
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
        <div class="card">أسلوب التخطيط: ${optimizationModeLabel}</div>
        <div class="card">سعر المفصلة: ${formatPrice(settings.hingePrice)}/قطعة</div>
      </div>
      <div class="summary">
        <div class="card">الوحدات: ${summary.unitCount}</div>
        <div class="card">إجمالي القطع: ${summary.totalPanels}</div>
        <div class="card">إجمالي الألواح: ${summary.totalSheets}</div>
        <div class="card">إجمالي الاستهلاك: ${summary.totalAreaM2} م²</div>
        <div class="card">المفصلات: ${summary.totalHingeCount} قطعة • ${formatPrice(summary.totalHingeCost)}</div>
        <div class="card">التكلفة التقريبية: ${formatPrice(summary.totalProjectCost)}</div>
      </div>
      <div class="mode-note"><strong>${optimizationModeLabel}:</strong> ${optimizationModeDescription}</div>
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
            <div class="edge-band-note">شريط الحافة يظهر بخط أسود متقطع على الضلع نفسه ليبقى واضحًا حتى في الطباعة الأبيض والأسود.</div>
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

function getSheetSvgPresentation(stock: SheetLayoutStock, isRotated = false) {
  return {
    viewBoxWidth: (isRotated ? stock.boardLength : stock.boardWidth) + 36,
    viewBoxHeight: (isRotated ? stock.boardWidth : stock.boardLength) + 36,
    contentTransform: isRotated
      ? `translate(0 ${stock.boardWidth}) rotate(-90)`
      : undefined,
  };
}

function getSheetPieceTextTransform(
  displayPiece: ReturnType<typeof getSheetDisplayPiece>,
  shouldRotate: boolean | undefined,
  isSheetRotated = false,
  transformOrigin?: { x: number; y: number },
) {
  if (isSheetRotated) {
    const originX =
      transformOrigin?.x ?? displayPiece.x + displayPiece.width / 2;
    const originY =
      transformOrigin?.y ?? displayPiece.y + displayPiece.height / 2;

    return `rotate(90 ${originX} ${originY})`;
  }

  if (!shouldRotate) {
    return undefined;
  }

  return `rotate(-90 ${displayPiece.x + displayPiece.width / 2} ${displayPiece.y + displayPiece.height / 2})`;
}

function getSheetPieceTextPosition(
  displayPiece: ReturnType<typeof getSheetDisplayPiece>,
  offset: number,
  isSheetRotated = false,
) {
  const centerX = displayPiece.x + displayPiece.width / 2;
  const centerY = displayPiece.y + displayPiece.height / 2;

  if (isSheetRotated) {
    return {
      x: centerX - offset,
      y: centerY,
    };
  }

  return {
    x: centerX,
    y: centerY + offset,
  };
}

function getSheetLengthLabelTransform(stock: SheetLayoutStock) {
  return `rotate(90 ${stock.boardWidth + 14} ${stock.boardLength / 2})`;
}

type SheetPieceVisualEdge = {
  edge: "top" | "right" | "bottom" | "left";
  logicalSide: EdgeBandSide;
  x: number;
  y: number;
  width: number;
  height: number;
  lineX1: number;
  lineY1: number;
  lineX2: number;
  lineY2: number;
  tickStartX1: number;
  tickStartY1: number;
  tickStartX2: number;
  tickStartY2: number;
  tickEndX1: number;
  tickEndY1: number;
  tickEndX2: number;
  tickEndY2: number;
};

function getSheetPieceEdgeThickness(
  displayPiece: ReturnType<typeof getSheetDisplayPiece>,
) {
  return Math.max(
    1.4,
    Math.min(Math.min(displayPiece.width, displayPiece.height) * 0.08, 3.2),
  );
}

function getSheetPieceEdgeMarkerStrokeWidth(
  displayPiece: ReturnType<typeof getSheetDisplayPiece>,
) {
  return Math.max(
    0.42,
    Math.min(Math.min(displayPiece.width, displayPiece.height) * 0.016, 0.75),
  );
}

function getSheetPieceEdgeMarkerDash(
  displayPiece: ReturnType<typeof getSheetDisplayPiece>,
) {
  const markerStrokeWidth = getSheetPieceEdgeMarkerStrokeWidth(displayPiece);

  return `${Math.max(7, round2(markerStrokeWidth * 9))} ${Math.max(6, round2(markerStrokeWidth * 8))}`;
}

function getSheetPieceVisualEdges(
  piece: SheetLayoutPiece,
  displayPiece: ReturnType<typeof getSheetDisplayPiece>,
) {
  const edgeThickness = getSheetPieceEdgeThickness(displayPiece);
  const tickLength = Math.max(
    2.8,
    Math.min(Math.min(displayPiece.width, displayPiece.height) * 0.18, 5.6),
  );
  const halfThickness = edgeThickness / 2;
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

  return edgeRects.map((edgeRect): SheetPieceVisualEdge => {
    const logicalSide = getVisualEdgeSide(piece, edgeRect.edge);

    switch (edgeRect.edge) {
      case "top":
        return {
          ...edgeRect,
          logicalSide,
          lineX1: edgeRect.x + halfThickness,
          lineY1: edgeRect.y + halfThickness,
          lineX2: edgeRect.x + edgeRect.width - halfThickness,
          lineY2: edgeRect.y + halfThickness,
          tickStartX1: edgeRect.x + halfThickness,
          tickStartY1: edgeRect.y + halfThickness,
          tickStartX2: edgeRect.x + halfThickness,
          tickStartY2: edgeRect.y + halfThickness + tickLength,
          tickEndX1: edgeRect.x + edgeRect.width - halfThickness,
          tickEndY1: edgeRect.y + halfThickness,
          tickEndX2: edgeRect.x + edgeRect.width - halfThickness,
          tickEndY2: edgeRect.y + halfThickness + tickLength,
        };
      case "right":
        return {
          ...edgeRect,
          logicalSide,
          lineX1: edgeRect.x + edgeRect.width - halfThickness,
          lineY1: edgeRect.y + halfThickness,
          lineX2: edgeRect.x + edgeRect.width - halfThickness,
          lineY2: edgeRect.y + edgeRect.height - halfThickness,
          tickStartX1: edgeRect.x + edgeRect.width - halfThickness,
          tickStartY1: edgeRect.y + halfThickness,
          tickStartX2: edgeRect.x + edgeRect.width - halfThickness - tickLength,
          tickStartY2: edgeRect.y + halfThickness,
          tickEndX1: edgeRect.x + edgeRect.width - halfThickness,
          tickEndY1: edgeRect.y + edgeRect.height - halfThickness,
          tickEndX2: edgeRect.x + edgeRect.width - halfThickness - tickLength,
          tickEndY2: edgeRect.y + edgeRect.height - halfThickness,
        };
      case "bottom":
        return {
          ...edgeRect,
          logicalSide,
          lineX1: edgeRect.x + halfThickness,
          lineY1: edgeRect.y + edgeRect.height - halfThickness,
          lineX2: edgeRect.x + edgeRect.width - halfThickness,
          lineY2: edgeRect.y + edgeRect.height - halfThickness,
          tickStartX1: edgeRect.x + halfThickness,
          tickStartY1: edgeRect.y + edgeRect.height - halfThickness,
          tickStartX2: edgeRect.x + halfThickness,
          tickStartY2:
            edgeRect.y + edgeRect.height - halfThickness - tickLength,
          tickEndX1: edgeRect.x + edgeRect.width - halfThickness,
          tickEndY1: edgeRect.y + edgeRect.height - halfThickness,
          tickEndX2: edgeRect.x + edgeRect.width - halfThickness,
          tickEndY2: edgeRect.y + edgeRect.height - halfThickness - tickLength,
        };
      case "left":
        return {
          ...edgeRect,
          logicalSide,
          lineX1: edgeRect.x + halfThickness,
          lineY1: edgeRect.y + halfThickness,
          lineX2: edgeRect.x + halfThickness,
          lineY2: edgeRect.y + edgeRect.height - halfThickness,
          tickStartX1: edgeRect.x + halfThickness,
          tickStartY1: edgeRect.y + halfThickness,
          tickStartX2: edgeRect.x + halfThickness + tickLength,
          tickStartY2: edgeRect.y + halfThickness,
          tickEndX1: edgeRect.x + halfThickness,
          tickEndY1: edgeRect.y + edgeRect.height - halfThickness,
          tickEndX2: edgeRect.x + halfThickness + tickLength,
          tickEndY2: edgeRect.y + edgeRect.height - halfThickness,
        };
    }
  });
}

function buildPrintSheetSvg(
  stock: SheetLayoutStock,
  sheet: SheetLayoutStock["sheets"][number],
  partsMap: Map<string, CutlistPart>,
  projectPartLinkMap: Map<string, ProjectPartLink>,
  isRotated = false,
) {
  const svgPresentation = getSheetSvgPresentation(stock, isRotated);
  const piecesMarkup = sheet.pieces
    .map((piece) => {
      const pieceLabel = getSheetPieceLabelMode(piece);
      const displayPiece = pieceLabel.displayPiece;
      const part = partsMap.get(piece.sourcePartId);
      const projectPartLink = projectPartLinkMap.get(piece.sourcePartId);
      const primaryLabel = getSheetPiecePrimaryLabel(
        piece,
        pieceLabel,
        projectPartLink?.code,
      );
      const nameTextPosition = getSheetPieceTextPosition(
        displayPiece,
        0,
        isRotated,
      );
      const nameTextTransform = getSheetPieceTextTransform(
        displayPiece,
        pieceLabel.rotate,
        isRotated,
        nameTextPosition,
      );
      const dimensionTexts = getSheetPieceDimensionTexts(
        piece,
        pieceLabel,
        isRotated,
      );
      const topDimensionTextStyle = dimensionTexts.top
        ? getSheetPieceDimensionTextStyle(dimensionTexts.top.fontSize)
        : null;
      const sideDimensionTextStyle = dimensionTexts.side
        ? getSheetPieceDimensionTextStyle(dimensionTexts.side.fontSize)
        : null;
      const visualEdges = getSheetPieceVisualEdges(piece, displayPiece);
      const edgeMarkerStrokeWidth =
        getSheetPieceEdgeMarkerStrokeWidth(displayPiece);
      const edgeMarkerDash = getSheetPieceEdgeMarkerDash(displayPiece);
      const edgeMarkup = part
        ? visualEdges
            .map((edgeInfo) => {
              const isActive = part.edgeBanding[edgeInfo.logicalSide] ?? false;

              if (!isActive) {
                return "";
              }

              return `<g>
                <line x1="${edgeInfo.lineX1}" y1="${edgeInfo.lineY1}" x2="${edgeInfo.lineX2}" y2="${edgeInfo.lineY2}" stroke="#111827" stroke-width="${edgeMarkerStrokeWidth}" stroke-linecap="butt" stroke-dasharray="${edgeMarkerDash}" />
              </g>`;
            })
            .join("")
        : "";
      const labelMarkup =
        pieceLabel.mode === "full"
          ? `<g>
              <text
                  x="${nameTextPosition.x}"
                  y="${nameTextPosition.y}"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="${primaryLabel?.fontSize ?? pieceLabel.nameFontSize}"
                font-weight="700"
                fill="#fff"
                direction="rtl"
                unicode-bidi="plaintext"
                ${nameTextTransform ? `transform="${nameTextTransform}"` : ""}
              >
                ${primaryLabel?.text ?? (projectPartLink ? `${projectPartLink.code} • ${piece.name}` : piece.name)}
              </text>
              ${dimensionTexts.top && topDimensionTextStyle ? `<text x="${dimensionTexts.top.x}" y="${dimensionTexts.top.y}" text-anchor="middle" dominant-baseline="middle" font-size="${dimensionTexts.top.fontSize}" font-weight="${topDimensionTextStyle.fontWeight}" fill="${topDimensionTextStyle.fill}" stroke="${topDimensionTextStyle.stroke}" stroke-width="${topDimensionTextStyle.strokeWidth}" stroke-linejoin="${topDimensionTextStyle.strokeLinejoin}" paint-order="${topDimensionTextStyle.paintOrder}" ${dimensionTexts.top.transform ? `transform="${dimensionTexts.top.transform}"` : ""}>${dimensionTexts.top.text}</text>` : ""}
              ${dimensionTexts.side && sideDimensionTextStyle ? `<text x="${dimensionTexts.side.x}" y="${dimensionTexts.side.y}" text-anchor="middle" dominant-baseline="middle" font-size="${dimensionTexts.side.fontSize}" font-weight="${sideDimensionTextStyle.fontWeight}" fill="${sideDimensionTextStyle.fill}" stroke="${sideDimensionTextStyle.stroke}" stroke-width="${sideDimensionTextStyle.strokeWidth}" stroke-linejoin="${sideDimensionTextStyle.strokeLinejoin}" paint-order="${sideDimensionTextStyle.paintOrder}" ${dimensionTexts.side.transform ? `transform="${dimensionTexts.side.transform}"` : ""}>${dimensionTexts.side.text}</text>` : ""}
            </g>`
          : pieceLabel.mode === "dims"
            ? `<g>
                ${dimensionTexts.top && topDimensionTextStyle ? `<text x="${dimensionTexts.top.x}" y="${dimensionTexts.top.y}" text-anchor="middle" dominant-baseline="middle" font-size="${dimensionTexts.top.fontSize}" font-weight="${topDimensionTextStyle.fontWeight}" fill="${topDimensionTextStyle.fill}" stroke="${topDimensionTextStyle.stroke}" stroke-width="${topDimensionTextStyle.strokeWidth}" stroke-linejoin="${topDimensionTextStyle.strokeLinejoin}" paint-order="${topDimensionTextStyle.paintOrder}" ${dimensionTexts.top.transform ? `transform="${dimensionTexts.top.transform}"` : ""}>${dimensionTexts.top.text}</text>` : ""}
                ${dimensionTexts.side && sideDimensionTextStyle ? `<text x="${dimensionTexts.side.x}" y="${dimensionTexts.side.y}" text-anchor="middle" dominant-baseline="middle" font-size="${dimensionTexts.side.fontSize}" font-weight="${sideDimensionTextStyle.fontWeight}" fill="${sideDimensionTextStyle.fill}" stroke="${sideDimensionTextStyle.stroke}" stroke-width="${sideDimensionTextStyle.strokeWidth}" stroke-linejoin="${sideDimensionTextStyle.strokeLinejoin}" paint-order="${sideDimensionTextStyle.paintOrder}" ${dimensionTexts.side.transform ? `transform="${dimensionTexts.side.transform}"` : ""}>${dimensionTexts.side.text}</text>` : ""}
              </g>`
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
    viewBox="-18 -18 ${svgPresentation.viewBoxWidth} ${svgPresentation.viewBoxHeight}"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label="${stock.key} sheet ${sheet.index + 1} layout"
  >
    <g${svgPresentation.contentTransform ? ` transform="${svgPresentation.contentTransform}"` : ""}>
    <line x1="0" y1="-10" x2="${stock.boardWidth}" y2="-10" stroke="#9b8a75" stroke-width="0.9" />
    <line x1="0" y1="-13.5" x2="0" y2="-6.5" stroke="#9b8a75" stroke-width="0.9" />
    <line x1="${stock.boardWidth}" y1="-13.5" x2="${stock.boardWidth}" y2="-6.5" stroke="#9b8a75" stroke-width="0.9" />
    <text x="${stock.boardWidth / 2}" y="-12.5" text-anchor="middle" dominant-baseline="ideographic" font-size="5.2" font-weight="700" fill="#6b5a45">
      عرض اللوح ${formatCm(stock.boardWidth)}
    </text>
    <line x1="${stock.boardWidth + 10}" y1="0" x2="${stock.boardWidth + 10}" y2="${stock.boardLength}" stroke="#9b8a75" stroke-width="0.9" />
    <line x1="${stock.boardWidth + 6.5}" y1="0" x2="${stock.boardWidth + 13.5}" y2="0" stroke="#9b8a75" stroke-width="0.9" />
    <line x1="${stock.boardWidth + 6.5}" y1="${stock.boardLength}" x2="${stock.boardWidth + 13.5}" y2="${stock.boardLength}" stroke="#9b8a75" stroke-width="0.9" />
    <text x="${stock.boardWidth + 14}" y="${stock.boardLength / 2}" text-anchor="middle" dominant-baseline="middle" font-size="5.2" font-weight="700" fill="#6b5a45" transform="${getSheetLengthLabelTransform(stock)}">
      طول اللوح ${formatCm(stock.boardLength)}
    </text>
    <rect x="0" y="0" width="${stock.boardWidth}" height="${stock.boardLength}" fill="#fcfaf7" stroke="#d6cec2" stroke-width="1" rx="4" />
    ${piecesMarkup}
    </g>
  </svg>`;
}

function buildSingleSheetPrintDocument(
  projectName: string,
  stock: SheetLayoutStock,
  sheet: SheetLayoutStock["sheets"][number],
  partsMap: Map<string, CutlistPart>,
  projectPartLinkMap: Map<string, ProjectPartLink>,
  isRotated = false,
) {
  const stockLabel = getStockLabel(stock.thickness, stock.isBackStock);
  const sheetTitle = `${stockLabel} - لوح #${sheet.index + 1}`;
  const executionMarkup = buildSheetExecutionMarkup(
    stock,
    sheet,
    projectPartLinkMap,
  );
  const offcutsMarkup = buildSheetOffcutsMarkup(stock, sheet);

  return `<!doctype html>
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <title>${sheetTitle}</title>
      <style>
        @page { size: A4 portrait; margin: 14mm; }
        body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 24px; color: #1c1917; }
        h1, h2, h3 { margin: 0; }
        p { margin: 0; }
        .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 16px 0 18px; }
        .card { border: 1px solid #d6cec2; border-radius: 14px; padding: 12px 14px; background: #faf8f4; }
        .sheet-card { border: 1px solid #e7dfd4; border-radius: 16px; padding: 12px; background: #fff; }
        .sheet-card-head { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; color: #57534e; margin-bottom: 10px; }
        .sheet-svg-wrap { border: 1px solid #e7dfd4; border-radius: 14px; padding: 10px; background: linear-gradient(180deg,#edf3f4 0%,#dbe7e7 100%); }
        .sheet-svg-wrap svg { display: block; width: 100%; height: auto; border-radius: 12px; background: #fff; box-shadow: inset 0 0 0 1px rgba(201,215,222,0.96); }
        .sheet-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
        .sheet-detail-card { border: 1px solid #e7dfd4; border-radius: 14px; padding: 10px 12px; background: #fcfaf7; }
        .sheet-detail-card h4 { margin: 0 0 8px; font-size: 13px; }
        .sheet-detail-card p, .sheet-detail-card li { font-size: 12px; line-height: 1.8; color: #44403c; }
        .sheet-detail-card ol, .sheet-detail-card ul { margin: 0; padding-inline-start: 18px; }
        .sheet-detail-card li + li { margin-top: 4px; }
        .sheet-detail-meta { margin-bottom: 8px; color: #78716c; }
        .edge-band-note { margin: 0 0 12px; border: 1px solid #d6cec2; border-radius: 12px; padding: 10px 12px; background: #fff; color: #44403c; font-size: 12px; font-weight: 700; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>${projectName}</h1>
      <div class="meta">
        <div class="card">${sheetTitle}</div>
        <div class="card">${stock.materialSummary} • ${formatSheetSize(stock.boardLength, stock.boardWidth)}</div>
        <div class="card">استخدام هذه المجموعة ${stock.totalAreaM2} م²</div>
        <div class="card">${isRotated ? "تم تدوير عرض اللوح 90° قبل الطباعة." : "العرض الحالي مطابق لاتجاه اللوح الافتراضي."}</div>
      </div>
      <div class="edge-band-note">شريط الحافة يظهر بخط أسود متقطع على الضلع نفسه ليبقى واضحًا حتى في الطباعة الأبيض والأسود.</div>
      <article class="sheet-card">
        <div class="sheet-card-head">
          <span>لوح #${sheet.index + 1}</span>
          <span>مستخدم طوليًا ${formatCm(sheet.usedLength)} من ${formatCm(stock.boardLength)}</span>
        </div>
        <div class="sheet-svg-wrap">
          ${buildPrintSheetSvg(stock, sheet, partsMap, projectPartLinkMap, isRotated)}
        </div>
        <div class="sheet-details">
          ${executionMarkup}
          ${offcutsMarkup}
        </div>
      </article>
    </body>
  </html>`;
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

function estimateSheetLabelTextWidth(text: string, fontSize: number) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return 0;
  }

  return normalizedText.length * fontSize * 0.62;
}

function fitSheetLabelText(
  text: string,
  baseFontSize: number,
  availableSpan: number,
  minFontSize: number,
) {
  const safeText = text.trim();

  if (!safeText) {
    return {
      text: "",
      fontSize: minFontSize,
    };
  }

  return {
    text: safeText,
    fontSize: clampSheetLabelFontSize(
      Math.min(
        baseFontSize,
        availableSpan / Math.max(safeText.length * 0.62, 1),
      ),
      minFontSize,
      baseFontSize,
    ),
  };
}

function getSheetPiecePrimaryLabel(
  piece: SheetLayoutPiece,
  pieceLabel: ReturnType<typeof getSheetPieceLabelMode>,
  code?: string,
) {
  if (pieceLabel.mode !== "full") {
    return null;
  }

  const availableSpan = Math.max(
    8,
    (pieceLabel.rotate
      ? pieceLabel.displayPiece.height
      : pieceLabel.displayPiece.width) - 3.4,
  );
  const fullText = code ? `${code} • ${piece.name}` : piece.name;
  const fullFit = fitSheetLabelText(
    fullText,
    pieceLabel.nameFontSize,
    availableSpan,
    2.2,
  );

  if (
    estimateSheetLabelTextWidth(fullFit.text, fullFit.fontSize) <=
    availableSpan + 0.35
  ) {
    return fullFit;
  }

  if (code) {
    const codeOnlyFit = fitSheetLabelText(
      code,
      pieceLabel.nameFontSize,
      availableSpan,
      2.2,
    );
    const codePrefixWidth = estimateSheetLabelTextWidth(
      `${code} • `,
      codeOnlyFit.fontSize,
    );
    const nameCapacity = Math.max(
      0,
      Math.floor(
        (availableSpan - codePrefixWidth) / (codeOnlyFit.fontSize * 0.62),
      ),
    );

    if (nameCapacity >= 4) {
      const truncatedName =
        piece.name.length > nameCapacity
          ? `${piece.name.slice(0, Math.max(nameCapacity - 1, 1))}…`
          : piece.name;
      const truncatedFit = fitSheetLabelText(
        `${code} • ${truncatedName}`,
        pieceLabel.nameFontSize,
        availableSpan,
        2.2,
      );

      if (
        estimateSheetLabelTextWidth(truncatedFit.text, truncatedFit.fontSize) <=
        availableSpan + 0.35
      ) {
        return truncatedFit;
      }
    }

    return codeOnlyFit;
  }

  const nameCapacity = Math.max(
    3,
    Math.floor(availableSpan / Math.max(pieceLabel.nameFontSize * 0.62, 1)),
  );
  const truncatedName =
    piece.name.length > nameCapacity
      ? `${piece.name.slice(0, Math.max(nameCapacity - 1, 1))}…`
      : piece.name;

  return fitSheetLabelText(
    truncatedName,
    pieceLabel.nameFontSize,
    availableSpan,
    2.2,
  );
}

type SheetPieceDimensionText = {
  text: string;
  fontSize: number;
  x: number;
  y: number;
  transform?: string;
};

function getSheetPieceDimensionTextStyle(fontSize: number) {
  return {
    fill: "#0f172a",
    stroke: "#ffffff",
    strokeWidth: round2(Math.max(fontSize * 0.18, 0.34)),
    fontWeight: 700,
    paintOrder: "stroke fill" as const,
    strokeLinejoin: "round" as const,
  };
}

function getSheetEdgeDimensionTextTransform(
  axis: "top" | "side",
  position: { x: number; y: number },
  isSheetRotated = false,
) {
  if (axis === "top") {
    return isSheetRotated
      ? `rotate(90 ${position.x} ${position.y})`
      : undefined;
  }

  return isSheetRotated ? undefined : `rotate(-90 ${position.x} ${position.y})`;
}

function getSheetPieceDimensionTexts(
  piece: SheetLayoutPiece,
  pieceLabel: ReturnType<typeof getSheetPieceLabelMode>,
  isSheetRotated = false,
) {
  if (pieceLabel.mode === "none") {
    return {
      top: null,
      side: null,
    } satisfies {
      top: SheetPieceDimensionText | null;
      side: SheetPieceDimensionText | null;
    };
  }

  const displayPiece = pieceLabel.displayPiece;
  const logicalTopValue = piece.rotated ? piece.width : piece.length;
  const logicalSideValue = piece.rotated ? piece.length : piece.width;
  const topValue = isSheetRotated ? logicalSideValue : logicalTopValue;
  const sideValue = isSheetRotated ? logicalTopValue : logicalSideValue;
  const topBaseFontSize =
    pieceLabel.mode === "full"
      ? clampSheetLabelFontSize(
          Math.min(displayPiece.width / 10.5, displayPiece.height / 2.9),
          1.9,
          4,
        )
      : clampSheetLabelFontSize(
          Math.min(displayPiece.width / 9.5, displayPiece.height / 2.5),
          1.8,
          3.2,
        );
  const sideBaseFontSize =
    pieceLabel.mode === "full"
      ? clampSheetLabelFontSize(
          Math.min(displayPiece.height / 11.5, displayPiece.width / 2.8),
          1.8,
          3.4,
        )
      : clampSheetLabelFontSize(
          Math.min(displayPiece.height / 10.5, displayPiece.width / 2.5),
          1.7,
          2.9,
        );
  const topLabel = fitSheetLabelText(
    String(round2(topValue)),
    topBaseFontSize,
    Math.max(8, displayPiece.width - 4.4),
    1.7,
  );
  const sideLabel = fitSheetLabelText(
    String(round2(sideValue)),
    sideBaseFontSize,
    Math.max(8, displayPiece.height - 4.4),
    1.6,
  );
  const topPosition = {
    x: displayPiece.x + displayPiece.width / 2,
    y: displayPiece.y + Math.max(topLabel.fontSize * 0.95, 2.1),
  };
  const sidePosition = {
    x: displayPiece.x + Math.max(sideLabel.fontSize * 0.95, 1.9),
    y: displayPiece.y + displayPiece.height / 2,
  };

  return {
    top:
      displayPiece.height >= topLabel.fontSize * 2.2
        ? {
            text: topLabel.text,
            fontSize: topLabel.fontSize,
            x: topPosition.x,
            y: topPosition.y,
            transform: getSheetEdgeDimensionTextTransform(
              "top",
              topPosition,
              isSheetRotated,
            ),
          }
        : null,
    side:
      displayPiece.width >= sideLabel.fontSize * 2.2
        ? {
            text: sideLabel.text,
            fontSize: sideLabel.fontSize,
            x: sidePosition.x,
            y: sidePosition.y,
            transform: getSheetEdgeDimensionTextTransform(
              "side",
              sidePosition,
              isSheetRotated,
            ),
          }
        : null,
  } satisfies {
    top: SheetPieceDimensionText | null;
    side: SheetPieceDimensionText | null;
  };
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
    const fullNameFontSize = round2(
      (isTallPiece
        ? clampSheetLabelFontSize(
            Math.min(shortSide / 9.8, longSide / 16.2),
            2.4,
            3.8,
          )
        : clampSheetLabelFontSize(
            Math.min(shortSide / 6.2, longSide / 11.1),
            2.7,
            4.6,
          )) * 0.8,
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
      nameOffset: isTallPiece
        ? fullNameFontSize * 1.05
        : fullNameFontSize * 1.18,
      dimsOffset: isTallPiece
        ? fullDimsFontSize * 1.32
        : fullDimsFontSize * 1.45,
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

function isDoorFrontPart(part: CutlistPart) {
  return (
    part.kind === "front-main" ||
    part.kind === "front-upper" ||
    part.kind === "front-lower"
  );
}

function getDoorLeafHingeCount(part: CutlistPart) {
  if (!isDoorFrontPart(part)) {
    return 0;
  }

  return Math.max(part.length, part.width) >= 120 ? 3 : 2;
}

function calculateDoorHingeCount(parts: CutlistPart[]) {
  return parts.reduce(
    (sum, part) => sum + getDoorLeafHingeCount(part) * part.qty,
    0,
  );
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

function applyEditorNumericDraftsToInput(
  input: CabinetInput,
  drafts: Record<EditorNumericFieldKey, string>,
): CabinetInput {
  const nextInput: CabinetInput = { ...input };

  (Object.entries(drafts) as Array<[EditorNumericFieldKey, string]>).forEach(
    ([key, value]) => {
      const normalizedValue = normalizeNumericInput(value);

      if (normalizedValue.trim() === "") {
        nextInput[key] = 0;
        return;
      }

      const parsedValue = Number(normalizedValue);

      if (Number.isFinite(parsedValue)) {
        nextInput[key] = parsedValue;
      }
    },
  );

  return nextInput;
}

function hasCompleteUnitDimensions(input: CabinetInput) {
  if (input.width <= 0 || input.height <= 0 || input.depth <= 0) {
    return false;
  }

  if (
    input.cabinetType === "corner-l-base" ||
    input.cabinetType === "corner-l-wall"
  ) {
    return input.returnDepth > 0;
  }

  return true;
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
    hingePrice: getResettableFieldValue(settings.hingePrice),
  };
}

function getCustomPartProjectThickness(
  settings: ProjectSettings,
  category: PartCategory,
) {
  return category === "back" ? settings.backThickness : settings.boardThickness;
}

function getCustomPartThicknessDraftValue(
  settings: ProjectSettings,
  category: PartCategory,
) {
  return String(round2(getCustomPartProjectThickness(settings, category) * 10));
}

function inferCustomPartThicknessMode(
  part: Pick<CustomProjectPart, "category" | "thickness" | "thicknessMode">,
  settings: ProjectSettings,
): CustomProjectPartThicknessMode {
  if (part.thicknessMode) {
    return part.thicknessMode;
  }

  return Math.abs(
    part.thickness - getCustomPartProjectThickness(settings, part.category),
  ) <= 0.01
    ? "project"
    : "manual";
}

function syncCustomProjectPartWithSettings(
  part: CustomProjectPart,
  settings: ProjectSettings,
): CustomProjectPart {
  const thicknessMode = inferCustomPartThicknessMode(part, settings);

  return {
    ...part,
    thickness:
      thicknessMode === "project"
        ? getCustomPartProjectThickness(settings, part.category)
        : part.thickness,
    thicknessMode,
    material: settings.material,
    edgeBanding: part.edgeBanding ?? {},
  };
}

function syncCustomPartDraftWithProjectSettings(
  draft: CustomProjectPartDraft,
  settings: ProjectSettings,
): CustomProjectPartDraft {
  return {
    ...draft,
    material: settings.material,
    thickness:
      draft.thicknessMode === "project"
        ? getCustomPartThicknessDraftValue(settings, draft.category)
        : draft.thickness,
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
    thickness: getCustomPartThicknessDraftValue(settings, "carcass"),
    thicknessMode: "project",
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
  settings: ProjectSettings,
): CutlistPart {
  const normalizedEntry = syncCustomProjectPartWithSettings(entry, settings);

  return {
    id: `custom-part-piece-${normalizedEntry.id}`,
    kind: "custom",
    name: normalizedEntry.title,
    category: normalizedEntry.category,
    qty: normalizedEntry.qty,
    length: normalizedEntry.length,
    width: normalizedEntry.width,
    thickness: normalizedEntry.thickness,
    material: normalizedEntry.material,
    notes:
      normalizedEntry.category === "back"
        ? "مقاس حر خارج الوحدات على لوح ظهر"
        : "مقاس حر خارج الوحدات",
    edgeBanding: normalizedEntry.edgeBanding ?? {},
    grainDirection: normalizedEntry.grainDirection,
    allowRotation: normalizedEntry.grainDirection === "free",
  };
}

function normalizeProjectSettings(settings?: Partial<ProjectSettings> | null) {
  const mergedSettings = {
    ...defaultProjectSettings,
    ...(settings ?? {}),
  } satisfies ProjectSettings;
  const boardSheetSize = normalizeSheetStockSize({
    length: mergedSettings.boardSheetLength,
    width: mergedSettings.boardSheetWidth,
  });
  const backSheetSize = normalizeSheetStockSize({
    length: mergedSettings.backSheetLength,
    width: mergedSettings.backSheetWidth,
  });

  return {
    ...mergedSettings,
    boardSheetLength: boardSheetSize.length,
    boardSheetWidth: boardSheetSize.width,
    backSheetLength: backSheetSize.length,
    backSheetWidth: backSheetSize.width,
  } satisfies ProjectSettings;
}

async function requestApi<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const isJsonResponse =
    response.headers.get("content-type")?.includes("application/json") ?? false;
  const payload = isJsonResponse ? ((await response.json()) as unknown) : null;

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? String((payload as { message?: string }).message)
        : "حدث خطأ غير متوقع.";

    throw new ApiRequestError(message, response.status);
  }

  return payload as T;
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
    optimizationMode: settings.optimizationMode,
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
  const initialProjectSettings = defaultProjectSettings;
  const skipProjectSettingsSyncRef = useRef(true);
  const lastSavedProjectArrangementKeyRef = useRef<string | null>(null);
  const projectArrangementAutosaveRequestIdRef = useRef(0);
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTab>("builder");
  const [activeBuilderTab, setActiveBuilderTab] = useState<BuilderTab>("unit");
  const [pendingWorkspaceTab, setPendingWorkspaceTab] =
    useState<WorkspaceTab | null>(null);
  const [isWorkspaceTransitionPending, startWorkspaceTransition] =
    useTransition();
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );
  const [openResultsSections, setOpenResultsSections] = useState<
    Record<ResultsSectionKey, boolean>
  >({
    costs: true,
    layout: true,
    metrics: false,
    workshop: false,
    parts: false,
  });
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState<AuthFormState>({
    name: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<PersistedUser | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [projectName, setProjectName] = useState("مشروع جديد");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [edgeBandOverrides, setEdgeBandOverrides] =
    useState<EdgeBandOverrideMap>({});
  const [isProjectLibraryOpen, setIsProjectLibraryOpen] = useState(false);
  const [isUnitPresetOpen, setIsUnitPresetOpen] = useState(false);
  const [projectActionMessage, setProjectActionMessage] = useState<
    string | null
  >(null);
  const [projectArrangementAutosaveState, setProjectArrangementAutosaveState] =
    useState<ProjectArrangementAutosaveState>("idle");
  const [projectArrangementAutosaveError, setProjectArrangementAutosaveError] =
    useState<string | null>(null);
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
    const basePart = buildCustomProjectCutlistPart(entry, projectSettings);

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
  const projectOptimizationRecommendations =
    buildProjectOptimizationRecommendations(
      projectParts,
      projectSheetLayout,
      projectSettings,
    );
  const projectFrontPieceCount = projectParts
    .filter((part) => part.category === "front")
    .reduce((sum, part) => sum + part.qty, 0);
  const projectMaterialSummary = materialLabels[projectSettings.material];
  const normalizedProjectArrangement = buildProjectArrangement(
    units,
    projectArrangement,
  );
  const projectArrangementAutosaveKey = buildProjectArrangementAutosaveKey(
    currentProjectId,
    normalizedProjectArrangement,
  );
  const projectArrangementTravelLimitCm =
    getProjectArrangementTravelLimit(units);
  const projectPreviewUnits = buildProjectPreviewUnits(
    units,
    normalizedProjectArrangement,
  );
  const projectArrangementAutosaveMessage =
    currentProjectId && authStatus === "authenticated"
      ? projectArrangementAutosaveState === "saving"
        ? "جاري حفظ ترتيب الوحدات تلقائيا..."
        : projectArrangementAutosaveState === "saved"
          ? "تم حفظ ترتيب الوحدات تلقائيا."
          : projectArrangementAutosaveState === "error"
            ? (projectArrangementAutosaveError ??
              "تعذر حفظ ترتيب الوحدات تلقائيا.")
            : null
      : null;
  const projectArrangementAutosaveToneClassName =
    projectArrangementAutosaveState === "error"
      ? "text-slate-700"
      : projectArrangementAutosaveState === "saving"
        ? "text-sky-700"
        : "text-teal-700";
  const syncSavedProjectsFromBootstrap = useCallback(
    (bootstrap: SessionBootstrap) => {
      if (bootstrap.user) {
        setCurrentUser(bootstrap.user);
      }

      setSavedProjects(normalizeSavedProjects(bootstrap.savedProjects));
    },
    [],
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
    const hingeCount = calculateDoorHingeCount(view.result.parts);
    const hingeCost = round2(hingeCount * projectSettings.hingePrice);

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
      hingeCount,
      hingeCost,
      totalCost: round2(sheetCost + laborCost + edgeBandCost + hingeCost),
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
  const projectHingeCount = calculateDoorHingeCount(projectParts);
  const projectHingeCost = round2(
    projectHingeCount * projectSettings.hingePrice,
  );
  const projectTotalCost = round2(
    projectSheetCost +
      projectLaborCost +
      projectEdgeBandCost +
      projectHingeCost,
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
  const activeWorkspaceTransitionTab = isWorkspaceTransitionPending
    ? pendingWorkspaceTab
    : null;
  const isPreviewTransitionPending =
    activeWorkspaceTransitionTab === "preview";
  const isResultsTransitionPending =
    activeWorkspaceTransitionTab === "results";
  const deletingProject = deletingProjectId
    ? savedProjects.find((project) => project.id === deletingProjectId) ?? null
    : null;
  const workspaceTransitionMessage =
    activeWorkspaceTransitionTab === "preview"
      ? "جاري فتح تبويب 3D..."
      : activeWorkspaceTransitionTab === "results"
        ? "جاري تجهيز النتائج..."
        : null;
  const blockingOverlayMessage = deletingProjectId
    ? "جاري حذف المشروع..."
    : workspaceTransitionMessage;
  const blockingOverlayDescription = deletingProjectId
    ? deletingProject
      ? `يتم الآن حذف ${deletingProject.name} من حسابك الحالي.`
      : "يتم الآن حذف المشروع من حسابك الحالي."
    : workspaceTransitionMessage
      ? "سيتم نقل الواجهة فور انتهاء تجهيز الشاشة المطلوبة."
      : null;
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
              label: isResultsTransitionPending
                ? "جاري تجهيز النتائج..."
                : "احسب المشروع",
              icon: isResultsTransitionPending ? RotateCw : Calculator,
              onClick: calculateUnits,
              disabled: projectItemCount === 0 || isResultsTransitionPending,
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
              label: isResultsTransitionPending
                ? "جاري تجهيز النتائج..."
                : "احسب المشروع",
              icon: isResultsTransitionPending ? RotateCw : Calculator,
              onClick: calculateUnits,
              disabled: projectItemCount === 0 || isResultsTransitionPending,
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
      totalHingeCount: projectHingeCount,
      totalHingeCost: projectHingeCost,
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
      totalHingeCount: 0,
      totalHingeCost: 0,
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
  projectSummary.totalHingeCount = projectHingeCount;
  projectSummary.totalHingeCost = projectHingeCost;
  projectSummary.totalProjectCost = projectTotalCost;
  const activeWorkspaceTabConfig =
    workspaceTabs.find((tab) => tab.id === activeWorkspaceTab) ??
    workspaceTabs[0];
  const ActiveWorkspaceIcon = activeWorkspaceTabConfig.icon;
  const dashboardRecommendations: ProjectOptimizationRecommendation[] =
    projectOptimizationRecommendations.length > 0
      ? projectOptimizationRecommendations.slice(0, 3)
      : [
          {
            id: "dashboard-start",
            title: "ابدأ من الوحدات الأساسية",
            body: "أضف أول وحدة أو مقاس حر، ثم احسب المشروع لتبدأ الألواح والتكلفة في الظهور داخل لوحة التنفيذ.",
            tone: "info",
          },
          {
            id: "dashboard-grain",
            title: "ثبت اتجاه الثمرة قبل القص",
            body: "إذا كانت الخامة كونتر أو ميلامين، راجع اتجاه الثمرة مبكرًا حتى لا تتغير نتيجة التوزيع لاحقًا داخل الورشة.",
            tone: "action",
          },
          {
            id: "dashboard-cost",
            title: "أدخل أسعار الورشة من البداية",
            body: "سعر اللوح، شريط الحافة، والمفصلة يجعل لوحة المشروع أقرب للقرار الحقيقي بدل مجرد مقاسات هندسية.",
            tone: "info",
          },
        ];
  const dashboardRailUnits = units.slice(0, 3);
  const dashboardRecentProjects = savedProjects.slice(0, 2);
  const dashboardLeadUnit = activeProjectPreviewUnit ?? projectPreviewUnits[0];
  const dashboardLeadUnitSizeLabel = dashboardLeadUnit
    ? `${round2(dashboardLeadUnit.input.width)} × ${round2(dashboardLeadUnit.input.height)} × ${round2(dashboardLeadUnit.input.depth)} سم`
    : null;
  const dashboardFocusTitle =
    activeWorkspaceTab === "builder"
      ? "محطة الإدخال"
      : activeWorkspaceTab === "preview"
        ? "مسرح المشروع"
        : activeWorkspaceTab === "results"
          ? "لوحة التنفيذ"
          : activeWorkspaceTab === "project"
            ? "إدارة المشروع"
            : "مكتبة المشروع";
  const dashboardFocusDescription =
    activeWorkspaceTab === "builder"
      ? "أدخل الوحدات والمقاسات الحرة من نفس المحطة، ثم انتقل مباشرة للمعاينة أو النتائج بدون فقد سياق المشروع."
      : activeWorkspaceTab === "preview"
        ? "راجع تموضع الوحدات، افتح الدلف، وحرّك المشهد قبل اعتماد القص النهائي أو الطباعة."
        : activeWorkspaceTab === "results"
          ? "نتائج الألواح والتكلفة والتوصيات العملية أصبحت في واجهة أقرب لمنطق التنفيذ اليومي داخل الورشة."
          : activeWorkspaceTab === "project"
            ? "مركز المشروع يجمع الحفظ، الإعدادات، والإجراءات الرئيسية بدل توزيعها في عدة أماكن منفصلة."
            : "الوحدات الجاهزة والمشاريع المحفوظة تبقى ضمن نفس لغة الواجهة بدل شاشة منفصلة عن بقية النظام.";
  const dashboardTopMetrics = [
    {
      label: "إجمالي الألواح",
      value: hasCalculatedProject ? `${projectSummary.totalSheets}` : "--",
      note: hasCalculatedProject ? `${projectMaterialSummary}` : "بعد الحساب",
    },
    {
      label: "الهالك التقريبي",
      value: hasCalculatedProject ? `${projectLayoutWastePercent}%` : "--",
      note: hasCalculatedProject
        ? (projectWasteInsight ?? "قراءة سريعة للهالك")
        : "سيظهر بعد التوزيع",
    },
    {
      label: "المفصلات",
      value: hasCalculatedProject ? `${projectSummary.totalHingeCount}` : "--",
      note: hasCalculatedProject
        ? formatPrice(projectSummary.totalHingeCost)
        : "مرتبطة بنوع الواجهة",
    },
    {
      label: "إجمالي التكلفة",
      value: hasCalculatedProject
        ? formatPrice(projectSummary.totalProjectCost)
        : "--",
      note: hasCalculatedProject
        ? "خامة + شريط + مفصلات + مصنعية"
        : "يظهر بعد الحساب",
    },
  ] as const;
  const dashboardProjectRailSettings = [
    {
      label: "الخامة",
      value: projectMaterialSummary,
    },
    {
      label: "سمك اللوح",
      value: formatMmFromCm(projectSettings.boardThickness),
    },
    {
      label: "لوح القص",
      value: formatSheetSize(
        projectSettings.boardSheetLength,
        projectSettings.boardSheetWidth,
      ),
    },
    {
      label: "سعر المفصلة",
      value: `${formatPrice(projectSettings.hingePrice)}/قطعة`,
    },
  ] as const;
  const stageDrawerSceneUnits =
    dashboardRailUnits.length > 0
      ? dashboardRailUnits.map((unit) => ({
          id: unit.id,
          title: unit.title,
          width: unit.width,
          height: unit.height,
          depth: unit.depth,
          frontLabel: frontOptionLabels[unit.frontOption as FrontOption],
        }))
      : hasEditorCompleteDimensions
        ? [
            {
              id: "draft-stage-unit",
              title: editorTitle || "الوحدة الحالية",
              width: editorInput.width,
              height: editorInput.height,
              depth: editorInput.depth,
              frontLabel: frontOptionLabels[editorInput.frontOption],
            },
          ]
        : [];
  const stageDrawerSceneStatusLabel =
    projectPreviewUnits.length > 1
      ? `المشروع • ${projectPreviewUnits.length} وحدات`
      : stageDrawerSceneUnits.length === 1
        ? "الوحدة النشطة"
        : "بانتظار الإدخال";
  const operatorFocusCards =
    activeWorkspaceTab === "builder"
      ? [
          {
            label: "اسم الوحدة",
            value: editorTitle || "وحدة جديدة",
          },
          {
            label: "نوع الوحدة",
            value: cabinetTypeLabels[editorInput.cabinetType],
          },
          {
            label: "الواجهة",
            value: frontOptionLabels[editorInput.frontOption],
          },
          {
            label: "المقاس",
            value: hasEditorCoreDimensions
              ? `${formatCm(editorInput.width)} × ${formatCm(editorInput.height)} × ${formatCm(editorInput.depth)}`
              : "أدخل المقاسات الأساسية",
          },
          {
            label: "اتجاه الثمرة",
            value: grainDirectionLabels[editorInput.grainDirection],
          },
          {
            label: "عدد الواجهات",
            value: `${editorFrontPieceCount}`,
          },
        ]
      : activeWorkspaceTab === "preview"
        ? [
            {
              label: "الوحدة النشطة",
              value: dashboardLeadUnit?.title ?? "بانتظار الإدخال",
            },
            {
              label: "المشهد",
              value: stageDrawerSceneStatusLabel,
            },
            {
              label: "المقاس",
              value: dashboardLeadUnitSizeLabel ?? "أضف أول وحدة للمراجعة",
            },
            {
              label: "الوحدات في 3D",
              value: `${projectPreviewUnits.length}`,
            },
            {
              label: "الطباعة",
              value: projectPreviewUnits.length > 0 ? "متاحة" : "معطلة",
            },
            {
              label: "الترتيب",
              value:
                projectPreviewUnits.length > 1
                  ? "مشروع متعدد الوحدات"
                  : "مشهد أولي",
            },
          ]
        : activeWorkspaceTab === "results"
          ? [
              {
                label: "إجمالي القطع",
                value: hasCalculatedProject ? `${projectParts.length}` : "--",
              },
              {
                label: "إجمالي الألواح",
                value: hasCalculatedProject
                  ? `${projectSummary.totalSheets}`
                  : "--",
              },
              {
                label: "إجمالي التكلفة",
                value: hasCalculatedProject
                  ? formatPrice(projectSummary.totalProjectCost)
                  : "--",
              },
              {
                label: "الهالك",
                value: hasCalculatedProject
                  ? `${projectLayoutWastePercent}%`
                  : "--",
              },
              {
                label: "المفصلات",
                value: hasCalculatedProject
                  ? `${projectSummary.totalHingeCount}`
                  : "--",
              },
              {
                label: "شريط الحافة",
                value: hasCalculatedProject
                  ? `${round2(projectSummary.totalEdgeBandLengthM)} م`
                  : "--",
              },
            ]
          : activeWorkspaceTab === "project"
            ? [
                {
                  label: "اسم المشروع",
                  value: projectName,
                },
                {
                  label: "الحساب",
                  value: currentUser.name,
                },
                {
                  label: "الوحدات",
                  value: `${units.length}`,
                },
                {
                  label: "المقاسات الحرة",
                  value: `${customParts.length}`,
                },
                {
                  label: "المحفوظات",
                  value: `${savedProjects.length}`,
                },
                {
                  label: "الحفظ",
                  value:
                    projectArrangementAutosaveMessage ??
                    (currentProjectId ? "جاهز للتحديث" : "احفظ المشروع أولًا"),
                },
              ]
            : [
                {
                  label: "المشاريع المحفوظة",
                  value: `${savedProjects.length}`,
                },
                {
                  label: "الوحدات الجاهزة",
                  value: `${unitPresets.length}`,
                },
                {
                  label: "آخر مشروع",
                  value: dashboardRecentProjects[0]?.name ?? "لا توجد محفوظات",
                },
                {
                  label: "العناصر الحالية",
                  value: `${projectItemCount}`,
                },
                {
                  label: "الخامة",
                  value: projectMaterialSummary,
                },
                {
                  label: "الحساب",
                  value: currentUser.name,
                },
              ];
  const operatorActionNote =
    activeWorkspaceTab === "builder"
      ? activeBuilderTab === "unit"
        ? "أكمل المقاسات الأساسية ثم أضف الوحدة مباشرة إلى قائمة المشروع."
        : activeBuilderTab === "custom"
          ? "أدخل أبعاد القطعة الحرة ثم احفظها قبل الانتقال للحساب."
          : "راجع العناصر الحالية ثم شغّل الحساب لاستخراج الألواح والتكلفة."
      : activeWorkspaceTab === "preview"
        ? "افتح المسرح الكامل أو اطبع لقطة بعد اكتمال ترتيب الوحدات."
        : activeWorkspaceTab === "results"
          ? "راجع التوصيات ثم اطبع أو صدّر ملخص المشروع النهائي."
          : activeWorkspaceTab === "project"
            ? "حدّث اسم المشروع واحفظه أو افتح مشروعًا آخر من المكتبة."
            : "افتح المكتبة لتحميل مشروع محفوظ أو وحدة جاهزة إلى المحرر.";
  const operatorDecisionStats = [
    {
      label: "الوحدات",
      value: `${units.length}`,
    },
    {
      label: "المفصلات",
      value: hasCalculatedProject ? `${projectSummary.totalHingeCount}` : "--",
    },
    {
      label: "الهالك",
      value: hasCalculatedProject ? `${projectLayoutWastePercent}%` : "--",
    },
    {
      label: "المحفوظات",
      value: `${savedProjects.length}`,
    },
  ] as const;

  useEffect(() => {
    if (authStatus !== "authenticated") {
      skipProjectSettingsSyncRef.current = true;
      return;
    }

    if (skipProjectSettingsSyncRef.current) {
      skipProjectSettingsSyncRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void requestApi<SessionBootstrap>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ settings: projectSettings }),
      }).catch((error) => {
        announceProjectAction(
          error instanceof Error
            ? error.message
            : "تعذر حفظ إعدادات المشروع الآن.",
        );
      });
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authStatus, projectSettings]);

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

  useEffect(() => {
    if (projectArrangementAutosaveState !== "saved") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setProjectArrangementAutosaveState((current) =>
        current === "saved" ? "idle" : current,
      );
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [projectArrangementAutosaveState]);

  useEffect(() => {
    if (
      authStatus !== "authenticated" ||
      !currentProjectId ||
      !projectArrangementAutosaveKey ||
      lastSavedProjectArrangementKeyRef.current ===
        projectArrangementAutosaveKey
    ) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (
        lastSavedProjectArrangementKeyRef.current ===
        projectArrangementAutosaveKey
      ) {
        return;
      }

      const requestId = projectArrangementAutosaveRequestIdRef.current + 1;
      projectArrangementAutosaveRequestIdRef.current = requestId;
      setProjectArrangementAutosaveState("saving");
      setProjectArrangementAutosaveError(null);

      const { snapshot } = buildSavedProjectSnapshot(
        currentProjectId,
        projectName,
        projectSettings,
        units,
        customParts,
        normalizedProjectArrangement,
        edgeBandOverrides,
      );

      void requestApi<SessionBootstrap>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ project: snapshot }),
      })
        .then((bootstrap) => {
          if (projectArrangementAutosaveRequestIdRef.current !== requestId) {
            return;
          }

          syncSavedProjectsFromBootstrap(bootstrap);
          lastSavedProjectArrangementKeyRef.current =
            buildProjectArrangementAutosaveKey(
              snapshot.id,
              snapshot.arrangement,
            );
          setProjectArrangementAutosaveState("saved");
        })
        .catch((error) => {
          if (projectArrangementAutosaveRequestIdRef.current !== requestId) {
            return;
          }

          setProjectArrangementAutosaveState("error");
          setProjectArrangementAutosaveError(
            error instanceof Error
              ? error.message
              : "تعذر حفظ ترتيب الوحدات تلقائيا.",
          );
        });
    }, 850);

    return () => window.clearTimeout(timeoutId);
  }, [
    authStatus,
    currentProjectId,
    customParts,
    edgeBandOverrides,
    normalizedProjectArrangement,
    projectArrangementAutosaveKey,
    projectName,
    projectSettings,
    syncSavedProjectsFromBootstrap,
    units,
  ]);

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
    setCustomPartDraft((current) => {
      if (key === "thickness") {
        return {
          ...current,
          thickness: value as CustomProjectPartDraft["thickness"],
          thicknessMode: "manual",
        };
      }

      if (key === "category") {
        const category = value as PartCategory;

        return {
          ...current,
          category,
          thickness:
            current.thicknessMode === "project"
              ? getCustomPartThicknessDraftValue(projectSettings, category)
              : current.thickness,
        };
      }

      return {
        ...current,
        [key]: value,
      };
    });
  }

  function useProjectThicknessForCustomPartDraft() {
    setCustomPartDraft((current) => ({
      ...current,
      thicknessMode: "project",
      thickness: getCustomPartThicknessDraftValue(
        projectSettings,
        current.category,
      ),
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

  function updateAuthField(
    field: keyof AuthFormState,
    value: AuthFormState[keyof AuthFormState],
  ) {
    setAuthForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const applyAuthenticatedSession = useCallback(
    (bootstrap: SessionBootstrap, message: string | null) => {
      const nextSettings = normalizeProjectSettings(bootstrap.projectSettings);
      const nextEditorInput = buildEmptyEditorInput(nextSettings);

      skipProjectSettingsSyncRef.current = true;
      lastSavedProjectArrangementKeyRef.current = null;
      projectArrangementAutosaveRequestIdRef.current += 1;
      setCurrentUser(bootstrap.user);
      setSavedProjects(normalizeSavedProjects(bootstrap.savedProjects));
      setAuthStatus("authenticated");
      setAuthError(null);
      setProjectName("مشروع جديد");
      setCurrentProjectId(null);
      setProjectArrangementAutosaveState("idle");
      setProjectArrangementAutosaveError(null);
      setProjectSettings(nextSettings);
      setProjectSettingsDrafts(buildProjectSettingsDrafts(nextSettings));
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
      setEditorTitle(createUnitTitle(0));
      setEditorInput(nextEditorInput);
      setEditorNumericDrafts(buildEditorNumericDrafts(nextEditorInput));
      setEditingUnitId(null);
      setSelectedPartId(null);
      setCustomPartDraft(buildEmptyCustomPartDraft(nextSettings));
      setEditingCustomPartId(null);

      if (message) {
        setProjectActionMessage(message);
      }
    },
    [],
  );

  const applyAnonymousSession = useCallback((message: string | null) => {
    const nextEditorInput = buildEmptyEditorInput(defaultProjectSettings);

    skipProjectSettingsSyncRef.current = true;
    lastSavedProjectArrangementKeyRef.current = null;
    projectArrangementAutosaveRequestIdRef.current += 1;
    setAuthStatus("anonymous");
    setCurrentUser(null);
    setSavedProjects([]);
    setProjectName("مشروع جديد");
    setCurrentProjectId(null);
    setProjectArrangementAutosaveState("idle");
    setProjectArrangementAutosaveError(null);
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
    setEditorTitle(createUnitTitle(0));
    setEditorInput(nextEditorInput);
    setEditorNumericDrafts(buildEditorNumericDrafts(nextEditorInput));
    setEditingUnitId(null);
    setSelectedPartId(null);
    setCustomPartDraft(buildEmptyCustomPartDraft(defaultProjectSettings));
    setEditingCustomPartId(null);

    if (message) {
      setProjectActionMessage(message);
    }
  }, []);

  async function submitAuthForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      const endpoint =
        authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        authMode === "register"
          ? authForm
          : {
              email: authForm.email,
              password: authForm.password,
            };
      const bootstrap = await requestApi<SessionBootstrap>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      applyAuthenticatedSession(
        bootstrap,
        authMode === "register"
          ? `تم إنشاء الحساب باسم ${bootstrap.user?.name ?? "المستخدم الجديد"}.`
          : `تم تسجيل الدخول باسم ${bootstrap.user?.name ?? "المستخدم الحالي"}.`,
      );
      setAuthForm({ name: "", email: "", password: "" });
      setAuthMode("login");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "تعذر تنفيذ العملية الآن.",
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function logoutCurrentUser() {
    try {
      await requestApi<{ ok: boolean }>("/api/auth/logout", {
        method: "POST",
      });
      setAuthForm((current) => ({
        ...current,
        password: "",
      }));
      setIsProjectLibraryOpen(false);
      setIsProjectSettingsOpen(false);
      setIsUnitPresetOpen(false);
      applyAnonymousSession("تم تسجيل الخروج.");
    } catch (error) {
      announceProjectAction(
        error instanceof Error ? error.message : "تعذر تسجيل الخروج الآن.",
      );
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function hydrateSession() {
      try {
        const bootstrap = await requestApi<SessionBootstrap>(
          "/api/auth/session",
          { method: "GET" },
        );

        if (isCancelled) {
          return;
        }

        if (!bootstrap.user) {
          applyAnonymousSession(null);
          return;
        }

        applyAuthenticatedSession(bootstrap, null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setAuthError(
          error instanceof Error
            ? error.message
            : "تعذر تحميل بيانات الحساب الحالية.",
        );
        applyAnonymousSession(null);
      }
    }

    void hydrateSession();

    return () => {
      isCancelled = true;
    };
  }, [applyAnonymousSession, applyAuthenticatedSession]);

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
    const thicknessMm =
      customPartDraft.thicknessMode === "project"
        ? round2(
            getCustomPartProjectThickness(
              projectSettings,
              customPartDraft.category,
            ) * 10,
          )
        : Number(normalizeNumericInput(customPartDraft.thickness));

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
      thicknessMode: customPartDraft.thicknessMode,
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
    const normalizedEntry = syncCustomProjectPartWithSettings(
      entry,
      projectSettings,
    );

    setActiveWorkspaceTab("builder");
    setActiveBuilderTab("custom");
    setEditingCustomPartId(normalizedEntry.id);
    setCustomPartDraft({
      title: normalizedEntry.title,
      length: String(round2(normalizedEntry.length)),
      width: String(round2(normalizedEntry.width)),
      qty: String(normalizedEntry.qty),
      thickness: String(round2(normalizedEntry.thickness * 10)),
      thicknessMode: inferCustomPartThicknessMode(
        normalizedEntry,
        projectSettings,
      ),
      material: projectSettings.material,
      category: normalizedEntry.category,
      grainDirection: normalizedEntry.grainDirection,
      edgeBanding: { ...(normalizedEntry.edgeBanding ?? {}) },
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
    const {
      title,
      nextUnitInput,
      nextEditorInput,
      nextEditorNumericDrafts,
    } = resolveEditorCommitState();

    setEditorTitle(title);
    setEditorInput(nextEditorInput);
    setEditorNumericDrafts(nextEditorNumericDrafts);

    if (!hasCompleteUnitDimensions(nextUnitInput)) {
      announceProjectAction(
        "أدخل العرض والارتفاع والعمق كاملين قبل إضافة الوحدة.",
      );
      return;
    }

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
    if (
      (units.length === 0 && customParts.length === 0) ||
      isWorkspaceTransitionPending ||
      deletingProjectId !== null
    ) {
      return;
    }

    setPendingWorkspaceTab("results");
    startWorkspaceTransition(() => {
      setActiveWorkspaceTab("results");
      setCalculatedUnits(units.map((unit) => ({ ...unit })));
      setCalculatedCustomParts(customParts.map((part) => ({ ...part })));
      setSelectedCalculatedUnitId(units[0]?.id ?? null);
      setSelectedPartId(null);
    });
  }

  function navigateToWorkspaceTab(tab: WorkspaceTab) {
    if (
      tab === activeWorkspaceTab ||
      isWorkspaceTransitionPending ||
      deletingProjectId !== null
    ) {
      return;
    }

    if (!isSlowWorkspaceTab(tab)) {
      setActiveWorkspaceTab(tab);
      return;
    }

    setPendingWorkspaceTab(tab);
    startWorkspaceTransition(() => {
      setActiveWorkspaceTab(tab);
    });
  }

  function resolveEditorCommitState() {
    const inputIdsByField: Record<EditorNumericFieldKey, string> = {
      width: "width",
      height: "height",
      depth: "depth",
      returnDepth: "returnDepth",
      shelfCount: "shelves",
      drawerCount: "drawerCount",
      doorLeafCount: "doorLeafCount",
    };

    const nextEditorNumericDrafts = { ...editorNumericDrafts };

    (Object.entries(inputIdsByField) as Array<
      [EditorNumericFieldKey, string]
    >).forEach(([key, inputId]) => {
      const element = document.getElementById(inputId);

      if (element instanceof HTMLInputElement) {
        nextEditorNumericDrafts[key] = normalizeNumericInput(element.value);
      }
    });

    const titleElement = document.getElementById("unitTitle");
    const titleValue =
      titleElement instanceof HTMLInputElement
        ? titleElement.value
        : editorTitle;
    const title = titleValue.trim() || createUnitTitle(units.length);
    const nextEditorInput = applyEditorNumericDraftsToInput(
      editorInput,
      nextEditorNumericDrafts,
    );

    return {
      title,
      nextEditorNumericDrafts,
      nextEditorInput,
      nextUnitInput: applyProjectSettingsToInput(
        nextEditorInput,
        projectSettings,
      ),
    };
  }

  function resolvePendingUnitForProjectSave() {
    if (activeBuilderTab !== "unit") {
      return {
        nextUnits: units,
        nextArrangement: normalizedProjectArrangement,
        shouldCommitDraft: false,
        nextActiveUnitId: activeProjectUnitId,
        nextEditorIndex: units.length,
      };
    }

    const { title, nextUnitInput } = resolveEditorCommitState();

    if (editingUnitId) {
      const nextUnits = units.map((unit) =>
        unit.id === editingUnitId
          ? { ...nextUnitInput, id: editingUnitId, title }
          : unit,
      );

      return {
        nextUnits,
        nextArrangement: buildProjectArrangement(nextUnits, projectArrangement),
        shouldCommitDraft: true,
        nextActiveUnitId: editingUnitId,
        nextEditorIndex: nextUnits.length,
      };
    }

    if (!hasCompleteUnitDimensions(nextUnitInput)) {
      return {
        nextUnits: units,
        nextArrangement: normalizedProjectArrangement,
        shouldCommitDraft: false,
        nextActiveUnitId: activeProjectUnitId,
        nextEditorIndex: units.length,
      };
    }

    const nextId = createUnitId();
    const nextUnits = [
      ...units,
      {
        ...nextUnitInput,
        id: nextId,
        title,
      },
    ];

    return {
      nextUnits,
      nextArrangement: buildProjectArrangement(nextUnits, [
        ...projectArrangement,
        { id: nextId, offsetX: 0, offsetY: 0, offsetZ: 0, rotationY: 0 },
      ]),
      shouldCommitDraft: true,
      nextActiveUnitId: nextId,
      nextEditorIndex: nextUnits.length,
    };
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

    applyAuthenticatedSession(
      {
        user: currentUser,
        projectSettings,
        savedProjects,
      },
      "تم فتح مشروع جديد.",
    );
  }

  async function saveCurrentProject() {
    const nextProjectId = currentProjectId ?? createProjectId();
    const pendingUnitResolution = resolvePendingUnitForProjectSave();
    const { trimmedName, snapshot } = buildSavedProjectSnapshot(
      nextProjectId,
      projectName,
      projectSettings,
      pendingUnitResolution.nextUnits,
      customParts,
      pendingUnitResolution.nextArrangement,
      edgeBandOverrides,
    );

    try {
      const bootstrap = await requestApi<SessionBootstrap>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ project: snapshot }),
      });

      syncSavedProjectsFromBootstrap(bootstrap);
      lastSavedProjectArrangementKeyRef.current =
        buildProjectArrangementAutosaveKey(snapshot.id, snapshot.arrangement);
      setProjectArrangementAutosaveState("idle");
      setProjectArrangementAutosaveError(null);
      setCurrentProjectId(nextProjectId);
      setProjectName(trimmedName);

      if (pendingUnitResolution.shouldCommitDraft) {
        setUnits(pendingUnitResolution.nextUnits);
        setProjectArrangement(pendingUnitResolution.nextArrangement);
        setActiveProjectUnitId(pendingUnitResolution.nextActiveUnitId);
        invalidateCalculatedState();
        resetEditor(pendingUnitResolution.nextEditorIndex);
      }

      announceProjectAction(`تم حفظ ${trimmedName} على الحساب الحالي.`);
    } catch (error) {
      announceProjectAction(
        error instanceof Error ? error.message : "تعذر حفظ المشروع الآن.",
      );
    }
  }

  function loadSavedProject(project: SavedProject) {
    const normalizedSettings = normalizeProjectSettings(project.settings);
    const nextArrangement = buildProjectArrangement(
      project.units,
      project.arrangement,
    );
    lastSavedProjectArrangementKeyRef.current =
      buildProjectArrangementAutosaveKey(project.id, nextArrangement);
    projectArrangementAutosaveRequestIdRef.current += 1;
    setCurrentProjectId(project.id);
    setProjectName(project.name);
    setProjectArrangementAutosaveState("idle");
    setProjectArrangementAutosaveError(null);
    setProjectSettings(normalizedSettings);
    setProjectSettingsDrafts(buildProjectSettingsDrafts(normalizedSettings));
    setUnits(project.units);
    setCustomParts(
      (project.customParts ?? []).map((part) =>
        syncCustomProjectPartWithSettings(part, normalizedSettings),
      ),
    );
    setEdgeBandOverrides(project.edgeBandOverrides ?? {});
    setCalculatedUnits(project.units.map((unit) => ({ ...unit })));
    setCalculatedCustomParts(
      (project.customParts ?? []).map((part) =>
        syncCustomProjectPartWithSettings(part, normalizedSettings),
      ),
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
    resetEditor(project.units.length, normalizedSettings);
    resetCustomPartEditor(normalizedSettings);
    setIsProjectLibraryOpen(false);
    announceProjectAction(`تم تحميل ${project.name}.`);
  }

  async function deleteSavedProject(projectId: string) {
    if (deletingProjectId || isWorkspaceTransitionPending) {
      return;
    }

    setDeletingProjectId(projectId);

    try {
      const bootstrap = await requestApi<SessionBootstrap>(
        `/api/projects/${projectId}`,
        {
          method: "DELETE",
        },
      );

      syncSavedProjectsFromBootstrap(bootstrap);

      if (currentProjectId === projectId) {
        lastSavedProjectArrangementKeyRef.current = null;
        projectArrangementAutosaveRequestIdRef.current += 1;
        setCurrentProjectId(null);
        setProjectArrangementAutosaveState("idle");
        setProjectArrangementAutosaveError(null);
      }

      announceProjectAction("تم حذف المشروع من حسابك.");
    } catch (error) {
      announceProjectAction(
        error instanceof Error ? error.message : "تعذر حذف المشروع الآن.",
      );
    } finally {
      setDeletingProjectId(null);
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

  function openPrintMarkup(printMarkup: string) {
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
      return false;
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

    return true;
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
        totalHingeCount: projectSummary.totalHingeCount,
        totalHingeCost: projectSummary.totalHingeCost,
        totalProjectCost: projectSummary.totalProjectCost,
      },
      projectParts,
      projectSheetLayout,
      projectPartLinkMap,
    );
    openPrintMarkup(printMarkup);
  }

  function printProjectSheet(
    stock: SheetLayoutStock,
    sheet: SheetLayoutStock["sheets"][number],
  ) {
    if (projectParts.length === 0) {
      return;
    }

    const partsMap = new Map(projectParts.map((part) => [part.id, part]));
    const isRotated = stock.boardLength >= stock.boardWidth;
    const printMarkup = buildSingleSheetPrintDocument(
      projectName.trim() || "مشروع",
      stock,
      sheet,
      partsMap,
      projectPartLinkMap,
      isRotated,
    );

    if (openPrintMarkup(printMarkup)) {
      announceProjectAction(`تم فتح طباعة لوح #${sheet.index + 1}.`);
    }
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

  function clampProjectArrangementOffset(value: number) {
    return round2(
      Math.max(
        -projectArrangementTravelLimitCm,
        Math.min(projectArrangementTravelLimitCm, value),
      ),
    );
  }

  function applyProjectArrangementChange(
    updateArrangement: (
      arrangement: ProjectArrangementItem[],
    ) => ProjectArrangementItem[],
  ) {
    let blockedOverlap: ReturnType<typeof findProjectPreviewOverlap> = null;

    setProjectArrangement((current) => {
      const normalizedArrangement = buildProjectArrangement(units, current);
      const nextArrangement = updateArrangement(
        normalizedArrangement.map((item) => ({ ...item })),
      );
      const overlap = findProjectPreviewOverlap(
        buildProjectPreviewUnits(units, nextArrangement),
      );

      if (overlap) {
        blockedOverlap = overlap;
        return current;
      }

      return nextArrangement;
    });

    if (blockedOverlap) {
      announceProjectAction(
        `لا يمكن وضع ${blockedOverlap.first.title} فوق ${blockedOverlap.second.title}.`,
      );
    }
  }

  function nudgeProjectUnit(
    unitId: string,
    axis: "x" | "y" | "z",
    delta: number,
  ) {
    applyProjectArrangementChange((current) =>
      current.map((item) =>
        item.id === unitId
          ? {
              ...item,
              offsetX:
                axis === "x"
                  ? clampProjectArrangementOffset(
                      (Number.isFinite(item.offsetX) ? item.offsetX : 0) +
                        delta,
                    )
                  : item.offsetX,
              offsetY:
                axis === "y"
                  ? clampProjectArrangementOffset(
                      (Number.isFinite(item.offsetY) ? item.offsetY : 0) +
                        delta,
                    )
                  : item.offsetY,
              offsetZ:
                axis === "z"
                  ? clampProjectArrangementOffset(
                      (Number.isFinite(item.offsetZ) ? item.offsetZ : 0) +
                        delta,
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
    applyProjectArrangementChange((current) => {
      const previewUnit = buildProjectPreviewUnits(units, current).find(
        (unit) => unit.id === unitId,
      );

      if (!previewUnit) {
        return current;
      }

      const nextOffsetX = clampProjectArrangementOffset(
        nextPosition.x - previewUnit.basePosition[0] * 100,
      );
      const nextOffsetZ = clampProjectArrangementOffset(
        nextPosition.z - previewUnit.basePosition[2] * 100,
      );

      return current.map((item) =>
        item.id === unitId
          ? {
              ...item,
              offsetX: nextOffsetX,
              offsetZ: nextOffsetZ,
            }
          : item,
      );
    });
  }

  function rotateProjectUnit(unitId: string, delta: number) {
    applyProjectArrangementChange((current) =>
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
    const nextSettings = normalizeProjectSettings({
      ...projectSettings,
      [key]: value,
    });

    setProjectSettings(nextSettings);
    setProjectSettingsDrafts(buildProjectSettingsDrafts(nextSettings));
    setCustomPartDraft((current) =>
      syncCustomPartDraftWithProjectSettings(current, nextSettings),
    );
    if (
      key === "material" ||
      key === "boardThickness" ||
      key === "backThickness"
    ) {
      setCustomParts((current) =>
        current.map((part) =>
          syncCustomProjectPartWithSettings(part, nextSettings),
        ),
      );
      setCalculatedCustomParts((current) =>
        current.map((part) =>
          syncCustomProjectPartWithSettings(part, nextSettings),
        ),
      );
    }
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

  const nudgeProjectUnitRef = useRef(nudgeProjectUnit);
  nudgeProjectUnitRef.current = nudgeProjectUnit;

  useEffect(() => {
    if (activeWorkspaceTab !== "preview" || !activeProjectPreviewUnit) {
      return undefined;
    }

    function isEditableHotkeyTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return (
        target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      );
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        isEditableHotkeyTarget(event.target) ||
        isProjectLibraryOpen ||
        isProjectSettingsOpen ||
        isUnitPresetOpen
      ) {
        return;
      }

      const step = event.shiftKey ? 1 : 10;
      let handled = true;

      switch (event.key) {
        case "ArrowRight":
          nudgeProjectUnitRef.current(activeProjectPreviewUnit.id, "x", -step);
          break;
        case "ArrowLeft":
          nudgeProjectUnitRef.current(activeProjectPreviewUnit.id, "x", step);
          break;
        case "ArrowUp":
          nudgeProjectUnitRef.current(activeProjectPreviewUnit.id, "z", -step);
          break;
        case "ArrowDown":
          nudgeProjectUnitRef.current(activeProjectPreviewUnit.id, "z", step);
          break;
        default:
          handled = false;
      }

      if (handled) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [
    activeProjectPreviewUnit,
    activeWorkspaceTab,
    isProjectLibraryOpen,
    isProjectSettingsOpen,
    isUnitPresetOpen,
  ]);

  if (authStatus === "loading") {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-[linear-gradient(180deg,#eef3f4_0%,#e4ebea_48%,#eef3f4_100%)] px-4 py-10 text-slate-950 sm:px-6 lg:px-10"
      >
        <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-[2rem] border border-slate-200 bg-white/90 px-8 py-16 text-center shadow-[0_30px_90px_-48px_rgba(24,32,40,0.45)]">
          <p className="text-sm text-slate-500">جارٍ تحميل الحساب الحالي...</p>
          <p className="mt-3 text-lg font-semibold text-slate-950">
            لحظة واحدة، نربط المشاريع بالمستخدم.
          </p>
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <UserAuthPanel
        email={authForm.email}
        error={authError}
        isSubmitting={isAuthSubmitting}
        mode={authMode}
        name={authForm.name}
        password={authForm.password}
        onFieldChange={updateAuthField}
        onModeChange={setAuthMode}
        onSubmit={submitAuthForm}
      />
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(112,154,169,0.18),_transparent_32%),linear-gradient(145deg,#0d1216_0%,#172028_52%,#0d1216_100%)] text-foreground"
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[94rem] flex-col px-4 py-6 pb-28 sm:px-6 sm:pb-8 lg:px-8">
        {isProjectSettingsOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_30px_90px_-40px_rgba(24,32,40,0.55)] sm:max-h-[calc(100vh-3rem)]">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    إعدادات المشروع
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
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
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-slate-950">
                      الخامة والسماكات
                    </h3>
                    <p className="text-xs text-slate-500">
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-slate-950">
                      مقاسات الألواح
                    </h3>
                    <p className="text-xs text-slate-500">
                      هذه المقاسات هي التي يعتمد عليها توزيع القص لكل نوع لوح.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white/85 p-3">
                      <p className="mb-3 text-sm font-medium text-slate-900">
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

                    <div className="rounded-xl border border-slate-200 bg-white/85 p-3">
                      <p className="mb-3 text-sm font-medium text-slate-900">
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-slate-950">
                      إعدادات القص
                    </h3>
                    <p className="text-xs text-slate-500">
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-slate-950">
                      أسلوب التوزيع
                    </h3>
                    <p className="text-xs text-slate-500">
                      اختر بين خطة أسهل للورشة أو خطة تميل لأقل هادر أو المحسن
                      الذكي.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>وضع التخطيط</Label>
                      <Select
                        value={projectSettings.optimizationMode}
                        onValueChange={(value) =>
                          updateProjectSetting(
                            "optimizationMode",
                            value as SheetLayoutOptimizationMode,
                          )
                        }
                      >
                        <SelectTrigger className="w-full bg-white">
                          <SelectValue>
                            {
                              sheetLayoutOptimizationModeLabels[
                                projectSettings.optimizationMode
                              ]
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="smart">المحسن الذكي</SelectItem>
                          <SelectItem value="workshop">وضع الورشة</SelectItem>
                          <SelectItem value="yield">أقل هادر</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2 text-xs leading-6 text-slate-600">
                      {
                        sheetLayoutOptimizationModeDescriptions[
                          projectSettings.optimizationMode
                        ]
                      }
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-sm font-semibold text-slate-950">
                      الأسعار والمصنعية
                    </h3>
                    <p className="text-xs text-slate-500">
                      تكلفة اللوح، المصنعية، شريط الحافة، والمفصلات لحساب تكلفة
                      المشروع.
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

                    <div className="space-y-2">
                      <Label htmlFor="projectHingePrice">سعر المفصلة</Label>
                      <Input
                        id="projectHingePrice"
                        inputMode="decimal"
                        className="bg-white"
                        value={projectSettingsDrafts.hingePrice}
                        onChange={(event) =>
                          updateProjectSettingNumber(
                            "hingePrice",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-slate-50/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] text-xs text-slate-500 sm:px-6 sm:py-4 sm:pb-4">
                أي تعديل هنا ينسحب فورًا على الوحدات الموجودة حاليًا وعلى أي
                وحدة جديدة تضيفها بعد ذلك.
              </div>
            </div>
          </div>
        ) : null}

        {isProjectLibraryOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_30px_90px_-40px_rgba(24,32,40,0.55)] sm:max-h-[calc(100vh-3rem)]">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    مكتبة المشاريع
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    افتح مشروعًا محفوظًا أو احذف مشروعًا قديمًا من حسابك الحالي.
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
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5 text-sm text-slate-500 md:col-span-2">
                    لا توجد مشاريع محفوظة بعد. احفظ أول مشروع وسيظهر هنا.
                  </div>
                ) : (
                  savedProjects.map((project) => (
                    <div
                      key={project.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {project.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            آخر حفظ {formatProjectUpdatedAt(project.updatedAt)}
                          </p>
                        </div>
                        {currentProjectId === project.id ? (
                          <Badge
                            variant="outline"
                            className="border-teal-200 bg-teal-50 text-teal-700"
                          >
                            الحالي
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
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
                          disabled={deletingProjectId !== null}
                        >
                          <FolderOpen className="size-4" />
                          فتح المشروع
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => deleteSavedProject(project.id)}
                          disabled={deletingProjectId !== null}
                        >
                          {deletingProjectId === project.id ? (
                            <RotateCw className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_30px_90px_-40px_rgba(24,32,40,0.55)] sm:max-h-[calc(100vh-3rem)]">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    مكتبة الوحدات الجاهزة
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
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
                    className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(235,240,242,0.82))] p-4 shadow-[0_18px_44px_-36px_rgba(24,32,40,0.4)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {preset.title}
                        </p>
                        <p className="mt-1 text-xs leading-6 text-slate-500">
                          {preset.description}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-white/80 text-slate-700"
                      >
                        {cabinetTypeLabels[preset.input.cabinetType]}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-white/75 p-3 ring-1 ring-slate-200">
                        <p className="text-[11px] text-slate-500">المقاس</p>
                        <p className="mt-1 font-semibold text-slate-950">
                          {formatCm(preset.input.width)} ×{" "}
                          {formatCm(preset.input.height)} ×{" "}
                          {formatCm(preset.input.depth)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/75 p-3 ring-1 ring-slate-200">
                        <p className="text-[11px] text-slate-500">الواجهة</p>
                        <p className="mt-1 font-semibold text-slate-950">
                          {frontOptionLabels[preset.input.frontOption]}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
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

        <section className="relative overflow-hidden rounded-[2.2rem] border border-white/40 bg-[linear-gradient(180deg,rgba(246,249,250,0.96),rgba(227,234,234,0.9))] p-4 shadow-[0_36px_100px_-54px_rgba(18,24,30,0.45)] backdrop-blur sm:p-6">
          <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(90deg,rgba(73,109,122,0.16),rgba(240,244,245,0.08),rgba(118,152,167,0.14))]" />
          <div className="absolute -left-16 top-0 size-40 rounded-full bg-sky-300/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 size-36 rounded-full bg-slate-200/30 blur-3xl" />

          <div className="relative rounded-[1.95rem] border border-slate-200/70 bg-white/76 p-5 shadow-[0_26px_70px_-42px_rgba(20,27,33,0.18)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="relative flex size-14 shrink-0 items-center justify-center rounded-[1.15rem] bg-[linear-gradient(145deg,#223741,#4b6978)] shadow-[0_18px_32px_-20px_rgba(26,42,51,0.42)]">
                  <span className="absolute inset-[0.62rem] rounded-[0.8rem] border border-white/60" />
                  <span className="absolute inset-y-[0.75rem] right-[0.7rem] w-[0.62rem] rounded-full border border-white/60 origin-left rotate-[-11deg]" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge variant="outline" className="bg-white/90">
                      {currentUser.name}
                    </Badge>
                    <span dir="ltr" className="truncate">
                      {currentUser.email}
                    </span>
                  </div>
                  <h1 className="mt-3 font-heading text-[1.8rem] font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
                    لوحة التشغيل
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                    واجهة تشغيل أوضح: شريط تنقل جانبي، لوحة عمل مركزية، ولوحة
                    قرار ثابتة بدل تكرار نفس المعلومات في أكثر من مكان.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{projectName}</span>
                    <span>{projectItemCount} عنصر</span>
                    <span>{units.length} وحدة</span>
                    <span>{customParts.length} مقاس حر</span>
                  </div>
                </div>
              </div>

              <div className="flex max-w-[42rem] flex-wrap items-center gap-2 xl:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-white/82"
                  onClick={saveCurrentProject}
                >
                  <Save className="size-4" />
                  حفظ
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-white/82"
                  onClick={() => setIsProjectSettingsOpen(true)}
                >
                  <Settings2 className="size-4" />
                  الإعدادات
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-white/82"
                  onClick={() => setIsProjectLibraryOpen(true)}
                >
                  <FolderOpen className="size-4" />
                  المشاريع
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-white/82"
                  onClick={resetProjectWorkspace}
                >
                  <Plus className="size-4" />
                  مشروع جديد
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-white/82"
                  onClick={logoutCurrentUser}
                >
                  <LogOut className="size-4" />
                  خروج
                </Button>
                <Button
                  type="button"
                  className="rounded-full bg-[linear-gradient(145deg,#416575,#5b8699)] text-white shadow-[0_16px_28px_-18px_rgba(65,101,117,0.3)] hover:bg-[linear-gradient(145deg,#416575,#5b8699)]"
                  onClick={mobilePrimaryAction.onClick}
                  disabled={mobilePrimaryAction.disabled}
                >
                  <mobilePrimaryAction.icon className="size-4" />
                  {mobilePrimaryAction.label}
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-200/70 pt-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                {dashboardProjectRailSettings.map((setting) => (
                  <span key={setting.label}>{setting.label}: {setting.value}</span>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {projectActionMessage ? (
                  <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-700">
                    {projectActionMessage}
                  </span>
                ) : null}
                {projectArrangementAutosaveMessage ? (
                  <span
                    className={cn(
                      "rounded-full bg-white/85 px-3 py-1 font-medium",
                      projectArrangementAutosaveToneClassName,
                    )}
                  >
                    {projectArrangementAutosaveMessage}
                  </span>
                ) : null}
                {!projectActionMessage && !projectArrangementAutosaveMessage ? (
                  <span className="text-slate-500">
                    {currentProjectId
                      ? "يمكنك تحديث المشروع الحالي أو حفظ نسخة جديدة من نفس المسار."
                      : "ابدأ التسمية ثم احفظ المشروع ليظهر داخل مكتبة الحساب."}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
          <Card className="border-0 bg-white/88 shadow-[0_24px_64px_-44px_rgba(20,27,33,0.22)] ring-1 ring-slate-900/5">
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Project Rail
                </p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">
                  التنقل كأداة عمل
                </h2>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  كل تبويب له مكان ثابت وواضح، مع عداد سريع يشرح أين تقف الآن.
                </p>
              </div>

              <div className="grid gap-2">
                {workspaceTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeWorkspaceTab === tab.id;
                  const isPendingTarget =
                    isWorkspaceTransitionPending && pendingWorkspaceTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => navigateToWorkspaceTab(tab.id)}
                      disabled={isWorkspaceTransitionPending}
                      className={cn(
                        "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[1.2rem] border px-3 py-3 text-right transition-colors disabled:cursor-wait disabled:opacity-75",
                        isActive
                          ? "border-slate-300 bg-[linear-gradient(145deg,#edf5f7,#ffffff)] ring-1 ring-slate-200"
                          : "border-slate-200 bg-white/82 text-slate-700 hover:bg-white",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-9 items-center justify-center rounded-[0.9rem] bg-slate-100 text-slate-700",
                          isActive &&
                            "bg-[linear-gradient(145deg,#31515d,#5d8596)] text-white",
                        )}
                      >
                          {isPendingTarget ? (
                            <RotateCw className="size-4 animate-spin" />
                          ) : (
                            <Icon className="size-4" />
                          )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-950">
                          {tab.label}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {tab.badge}
                        </span>
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                        {tab.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeWorkspaceTab === "builder" ? (
                <div className="border-t border-slate-200/80 pt-4">
                  <p className="text-xs font-semibold text-slate-500">
                    لوحة الإضافة
                  </p>
                  <div className="mt-3 grid gap-2">
                    {builderTabs.map((tab) => {
                      const isActive = activeBuilderTab === tab.id;

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveBuilderTab(tab.id)}
                          className={cn(
                            "rounded-[1rem] border px-3 py-3 text-right transition-colors",
                            isActive
                              ? "border-slate-300 bg-slate-100 ring-1 ring-slate-200"
                              : "border-slate-200 bg-white/82",
                          )}
                        >
                          <p className="text-sm font-semibold text-slate-950">
                            {tab.label}
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">
                            {tab.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-200/80 pt-4">
                  <p className="text-xs font-semibold text-slate-500">
                    إعدادات سريعة
                  </p>
                  <div className="mt-3 space-y-2">
                    {dashboardProjectRailSettings.map((setting) => (
                      <div
                        key={setting.label}
                        className="rounded-[1rem] border border-slate-200 bg-white/80 px-3 py-3"
                      >
                        <p className="text-[11px] text-slate-500">
                          {setting.label}
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-950">
                          {setting.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {dashboardTopMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className={cn(
                    "rounded-[1.4rem] border p-4 shadow-[0_18px_40px_-32px_rgba(26,42,51,0.18)]",
                    metric.label === "إجمالي التكلفة"
                      ? "border-slate-300 bg-[linear-gradient(145deg,#20363f,#355260)] text-white"
                      : "border-slate-200 bg-white/88",
                  )}
                >
                  <p
                    className={cn(
                      "text-[11px]",
                      metric.label === "إجمالي التكلفة"
                        ? "text-slate-200"
                        : "text-slate-500",
                    )}
                  >
                    {metric.label}
                  </p>
                  <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                  <p
                    className={cn(
                      "mt-1 text-[11px] leading-5",
                      metric.label === "إجمالي التكلفة"
                        ? "text-slate-200"
                        : "text-slate-500",
                    )}
                  >
                    {metric.note}
                  </p>
                </div>
              ))}
            </div>

            <Card className="border-0 bg-white/88 shadow-[0_26px_70px_-42px_rgba(20,27,33,0.24)] ring-1 ring-slate-900/5">
              <CardContent className="space-y-6 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <Badge
                      variant="outline"
                      className="flex w-fit items-center gap-1.5 border-slate-200 bg-white/85 text-slate-700"
                    >
                      <ActiveWorkspaceIcon className="size-3.5" />
                      {dashboardFocusTitle}
                    </Badge>
                    <h2 className="mt-4 text-[1.8rem] font-semibold leading-tight text-slate-950">
                      لوحة العمل النشطة
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                      {dashboardFocusDescription}
                    </p>
                  </div>

                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-white/85 text-slate-700"
                  >
                    {activeWorkspaceTabConfig.label}
                  </Badge>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                  <div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {operatorFocusCards.map((card) => (
                        <div
                          key={card.label}
                          className="rounded-[1.2rem] border border-slate-200 bg-slate-50/80 p-4"
                        >
                          <p className="text-[11px] text-slate-500">
                            {card.label}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-950">
                            {card.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-[linear-gradient(145deg,rgba(240,246,248,0.94),rgba(255,255,255,0.86))] p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-xs text-slate-500">الأمر الحالي</p>
                          <p className="mt-1 text-base font-semibold text-slate-950">
                            {mobilePrimaryAction.label}
                          </p>
                          <p className="mt-1 text-xs leading-6 text-slate-500">
                            {operatorActionNote}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigateToWorkspaceTab("preview")}
                            disabled={isPreviewTransitionPending}
                          >
                            {isPreviewTransitionPending ? (
                              <RotateCw className="size-4 animate-spin" />
                            ) : (
                              <PanelsTopLeft className="size-4" />
                            )}
                            {isPreviewTransitionPending
                              ? "جاري فتح 3D..."
                              : "فتح 3D"}
                          </Button>
                          <Button
                            type="button"
                            className="bg-[linear-gradient(145deg,#416575,#5b8699)] text-white hover:bg-[linear-gradient(145deg,#416575,#5b8699)]"
                            onClick={mobilePrimaryAction.onClick}
                            disabled={mobilePrimaryAction.disabled}
                          >
                            <mobilePrimaryAction.icon className="size-4" />
                            {mobilePrimaryAction.label}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.55rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.6),_transparent_38%),linear-gradient(180deg,#edf3f4_0%,#dbe7e7_100%)] p-4 shadow-[0_18px_40px_-32px_rgba(26,42,51,0.18)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                          Live Snapshot
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">
                          {dashboardLeadUnit?.title ?? "المشهد ينتظر أول وحدة"}
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">
                          {dashboardLeadUnitSizeLabel ??
                            "أضف وحدة أو افتح مشروعًا ليبدأ المسار البصري الحالي."}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-white/80 text-slate-700"
                      >
                        {stageDrawerSceneStatusLabel}
                      </Badge>
                    </div>

                    <div className="relative mt-4 overflow-hidden rounded-[1.3rem] border border-slate-200/70 bg-[linear-gradient(180deg,#e7eff1_0%,#cfdddd_100%)] px-4 pb-5 pt-8">
                      <div className="absolute inset-x-6 bottom-3 h-4 rounded-full bg-slate-900/10 blur-xl" />
                      <div className="relative flex min-h-44 items-end justify-center gap-3">
                        {stageDrawerSceneUnits.length > 0 ? (
                          stageDrawerSceneUnits.slice(0, 3).map((unit, index) => {
                            const blockHeight = Math.min(
                              Math.max(unit.height / 3.2, 88),
                              180,
                            );
                            const blockWidth = Math.min(
                              Math.max(unit.width / 2.5, 74),
                              120,
                            );

                            return (
                              <div
                                key={unit.id}
                                className="flex flex-col items-center gap-3"
                              >
                                <div
                                  className={cn(
                                    "relative rounded-[1.2rem] border border-slate-900/15 bg-[linear-gradient(180deg,#899fae_0%,#637c8e_100%)] shadow-[0_18px_30px_-20px_rgba(30,41,59,0.34)]",
                                    index === 1 &&
                                      "bg-[linear-gradient(180deg,#708899_0%,#4e687b_100%)]",
                                    index === 2 &&
                                      "bg-[linear-gradient(180deg,#9db4c2_0%,#7994a5_100%)]",
                                  )}
                                  style={{
                                    height: `${blockHeight}px`,
                                    width: `${blockWidth}px`,
                                  }}
                                >
                                  <div className="absolute inset-[12%] rounded-[0.95rem] border border-white/30" />
                                  <div className="absolute inset-y-[14%] right-[14%] w-[14%] rounded-full border border-white/30 origin-left rotate-[-9deg]" />
                                </div>
                                <div className="text-center">
                                  <p className="text-xs font-semibold text-slate-950">
                                    {unit.title}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {unit.frontLabel}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="flex w-full items-center justify-center rounded-[1rem] border border-dashed border-slate-300 bg-white/55 px-5 py-8 text-center text-sm leading-7 text-slate-500">
                            أضف أول وحدة ليظهر الملخص البصري هنا بدل الشاشة
                            الفارغة.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-white/82"
                        onClick={() => navigateToWorkspaceTab("preview")}
                        disabled={isPreviewTransitionPending}
                      >
                        {isPreviewTransitionPending ? (
                          <RotateCw className="size-4 animate-spin" />
                        ) : (
                          <PanelsTopLeft className="size-4" />
                        )}
                        {isPreviewTransitionPending
                          ? "جاري فتح 3D..."
                          : "المشهد الكامل"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-white/82"
                        onClick={printProjectPreviewSnapshot}
                        disabled={projectPreviewUnits.length === 0}
                      >
                        <Printer className="size-4" />
                        طباعة
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 bg-[linear-gradient(180deg,#19242a_0%,#12191f_100%)] text-slate-50 shadow-[0_26px_70px_-42px_rgba(20,27,33,0.56)] ring-1 ring-white/5">
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                  Decision Panel
                </p>
                <h2 className="mt-4 text-[1.8rem] font-semibold leading-tight">
                  لوحة القرار
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  التكلفة، التوصيات، والإجراء التالي في عمود ثابت بدل تكرار نفس
                  المعلومة عبر الشاشة.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {operatorDecisionStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4"
                  >
                    <p className="text-xs text-slate-300">{stat.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-50">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                {dashboardProjectRailSettings.map((setting) => (
                  <div
                    key={setting.label}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-slate-300">{setting.label}</span>
                    <span className="font-medium text-slate-50">
                      {setting.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {dashboardRecommendations.slice(0, 3).map((recommendation) => (
                  <div
                    key={recommendation.id}
                    className={cn(
                      "rounded-[1.15rem] border p-3",
                      recommendation.tone === "action"
                        ? "border-amber-200/30 bg-amber-300/10"
                        : "border-white/10 bg-white/5",
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-50">
                      {recommendation.title}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-slate-300">
                      {recommendation.body}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-50">
                    آخر المشاريع
                  </p>
                  <span className="text-xs text-slate-300">
                    {savedProjects.length} محفوظ
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {dashboardRecentProjects.length > 0 ? (
                    dashboardRecentProjects.map((project) => (
                      <div
                        key={project.id}
                        className="rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3"
                      >
                        <p className="text-sm font-semibold text-slate-50">
                          {project.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          {project.units.length} وحدة • آخر حفظ{" "}
                          {formatProjectUpdatedAt(project.updatedAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs leading-6 text-slate-300">
                      عند حفظ أول مشروع سيظهر هنا كمختصر سريع للعودة إليه.
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="button"
                className="h-11 w-full rounded-[1rem] bg-white text-slate-950 hover:bg-white/90"
                onClick={mobilePrimaryAction.onClick}
                disabled={mobilePrimaryAction.disabled}
              >
                <mobilePrimaryAction.icon className="size-4" />
                {mobilePrimaryAction.label}
              </Button>
            </CardContent>
          </Card>
        </section>

        {activeWorkspaceTab === "project" ? (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
              <CardHeader>
                <CardTitle>إدارة المشروع</CardTitle>
                <CardDescription>
                  اختصارات الإدارة والحفظ والإخراج مجمعة هنا بدل التنقل داخل
                  الصفحة كاملة.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-950">
                      {currentUser.name}
                    </p>
                    <p dir="ltr" className="text-xs text-slate-500">
                      {currentUser.email}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={logoutCurrentUser}
                  >
                    <LogOut className="size-4" />
                    تسجيل الخروج
                  </Button>
                </div>

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
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs text-slate-500">الوحدات الحالية</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {units.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs text-slate-500">المقاسات الحرة</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {customParts.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs text-slate-500">المحفوظات</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
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

                {projectActionMessage || projectArrangementAutosaveMessage ? (
                  <div className="space-y-3">
                    {projectActionMessage ? (
                      <div className="rounded-2xl border border-teal-200 bg-teal-50/80 p-4 text-sm text-teal-800">
                        {projectActionMessage}
                      </div>
                    ) : null}
                    {projectArrangementAutosaveMessage ? (
                      <div
                        className={cn(
                          "rounded-2xl border p-4 text-sm",
                          projectArrangementAutosaveState === "error"
                            ? "border-slate-300 bg-slate-100 text-slate-800"
                            : projectArrangementAutosaveState === "saving"
                              ? "border-sky-200 bg-sky-50/80 text-sky-800"
                              : "border-teal-200 bg-teal-50/80 text-teal-800",
                        )}
                      >
                        {projectArrangementAutosaveMessage}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
                <CardHeader>
                  <CardTitle>ملخص الإعدادات الحالية</CardTitle>
                  <CardDescription>
                    القيم التي ستُطبق على الوحدات والنتائج في هذا المشروع.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-600">
                  <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200">
                    <p className="font-medium text-slate-950">
                      {materialLabels[projectSettings.material]} •{" "}
                      {formatMmFromCm(projectSettings.boardThickness)} • ظهر{" "}
                      {formatMmFromCm(projectSettings.backThickness)}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-slate-500">
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
                    <p className="mt-1 text-xs leading-6 text-slate-500">
                      سلاح: {formatOptionalMmFromCm(projectSettings.cutKerf)} •
                      حافة تشطيب:{" "}
                      {formatOptionalMmFromCm(projectSettings.trimMargin)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-slate-950 text-slate-50 ring-0">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Info className="size-4 text-[color:var(--chart-3)]" />
                    <Layers2 className="size-4 text-[color:var(--chart-3)]" />
                    <CardTitle>وضع المحرك الحالي</CardTitle>
                  </div>
                  <CardDescription className="text-slate-300">
                    المشروع أصبح يدعم تجميع وحدات متعددة مع أوضاع واجهات مختلفة
                    قبل تنفيذ الحساب النهائي.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </section>
        ) : null}

        {activeWorkspaceTab === "builder" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
                {activeBuilderTab === "unit" ? (
                  <>
                    <CardHeader>
                      <CardTitle>
                        {editingUnitId ? "تعديل وحدة" : "إضافة وحدة"}
                      </CardTitle>
                      <CardDescription className="hidden sm:block">
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
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 xl:col-span-2">
                          <p className="text-xs text-slate-500">
                            إعدادات المشروع
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-950">
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

                      <div className="space-y-3 lg:hidden">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                            <p className="text-[11px] text-slate-500">
                              الأبعاد
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-950">
                              {hasEditorCoreDimensions
                                ? `${formatCm(editorInput.width)} × ${formatCm(editorInput.height)} × ${formatCm(editorInput.depth)}`
                                : "أدخل المقاسات"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                            <p className="text-[11px] text-slate-500">
                              الواجهة
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-950">
                              {frontOptionLabels[editorInput.frontOption]}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                            <p className="text-[11px] text-slate-500">
                              عدد الواجهات
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-950">
                              {editorFrontPieceCount}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                            <p className="text-[11px] text-slate-500">
                              اتجاه الثمرة
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-950">
                              {grainDirectionLabels[editorInput.grainDirection]}
                            </p>
                          </div>
                        </div>

                        <details className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-950 [&::-webkit-details-marker]:hidden">
                            <span className="flex items-center gap-2">
                              <Sparkles className="size-4 text-[color:var(--chart-2)]" />
                              مراجعة سريعة
                            </span>
                            <span className="text-[11px] text-slate-500">
                              افتح عند الحاجة
                            </span>
                          </summary>
                          {hasEditorCompleteDimensions &&
                          editorReviewWarnings.length > 0 ? (
                            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                              {editorReviewWarnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          ) : (
                            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                              {hasEditorCompleteDimensions ? (
                                <>
                                  <li>
                                    المعاينة الحالية تعكس شكل الواجهة المختار.
                                  </li>
                                  <li>
                                    بعد إضافة الوحدات اضغط احسب لاستخراج مقاسات
                                    المشروع.
                                  </li>
                                </>
                              ) : (
                                <>
                                  <li>
                                    ابدأ بإدخال العرض والارتفاع والعمق أولًا.
                                  </li>
                                  <li>
                                    لو كانت الوحدة زاوية L، أدخل ضلع الرجوع
                                    أيضًا.
                                  </li>
                                </>
                              )}
                            </ul>
                          )}
                        </details>
                      </div>

                      <div className="hidden gap-4 lg:grid lg:grid-cols-[1.25fr_0.75fr]">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
                            <ScanSearch className="size-4 text-[color:var(--chart-2)]" />
                            ملخص الوحدة الجاري إعدادها
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">
                                الأبعاد الكلية
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-950">
                                {hasEditorCoreDimensions
                                  ? `${formatCm(editorInput.width)} × ${formatCm(editorInput.height)} × ${formatCm(editorInput.depth)}`
                                  : "أدخل العرض والارتفاع والعمق لعرض الملخص"}
                              </p>
                            </div>
                            {isCornerBlindEditor ? (
                              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                                <p className="text-xs text-slate-500">
                                  بيانات الزاوية
                                </p>
                                <p className="mt-1 text-sm font-medium text-slate-950">
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
                            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">
                                نوع الواجهة
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-950">
                                {frontOptionLabels[editorInput.frontOption]}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">
                                عدد الواجهات الظاهرة
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-950">
                                {editorFrontPieceCount}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">
                                الخامة المختارة
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-950">
                                {materialLabels[projectSettings.material]}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">
                                سمك اللوح
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-950">
                                {formatMmFromCm(projectSettings.boardThickness)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">
                                سمك الظهر
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-950">
                                {formatMmFromCm(projectSettings.backThickness)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">
                                اتجاه الثمرة
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-950">
                                {
                                  grainDirectionLabels[
                                    editorInput.grainDirection
                                  ]
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-slate-50">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Sparkles className="size-4 text-[color:var(--chart-3)]" />
                            مراجعة قبل الإضافة
                          </div>
                          {hasEditorCompleteDimensions &&
                          editorReviewWarnings.length > 0 ? (
                            <ul className="mt-4 space-y-3 text-sm text-slate-300">
                              {editorReviewWarnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          ) : (
                            <ul className="mt-4 space-y-3 text-sm text-slate-300">
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
                    <CardFooter className="flex flex-col gap-3 border-t border-slate-200/80 bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-slate-500 sm:hidden">
                        أضف الوحدات ثم احسب المشروع عند الانتهاء.
                      </p>
                      <p className="hidden text-xs text-slate-500 sm:block">
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
                          className="border-slate-200 bg-slate-50 text-slate-700"
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
                          <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                            <span>
                              {customPartDraft.thicknessMode === "project"
                                ? `مرتبط تلقائيا بسمك ${customPartDraft.category === "back" ? "الظهر" : "الهيكل"} الحالي.`
                                : "تم تثبيت السمك يدويًا ولن يتغير مع إعدادات المشروع."}
                            </span>
                            {customPartDraft.thicknessMode === "manual" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-auto px-2 py-1 text-xs"
                                onClick={useProjectThicknessForCustomPartDraft}
                              >
                                استخدام سمك المشروع
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>الخامة</Label>
                          <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                            {materialLabels[projectSettings.material]}
                          </div>
                          <p className="text-xs text-slate-500">
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
                          <p className="text-xs text-slate-500">
                            اختر أي ضلع من الطول أو العرض ليُحسب ضمن شريط الحافة
                            للمقاس الحر.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-6 text-slate-500">
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
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-500">
                          لم تتم إضافة أي مقاسات حرة بعد.
                        </div>
                      ) : (
                        customParts.map((part) => (
                          <div
                            key={part.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 ring-1 ring-slate-200"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="space-y-1">
                                <p className="font-medium text-slate-950">
                                  {part.title}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {partCategoryLabels[part.category]} •{" "}
                                  {formatCm(part.length)} ×{" "}
                                  {formatCm(part.width)} • {part.qty} قطعة •{" "}
                                  {formatMmFromCm(
                                    syncCustomProjectPartWithSettings(
                                      part,
                                      projectSettings,
                                    ).thickness,
                                  )}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {materialLabels[projectSettings.material]} •{" "}
                                  {grainDirectionLabels[part.grainDirection]}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {(part.thicknessMode ??
                                    inferCustomPartThicknessMode(
                                      part,
                                      projectSettings,
                                    )) === "project"
                                    ? "السمك يتبع المشروع الحالي تلقائيًا"
                                    : "السمك مضبوط يدويًا لهذا المقاس"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatPartEdgeBanding(
                                    buildCustomProjectCutlistPart(
                                      part,
                                      projectSettings,
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
                          className="border-slate-200 bg-slate-50 text-slate-700"
                        >
                          {projectItemCount} عنصر
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {unitFeedback ? (
                        <div className="rounded-2xl border border-teal-200 bg-teal-50/80 p-4 text-sm text-teal-900 ring-1 ring-teal-100">
                          <div className="flex items-center gap-2 font-medium">
                            <Sparkles className="size-4" />
                            تم تحديث قائمة الوحدات
                          </div>
                          <p className="mt-2 text-sm leading-6 text-teal-800">
                            {unitFeedback.message}
                          </p>
                        </div>
                      ) : null}

                      <div className="space-y-3">
                        {units.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-500">
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
                                  "rounded-2xl border bg-slate-50/80 p-4 ring-1 transition-colors",
                                  isActive
                                    ? "border-slate-300 bg-slate-50 ring-slate-200"
                                    : isRecentlySaved
                                      ? "border-teal-300 bg-teal-50/80 ring-teal-200"
                                      : "border-slate-200 ring-slate-200",
                                )}
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="space-y-1">
                                    <p className="font-medium text-slate-950">
                                      {unit.title}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {cabinetTypeLabels[unit.cabinetType]} •{" "}
                                      {formatCm(unit.width)} ×{" "}
                                      {formatCm(unit.height)} ×{" "}
                                      {formatCm(unit.depth)}
                                    </p>
                                    {unit.cabinetType === "corner-l-base" ||
                                    unit.cabinetType === "corner-l-wall" ? (
                                      <p className="text-xs text-slate-500">
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
                                <p className="mt-2 text-xs text-slate-500">
                                  {frontOptionLabels[unit.frontOption]} •{" "}
                                  {getFrontPieceCount(unitResult)} واجهة •{" "}
                                  {unit.shelfCount} رف
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-slate-500">
                            الحساب يعتمد على الوحدات والمقاسات الحرة الموجودة
                            داخل المشروع.
                          </p>
                          <Button
                            type="button"
                            className="w-full sm:w-auto"
                            onClick={calculateUnits}
                            disabled={projectItemCount === 0 || isResultsTransitionPending}
                          >
                            {isResultsTransitionPending ? (
                              <RotateCw className="size-4 animate-spin" />
                            ) : (
                              <Calculator className="size-4" />
                            )}
                            {isResultsTransitionPending
                              ? "جاري تجهيز النتائج..."
                              : "احسب المشروع"}
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
                      className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8 lg:hidden"
                    >
                      <CardHeader className="pb-3">
                        <CardTitle>معاينة الوحدة</CardTitle>
                        <CardDescription>
                          افتح 3D عند الحاجة بدل بقاءه ظاهرًا طوال الوقت.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-center">
                            <p className="text-[11px] text-slate-500">
                              اسم الوحدة
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-950">
                              {editorTitle}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-center">
                            <p className="text-[11px] text-slate-500">
                              الواجهة
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-950">
                              {frontOptionLabels[editorInput.frontOption]}
                            </p>
                          </div>
                        </div>

                        <details className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-950 [&::-webkit-details-marker]:hidden">
                            <span className="flex items-center gap-2">
                              <PanelsTopLeft className="size-4" />
                              فتح 3D للوحدة الحالية
                            </span>
                            <span className="text-[11px] text-slate-500">
                              اختياري
                            </span>
                          </summary>
                          <div className="mt-3 relative overflow-hidden rounded-[1.25rem] border border-slate-200 bg-[linear-gradient(180deg,#f4f8f8_0%,#e6edec_100%)] p-4">
                            {hasEditorCompleteDimensions ? (
                              <CabinetPreview
                                input={editorInput}
                                result={editorResult}
                                selectedPartId={selectedPartId}
                              />
                            ) : (
                              <div className="flex h-56 w-full items-center justify-center rounded-[1rem] border border-dashed border-slate-300 bg-white/65 px-4 text-center text-sm leading-7 text-slate-500">
                                أدخل المقاسات الأساسية لتظهر المعاينة بشكل صحيح.
                              </div>
                            )}
                          </div>
                        </details>
                      </CardContent>
                    </Card>

                    <Card
                      id="project-units-list"
                      className="hidden border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8 lg:block"
                    >
                      <CardHeader>
                        <CardTitle>3D للوحدة الحالية</CardTitle>
                        <CardDescription>
                          المعاينة هنا خاصة بالوحدة الجاري إعدادها قبل إضافتها
                          أو تعديلها داخل المشروع.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,#f4f8f8_0%,#e6edec_100%)] p-6">
                          <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(43,58,68,0.12),transparent_60%)]" />
                          <div className="relative space-y-4">
                            {hasEditorCompleteDimensions ? (
                              <CabinetPreview
                                input={editorInput}
                                result={editorResult}
                                selectedPartId={selectedPartId}
                              />
                            ) : (
                              <div className="flex h-72 w-full items-center justify-center rounded-[1.25rem] border border-dashed border-slate-300 bg-white/65 px-6 text-center text-sm leading-7 text-slate-500">
                                أدخل المقاسات الأساسية للوحدة لتظهر المعاينة
                                ثلاثية الأبعاد والقطع المتوقعة بشكل صحيح.
                              </div>
                            )}
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="rounded-xl bg-white/80 p-3 text-center ring-1 ring-slate-200">
                                <p className="text-xs text-slate-500">
                                  اسم الوحدة
                                </p>
                                <p className="mt-1 text-sm font-medium text-slate-950">
                                  {editorTitle}
                                </p>
                              </div>
                              <div className="rounded-xl bg-white/80 p-3 text-center ring-1 ring-slate-200">
                                <p className="text-xs text-slate-500">
                                  نوع الواجهة
                                </p>
                                <p className="mt-1 text-sm font-medium text-slate-950">
                                  {frontOptionLabels[editorInput.frontOption]}
                                </p>
                              </div>
                              <div className="rounded-xl bg-white/80 p-3 text-center ring-1 ring-slate-200">
                                <p className="text-xs text-slate-500">
                                  عدد الواجهات
                                </p>
                                <p className="mt-1 text-sm font-medium text-slate-950">
                                  {hasEditorCompleteDimensions
                                    ? editorFrontPieceCount
                                    : "--"}
                                </p>
                              </div>
                              <div className="rounded-xl bg-white/80 p-3 text-center ring-1 ring-slate-200">
                                <p className="text-xs text-slate-500">
                                  اتجاه الثمرة
                                </p>
                                <p className="mt-1 text-sm font-medium text-slate-950">
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
                      <>
                        <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8 lg:hidden">
                          <CardContent className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">
                                  ترتيب المشروع
                                </p>
                                <p className="mt-1 text-xs leading-6 text-slate-500">
                                  للمشروع أكثر من وحدة. افتح تبويب 3D عند الحاجة
                                  بدل عرض المسرح الكامل هنا.
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className="border-slate-200 bg-slate-50 text-slate-700"
                              >
                                {projectPreviewUnits.length} وحدة
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                className="flex-1"
                                onClick={() => navigateToWorkspaceTab("preview")}
                                disabled={isPreviewTransitionPending}
                              >
                                {isPreviewTransitionPending ? (
                                  <RotateCw className="size-4 animate-spin" />
                                ) : (
                                  <PanelsTopLeft className="size-4" />
                                )}
                                {isPreviewTransitionPending
                                  ? "جاري فتح 3D..."
                                  : "افتح تبويب 3D"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={resetProjectArrangement}
                              >
                                إعادة ضبط
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="hidden border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8 lg:block">
                          <CardHeader>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <CardTitle>3D لترتيب المشروع</CardTitle>
                                <CardDescription>
                                  راقب شكل المشروع النهائي، اسحب الوحدة بزرار
                                  الماوس الشمال لتحريكها في المكان الذي تريده،
                                  واسحب بزرار الماوس اليمين لتغيير زاوية العرض
                                  قبل عرضها على العميل.
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
                            <ProjectPreview
                              units={projectPreviewUnits.map((unit) => ({
                                ...unit,
                                active:
                                  unit.id === activeProjectPreviewUnit?.id,
                              }))}
                              onSelectUnit={setActiveProjectUnitId}
                              onUnitPositionChange={updateProjectUnitPosition}
                              onUnitNudge={nudgeProjectUnit}
                              onUnitRotate={rotateProjectUnit}
                              showQuickControls
                            />

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
                                        ? "border-slate-300 bg-slate-50 ring-slate-200"
                                        : "border-slate-200 bg-slate-50/80 ring-slate-200",
                                    )}
                                  >
                                    <button
                                      type="button"
                                      className="w-full text-right"
                                      onClick={() =>
                                        setActiveProjectUnitId(unit.id)
                                      }
                                    >
                                      <p className="font-medium text-slate-950">
                                        {unit.title}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-500">
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
                                          moveProjectUnitOrder(
                                            unit.id,
                                            "forward",
                                          )
                                        }
                                        disabled={
                                          index ===
                                          projectPreviewUnits.length - 1
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

                                    <p className="mt-3 text-[11px] leading-5 text-slate-500">
                                      الوحدات الأرضية تبدأ تحت تلقائيًا،
                                      والوحدات المعلقة تبدأ فوق تلقائيًا ويمكنك
                                      ضبط مكان كل وحدة كما تريد.
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    ) : null}
                  </>
                ) : activeBuilderTab === "units" ? (
                  units.length > 1 ? (
                    <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
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
                        <ProjectPreview
                          units={projectPreviewUnits.map((unit) => ({
                            ...unit,
                            active: unit.id === activeProjectPreviewUnit?.id,
                          }))}
                          onSelectUnit={setActiveProjectUnitId}
                          onUnitPositionChange={updateProjectUnitPosition}
                          onUnitNudge={nudgeProjectUnit}
                          onUnitRotate={rotateProjectUnit}
                          showQuickControls
                        />
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
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
                  <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
                    <CardHeader>
                      <CardTitle>المقاسات الحرة الحالية</CardTitle>
                      <CardDescription>
                        راجع المقاسات الحرة الموجودة أو انتقل إلى تبويب المقاس
                        الحر لتعديلها.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {customParts.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-500">
                          لا توجد مقاسات حرة بعد.
                        </div>
                      ) : (
                        customParts.map((part) => (
                          <div
                            key={part.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 ring-1 ring-slate-200"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-slate-950">
                                  {part.title}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
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
        ) : null}

        {activeWorkspaceTab === "preview" ? (
          <section className="mt-6 space-y-6 pb-8">
            {projectPreviewUnits.length === 0 ? (
              <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
                <CardHeader>
                  <CardTitle>معاينة 3D للمشروع</CardTitle>
                  <CardDescription>
                    أضف وحدة واحدة على الأقل ليظهر مشهد 3D وتتمكن من ترتيب
                    الوحدات وطباعة لقطة من الشكل النهائي.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
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
                  <ProjectPreview
                    units={projectPreviewUnits.map((unit) => ({
                      ...unit,
                      active: unit.id === activeProjectPreviewUnit?.id,
                    }))}
                    onSelectUnit={setActiveProjectUnitId}
                    onUnitPositionChange={updateProjectUnitPosition}
                    onUnitNudge={nudgeProjectUnit}
                    onUnitRotate={rotateProjectUnit}
                    showQuickControls
                    onCanvasReady={bindProjectPreviewCanvas}
                  />

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {projectPreviewUnits.map((unit, index) => {
                      const isActive = activeProjectPreviewUnit?.id === unit.id;

                      return (
                        <div
                          key={unit.id}
                          className={cn(
                            "rounded-2xl border p-4 ring-1",
                            isActive
                              ? "border-slate-300 bg-slate-50 ring-slate-200"
                              : "border-slate-200 bg-slate-50/80 ring-slate-200",
                          )}
                        >
                          <button
                            type="button"
                            className="w-full text-right"
                            onClick={() => setActiveProjectUnitId(unit.id)}
                          >
                            <p className="font-medium text-slate-950">
                              {unit.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
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

                          <p className="mt-3 text-[11px] leading-5 text-slate-500">
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
              <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-9">
                <Card className="border-0 bg-white/88 ring-1 ring-slate-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">الوحدات المحسوبة</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {projectSummary.unitCount}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-slate-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">المقاسات الحرة</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {calculatedCustomParts.length}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-slate-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">إجمالي القطع</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {projectSummary.totalPanels}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-slate-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">إجمالي الألواح</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {projectSummary.totalSheets}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-slate-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">إجمالي الاستهلاك</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {projectSummary.totalAreaM2} م²
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-slate-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">تكلفة الألواح</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {formatPrice(projectSummary.totalSheetCost)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-slate-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">المصنعية</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {formatPrice(projectSummary.totalLaborCost)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-slate-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">تكلفة شريط الحافة</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {formatPrice(projectSummary.totalEdgeBandCost)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/88 ring-1 ring-slate-950/8">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">إجمالي المفصلات</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {projectSummary.totalHingeCount} مفصلة
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      التكلفة {formatPrice(projectSummary.totalHingeCost)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-slate-950 text-slate-50 ring-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-300">إجمالي التكلفة</p>
                    <p className="mt-2 text-lg font-semibold">
                      {formatPrice(projectSummary.totalProjectCost)}
                    </p>
                  </CardContent>
                </Card>
              </section>

              <section className="mt-6">
                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
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
                          className="w-fit bg-slate-100 text-slate-700"
                        >
                          {unitCostSummaries.length} وحدة
                        </Badge>
                      </div>
                      {openResultsSections.costs ? (
                        <ArrowUp className="size-4 text-[color:var(--chart-2)]" />
                      ) : (
                        <ArrowDown className="size-4 text-[color:var(--chart-2)]" />
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
                          className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(235,240,242,0.82))] p-4 shadow-[0_18px_44px_-36px_rgba(24,32,40,0.4)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">
                                {summary.unitTitle}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {summary.panelCount} قطعة •{" "}
                                {summary.totalAreaM2} م²
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="border-slate-300 bg-slate-50 text-slate-800"
                            >
                              {formatPrice(summary.totalCost)}
                            </Badge>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-white/75 p-3 ring-1 ring-slate-200">
                              <p className="text-[11px] text-slate-500">
                                ألواح 18 مم
                              </p>
                              <p className="mt-1 font-semibold text-slate-950">
                                {summary.boardSheetCount} لوح
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                استخدام {summary.boardUsedAreaM2} م²
                              </p>
                            </div>
                            <div className="rounded-xl bg-white/75 p-3 ring-1 ring-slate-200">
                              <p className="text-[11px] text-slate-500">
                                ألواح 6 مم
                              </p>
                              <p className="mt-1 font-semibold text-slate-950">
                                {summary.backSheetCount} لوح
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                استخدام {summary.backUsedAreaM2} م²
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2 rounded-xl bg-slate-950/[0.03] p-3 ring-1 ring-slate-200 text-xs text-slate-600">
                            <div className="flex items-center justify-between gap-3">
                              <span>تكلفة الألواح</span>
                              <span className="font-medium text-slate-900">
                                {formatPrice(summary.sheetCost)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>المصنعية</span>
                              <span className="font-medium text-slate-900">
                                {formatPrice(summary.laborCost)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>شريط الحافة</span>
                              <span className="font-medium text-slate-900">
                                {summary.edgeBandLengthM} م ط •{" "}
                                {formatPrice(summary.edgeBandCost)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>المفصلات</span>
                              <span className="font-medium text-slate-900">
                                {summary.hingeCount} مفصلة •{" "}
                                {formatPrice(summary.hingeCost)}
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
                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
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

              <section className="mt-6">
                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
                  <CardHeader>
                    <CardTitle>توصيات المحسن الذكي</CardTitle>
                    <CardDescription>
                      ملاحظات عملية مبنية على توزيع الألواح الحالي لتقليل الهدر
                      أو تفسير سبب الفصل بين بعض القطع.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      {projectOptimizationRecommendations.map(
                        (recommendation) => (
                          <div
                            key={recommendation.id}
                            className={cn(
                              "rounded-[1.4rem] border p-4 shadow-[0_16px_44px_-34px_rgba(24,32,40,0.35)]",
                              recommendation.tone === "action"
                                ? "border-slate-300 bg-slate-50/85"
                                : "border-slate-200 bg-slate-50/80",
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-950">
                                {recommendation.title}
                              </p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  recommendation.tone === "action"
                                    ? "border-slate-300 bg-white text-slate-900"
                                    : "border-slate-200 bg-white text-slate-700",
                                )}
                              >
                                {recommendation.tone === "action"
                                  ? "تحسين مقترح"
                                  : "معلومة ذكية"}
                              </Badge>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-slate-600">
                              {recommendation.body}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="mt-6 space-y-6">
                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
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
                          className="border-slate-200 bg-slate-50 text-slate-700"
                        >
                          {projectLayoutSheetCount} لوح /{" "}
                          {projectSheetLayout?.stocks.length ?? 0} خامة
                        </Badge>
                      </div>
                      {openResultsSections.layout ? (
                        <ArrowUp className="size-4 text-[color:var(--chart-2)]" />
                      ) : (
                        <ArrowDown className="size-4 text-[color:var(--chart-2)]" />
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
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
                      >
                        <div className="mb-4 flex flex-col gap-2 rounded-xl bg-white/90 p-3 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-950">
                              {getStockLabel(
                                stock.thickness,
                                stock.isBackStock,
                              )}
                            </p>
                            <p className="text-xs text-slate-500">
                              {stock.materialSummary} • {stock.partCount} قطعة •{" "}
                              {stock.sheets.length} لوح •{" "}
                              {formatSheetSize(
                                stock.boardLength,
                                stock.boardWidth,
                              )}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500">
                            استهلاك هذه المجموعة {stock.totalAreaM2} م²
                          </p>
                          <p className="text-xs text-slate-500">
                            الهالك داخل هذه المجموعة{" "}
                            {getStockWasteAreaM2(stock)} م²
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium leading-5 text-slate-600">
                            شريط الحافة يظهر بخط أسود متقطع على الضلع نفسه ليبقى
                            واضحًا حتى في الطباعة الأبيض والأسود.
                          </div>
                          {stock.sheets.map((sheet) => {
                            const isSheetRotated =
                              stock.boardLength >= stock.boardWidth;
                            const sheetSvgPresentation =
                              getSheetSvgPresentation(stock, isSheetRotated);

                            return (
                              <div
                                key={`${stock.key}-${sheet.index}`}
                                className="rounded-2xl border border-slate-200 bg-white/80 p-3"
                              >
                                <div className="mb-3 flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="space-y-1">
                                    <span className="block">
                                      لوح #{sheet.index + 1}
                                    </span>
                                    <span className="block">
                                      مستخدم طوليًا {formatCm(sheet.usedLength)}{" "}
                                      من {formatCm(stock.boardLength)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1.5 rounded-xl"
                                      onClick={() =>
                                        printProjectSheet(stock, sheet)
                                      }
                                    >
                                      <Printer className="size-3.5" />
                                      طباعة
                                    </Button>
                                  </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#edf3f4_0%,#dbe7e7_100%)] p-3">
                                  <svg
                                    viewBox={`-18 -18 ${sheetSvgPresentation.viewBoxWidth} ${sheetSvgPresentation.viewBoxHeight}`}
                                    className="w-full rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(201,215,222,0.96)]"
                                    preserveAspectRatio="xMidYMid meet"
                                    role="img"
                                    aria-label={`${stock.key} sheet ${sheet.index + 1} layout`}
                                  >
                                    <g
                                      transform={
                                        sheetSvgPresentation.contentTransform
                                      }
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
                                        transform={getSheetLengthLabelTransform(
                                          stock,
                                        )}
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
                                        const primaryLabel =
                                          getSheetPiecePrimaryLabel(
                                            piece,
                                            pieceLabel,
                                            projectPartLink?.code,
                                          );
                                        const nameTextPosition =
                                          getSheetPieceTextPosition(
                                            displayPiece,
                                            0,
                                            isSheetRotated,
                                          );
                                        const nameTextTransform =
                                          getSheetPieceTextTransform(
                                            displayPiece,
                                            pieceLabel.rotate,
                                            isSheetRotated,
                                            nameTextPosition,
                                          );
                                        const dimensionTexts =
                                          getSheetPieceDimensionTexts(
                                            piece,
                                            pieceLabel,
                                            isSheetRotated,
                                          );
                                        const topDimensionTextStyle =
                                          dimensionTexts.top
                                            ? getSheetPieceDimensionTextStyle(
                                                dimensionTexts.top.fontSize,
                                              )
                                            : null;
                                        const sideDimensionTextStyle =
                                          dimensionTexts.side
                                            ? getSheetPieceDimensionTextStyle(
                                                dimensionTexts.side.fontSize,
                                              )
                                            : null;
                                        const visualEdges =
                                          getSheetPieceVisualEdges(
                                            piece,
                                            displayPiece,
                                          );
                                        const edgeMarkerStrokeWidth =
                                          getSheetPieceEdgeMarkerStrokeWidth(
                                            displayPiece,
                                          );
                                        const edgeMarkerDash =
                                          getSheetPieceEdgeMarkerDash(
                                            displayPiece,
                                          );

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
                                                      : piece.category ===
                                                          "support"
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
                                              ? visualEdges.map((edgeInfo) => {
                                                  const isActive =
                                                    aggregatedPart.part
                                                      .edgeBanding[
                                                      edgeInfo.logicalSide
                                                    ] ?? false;

                                                  return (
                                                    <g
                                                      key={`${piece.id}-${edgeInfo.edge}`}
                                                    >
                                                      <rect
                                                        x={edgeInfo.x}
                                                        y={edgeInfo.y}
                                                        width={edgeInfo.width}
                                                        height={edgeInfo.height}
                                                        rx="1"
                                                        className="cursor-pointer"
                                                        fill="rgba(255,255,255,0.001)"
                                                        stroke="rgba(255,255,255,0.35)"
                                                        strokeWidth="0.3"
                                                        onClick={(event) => {
                                                          event.stopPropagation();
                                                          toggleProjectPartEdgeBand(
                                                            piece.sourcePartId,
                                                            edgeInfo.logicalSide,
                                                          );
                                                        }}
                                                      />
                                                      {isActive ? (
                                                        <g pointerEvents="none">
                                                          <line
                                                            x1={edgeInfo.lineX1}
                                                            y1={edgeInfo.lineY1}
                                                            x2={edgeInfo.lineX2}
                                                            y2={edgeInfo.lineY2}
                                                            stroke="#111827"
                                                            strokeWidth={
                                                              edgeMarkerStrokeWidth
                                                            }
                                                            strokeLinecap="butt"
                                                            strokeDasharray={
                                                              edgeMarkerDash
                                                            }
                                                          />
                                                        </g>
                                                      ) : null}
                                                    </g>
                                                  );
                                                })
                                              : null}
                                            {pieceLabel.mode === "full" ? (
                                              <g>
                                                <text
                                                  x={nameTextPosition.x}
                                                  y={nameTextPosition.y}
                                                  textAnchor="middle"
                                                  dominantBaseline="middle"
                                                  fontSize={
                                                    primaryLabel?.fontSize ??
                                                    pieceLabel.nameFontSize
                                                  }
                                                  fontWeight="700"
                                                  fill="#fff"
                                                  direction="rtl"
                                                  unicodeBidi="plaintext"
                                                  transform={nameTextTransform}
                                                >
                                                  {primaryLabel?.text ??
                                                    (projectPartLink
                                                      ? `${projectPartLink.code} • ${piece.name}`
                                                      : piece.name)}
                                                </text>
                                                {dimensionTexts.top ? (
                                                  <text
                                                    x={dimensionTexts.top.x}
                                                    y={dimensionTexts.top.y}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    fontSize={
                                                      dimensionTexts.top
                                                        .fontSize
                                                    }
                                                    fontWeight={
                                                      topDimensionTextStyle?.fontWeight
                                                    }
                                                    fill={
                                                      topDimensionTextStyle?.fill
                                                    }
                                                    stroke={
                                                      topDimensionTextStyle?.stroke
                                                    }
                                                    strokeWidth={
                                                      topDimensionTextStyle?.strokeWidth
                                                    }
                                                    strokeLinejoin={
                                                      topDimensionTextStyle?.strokeLinejoin
                                                    }
                                                    paintOrder={
                                                      topDimensionTextStyle?.paintOrder
                                                    }
                                                    transform={
                                                      dimensionTexts.top
                                                        .transform
                                                    }
                                                  >
                                                    {dimensionTexts.top.text}
                                                  </text>
                                                ) : null}
                                                {dimensionTexts.side ? (
                                                  <text
                                                    x={dimensionTexts.side.x}
                                                    y={dimensionTexts.side.y}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    fontSize={
                                                      dimensionTexts.side
                                                        .fontSize
                                                    }
                                                    fontWeight={
                                                      sideDimensionTextStyle?.fontWeight
                                                    }
                                                    fill={
                                                      sideDimensionTextStyle?.fill
                                                    }
                                                    stroke={
                                                      sideDimensionTextStyle?.stroke
                                                    }
                                                    strokeWidth={
                                                      sideDimensionTextStyle?.strokeWidth
                                                    }
                                                    strokeLinejoin={
                                                      sideDimensionTextStyle?.strokeLinejoin
                                                    }
                                                    paintOrder={
                                                      sideDimensionTextStyle?.paintOrder
                                                    }
                                                    transform={
                                                      dimensionTexts.side
                                                        .transform
                                                    }
                                                  >
                                                    {dimensionTexts.side.text}
                                                  </text>
                                                ) : null}
                                              </g>
                                            ) : pieceLabel.mode === "dims" ? (
                                              <g>
                                                {dimensionTexts.top ? (
                                                  <text
                                                    x={dimensionTexts.top.x}
                                                    y={dimensionTexts.top.y}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    fontSize={
                                                      dimensionTexts.top
                                                        .fontSize
                                                    }
                                                    fontWeight={
                                                      topDimensionTextStyle?.fontWeight
                                                    }
                                                    fill={
                                                      topDimensionTextStyle?.fill
                                                    }
                                                    stroke={
                                                      topDimensionTextStyle?.stroke
                                                    }
                                                    strokeWidth={
                                                      topDimensionTextStyle?.strokeWidth
                                                    }
                                                    strokeLinejoin={
                                                      topDimensionTextStyle?.strokeLinejoin
                                                    }
                                                    paintOrder={
                                                      topDimensionTextStyle?.paintOrder
                                                    }
                                                    transform={
                                                      dimensionTexts.top
                                                        .transform
                                                    }
                                                  >
                                                    {dimensionTexts.top.text}
                                                  </text>
                                                ) : null}
                                                {dimensionTexts.side ? (
                                                  <text
                                                    x={dimensionTexts.side.x}
                                                    y={dimensionTexts.side.y}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    fontSize={
                                                      dimensionTexts.side
                                                        .fontSize
                                                    }
                                                    fontWeight={
                                                      sideDimensionTextStyle?.fontWeight
                                                    }
                                                    fill={
                                                      sideDimensionTextStyle?.fill
                                                    }
                                                    stroke={
                                                      sideDimensionTextStyle?.stroke
                                                    }
                                                    strokeWidth={
                                                      sideDimensionTextStyle?.strokeWidth
                                                    }
                                                    strokeLinejoin={
                                                      sideDimensionTextStyle?.strokeLinejoin
                                                    }
                                                    paintOrder={
                                                      sideDimensionTextStyle?.paintOrder
                                                    }
                                                    transform={
                                                      dimensionTexts.side
                                                        .transform
                                                    }
                                                  >
                                                    {dimensionTexts.side.text}
                                                  </text>
                                                ) : null}
                                              </g>
                                            ) : null}
                                          </g>
                                        );
                                      })}
                                    </g>
                                  </svg>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {projectWasteInsight ? (
                      <div className="rounded-2xl border border-slate-300 bg-slate-100 p-4 text-sm leading-7 text-slate-950 ring-1 ring-slate-100">
                        <p className="font-medium">قراءة سريعة للهالك</p>
                        <p className="mt-2 text-slate-900">
                          {projectWasteInsight}
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter className="justify-between border-t border-slate-200/80 bg-slate-50/80 text-xs text-slate-500">
                    <span>
                      توزيع المشروع يظل مفصولًا حسب سماكة اللوح لكل خامة.
                    </span>
                    <span>{projectLayoutWastePercent}% هالك تقريبي</span>
                  </CardFooter>
                </Card>

                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
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
                        <ArrowUp className="size-4 text-[color:var(--chart-2)]" />
                      ) : (
                        <ArrowDown className="size-4 text-[color:var(--chart-2)]" />
                      )}
                    </button>
                  </CardHeader>
                  <CardContent
                    className={cn(
                      "grid gap-3 sm:grid-cols-2",
                      !openResultsSections.metrics && "hidden",
                    )}
                  >
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">عدد الوحدات</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {projectSummary.unitCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">
                        الخامات المستخدمة
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {projectMaterialSummary || "--"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">إجمالي الواجهات</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {projectFrontPieceCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">المفصلات</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {projectSummary.totalHingeCount} ×{" "}
                        {formatPrice(projectSettings.hingePrice)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        الإجمالي {formatPrice(projectSummary.totalHingeCost)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">الهالك التقريبي</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {projectLayoutWastePercent}%
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">تسعير الألواح</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        18 مم: {formatPrice(projectSettings.boardSheetPrice)} •
                        6 مم: {formatPrice(projectSettings.backSheetPrice)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">مصنعية المتر</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {formatPrice(projectSettings.laborPricePerSquareMeter)}{" "}
                        / م²
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">شريط الحافة</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {projectSummary.totalEdgeBandLengthM} م ط ×{" "}
                        {formatPrice(projectSettings.edgeBandPricePerMeter)} ={" "}
                        {formatPrice(projectSummary.totalEdgeBandCost)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">سعر المفصلة</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {formatPrice(projectSettings.hingePrice)} / قطعة
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="mt-6">
                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
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
                          className="w-fit bg-slate-100 text-slate-700"
                        >
                          {workshopExecutionCards.length} بطاقة
                        </Badge>
                      </div>
                      {openResultsSections.workshop ? (
                        <ArrowUp className="size-4 text-[color:var(--chart-2)]" />
                      ) : (
                        <ArrowDown className="size-4 text-[color:var(--chart-2)]" />
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
                          className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(235,240,242,0.82))] p-4 shadow-[0_18px_44px_-36px_rgba(24,32,40,0.4)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">
                                {card.part.name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {card.unitTitle} •{" "}
                                {partCategoryLabels[card.part.category]}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge
                                variant="outline"
                                className="border-slate-200 bg-white text-slate-700"
                              >
                                تشغيل #{card.operationOrder}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-slate-300 bg-slate-50 text-slate-800"
                              >
                                {card.partCode} • × {card.part.qty}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-white/75 p-3 ring-1 ring-slate-200">
                              <p className="text-[11px] text-slate-500">
                                الطول × العرض
                              </p>
                              <p className="mt-1 font-semibold text-slate-950">
                                {formatCm(card.part.length)} ×{" "}
                                {formatCm(card.part.width)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white/75 p-3 ring-1 ring-slate-200">
                              <p className="text-[11px] text-slate-500">
                                السمك
                              </p>
                              <p className="mt-1 font-semibold text-slate-950">
                                {formatCm(card.part.thickness)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 rounded-xl bg-slate-950/[0.03] p-3 ring-1 ring-slate-200">
                            <p className="text-[11px] text-slate-500">
                              ربط اللوح
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                              {card.primarySheetReference ?? "لم يُوزع بعد"}
                            </p>
                            {card.sheetReferences.length > 1 ? (
                              <p className="mt-1 text-[11px] leading-6 text-slate-500">
                                {card.sheetReferences.join(" • ")}
                              </p>
                            ) : null}
                          </div>

                          <div className="mt-3 rounded-xl bg-slate-950/[0.03] p-3 ring-1 ring-slate-200">
                            <p className="text-[11px] text-slate-500">الحواف</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                              {formatPartEdgeBanding(card.part)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              إجمالي الطول:{" "}
                              {formatCm(getPartEdgeBandLengthCm(card.part))}
                            </p>
                          </div>

                          <div className="mt-3 rounded-xl bg-white/75 p-3 ring-1 ring-slate-200">
                            <p className="text-[11px] text-slate-500">
                              ملاحظات التنفيذ
                            </p>
                            <p className="mt-1 text-xs leading-6 text-slate-600">
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
                <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
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
                          className="w-fit bg-slate-100 text-slate-700"
                        >
                          {selectedPartId
                            ? "جزء محدد"
                            : `${projectPartLinks.length} كود قطعة`}
                        </Badge>
                      </div>
                      {openResultsSections.parts ? (
                        <ArrowUp className="size-4 text-[color:var(--chart-2)]" />
                      ) : (
                        <ArrowDown className="size-4 text-[color:var(--chart-2)]" />
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
                          <TableHead className="px-3 text-right text-slate-700">
                            الجزء
                          </TableHead>
                          <TableHead className="px-3 text-right text-slate-700">
                            الفئة
                          </TableHead>
                          <TableHead className="px-3 text-right text-slate-700">
                            العدد
                          </TableHead>
                          <TableHead className="px-3 text-right text-slate-700">
                            الطول
                          </TableHead>
                          <TableHead className="px-3 text-right text-slate-700">
                            العرض
                          </TableHead>
                          <TableHead className="px-3 text-right text-slate-700">
                            السمك
                          </TableHead>
                          <TableHead className="px-3 text-right text-slate-700">
                            الحواف
                          </TableHead>
                          <TableHead className="px-3 text-right text-slate-700">
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
                                "bg-slate-50 hover:bg-slate-50",
                            )}
                            onClick={() => handlePartSelection(part.id)}
                          >
                            <TableCell className="px-3 align-top font-medium whitespace-normal text-slate-900">
                              <span className="inline-flex min-w-16 items-center justify-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
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
                            <TableCell className="px-3 align-top whitespace-normal text-xs leading-6 text-slate-500">
                              {formatPartEdgeBanding(part)}
                              <span className="mt-1 block text-[11px] text-slate-400">
                                {formatCm(getPartEdgeBandLengthCm(part))}
                              </span>
                              {projectPartLinkMap.get(part.id)
                                ?.primarySheetReference ? (
                                <span className="mt-2 block text-[11px] text-slate-500">
                                  {
                                    projectPartLinkMap.get(part.id)
                                      ?.primarySheetReference
                                  }
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="px-3 align-top whitespace-normal text-xs leading-6 text-slate-500">
                              {part.notes}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                  <CardFooter className="justify-between border-t border-slate-200/80 bg-slate-50/80 text-xs text-slate-500">
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
              <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
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
            <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
              <CardHeader>
                <CardTitle>المشاريع المحفوظة</CardTitle>
                <CardDescription>
                  وصول سريع لآخر المشاريع بدل فتح الشاشة كاملة كل مرة.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentSavedProjects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-500">
                    لا توجد مشاريع محفوظة بعد.
                  </div>
                ) : (
                  recentSavedProjects.map((project) => (
                    <div
                      key={project.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 ring-1 ring-slate-200"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950">
                            {project.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
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

            <Card className="border-0 bg-white/88 shadow-[0_20px_60px_-45px_rgba(24,32,40,0.55)] ring-1 ring-slate-950/8">
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
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 ring-1 ring-slate-200"
                  >
                    <p className="font-medium text-slate-950">{preset.title}</p>
                    <p className="mt-1 text-xs leading-6 text-slate-500">
                      {preset.description}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
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
            className="h-12 w-full rounded-[1.25rem] shadow-[0_20px_50px_-30px_rgba(24,32,40,0.65)]"
            onClick={mobilePrimaryAction.onClick}
            disabled={mobilePrimaryAction.disabled}
          >
            <mobilePrimaryAction.icon className="size-4" />
            {mobilePrimaryAction.label}
          </Button>
        </div>

        <nav className="fixed inset-x-4 bottom-4 z-40 rounded-[1.5rem] border border-slate-200 bg-white/92 p-2 shadow-[0_20px_60px_-35px_rgba(24,32,40,0.55)] backdrop-blur sm:hidden">
          <div className="grid grid-cols-5 gap-2">
            {workspaceTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeWorkspaceTab === tab.id;
              const isPendingTarget =
                isWorkspaceTransitionPending && pendingWorkspaceTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigateToWorkspaceTab(tab.id)}
                  disabled={isWorkspaceTransitionPending}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] disabled:cursor-wait disabled:opacity-75",
                    isActive ? "bg-slate-950 text-slate-50" : "text-slate-600",
                  )}
                >
                  {isPendingTarget ? (
                    <RotateCw className="size-4 animate-spin" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                  <span className="mt-1">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {blockingOverlayMessage ? (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[3px]">
            <div className="w-full max-w-md rounded-[1.75rem] border border-white/35 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(30,41,59,0.9))] px-6 py-7 text-white shadow-[0_30px_80px_-35px_rgba(15,23,42,0.85)] ring-1 ring-white/10">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <RotateCw className="size-5 animate-spin" />
                </div>
                <div>
                  <p className="text-base font-semibold">{blockingOverlayMessage}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-200">
                    {blockingOverlayDescription}
                  </p>
                </div>
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#93c5fd,#e2e8f0)]" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default App;
