export type CabinetType =
  | "base"
  | "wall"
  | "tall"
  | "corner-l-base"
  | "corner-l-wall";
export type MaterialType = "mdf" | "melamine" | "plywood";
export type FrontOption = "doors" | "drawers" | "mixed" | "none";
export type GrainDirection = "free" | "length" | "width";
export type CornerHand = "left" | "right";

export type CabinetInput = {
  width: number;
  height: number;
  depth: number;
  returnDepth: number;
  boardThickness: number;
  backThickness: number;
  shelfCount: number;
  cabinetType: CabinetType;
  cornerHand: CornerHand;
  material: MaterialType;
  frontOption: FrontOption;
  drawerCount: number;
  doorLeafCount: number;
  grainDirection: GrainDirection;
};

export type PartCategory = "carcass" | "shelf" | "back" | "support" | "front";
export type PartKind =
  | "side"
  | "bottom"
  | "top"
  | "top-stretcher"
  | "hanging-rail"
  | "fixed-shelf"
  | "shelf"
  | "back"
  | "front-main"
  | "front-drawer"
  | "front-upper"
  | "front-lower"
  | "plinth";

export type EdgeBandSide =
  | "length-start"
  | "length-end"
  | "width-start"
  | "width-end";

export type EdgeBandProfile = Partial<Record<EdgeBandSide, boolean>>;

export const edgeBandSideLabels: Record<EdgeBandSide, string> = {
  "length-start": "الطول الأول",
  "length-end": "الطول الثاني",
  "width-start": "العرض الأول",
  "width-end": "العرض الثاني",
};

export type CutlistPart = {
  id: string;
  kind: PartKind;
  name: string;
  category: PartCategory;
  qty: number;
  length: number;
  width: number;
  thickness: number;
  material: MaterialType;
  notes: string;
  edgeBanding: EdgeBandProfile;
  grainDirection: GrainDirection;
  allowRotation: boolean;
};

export type CabinetCutlistResult = {
  parts: CutlistPart[];
  warnings: string[];
  metrics: {
    sideHeight: number;
    innerWidth: number;
    innerHeight: number;
    usableDepth: number;
    frontCount: number;
    frontRows: number;
    drawerCount: number;
    doorLeafCount: number;
    totalPanels: number;
    totalAreaM2: number;
    estimatedSheets: number;
    wastePercent: number;
  };
};

export type SheetLayoutPiece = {
  id: string;
  sourcePartId: string;
  name: string;
  category: PartCategory;
  sheetIndex: number;
  x: number;
  y: number;
  length: number;
  width: number;
  rotated: boolean;
};

export type SheetLayoutSheet = {
  index: number;
  usedLength: number;
  rows: number;
  pieces: SheetLayoutPiece[];
};

export type SheetLayoutStock = {
  key: string;
  material: MaterialType;
  materialSummary: string;
  thickness: number;
  boardLength: number;
  boardWidth: number;
  totalAreaM2: number;
  partCount: number;
  isBackStock: boolean;
  sheets: SheetLayoutSheet[];
};

export type SheetStockSize = {
  length: number;
  width: number;
};

export type SheetLayoutOptions = {
  boardStockSize?: SheetStockSize;
  backStockSize?: SheetStockSize;
  cutKerf?: number;
  trimMargin?: number;
};

export type SheetLayoutResult = {
  boardLength: number;
  boardWidth: number;
  stocks: SheetLayoutStock[];
};

const sheetAreaM2 = (240 * 120) / 10000;
const boardLength = 240;
const boardWidth = 120;
const defaultBoardStockSize: SheetStockSize = {
  length: boardLength,
  width: boardWidth,
};

const cabinetProfiles: Record<
  CabinetType,
  {
    toeKickHeight: number;
    useTopStretchers: boolean;
    includePlinth: boolean;
    hangingRailCount: number;
    fixedShelfCount: number;
    frontRows: 1 | 2;
    frontSplitHeightRatio: number;
    doorStyle: string;
  }
> = {
  base: {
    toeKickHeight: 0,
    useTopStretchers: true,
    includePlinth: false,
    hangingRailCount: 0,
    fixedShelfCount: 0,
    frontRows: 1,
    frontSplitHeightRatio: 0.5,
    doorStyle: "أبواب أمامية على جسم أرضي",
  },
  "corner-l-base": {
    toeKickHeight: 0,
    useTopStretchers: true,
    includePlinth: false,
    hangingRailCount: 0,
    fixedShelfCount: 0,
    frontRows: 1,
    frontSplitHeightRatio: 0.5,
    doorStyle: "واجهة ركنة زاوية 45° أرضية",
  },
  "corner-l-wall": {
    toeKickHeight: 0,
    useTopStretchers: false,
    includePlinth: false,
    hangingRailCount: 2,
    fixedShelfCount: 0,
    frontRows: 1,
    frontSplitHeightRatio: 0.5,
    doorStyle: "واجهة ركنة زاوية 45° علوية",
  },
  wall: {
    toeKickHeight: 0,
    useTopStretchers: false,
    includePlinth: false,
    hangingRailCount: 2,
    fixedShelfCount: 0,
    frontRows: 1,
    frontSplitHeightRatio: 0.5,
    doorStyle: "أبواب أمامية لوحدة معلقة",
  },
  tall: {
    toeKickHeight: 10,
    useTopStretchers: false,
    includePlinth: true,
    hangingRailCount: 0,
    fixedShelfCount: 1,
    frontRows: 2,
    frontSplitHeightRatio: 0.42,
    doorStyle: "أبواب أمامية لوحدة طويلة",
  },
};

export const defaultInput: CabinetInput = {
  width: 120,
  height: 90,
  depth: 60,
  returnDepth: 60,
  boardThickness: 1.8,
  backThickness: 0.6,
  shelfCount: 2,
  cabinetType: "base",
  cornerHand: "left",
  material: "mdf",
  frontOption: "doors",
  drawerCount: 2,
  doorLeafCount: 2,
  grainDirection: "free",
};

export const cabinetTypeLabels: Record<CabinetType, string> = {
  base: "وحدة أرضية",
  "corner-l-base": "ركنة زاوية 45° أرضية",
  "corner-l-wall": "ركنة زاوية 45° علوية",
  wall: "وحدة معلقة",
  tall: "وحدة طويلة",
};

export const cornerPlacementLabels: Record<"base" | "wall", string> = {
  base: "سفلية",
  wall: "علوية",
};

export const cornerHandLabels: Record<CornerHand, string> = {
  left: "رجوع يسار",
  right: "رجوع يمين",
};

export const materialLabels: Record<MaterialType, string> = {
  mdf: "MDF",
  melamine: "ميلامين",
  plywood: "كونتر",
};

export const frontOptionLabels: Record<FrontOption, string> = {
  doors: "بدلف",
  drawers: "أدراج",
  mixed: "أدراج + دلف",
  none: "بدون دلف",
};

export const grainDirectionLabels: Record<GrainDirection, string> = {
  free: "حر",
  length: "طولي مع طول اللوح",
  width: "عرضي مع عرض اللوح",
};

export const partCategoryLabels: Record<PartCategory, string> = {
  carcass: "هيكل",
  shelf: "رفوف",
  back: "ظهر",
  support: "دعامات",
  front: "واجهات",
};

export function round2(value: number) {
  return Number(value.toFixed(2));
}

export function formatCm(value: number) {
  return `${round2(value)} سم`;
}

function clamp(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(value, 0);
}

function createPart(
  part: Omit<
    CutlistPart,
    "id" | "grainDirection" | "allowRotation" | "edgeBanding"
  > & {
    grainDirection?: GrainDirection;
    allowRotation?: boolean;
    edgeBanding?: EdgeBandProfile;
  },
): CutlistPart {
  return {
    ...part,
    id: `${part.kind}-${part.length}-${part.width}-${part.qty}`,
    edgeBanding: part.edgeBanding ?? getDefaultEdgeBanding(part.kind),
    grainDirection: part.grainDirection ?? "free",
    allowRotation: part.allowRotation ?? true,
  };
}

function getDefaultEdgeBanding(kind: PartKind): EdgeBandProfile {
  switch (kind) {
    case "side":
    case "bottom":
    case "top":
    case "fixed-shelf":
    case "shelf":
      return { "length-start": true };
    case "front-main":
    case "front-drawer":
    case "front-upper":
    case "front-lower":
    case "plinth":
      return {
        "length-start": true,
        "length-end": true,
        "width-start": true,
        "width-end": true,
      };
    default:
      return {};
  }
}

