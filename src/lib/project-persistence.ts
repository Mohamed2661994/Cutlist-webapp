import type {
  CabinetInput,
  EdgeBandProfile,
  GrainDirection,
  MaterialType,
  PartCategory,
  SheetLayoutOptimizationMode,
} from "@/lib/cutlist";

export type CabinetUnit = CabinetInput & {
  id: string;
  title: string;
};

export type CustomProjectPart = {
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

export type ProjectArrangementItem = {
  id: string;
  offsetX: number;
  offsetZ: number;
  offsetY: number;
  rotationY: number;
};

export type CabinetProjectSettings = Pick<
  CabinetInput,
  "material" | "boardThickness" | "backThickness"
>;

export type ProjectPricingSettings = {
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
};

export type ProjectSettings = CabinetProjectSettings & ProjectPricingSettings;

export type EdgeBandOverrideMap = Record<string, EdgeBandProfile>;

export type SavedProject = {
  id: string;
  name: string;
  updatedAt: string;
  settings: ProjectSettings;
  units: CabinetUnit[];
  customParts: CustomProjectPart[];
  arrangement: ProjectArrangementItem[];
  edgeBandOverrides: EdgeBandOverrideMap;
};

export type PersistedUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionBootstrap = {
  user: PersistedUser | null;
  projectSettings: ProjectSettings | null;
  savedProjects: SavedProject[];
};