export function calculateCabinetCutlist(
  input: CabinetInput,
): CabinetCutlistResult {
  const installationClearance = 0.5;
  const backClearancePerSide = 0.5;

  const profile = cabinetProfiles[input.cabinetType];
  const normalized = {
    width: clamp(input.width),
    height: clamp(input.height),
    depth: clamp(input.depth),
    returnDepth: clamp(input.returnDepth),
    boardThickness: clamp(input.boardThickness),
    backThickness: clamp(input.backThickness),
    shelfCount: Math.max(0, Math.floor(clamp(input.shelfCount))),
    cabinetType: input.cabinetType,
    cornerHand: input.cornerHand,
    material: input.material,
    frontOption: input.frontOption,
    drawerCount: Math.max(1, Math.floor(clamp(input.drawerCount || 0))),
    doorLeafCount: Math.min(
      2,
      Math.max(1, Math.floor(clamp(input.doorLeafCount || 0))),
    ),
    grainDirection: input.grainDirection,
  };
  const lockGrain = normalized.grainDirection !== "free";
  const isBlindCornerBase =
    normalized.cabinetType === "corner-l-base" ||
    normalized.cabinetType === "corner-l-wall";

  const hasDoors =
    normalized.frontOption === "doors" || normalized.frontOption === "mixed";
  const hasDrawers =
    !isBlindCornerBase &&
    (normalized.frontOption === "drawers" ||
      normalized.frontOption === "mixed");
  const hasFronts = hasDoors || hasDrawers;
  const overallWidth = isBlindCornerBase
    ? normalized.width +
      Math.max(normalized.returnDepth - normalized.boardThickness, 0)
    : normalized.width;

  const sideHeight = Math.max(normalized.height - profile.toeKickHeight, 0);
  const innerWidth = Math.max(overallWidth - normalized.boardThickness * 2, 0);
  const usableDepth = Math.max(
    normalized.depth - normalized.backThickness - installationClearance,
    0,
  );
  const innerHeight = Math.max(
    sideHeight - normalized.boardThickness * (profile.useTopStretchers ? 1 : 2),
    0,
  );
  const doorLeafCount = hasDoors
    ? normalized.frontOption === "mixed"
      ? normalized.doorLeafCount
      : normalized.doorLeafCount
    : 0;
  const drawerCount = hasDrawers ? normalized.drawerCount : 0;
  const frontCount = hasFronts ? doorLeafCount + drawerCount : 0;
  const frontRows =
    hasDoors && !hasDrawers
      ? normalized.cabinetType === "tall" && normalized.height >= 180
        ? 2
        : profile.frontRows
      : 0;
  const doorGap = doorLeafCount === 2 ? 0.3 : 0;
  const frontWidth = Math.max(
    doorLeafCount > 0 ? (normalized.width - 0.6 - doorGap) / doorLeafCount : 0,
    0,
  );
  const frontHeight = hasFronts ? Math.max(sideHeight - 0.6, 0) : 0;
  const drawerGap = drawerCount > 1 ? 0.3 : 0;
  const drawerFrontWidth = hasDrawers ? Math.max(normalized.width - 0.6, 0) : 0;
  const drawerZoneRatio = normalized.cabinetType === "tall" ? 0.36 : 0.32;
  const mixedZoneGap = hasDoors && hasDrawers ? 0.3 : 0;
  const mixedDrawerZoneHeight =
    hasDrawers && hasDoors ? Math.max(frontHeight * drawerZoneRatio, 0) : 0;
  const drawerAvailableHeight = hasDrawers
    ? hasDoors
      ? Math.max(frontHeight - mixedZoneGap, 0) > 0
        ? Math.min(
            mixedDrawerZoneHeight,
            Math.max(frontHeight - mixedZoneGap - 18, 0),
          )
        : 0
      : frontHeight
    : 0;
  const drawerFrontHeight = hasDrawers
    ? Math.max(
        (drawerAvailableHeight - Math.max(drawerCount - 1, 0) * drawerGap) /
          drawerCount,
        0,
      )
    : 0;
  const mixedDoorHeight =
    hasDoors && hasDrawers
      ? Math.max(frontHeight - drawerAvailableHeight - mixedZoneGap, 0)
      : frontHeight;
  const frontVerticalGap = frontRows === 2 ? 0.3 : 0;
  const upperFrontHeight =
    frontRows === 2
      ? Math.max(
          (frontHeight - frontVerticalGap) * profile.frontSplitHeightRatio,
          0,
        )
      : frontHeight;
  const lowerFrontHeight =
    frontRows === 2
      ? Math.max(frontHeight - frontVerticalGap - upperFrontHeight, 0)
      : 0;
  const backWidth = Math.max(innerWidth + backClearancePerSide * 2, 0);
  const backHeight = Math.max(sideHeight - backClearancePerSide * 2, 0);
  const carcassPanelDepth = normalized.depth;
  const shelfDepthOffset = 3;
  const shelfWidth = innerWidth;
  const shelfDepth = Math.max(carcassPanelDepth - shelfDepthOffset, 0);
  const backGrooveNote =
    "يُقص العمق كاملًا ثم يُترك من الخلف 1.8 سم ويُحز بعمق 0.5 سم لتثبيت الظهر";

  const parts: CutlistPart[] = isBlindCornerBase
    ? [
        createPart({
          kind: "side",
          name: normalized.cornerHand === "left" ? "جنب راجع" : "جنب رئيسي",
          category: "carcass",
          qty: 1,
          length: sideHeight,
          width:
            normalized.cornerHand === "left"
              ? normalized.returnDepth
              : normalized.depth,
          thickness: normalized.boardThickness,
          material: normalized.material,
          notes:
            normalized.cornerHand === "left"
              ? "جنب الرجوع الداخلي لركنة زاوية 45°"
              : "الجنب الرئيسي بكامل عمق الوحدة",
        }),
        createPart({
          kind: "side",
          name: normalized.cornerHand === "left" ? "جنب رئيسي" : "جنب راجع",
          category: "carcass",
          qty: 1,
          length: sideHeight,
          width:
            normalized.cornerHand === "left"
              ? normalized.depth
              : normalized.returnDepth,
          thickness: normalized.boardThickness,
          material: normalized.material,
          notes:
            normalized.cornerHand === "left"
              ? "الجنب الرئيسي بكامل عمق الوحدة"
              : "جنب الرجوع الداخلي لركنة زاوية 45°",
        }),
      ]
    : [
        createPart({
          kind: "side",
          name: "جنب",
          category: "carcass",
          qty: 2,
          length: sideHeight,
          width: normalized.depth,
          thickness: normalized.boardThickness,
          material: normalized.material,
          notes:
            normalized.cabinetType === "wall"
              ? "الجنب بكامل ارتفاع الوحدة المعلقة"
              : normalized.cabinetType === "base"
                ? "الجنب بكامل ارتفاع الوحدة الأرضية"
                : "الجنب محسوب بعد خصم الارتداد السفلي",
        }),
      ];

  if (profile.useTopStretchers) {
    parts.push(
      createPart({
        kind: "bottom",
        name: isBlindCornerBase ? "قاعدة زاوية" : "قاعدة داخلية",
        category: "carcass",
        qty: 1,
        length: innerWidth,
        width: carcassPanelDepth,
        thickness: normalized.boardThickness,
        material: normalized.material,
        notes: isBlindCornerBase
          ? `لوح خام لقاعدة ركنة زاوية 45° مع قص الواجهة المائلة حسب اتجاه ${cornerHandLabels[normalized.cornerHand]} وطول الضلع الثاني ${round2(normalized.returnDepth)} سم`
          : `قاعدة بين الجنبين للوحدة الأرضية - ${backGrooveNote}`,
      }),
      createPart({
        kind: "top-stretcher",
        name: "دعامة علوية",
        category: "support",
        qty: 2,
        length: isBlindCornerBase
          ? Math.max(normalized.width - normalized.boardThickness * 2, 0)
          : innerWidth,
        width: 10,
        thickness: normalized.boardThickness,
        material: normalized.material,
        notes: isBlindCornerBase
          ? "دعامات أمامية وخلفية على فتحة الركنة الزاوية 45°"
          : "دعامات أمامية وخلفية أعلى الوحدة الأرضية",
      }),
    );
  } else {
    parts.push(
      createPart({
        kind: "top",
        name: "سطح علوي",
        category: "carcass",
        qty: 1,
        length: innerWidth,
        width: carcassPanelDepth,
        thickness: normalized.boardThickness,
        material: normalized.material,
        notes:
          normalized.cabinetType === "wall"
            ? `لوح علوي بين الجنبين للوحدة المعلقة - ${backGrooveNote}`
            : `لوح علوي بين الجنبين للوحدة الطويلة - ${backGrooveNote}`,
      }),
      createPart({
        kind: "bottom",
        name: "قاعدة سفلية",
        category: "carcass",
        qty: 1,
        length: innerWidth,
        width: carcassPanelDepth,
        thickness: normalized.boardThickness,
        material: normalized.material,
        notes:
          normalized.cabinetType === "wall"
            ? `لوح سفلي بين الجنبين للوحدة المعلقة - ${backGrooveNote}`
            : `لوح سفلي بين الجنبين للوحدة الطويلة - ${backGrooveNote}`,
      }),
    );
  }

  if (profile.fixedShelfCount > 0) {
    parts.push(
      createPart({
        kind: "fixed-shelf",
        name: "رف ثابت",
        category: "carcass",
        qty: profile.fixedShelfCount,
        length: shelfWidth,
        width: shelfDepth,
        thickness: normalized.boardThickness,
        material: normalized.material,
        notes: `رف إنشائي ثابت لتقوية جسم الوحدة الطويلة - أقل من عمق القاعدة الداخلية بـ 3 سم - ${backGrooveNote}`,
      }),
    );
  }

  if (normalized.shelfCount > 0) {
    parts.push(
      createPart({
        kind: "shelf",
        name: isBlindCornerBase ? "رف زاوية" : "رف داخلي",
        category: "shelf",
        qty: normalized.shelfCount,
        length: shelfWidth,
        width: shelfDepth,
        thickness: normalized.boardThickness,
        material: normalized.material,
        notes: isBlindCornerBase
          ? `لوح خام لرف ركنة زاوية 45° مع قص الواجهة المائلة حسب اتجاه ${cornerHandLabels[normalized.cornerHand]}`
          : "رفوف متحركة أقل من عمق القاعدة الداخلية بـ 3 سم",
      }),
    );
  }

  parts.push(
    createPart({
      kind: "back",
      name: "ظهر",
      category: "back",
      qty: 1,
      length: backWidth,
      width: backHeight,
      thickness: normalized.backThickness,
      material: normalized.material,
      notes: isBlindCornerBase
        ? `ظهر خام لركنة زاوية 45° يحتاج تعليم وقص حسب اتجاه ${cornerHandLabels[normalized.cornerHand]}`
        : "ظهر خارجي يزيد 0.5 سم في العرض من كل جنب ويقل 0.5 سم في الارتفاع من أعلى وأسفل",
    }),
  );

  if (hasFronts) {
    if (hasDrawers) {
      parts.push(
        createPart({
          kind: "front-drawer",
          name: drawerCount === 1 ? "واجهة درج" : "واجهات أدراج",
          category: "front",
          qty: drawerCount,
          length: drawerFrontWidth,
          width: drawerFrontHeight,
          thickness: normalized.boardThickness,
          material: normalized.material,
          notes:
            normalized.frontOption === "mixed"
              ? "أدراج علوية مع دلف سفلية"
              : "أدراج أمامية على عرض الوحدة بالكامل",
        }),
      );
    }

    if (hasDoors && !hasDrawers && frontRows === 2) {
      parts.push(
        createPart({
          kind: "front-upper",
          name: "واجهة علوية",
          category: "front",
          qty: doorLeafCount,
          length: frontWidth,
          width: upperFrontHeight,
          thickness: normalized.boardThickness,
          material: normalized.material,
          notes: `${profile.doorStyle} - صف علوي`,
        }),
        createPart({
          kind: "front-lower",
          name: "واجهة سفلية",
          category: "front",
          qty: doorLeafCount,
          length: frontWidth,
          width: lowerFrontHeight,
          thickness: normalized.boardThickness,
          material: normalized.material,
          notes: `${profile.doorStyle} - صف سفلي`,
        }),
      );
    } else if (hasDoors) {
      parts.push(
        createPart({
          kind: "front-main",
          name: doorLeafCount === 2 ? "دلفة" : "باب",
          category: "front",
          qty: doorLeafCount,
          length: frontWidth,
          width: hasDrawers ? mixedDoorHeight : frontHeight,
          thickness: normalized.boardThickness,
          material: normalized.material,
          notes:
            normalized.frontOption === "mixed"
              ? `${profile.doorStyle} - جزء سفلي أسفل الأدراج`
              : profile.doorStyle,
        }),
      );
    }
  }

  if (profile.includePlinth) {
    parts.push(
      createPart({
        kind: "plinth",
        name: "وزرة أمامية",
        category: "support",
        qty: 1,
        length: innerWidth,
        width: profile.toeKickHeight,
        thickness: normalized.boardThickness,
        material: normalized.material,
        notes: "واجهة قاعدة أمامية",
      }),
    );
  }

  parts.forEach((part) => {
    part.grainDirection = normalized.grainDirection;
    part.allowRotation = !lockGrain;

    if (lockGrain) {
      part.notes = `${part.notes} • اتجاه الثمرة: ${grainDirectionLabels[normalized.grainDirection]}`;
    }
  });

  const warnings: string[] = [];

  if (innerWidth <= 0) {
    warnings.push(
      "العرض الحالي أصغر من أن يستوعب الجنبين معًا بعد خصم السماكة.",
    );
  }

  if (usableDepth <= 0) {
    warnings.push("العمق الحالي لا يكفي بعد خصم سمك الظهر والخلوص الخلفي.");
  }

  if (hasFronts && frontHeight <= 0) {
    warnings.push("ارتفاع الواجهة غير صالح. راجع ارتفاع الوحدة أو الوزرة.");
  }

  if (hasDrawers && drawerFrontHeight <= 0) {
    warnings.push(
      "ارتفاع واجهات الأدراج غير صالح. قلل عدد الأدراج أو زِد ارتفاع الوحدة.",
    );
  }

  if (hasDoors && hasDrawers && mixedDoorHeight <= 0) {
    warnings.push(
      "المساحة المتبقية للدلف غير كافية بعد توزيع الأدراج. راجع عدد الأدراج أو ارتفاع الوحدة.",
    );
  }

  if (
    (normalized.cabinetType === "wall" ||
      normalized.cabinetType === "corner-l-wall") &&
    normalized.depth > 40
  ) {
    warnings.push(
      "الوحدات المعلقة عادة تكون أقل عمقًا من هذا الرقم. راجع العمق إذا لزم.",
    );
  }

  if (
    (normalized.cabinetType === "base" ||
      normalized.cabinetType === "corner-l-base") &&
    normalized.depth < 50
  ) {
    warnings.push(
      "الوحدات الأرضية غالبًا تحتاج عمقًا أكبر من 50 سم للأجهزة والرخامة.",
    );
  }

  if (isBlindCornerBase && normalized.returnDepth < 30) {
    warnings.push(
      "عمق الرجوع في الزاوية الحرة L صغير جدًا وقد لا يكون عمليًا في التنفيذ.",
    );
  }

  if (
    isBlindCornerBase &&
    input.frontOption !== "doors" &&
    input.frontOption !== "none"
  ) {
    warnings.push(
      "النسخة الحالية من وحدة الزاوية الحرة L تدعم الأبواب فقط، وليست الأدراج أو المختلط.",
    );
  }

  if (normalized.cabinetType === "tall" && normalized.height < 170) {
    warnings.push(
      "الوحدة الطويلة عادة تحتاج ارتفاعًا أكبر من هذا المقاس حتى تكون النسب عملية.",
    );
  }

  if (
    normalized.material === "plywood" &&
    normalized.grainDirection === "free"
  ) {
    warnings.push(
      "خامة الكونتر غالبًا تحتاج تحديد اتجاه ثمرة الخشب قبل اعتماد توزيع الألواح.",
    );
  }

  const totalPanels = parts.reduce((sum, part) => sum + part.qty, 0);
  const totalAreaM2 = round2(
    parts.reduce(
      (sum, part) => sum + (part.length * part.width * part.qty) / 10000,
      0,
    ),
  );
  const estimatedSheets =
    totalAreaM2 > 0 ? Math.ceil(totalAreaM2 / sheetAreaM2) : 0;
  const wastePercent =
    estimatedSheets > 0
      ? round2(
          ((estimatedSheets * sheetAreaM2 - totalAreaM2) /
            (estimatedSheets * sheetAreaM2)) *
            100,
        )
      : 0;

  return {
    parts,
    warnings,
    metrics: {
      sideHeight: round2(sideHeight),
      innerWidth: round2(innerWidth),
      innerHeight: round2(innerHeight),
      usableDepth: round2(usableDepth),
      frontCount,
      frontRows,
      drawerCount,
      doorLeafCount,
      totalPanels,
      totalAreaM2,
      estimatedSheets,
      wastePercent,
    },
  };
}

function buildSingleStockSheets(
  parts: CutlistPart[],
  stockSize: SheetStockSize,
  layoutOptions: SheetLayoutOptions = {},
): SheetLayoutSheet[] {
  type FlatPiece = {
    id: string;
    sourcePartId: string;
    name: string;
    category: PartCategory;
    length: number;
    width: number;
    allowRotation: boolean;
  };

  type FreeRect = {
    x: number;
    y: number;
    length: number;
    width: number;
  };

  type InternalSheet = {
    index: number;
    pieces: SheetLayoutPiece[];
    freeRects: FreeRect[];
  };

  type InternalRow = {
    x: number;
    length: number;
    usedWidth: number;
  };

  type InternalShelfSheet = {
    index: number;
    pieces: SheetLayoutPiece[];
    rows: InternalRow[];
    usedLength: number;
  };

  type Placement = {
    score: number;
    shortSideFit: number;
    longSideFit: number;
    topEdge: number;
    leftEdge: number;
    rect: FreeRect;
    length: number;
    width: number;
  };

  type GuillotinePlacement = Placement & {
    leftoverRects: FreeRect[];
    largestLeftoverArea: number;
    smallestLeftoverShortSide: number;
  };

  const sourcePieces: FlatPiece[] = parts.flatMap((part) =>
    Array.from({ length: part.qty }, (_, pieceIndex) => ({
      id: `${part.id}-${pieceIndex}`,
      sourcePartId: part.id,
      name: part.name,
      category: part.category,
      length: part.grainDirection === "width" ? part.width : part.length,
      width: part.grainDirection === "width" ? part.length : part.width,
      allowRotation: part.allowRotation,
    })),
  );
  const cutKerf = Math.max(layoutOptions.cutKerf ?? 0, 0);
  const trimMargin = Math.max(layoutOptions.trimMargin ?? 0, 0);
  const boardLength = Math.max(stockSize.length - trimMargin * 2, 0);
  const boardWidth = Math.max(stockSize.width - trimMargin * 2, 0);
  const hasSawOptions = cutKerf > 0 || trimMargin > 0;

  function getAllowedOrientations(piece: FlatPiece) {
    if (!piece.allowRotation || piece.length === piece.width) {
      return [{ length: piece.length, width: piece.width }];
    }

    return [
      { length: piece.length, width: piece.width },
      { length: piece.width, width: piece.length },
    ];
  }

  function isRotatedOrientation(
    piece: FlatPiece,
    length: number,
    width: number,
  ) {
    return (
      piece.length !== piece.width &&
      length === piece.width &&
      width === piece.length
    );
  }

  function createSheet(sheets: InternalSheet[]) {
    const sheet: InternalSheet = {
      index: sheets.length,
      pieces: [],
      freeRects: [
        {
          x: trimMargin,
          y: trimMargin,
          length: boardLength,
          width: boardWidth,
        },
      ],
    };
    sheets.push(sheet);
    return sheet;
  }

  function intersects(left: FreeRect, right: FreeRect) {
    return !(
      right.x >= left.x + left.length ||
      right.x + right.length <= left.x ||
      right.y >= left.y + left.width ||
      right.y + right.width <= left.y
    );
  }

  function contains(outer: FreeRect, inner: FreeRect) {
    return (
      inner.x >= outer.x &&
      inner.y >= outer.y &&
      inner.x + inner.length <= outer.x + outer.length &&
      inner.y + inner.width <= outer.y + outer.width
    );
  }

  function pruneFreeRects(freeRects: FreeRect[]) {
    return freeRects.filter((candidate, candidateIndex) => {
      if (candidate.length <= 0 || candidate.width <= 0) {
        return false;
      }

      return !freeRects.some((other, otherIndex) => {
        if (candidateIndex === otherIndex) {
          return false;
        }

        return contains(other, candidate);
      });
    });
  }

  function splitFreeRects(freeRects: FreeRect[], usedRect: FreeRect) {
    const nextRects: FreeRect[] = [];

    for (const freeRect of freeRects) {
      if (!intersects(freeRect, usedRect)) {
        nextRects.push(freeRect);
        continue;
      }

      if (usedRect.x > freeRect.x) {
        nextRects.push({
          x: freeRect.x,
          y: freeRect.y,
          length: usedRect.x - freeRect.x - cutKerf,
          width: freeRect.width,
        });
      }

      const freeRectRight = freeRect.x + freeRect.length;
      const usedRectRight = usedRect.x + usedRect.length;
      if (usedRectRight < freeRectRight) {
        nextRects.push({
          x: usedRectRight + cutKerf,
          y: freeRect.y,
          length: freeRectRight - usedRectRight - cutKerf,
          width: freeRect.width,
        });
      }

      if (usedRect.y > freeRect.y) {
        nextRects.push({
          x: freeRect.x,
          y: freeRect.y,
          length: freeRect.length,
          width: usedRect.y - freeRect.y - cutKerf,
        });
      }

      const freeRectBottom = freeRect.y + freeRect.width;
      const usedRectBottom = usedRect.y + usedRect.width;
      if (usedRectBottom < freeRectBottom) {
        nextRects.push({
          x: freeRect.x,
          y: usedRectBottom + cutKerf,
          length: freeRect.length,
          width: freeRectBottom - usedRectBottom - cutKerf,
        });
      }
    }

    return pruneFreeRects(nextRects);
  }

  function getBestPlacement(sheet: InternalSheet, piece: FlatPiece) {
    let bestPlacement: Placement | undefined;

    const orientations = getAllowedOrientations(piece);

    for (const freeRect of sheet.freeRects) {
      for (const orientation of orientations) {
        if (
          orientation.length > freeRect.length ||
          orientation.width > freeRect.width
        ) {
          continue;
        }

        const areaFit =
          freeRect.length * freeRect.width -
          orientation.length * orientation.width;
        const shortSideFit = Math.min(
          freeRect.length - orientation.length,
          freeRect.width - orientation.width,
        );
        const longSideFit = Math.max(
          freeRect.length - orientation.length,
          freeRect.width - orientation.width,
        );
        const topEdge = freeRect.y + orientation.width;
        const leftEdge = freeRect.x + orientation.length;

        if (
          !bestPlacement ||
          areaFit < bestPlacement.score ||
          (areaFit === bestPlacement.score &&
            shortSideFit < bestPlacement.shortSideFit) ||
          (areaFit === bestPlacement.score &&
            shortSideFit === bestPlacement.shortSideFit &&
            longSideFit < bestPlacement.longSideFit) ||
          (areaFit === bestPlacement.score &&
            shortSideFit === bestPlacement.shortSideFit &&
            longSideFit === bestPlacement.longSideFit &&
            topEdge < bestPlacement.topEdge) ||
          (areaFit === bestPlacement.score &&
            shortSideFit === bestPlacement.shortSideFit &&
            longSideFit === bestPlacement.longSideFit &&
            topEdge === bestPlacement.topEdge &&
            leftEdge < bestPlacement.leftEdge)
        ) {
          bestPlacement = {
            score: areaFit,
            shortSideFit,
            longSideFit,
            topEdge,
            leftEdge,
            rect: freeRect,
            length: orientation.length,
            width: orientation.width,
          };
        }
      }
    }

    if (!bestPlacement) {
      return undefined;
    }

    return bestPlacement;
  }

  function applyPlacement(
    sheet: InternalSheet,
    piece: FlatPiece,
    placement: Placement,
  ) {
    const usedRect: FreeRect = {
      x: placement.rect.x,
      y: placement.rect.y,
      length: placement.length,
      width: placement.width,
    };

    sheet.pieces.push({
      id: piece.id,
      sourcePartId: piece.sourcePartId,
      name: piece.name,
      category: piece.category,
      sheetIndex: sheet.index,
      x: usedRect.x,
      y: usedRect.y,
      length: usedRect.length,
      width: usedRect.width,
      rotated: isRotatedOrientation(piece, usedRect.length, usedRect.width),
    });

    sheet.freeRects = splitFreeRects(sheet.freeRects, usedRect);
  }

  function createOverflowPlacement(sheet: InternalSheet, piece: FlatPiece) {
    sheet.pieces.push({
      id: piece.id,
      sourcePartId: piece.sourcePartId,
      name: piece.name,
      category: piece.category,
      sheetIndex: sheet.index,
      x: 0,
      y: 0,
      length: Math.min(piece.length, boardLength),
      width: Math.min(piece.width, boardWidth),
      rotated: false,
    });
    sheet.freeRects = [];
  }

  function getUsedLength(sheet: InternalSheet) {
    return sheet.pieces.reduce(
      (max, piece) => Math.max(max, piece.x + piece.length),
      0,
    );
  }

  function getUsedWidth(sheet: InternalSheet) {
    return sheet.pieces.reduce(
      (max, piece) => Math.max(max, piece.y + piece.width),
      0,
    );
  }

  function getRowCount(sheet: InternalSheet) {
    return new Set(sheet.pieces.map((piece) => piece.y.toFixed(2))).size;
  }

  function compareSheets(left: InternalSheet, right: InternalSheet) {
    if (left.pieces.length !== right.pieces.length) {
      return left.pieces.length - right.pieces.length;
    }

    return getUsedLength(left) - getUsedLength(right);
  }

  function getSheetPieceArea(sheet: InternalSheet) {
    return sheet.pieces.reduce(
      (sum, piece) => sum + piece.length * piece.width,
      0,
    );
  }

  function getSheetUnusedArea(sheet: InternalSheet) {
    return boardLength * boardWidth - getSheetPieceArea(sheet);
  }

  function getLargestFreeRectArea(sheet: InternalSheet) {
    return sheet.freeRects.reduce(
      (max, freeRect) => Math.max(max, freeRect.length * freeRect.width),
      0,
    );
  }

  function scoreLayout(sheets: InternalSheet[]) {
    const totalBoundingArea = sheets.reduce(
      (sum, sheet) => sum + getUsedLength(sheet) * getUsedWidth(sheet),
      0,
    );
    const totalPieceArea = sheets.reduce(
      (sum, sheet) => sum + getSheetPieceArea(sheet),
      0,
    );
    const totalUnusedInsideBounds = totalBoundingArea - totalPieceArea;
    const totalLargestReusableGap = sheets.reduce(
      (sum, sheet) => sum + getLargestFreeRectArea(sheet),
      0,
    );
    const totalRows = sheets.reduce(
      (sum, sheet) => sum + getRowCount(sheet),
      0,
    );

    return {
      sheetCount: sheets.length,
      totalBoundingArea,
      totalUnusedInsideBounds,
      totalLargestReusableGap,
      totalRows,
    };
  }

  function isWithinUsableBoard(piece: SheetLayoutPiece) {
    return (
      piece.x >= trimMargin &&
      piece.y >= trimMargin &&
      piece.x + piece.length <= trimMargin + boardLength &&
      piece.y + piece.width <= trimMargin + boardWidth
    );
  }

  function piecesOverlap(left: SheetLayoutPiece, right: SheetLayoutPiece) {
    return !(
      left.x + left.length <= right.x ||
      right.x + right.length <= left.x ||
      left.y + left.width <= right.y ||
      right.y + right.width <= left.y
    );
  }

  function isLayoutValid(sheets: InternalSheet[]) {
    const placedPieceIds = new Set<string>();

    for (const sheet of sheets) {
      for (const piece of sheet.pieces) {
        if (!isWithinUsableBoard(piece) || placedPieceIds.has(piece.id)) {
          return false;
        }

        placedPieceIds.add(piece.id);
      }

      for (let index = 0; index < sheet.pieces.length; index += 1) {
        for (
          let compareIndex = index + 1;
          compareIndex < sheet.pieces.length;
          compareIndex += 1
        ) {
          if (piecesOverlap(sheet.pieces[index], sheet.pieces[compareIndex])) {
            return false;
          }
        }
      }
    }

    return placedPieceIds.size === sourcePieces.length;
  }

  function isBetterLayout(left: InternalSheet[], right: InternalSheet[]) {
    const leftScore = scoreLayout(left);
    const rightScore = scoreLayout(right);

    return (
      leftScore.sheetCount < rightScore.sheetCount ||
      (leftScore.sheetCount === rightScore.sheetCount &&
        leftScore.totalBoundingArea < rightScore.totalBoundingArea) ||
      (leftScore.sheetCount === rightScore.sheetCount &&
        leftScore.totalBoundingArea === rightScore.totalBoundingArea &&
        leftScore.totalUnusedInsideBounds <
          rightScore.totalUnusedInsideBounds) ||
      (leftScore.sheetCount === rightScore.sheetCount &&
        leftScore.totalBoundingArea === rightScore.totalBoundingArea &&
        leftScore.totalUnusedInsideBounds ===
          rightScore.totalUnusedInsideBounds &&
        leftScore.totalLargestReusableGap >
          rightScore.totalLargestReusableGap) ||
      (leftScore.sheetCount === rightScore.sheetCount &&
        leftScore.totalBoundingArea === rightScore.totalBoundingArea &&
        leftScore.totalUnusedInsideBounds ===
          rightScore.totalUnusedInsideBounds &&
        leftScore.totalLargestReusableGap ===
          rightScore.totalLargestReusableGap &&
        leftScore.totalRows < rightScore.totalRows)
    );
  }

  const pieceOrderings: Array<(piece: FlatPiece) => [number, number, number]> =
    [
      (piece) => [
        -(piece.length * piece.width),
        -Math.max(piece.length, piece.width),
        -piece.length,
      ],
      (piece) => [
        -Math.max(piece.length, piece.width),
        -(piece.length * piece.width),
        -piece.width,
      ],
      (piece) => [
        -(piece.length + piece.width),
        -(piece.length * piece.width),
        -piece.length,
      ],
      (piece) => [-piece.width, -piece.length, -(piece.length * piece.width)],
      (piece) => [
        -Math.abs(piece.length - piece.width),
        -(piece.length * piece.width),
        -Math.max(piece.length, piece.width),
      ],
    ];

  function getOrderedPieces(
    getOrderingKey: (piece: FlatPiece) => [number, number, number],
  ) {
    return [...sourcePieces].sort((left, right) => {
      const leftKey = getOrderingKey(left);
      const rightKey = getOrderingKey(right);

      for (let index = 0; index < leftKey.length; index += 1) {
        if (leftKey[index] !== rightKey[index]) {
          return leftKey[index] - rightKey[index];
        }
      }

      return left.id.localeCompare(right.id);
    });
  }

  function cloneSheets(sheets: InternalSheet[]) {
    return sheets.map((sheet) => ({
      index: sheet.index,
      pieces: sheet.pieces.map((piece) => ({ ...piece })),
      freeRects: sheet.freeRects.map((freeRect) => ({ ...freeRect })),
    }));
  }

  const sourcePieceMap = new Map(
    sourcePieces.map((piece) => [piece.id, piece]),
  );

  function packWithFreeRects(
    flatPieces: FlatPiece[],
    preferDenseSheets = false,
  ) {
    const sheets: InternalSheet[] = [];

    for (const piece of flatPieces) {
      let bestSheet:
        | {
            sheet: InternalSheet;
            placement: Placement;
            unusedAreaAfterPlacement: number;
          }
        | undefined;

      const candidateSheets = [...sheets].sort((left, right) => {
        if (!preferDenseSheets) {
          return compareSheets(left, right);
        }

        return (
          getSheetUnusedArea(left) - getSheetUnusedArea(right) ||
          compareSheets(left, right)
        );
      });

      for (const sheet of candidateSheets) {
        const placement = getBestPlacement(sheet, piece);
        if (!placement) {
          continue;
        }

        const unusedAreaAfterPlacement =
          getSheetUnusedArea(sheet) - placement.length * placement.width;

        if (
          !bestSheet ||
          placement.score < bestSheet.placement.score ||
          (placement.score === bestSheet.placement.score &&
            placement.shortSideFit < bestSheet.placement.shortSideFit) ||
          (placement.score === bestSheet.placement.score &&
            placement.shortSideFit === bestSheet.placement.shortSideFit &&
            preferDenseSheets &&
            unusedAreaAfterPlacement < bestSheet.unusedAreaAfterPlacement) ||
          (placement.score === bestSheet.placement.score &&
            placement.shortSideFit === bestSheet.placement.shortSideFit &&
            (!preferDenseSheets ||
              unusedAreaAfterPlacement ===
                bestSheet.unusedAreaAfterPlacement) &&
            compareSheets(sheet, bestSheet.sheet) < 0)
        ) {
          bestSheet = {
            sheet,
            placement,
            unusedAreaAfterPlacement,
          };
        }
      }

      if (bestSheet) {
        applyPlacement(bestSheet.sheet, piece, bestSheet.placement);
        continue;
      }

      const newSheet = createSheet(sheets);
      const placement = getBestPlacement(newSheet, piece);
      if (placement) {
        applyPlacement(newSheet, piece, placement);
      } else {
        createOverflowPlacement(newSheet, piece);
      }
    }

    return sheets;
  }

  function buildGuillotineLeftovers(
    rect: FreeRect,
    length: number,
    width: number,
    splitAlongLengthFirst: boolean,
  ) {
    const rightRect: FreeRect = {
      x: rect.x + length + cutKerf,
      y: rect.y,
      length: rect.length - length - cutKerf,
      width: splitAlongLengthFirst ? width : rect.width,
    };
    const bottomRect: FreeRect = {
      x: rect.x,
      y: rect.y + width + cutKerf,
      length: splitAlongLengthFirst ? rect.length : length,
      width: rect.width - width - cutKerf,
    };

    return [rightRect, bottomRect].filter(
      (freeRect) => freeRect.length > 0 && freeRect.width > 0,
    );
  }

  function getBestGuillotinePlacement(sheet: InternalSheet, piece: FlatPiece) {
    let bestPlacement: GuillotinePlacement | undefined;

    for (const freeRect of sheet.freeRects) {
      for (const orientation of getAllowedOrientations(piece)) {
        if (
          orientation.length > freeRect.length ||
          orientation.width > freeRect.width
        ) {
          continue;
        }

        for (const splitAlongLengthFirst of [true, false]) {
          const leftoverRects = buildGuillotineLeftovers(
            freeRect,
            orientation.length,
            orientation.width,
            splitAlongLengthFirst,
          );
          const areaFit =
            freeRect.length * freeRect.width -
            orientation.length * orientation.width;
          const shortSideFit = Math.min(
            freeRect.length - orientation.length,
            freeRect.width - orientation.width,
          );
          const longSideFit = Math.max(
            freeRect.length - orientation.length,
            freeRect.width - orientation.width,
          );
          const largestLeftoverArea = leftoverRects.reduce(
            (max, leftoverRect) =>
              Math.max(max, leftoverRect.length * leftoverRect.width),
            0,
          );
          const smallestLeftoverShortSide = leftoverRects.reduce(
            (min, leftoverRect) =>
              Math.min(min, Math.min(leftoverRect.length, leftoverRect.width)),
            Number.POSITIVE_INFINITY,
          );
          const topEdge = freeRect.y + orientation.width;
          const leftEdge = freeRect.x + orientation.length;

          if (
            !bestPlacement ||
            areaFit < bestPlacement.score ||
            (areaFit === bestPlacement.score &&
              largestLeftoverArea > bestPlacement.largestLeftoverArea) ||
            (areaFit === bestPlacement.score &&
              largestLeftoverArea === bestPlacement.largestLeftoverArea &&
              smallestLeftoverShortSide >
                bestPlacement.smallestLeftoverShortSide) ||
            (areaFit === bestPlacement.score &&
              largestLeftoverArea === bestPlacement.largestLeftoverArea &&
              smallestLeftoverShortSide ===
                bestPlacement.smallestLeftoverShortSide &&
              shortSideFit < bestPlacement.shortSideFit) ||
            (areaFit === bestPlacement.score &&
              largestLeftoverArea === bestPlacement.largestLeftoverArea &&
              smallestLeftoverShortSide ===
                bestPlacement.smallestLeftoverShortSide &&
              shortSideFit === bestPlacement.shortSideFit &&
              longSideFit < bestPlacement.longSideFit) ||
            (areaFit === bestPlacement.score &&
              largestLeftoverArea === bestPlacement.largestLeftoverArea &&
              smallestLeftoverShortSide ===
                bestPlacement.smallestLeftoverShortSide &&
              shortSideFit === bestPlacement.shortSideFit &&
              longSideFit === bestPlacement.longSideFit &&
              topEdge < bestPlacement.topEdge) ||
            (areaFit === bestPlacement.score &&
              largestLeftoverArea === bestPlacement.largestLeftoverArea &&
              smallestLeftoverShortSide ===
                bestPlacement.smallestLeftoverShortSide &&
              shortSideFit === bestPlacement.shortSideFit &&
              longSideFit === bestPlacement.longSideFit &&
              topEdge === bestPlacement.topEdge &&
              leftEdge < bestPlacement.leftEdge)
          ) {
            bestPlacement = {
              score: areaFit,
              shortSideFit,
              longSideFit,
              topEdge,
              leftEdge,
              rect: freeRect,
              length: orientation.length,
              width: orientation.width,
              leftoverRects,
              largestLeftoverArea,
              smallestLeftoverShortSide:
                smallestLeftoverShortSide === Number.POSITIVE_INFINITY
                  ? 0
                  : smallestLeftoverShortSide,
            };
          }
        }
      }
    }

    return bestPlacement;
  }

  function applyGuillotinePlacement(
    sheet: InternalSheet,
    piece: FlatPiece,
    placement: GuillotinePlacement,
  ) {
    sheet.pieces.push({
      id: piece.id,
      sourcePartId: piece.sourcePartId,
      name: piece.name,
      category: piece.category,
      sheetIndex: sheet.index,
      x: placement.rect.x,
      y: placement.rect.y,
      length: placement.length,
      width: placement.width,
      rotated: isRotatedOrientation(piece, placement.length, placement.width),
    });

    sheet.freeRects = pruneFreeRects(
      sheet.freeRects
        .filter((freeRect) => freeRect !== placement.rect)
        .concat(placement.leftoverRects)
        .sort(
          (left, right) =>
            right.length * right.width - left.length * left.width ||
            right.length - left.length ||
            right.width - left.width,
        ),
    );
  }

  function packWithGuillotine(
    flatPieces: FlatPiece[],
    preferDenseSheets = false,
  ) {
    const sheets: InternalSheet[] = [];

    for (const piece of flatPieces) {
      let bestSheet:
        | {
            sheet: InternalSheet;
            placement: GuillotinePlacement;
            unusedAreaAfterPlacement: number;
          }
        | undefined;

      const candidateSheets = [...sheets].sort((left, right) => {
        if (!preferDenseSheets) {
          return compareSheets(left, right);
        }

        return (
          getSheetUnusedArea(left) - getSheetUnusedArea(right) ||
          compareSheets(left, right)
        );
      });

      for (const sheet of candidateSheets) {
        const placement = getBestGuillotinePlacement(sheet, piece);
        if (!placement) {
          continue;
        }

        const unusedAreaAfterPlacement =
          getSheetUnusedArea(sheet) - placement.length * placement.width;

        if (
          !bestSheet ||
          placement.score < bestSheet.placement.score ||
          (placement.score === bestSheet.placement.score &&
            placement.largestLeftoverArea >
              bestSheet.placement.largestLeftoverArea) ||
          (placement.score === bestSheet.placement.score &&
            placement.largestLeftoverArea ===
              bestSheet.placement.largestLeftoverArea &&
            preferDenseSheets &&
            unusedAreaAfterPlacement < bestSheet.unusedAreaAfterPlacement) ||
          (placement.score === bestSheet.placement.score &&
            placement.largestLeftoverArea ===
              bestSheet.placement.largestLeftoverArea &&
            (!preferDenseSheets ||
              unusedAreaAfterPlacement ===
                bestSheet.unusedAreaAfterPlacement) &&
            compareSheets(sheet, bestSheet.sheet) < 0)
        ) {
          bestSheet = {
            sheet,
            placement,
            unusedAreaAfterPlacement,
          };
        }
      }

      if (bestSheet) {
        applyGuillotinePlacement(bestSheet.sheet, piece, bestSheet.placement);
        continue;
      }

      const newSheet = createSheet(sheets);
      const placement = getBestGuillotinePlacement(newSheet, piece);
      if (placement) {
        applyGuillotinePlacement(newSheet, piece, placement);
      } else {
        createOverflowPlacement(newSheet, piece);
      }
    }

    return sheets;
  }

  function packWithShelves(flatPieces: FlatPiece[]) {
    const sheets: InternalShelfSheet[] = [];

    function createShelfSheet() {
      const sheet: InternalShelfSheet = {
        index: sheets.length,
        pieces: [],
        rows: [],
        usedLength: 0,
      };

      sheets.push(sheet);
      return sheet;
    }

    for (const piece of flatPieces) {
      const orientations = getAllowedOrientations(piece);

      let bestCandidate:
        | {
            sheet: InternalShelfSheet;
            row: InternalRow | null;
            length: number;
            width: number;
            addedLength: number;
            remainingWidth: number;
          }
        | undefined;

      for (const sheet of sheets) {
        for (const row of sheet.rows) {
          for (const orientation of orientations) {
            if (row.usedWidth + orientation.width > boardWidth) {
              const nextY = row.usedWidth + cutKerf;
              if (nextY + orientation.width > trimMargin + boardWidth) {
                continue;
              }
            } else if (
              row.usedWidth + orientation.width >
              trimMargin + boardWidth
            ) {
              continue;
            }

            const addedLength = Math.max(0, orientation.length - row.length);
            if (sheet.usedLength + addedLength > boardLength) {
              continue;
            }

            const nextRowWidth = row.usedWidth + cutKerf + orientation.width;
            const remainingWidth = trimMargin + boardWidth - nextRowWidth;
            if (
              !bestCandidate ||
              addedLength < bestCandidate.addedLength ||
              (addedLength === bestCandidate.addedLength &&
                remainingWidth < bestCandidate.remainingWidth) ||
              (addedLength === bestCandidate.addedLength &&
                remainingWidth === bestCandidate.remainingWidth &&
                sheet.usedLength < bestCandidate.sheet.usedLength)
            ) {
              bestCandidate = {
                sheet,
                row,
                length: orientation.length,
                width: orientation.width,
                addedLength,
                remainingWidth,
              };
            }
          }
        }

        for (const orientation of orientations) {
          const rowStartX =
            sheet.rows.length > 0
              ? sheet.usedLength + cutKerf
              : sheet.usedLength;
          if (rowStartX + orientation.length > trimMargin + boardLength) {
            continue;
          }

          const remainingWidth = boardWidth - orientation.width;
          if (
            !bestCandidate ||
            rowStartX + orientation.length - sheet.usedLength <
              bestCandidate.addedLength ||
            (rowStartX + orientation.length - sheet.usedLength ===
              bestCandidate.addedLength &&
              remainingWidth < bestCandidate.remainingWidth) ||
            (rowStartX + orientation.length - sheet.usedLength ===
              bestCandidate.addedLength &&
              remainingWidth === bestCandidate.remainingWidth &&
              sheet.usedLength < bestCandidate.sheet.usedLength)
          ) {
            bestCandidate = {
              sheet,
              row: null,
              length: orientation.length,
              width: orientation.width,
              addedLength: rowStartX + orientation.length - sheet.usedLength,
              remainingWidth,
            };
          }
        }
      }

      if (!bestCandidate) {
        const sheet = createShelfSheet();
        const orientation = orientations.sort(
          (left, right) =>
            left.length - right.length || left.width - right.width,
        )[0];

        if (
          orientation.length > boardLength ||
          orientation.width > boardWidth
        ) {
          sheet.pieces.push({
            id: piece.id,
            sourcePartId: piece.sourcePartId,
            name: piece.name,
            category: piece.category,
            sheetIndex: sheet.index,
            x: 0,
            y: 0,
            length: Math.min(orientation.length, boardLength),
            width: Math.min(orientation.width, boardWidth),
            rotated: isRotatedOrientation(
              piece,
              orientation.length,
              orientation.width,
            ),
          });
          sheet.usedLength = boardLength;
          continue;
        }

        const row: InternalRow = {
          x: trimMargin,
          length: orientation.length,
          usedWidth: trimMargin + orientation.width,
        };

        sheet.rows.push(row);
        sheet.usedLength = trimMargin + orientation.length;
        sheet.pieces.push({
          id: piece.id,
          sourcePartId: piece.sourcePartId,
          name: piece.name,
          category: piece.category,
          sheetIndex: sheet.index,
          x: row.x,
          y: trimMargin,
          length: orientation.length,
          width: orientation.width,
          rotated: isRotatedOrientation(
            piece,
            orientation.length,
            orientation.width,
          ),
        });
        continue;
      }

      if (bestCandidate.row) {
        const row = bestCandidate.row;
        const previousLength = row.length;
        const y = row.usedWidth + cutKerf;

        row.length = Math.max(row.length, bestCandidate.length);
        row.usedWidth += cutKerf + bestCandidate.width;
        bestCandidate.sheet.usedLength += row.length - previousLength;

        bestCandidate.sheet.pieces.push({
          id: piece.id,
          sourcePartId: piece.sourcePartId,
          name: piece.name,
          category: piece.category,
          sheetIndex: bestCandidate.sheet.index,
          x: row.x,
          y,
          length: bestCandidate.length,
          width: bestCandidate.width,
          rotated: isRotatedOrientation(
            piece,
            bestCandidate.length,
            bestCandidate.width,
          ),
        });
        continue;
      }

      const row: InternalRow = {
        x:
          bestCandidate.sheet.rows.length > 0
            ? bestCandidate.sheet.usedLength + cutKerf
            : bestCandidate.sheet.usedLength,
        length: bestCandidate.length,
        usedWidth: trimMargin + bestCandidate.width,
      };

      bestCandidate.sheet.rows.push(row);
      bestCandidate.sheet.usedLength = row.x + bestCandidate.length;
      bestCandidate.sheet.pieces.push({
        id: piece.id,
        sourcePartId: piece.sourcePartId,
        name: piece.name,
        category: piece.category,
        sheetIndex: bestCandidate.sheet.index,
        x: row.x,
        y: trimMargin,
        length: bestCandidate.length,
        width: bestCandidate.width,
        rotated: isRotatedOrientation(
          piece,
          bestCandidate.length,
          bestCandidate.width,
        ),
      });
    }

    return sheets.map((sheet) => ({
      index: sheet.index,
      pieces: sheet.pieces,
      freeRects: [],
    }));
  }

  function packWithExactSheets(flatPieces: FlatPiece[]) {
    if (flatPieces.length === 0 || flatPieces.length > 12) {
      return undefined;
    }

    type OrientedPiece = {
      pieceIndex: number;
      length: number;
      width: number;
    };

    type RowOption = {
      length: number;
      pieces: OrientedPiece[];
    };

    const pieceCount = flatPieces.length;
    const fullMask = (1 << pieceCount) - 1;
    const rowOptions = new Map<number, RowOption>();

    for (let mask = 1; mask <= fullMask; mask += 1) {
      const pieceIndexes: number[] = [];
      for (let pieceIndex = 0; pieceIndex < pieceCount; pieceIndex += 1) {
        if ((mask & (1 << pieceIndex)) !== 0) {
          pieceIndexes.push(pieceIndex);
        }
      }

      let bestRow: RowOption | undefined;

      function searchRow(
        index: number,
        totalWidth: number,
        maxLength: number,
        placements: OrientedPiece[],
      ) {
        if (totalWidth > boardWidth || maxLength > boardLength) {
          return;
        }

        if (index === pieceIndexes.length) {
          if (!bestRow || maxLength < bestRow.length) {
            bestRow = {
              length: maxLength,
              pieces: [...placements].sort(
                (left, right) => right.width - left.width,
              ),
            };
          }
          return;
        }

        const piece = flatPieces[pieceIndexes[index]];
        const orientations = getAllowedOrientations(piece);

        for (const orientation of orientations) {
          const nextTotalWidth =
            totalWidth === 0
              ? orientation.width
              : totalWidth + cutKerf + orientation.width;
          placements.push({
            pieceIndex: pieceIndexes[index],
            length: orientation.length,
            width: orientation.width,
          });
          searchRow(
            index + 1,
            nextTotalWidth,
            Math.max(maxLength, orientation.length),
            placements,
          );
          placements.pop();
        }
      }

      searchRow(0, 0, 0, []);

      if (bestRow) {
        rowOptions.set(mask, bestRow);
      }
    }

    const bestSheetLength = new Array<number>(fullMask + 1).fill(
      Number.POSITIVE_INFINITY,
    );
    const bestSheetRowMask = new Array<number>(fullMask + 1).fill(0);
    bestSheetLength[0] = 0;

    for (let mask = 1; mask <= fullMask; mask += 1) {
      for (let rowMask = mask; rowMask > 0; rowMask = (rowMask - 1) & mask) {
        const rowOption = rowOptions.get(rowMask);
        if (!rowOption) {
          continue;
        }

        const nextLength =
          bestSheetLength[mask ^ rowMask] +
          (bestSheetLength[mask ^ rowMask] > 0 ? cutKerf : 0) +
          rowOption.length;
        if (nextLength < bestSheetLength[mask] && nextLength <= boardLength) {
          bestSheetLength[mask] = nextLength;
          bestSheetRowMask[mask] = rowMask;
        }
      }
    }

    const feasibleSheetMasks: number[] = [];
    for (let mask = 1; mask <= fullMask; mask += 1) {
      if (bestSheetLength[mask] <= boardLength) {
        feasibleSheetMasks.push(mask);
      }
    }

    const bestBoardCount = new Array<number>(fullMask + 1).fill(
      Number.POSITIVE_INFINITY,
    );
    const bestBoardUsedLength = new Array<number>(fullMask + 1).fill(
      Number.POSITIVE_INFINITY,
    );
    const bestBoardMask = new Array<number>(fullMask + 1).fill(0);
    bestBoardCount[0] = 0;
    bestBoardUsedLength[0] = 0;

    for (let mask = 1; mask <= fullMask; mask += 1) {
      for (const sheetMask of feasibleSheetMasks) {
        if ((sheetMask & mask) !== sheetMask) {
          continue;
        }

        const restMask = mask ^ sheetMask;
        const nextBoardCount = bestBoardCount[restMask] + 1;
        const nextUsedLength =
          bestBoardUsedLength[restMask] + bestSheetLength[sheetMask];

        if (
          nextBoardCount < bestBoardCount[mask] ||
          (nextBoardCount === bestBoardCount[mask] &&
            nextUsedLength < bestBoardUsedLength[mask])
        ) {
          bestBoardCount[mask] = nextBoardCount;
          bestBoardUsedLength[mask] = nextUsedLength;
          bestBoardMask[mask] = sheetMask;
        }
      }
    }

    if (!Number.isFinite(bestBoardCount[fullMask])) {
      return undefined;
    }

    const sheetMasks: number[] = [];
    let currentMask = fullMask;
    while (currentMask > 0) {
      const sheetMask = bestBoardMask[currentMask];
      if (sheetMask === 0) {
        return undefined;
      }

      sheetMasks.push(sheetMask);
      currentMask ^= sheetMask;
    }

    return sheetMasks.map((sheetMask, sheetIndex) => {
      const rowMasks: number[] = [];
      let remainingMask = sheetMask;
      while (remainingMask > 0) {
        const rowMask = bestSheetRowMask[remainingMask];
        if (rowMask === 0) {
          break;
        }

        rowMasks.push(rowMask);
        remainingMask ^= rowMask;
      }

      const pieces: SheetLayoutPiece[] = [];
      let x = trimMargin;

      const rows = rowMasks
        .map((rowMask) => rowOptions.get(rowMask))
        .filter((row): row is RowOption => Boolean(row))
        .sort((left, right) => right.length - left.length);

      for (const row of rows) {
        let y = trimMargin;
        for (const orientedPiece of row.pieces) {
          const piece = flatPieces[orientedPiece.pieceIndex];
          pieces.push({
            id: piece.id,
            sourcePartId: piece.sourcePartId,
            name: piece.name,
            category: piece.category,
            sheetIndex,
            x,
            y,
            length: orientedPiece.length,
            width: orientedPiece.width,
            rotated: isRotatedOrientation(
              piece,
              orientedPiece.length,
              orientedPiece.width,
            ),
          });
          y += orientedPiece.width + cutKerf;
        }
        x += row.length + cutKerf;
      }

      return {
        index: sheetIndex,
        pieces,
        freeRects: [],
      };
    });
  }

  function buildRefinementOrderings(layout: InternalSheet[]) {
    const byOriginalOrder = layout
      .flatMap((sheet) => sheet.pieces)
      .map((piece) => sourcePieceMap.get(piece.id))
      .filter((piece): piece is FlatPiece => Boolean(piece));

    const uniqueByOriginalOrder = byOriginalOrder.filter(
      (piece, index) =>
        byOriginalOrder.findIndex((candidate) => candidate.id === piece.id) ===
        index,
    );

    if (uniqueByOriginalOrder.length !== sourcePieces.length) {
      return [];
    }

    const sparseSheetsFirst = [...layout]
      .sort((left, right) => {
        if (left.pieces.length !== right.pieces.length) {
          return left.pieces.length - right.pieces.length;
        }

        return getUsedLength(left) - getUsedLength(right);
      })
      .flatMap((sheet) =>
        [...sheet.pieces]
          .sort(
            (left, right) =>
              right.length * right.width - left.length * left.width ||
              right.length - left.length ||
              right.width - left.width,
          )
          .map((piece) => sourcePieceMap.get(piece.id))
          .filter((piece): piece is FlatPiece => Boolean(piece)),
      );

    const laterSheetsFirst = [...layout]
      .sort((left, right) => right.index - left.index)
      .flatMap((sheet) =>
        [...sheet.pieces]
          .sort(
            (left, right) =>
              right.length * right.width - left.length * left.width ||
              right.length - left.length ||
              right.width - left.width,
          )
          .map((piece) => sourcePieceMap.get(piece.id))
          .filter((piece): piece is FlatPiece => Boolean(piece)),
      );

    const densestSheetsFirst = [...layout]
      .sort((left, right) => {
        const leftUnusedArea = getSheetUnusedArea(left);
        const rightUnusedArea = getSheetUnusedArea(right);

        return leftUnusedArea - rightUnusedArea || compareSheets(right, left);
      })
      .flatMap((sheet) =>
        [...sheet.pieces]
          .sort(
            (left, right) =>
              Math.max(right.length, right.width) -
                Math.max(left.length, left.width) ||
              right.length * right.width - left.length * left.width ||
              right.length - left.length ||
              right.width - left.width,
          )
          .map((piece) => sourcePieceMap.get(piece.id))
          .filter((piece): piece is FlatPiece => Boolean(piece)),
      );

    const largestLeftoversFirst = [...layout]
      .sort((left, right) => {
        const leftFreeArea = left.freeRects.reduce(
          (sum, freeRect) => sum + freeRect.length * freeRect.width,
          0,
        );
        const rightFreeArea = right.freeRects.reduce(
          (sum, freeRect) => sum + freeRect.length * freeRect.width,
          0,
        );

        return leftFreeArea - rightFreeArea || left.index - right.index;
      })
      .flatMap((sheet) =>
        [...sheet.pieces]
          .sort(
            (left, right) =>
              right.length * right.width - left.length * left.width ||
              right.length - left.length ||
              right.width - left.width,
          )
          .map((piece) => sourcePieceMap.get(piece.id))
          .filter((piece): piece is FlatPiece => Boolean(piece)),
      );

    return [
      uniqueByOriginalOrder,
      sparseSheetsFirst,
      laterSheetsFirst,
      densestSheetsFirst,
      largestLeftoversFirst,
      [...uniqueByOriginalOrder].reverse(),
      [...sparseSheetsFirst].reverse(),
      [...densestSheetsFirst].reverse(),
    ].filter((orderedPieces) => orderedPieces.length === sourcePieces.length);
  }

  function refineBestLayout(initialBest: InternalSheet[]) {
    let refinedBest = cloneSheets(initialBest);
    let changed = true;
    let passCount = 0;

    while (changed && passCount < 3) {
      changed = false;
      passCount += 1;
      const refinementOrderings = buildRefinementOrderings(refinedBest);

      for (const orderedPieces of refinementOrderings) {
        const candidateLayouts = [
          packWithGuillotine(orderedPieces),
          packWithGuillotine(orderedPieces, true),
          packWithFreeRects(orderedPieces),
          packWithFreeRects(orderedPieces, true),
          ...(hasSawOptions ? [] : [packWithShelves(orderedPieces)]),
          ...(hasSawOptions ? [] : [packWithExactSheets(orderedPieces)]),
        ];

        for (const candidateLayout of candidateLayouts) {
          if (!candidateLayout || !isLayoutValid(candidateLayout)) {
            continue;
          }

          if (isBetterLayout(candidateLayout, refinedBest)) {
            refinedBest = cloneSheets(candidateLayout);
            changed = true;
          }
        }
      }
    }

    return refinedBest;
  }

  let bestSheets: InternalSheet[] | undefined;

  for (const getOrderingKey of pieceOrderings) {
    const orderedPieces = getOrderedPieces(getOrderingKey);
    const candidateLayouts = [
      packWithGuillotine(orderedPieces),
      packWithGuillotine(orderedPieces, true),
      packWithFreeRects(orderedPieces),
      packWithFreeRects(orderedPieces, true),
      ...(hasSawOptions ? [] : [packWithShelves(orderedPieces)]),
      ...(hasSawOptions ? [] : [packWithExactSheets(orderedPieces)]),
    ];

    for (const candidateLayout of candidateLayouts) {
      if (!candidateLayout || !isLayoutValid(candidateLayout)) {
        continue;
      }

      if (!bestSheets || isBetterLayout(candidateLayout, bestSheets)) {
        bestSheets = cloneSheets(candidateLayout);
      }
    }
  }

  const resolvedSheets = bestSheets ? refineBestLayout(bestSheets) : [];

  return resolvedSheets.map((sheet) => ({
    index: sheet.index,
    usedLength: round2(getUsedLength(sheet)),
    rows: getRowCount(sheet),
    pieces: sheet.pieces,
  }));
}

export function buildSheetLayout(
  parts: CutlistPart[],
  options: SheetLayoutOptions = {},
): SheetLayoutResult {
  const boardStockSize = options.boardStockSize ?? defaultBoardStockSize;
  const backStockSize = options.backStockSize ?? defaultBoardStockSize;
  const stockGroups = new Map<string, CutlistPart[]>();

  for (const part of parts) {
    const stockKey =
      part.category === "back"
        ? `back-${part.thickness}`
        : `${part.material}-${part.thickness}`;
    const currentGroup = stockGroups.get(stockKey);

    if (currentGroup) {
      currentGroup.push(part);
      continue;
    }

    stockGroups.set(stockKey, [part]);
  }

  const stocks = [...stockGroups.entries()]
    .map(([key, stockParts]) => {
      const isBackStock = stockParts.every((part) => part.category === "back");
      const stockSize = isBackStock ? backStockSize : boardStockSize;
      const materialSummary = isBackStock
        ? "خامة ظهر موحدة"
        : Array.from(
            new Set(stockParts.map((part) => materialLabels[part.material])),
          ).join(" + ");

      return {
        key,
        material: stockParts[0].material,
        materialSummary,
        thickness: stockParts[0].thickness,
        boardLength: stockSize.length,
        boardWidth: stockSize.width,
        totalAreaM2: round2(
          stockParts.reduce(
            (sum, part) => sum + (part.length * part.width * part.qty) / 10000,
            0,
          ),
        ),
        partCount: stockParts.reduce((sum, part) => sum + part.qty, 0),
        isBackStock,
        sheets: buildSingleStockSheets(stockParts, stockSize, options),
      };
    })
    .sort(
      (left, right) =>
        right.thickness - left.thickness || left.key.localeCompare(right.key),
    );

  return {
    boardLength: boardStockSize.length,
    boardWidth: boardStockSize.width,
    stocks,
  };
}
