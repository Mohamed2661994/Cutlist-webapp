import { useEffect, useRef, useState } from "react";

import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import {
  MOUSE,
  Plane,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
  type Group,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { cn } from "@/lib/utils";
import type {
  CabinetCutlistResult,
  CabinetInput,
  CutlistPart,
  PartKind,
} from "@/lib/cutlist";
import { round2 } from "@/lib/cutlist";

type CabinetPreviewProps = {
  input: CabinetInput;
  result: CabinetCutlistResult;
  selectedPartId: string | null;
};

type CabinetModelProps = CabinetPreviewProps & {
  showPartLabels?: boolean;
};

type ProjectPreviewProps = {
  units: Array<{
    id: string;
    title: string;
    input: CabinetInput;
    result: CabinetCutlistResult;
    basePosition: [number, number, number];
    position: [number, number, number];
    rotationY: number;
    active: boolean;
  }>;
  onSelectUnit?: (unitId: string | null) => void;
  onUnitPositionChange?: (
    unitId: string,
    nextPosition: { x: number; z: number },
  ) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
};

type PanelProps = {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  opacity?: number;
  highlighted?: boolean;
  label?: string;
  labelOffset?: [number, number, number];
  grainDirection?: CutlistPart["grainDirection"];
  lengthAxis?: "x" | "y" | "z";
  widthAxis?: "x" | "y" | "z";
};

const axisIndex = {
  x: 0,
  y: 1,
  z: 2,
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snapToStep(value: number, step: number) {
  if (step <= 0) {
    return round2(value);
  }

  return round2(Math.round(value / step) * step);
}

function formatPreviewDimension(valueCm: number) {
  return `${round2(valueCm)} سم`;
}

function formatPreviewFootprint(
  widthCm: number,
  heightCm: number,
  depthCm: number,
) {
  return `${formatPreviewDimension(widthCm)} × ${formatPreviewDimension(heightCm)} × ${formatPreviewDimension(depthCm)}`;
}

function Panel({
  size,
  position,
  color,
  opacity = 1,
  highlighted = false,
  label,
  labelOffset = [0, 0.04, 0],
  grainDirection = "free",
  lengthAxis,
  widthAxis,
}: PanelProps) {
  const showGrain =
    grainDirection !== "free" && Boolean(lengthAxis) && Boolean(widthAxis);
  const grainAxis =
    showGrain && grainDirection === "length" ? lengthAxis : widthAxis;
  const crossAxis = grainAxis === lengthAxis ? widthAxis : lengthAxis;
  const thicknessAxis =
    lengthAxis && widthAxis
      ? (["x", "y", "z"].find(
          (axis) => axis !== lengthAxis && axis !== widthAxis,
        ) as "x" | "y" | "z")
      : undefined;
  const grainLines =
    showGrain && grainAxis && crossAxis && thicknessAxis
      ? Array.from({ length: 5 }, (_, index) => {
          const grainSize = [0, 0, 0];
          const grainPosition = [0, 0, 0];
          const grainSpan = size[axisIndex[grainAxis]] * 0.86;
          const crossSpan = size[axisIndex[crossAxis]] * 0.8;
          const step = crossSpan / 4;
          const offset = -crossSpan / 2 + step * index;

          grainSize[axisIndex[grainAxis]] = Math.max(grainSpan, 0.01);
          grainSize[axisIndex[crossAxis]] = Math.max(
            Math.min(crossSpan / 14, 0.012),
            0.004,
          );
          grainSize[axisIndex[thicknessAxis]] = 0.0015;

          grainPosition[axisIndex[crossAxis]] = offset;

          return {
            key: `grain-${index}`,
            size: grainSize as [number, number, number],
            frontPosition: [
              grainPosition[0],
              grainPosition[1],
              grainPosition[2],
            ] as [number, number, number],
            backPosition: [
              grainPosition[0],
              grainPosition[1],
              grainPosition[2],
            ] as [number, number, number],
          };
        })
      : [];

  if (thicknessAxis) {
    grainLines.forEach((line) => {
      line.frontPosition[axisIndex[thicknessAxis]] =
        size[axisIndex[thicknessAxis]] / 2 + 0.001;
      line.backPosition[axisIndex[thicknessAxis]] =
        -size[axisIndex[thicknessAxis]] / 2 - 0.001;
    });
  }

  return (
    <group>
      <group position={position}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial
            color={highlighted ? "#f1c27d" : color}
            emissive={highlighted ? "#5b3510" : "#000000"}
            emissiveIntensity={highlighted ? 0.5 : 0}
            roughness={0.55}
            metalness={0.05}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
        {grainLines.map((line) => (
          <group key={line.key}>
            <mesh position={line.frontPosition}>
              <boxGeometry args={line.size} />
              <meshBasicMaterial color="#6f4c2f" transparent opacity={0.28} />
            </mesh>
            <mesh position={line.backPosition}>
              <boxGeometry args={line.size} />
              <meshBasicMaterial color="#6f4c2f" transparent opacity={0.18} />
            </mesh>
          </group>
        ))}
      </group>
      {label ? (
        <Html
          position={[
            position[0] + labelOffset[0],
            position[1] + size[1] / 2 + labelOffset[1],
            position[2] + labelOffset[2],
          ]}
          center
          distanceFactor={8}
          transform
          sprite
          occlude
        >
          <div className="min-w-16 rounded-md border border-stone-200/80 bg-white/92 px-2 py-1 text-center text-[10px] leading-4 text-stone-900 shadow-sm">
            {label}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

type AxisGuideProps = {
  planWidth: number;
  planDepth: number;
};

function AxisGuide({ planWidth, planDepth }: AxisGuideProps) {
  const arrowLengthX = Math.max(planWidth / 2 + 0.32, 0.62);
  const arrowLengthZ = Math.max(planDepth / 2 + 0.32, 0.62);

  return (
    <group position={[0, 0.016, 0]}>
      <mesh position={[arrowLengthX / 2, 0, 0]}>
        <boxGeometry args={[arrowLengthX, 0.012, 0.016]} />
        <meshBasicMaterial color="#d97706" transparent opacity={0.92} />
      </mesh>
      <mesh
        position={[arrowLengthX + 0.06, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <coneGeometry args={[0.032, 0.09, 18]} />
        <meshBasicMaterial color="#d97706" />
      </mesh>
      <mesh position={[-arrowLengthX / 2, 0, 0]}>
        <boxGeometry args={[arrowLengthX, 0.012, 0.016]} />
        <meshBasicMaterial color="#d97706" transparent opacity={0.45} />
      </mesh>
      <mesh
        position={[-arrowLengthX - 0.06, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <coneGeometry args={[0.028, 0.08, 18]} />
        <meshBasicMaterial color="#d97706" transparent opacity={0.55} />
      </mesh>

      <mesh position={[0, 0, arrowLengthZ / 2]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[arrowLengthZ, 0.012, 0.016]} />
        <meshBasicMaterial color="#0891b2" transparent opacity={0.92} />
      </mesh>
      <mesh
        position={[0, 0, arrowLengthZ + 0.06]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <coneGeometry args={[0.032, 0.09, 18]} />
        <meshBasicMaterial color="#0891b2" />
      </mesh>
      <mesh position={[0, 0, -arrowLengthZ / 2]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[arrowLengthZ, 0.012, 0.016]} />
        <meshBasicMaterial color="#0891b2" transparent opacity={0.45} />
      </mesh>
      <mesh
        position={[0, 0, -arrowLengthZ - 0.06]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <coneGeometry args={[0.028, 0.08, 18]} />
        <meshBasicMaterial color="#0891b2" transparent opacity={0.55} />
      </mesh>

      <Html position={[arrowLengthX + 0.17, 0.02, 0]} center transform sprite>
        <div className="rounded-full border border-amber-200/90 bg-amber-50/95 px-2 py-1 text-[10px] font-medium text-amber-950 shadow-sm">
          جانبي
        </div>
      </Html>
      <Html position={[0, 0.02, arrowLengthZ + 0.18]} center transform sprite>
        <div className="rounded-full border border-cyan-200/90 bg-cyan-50/95 px-2 py-1 text-[10px] font-medium text-cyan-950 shadow-sm">
          عمق
        </div>
      </Html>
    </group>
  );
}

type DragHandleProps = {
  active: boolean;
  dragging: boolean;
  planWidth: number;
  planDepth: number;
  snapStepCm: number;
  onStartDrag: (clientX: number, clientY: number, eventPointY?: number) => void;
};

function DragHandle({
  active,
  dragging,
  planWidth,
  planDepth,
  snapStepCm,
  onStartDrag,
}: DragHandleProps) {
  const handleRadius = Math.max(
    0.13,
    Math.min(Math.min(planWidth, planDepth) * 0.22, 0.22),
  );
  const handleY = 0.052;

  if (!active) {
    return null;
  }

  return (
    <group position={[0, handleY, 0]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }

          event.stopPropagation();
          onStartDrag(event.clientX, event.clientY, event.point.y);
        }}
      >
        <circleGeometry args={[handleRadius, 40]} />
        <meshStandardMaterial
          color={dragging ? "#f59e0b" : "#111827"}
          emissive={dragging ? "#7c2d12" : "#000000"}
          emissiveIntensity={dragging ? 0.22 : 0}
          transparent
          opacity={0.88}
          roughness={0.34}
          metalness={0.12}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.014, 0]}>
        <ringGeometry args={[handleRadius * 1.15, handleRadius * 1.34, 48]} />
        <meshBasicMaterial
          color={dragging ? "#fbbf24" : "#f59e0b"}
          transparent
          opacity={dragging ? 0.72 : 0.48}
        />
      </mesh>
      <mesh position={[0, 0.012, 0]}>
        <sphereGeometry args={[handleRadius * 0.26, 20, 20]} />
        <meshStandardMaterial
          color="#fff7ed"
          roughness={0.18}
          metalness={0.2}
        />
      </mesh>
      <Html position={[0, 0.16, 0]} center transform sprite>
        <button
          type="button"
          className={cn(
            "select-none rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur-sm transition",
            dragging
              ? "border-amber-200 bg-amber-400/95 text-stone-950"
              : "border-stone-900/10 bg-white/88 text-stone-800",
          )}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }

            event.stopPropagation();
            onStartDrag(event.clientX, event.clientY);
          }}
        >
          اسحب • سناب {snapStepCm} سم
        </button>
      </Html>
    </group>
  );
}

function findPart(parts: CutlistPart[], kind: PartKind) {
  return parts.find((part) => part.kind === kind);
}

function formatPartLabel(part: CutlistPart | undefined) {
  if (!part) {
    return undefined;
  }

  return `${part.name} ${round2(part.length)}×${round2(part.width)} سم`;
}

function CabinetModel({
  input,
  result,
  selectedPartId,
  showPartLabels = true,
}: CabinetModelProps) {
  const isCornerLBase =
    input.cabinetType === "corner-l-base" ||
    input.cabinetType === "corner-l-wall";
  const isWallMounted =
    input.cabinetType === "wall" || input.cabinetType === "corner-l-wall";
  const effectiveWidthCm = isCornerLBase
    ? input.width + Math.max(input.returnDepth - input.boardThickness, 0)
    : input.width;
  const width = effectiveWidthCm / 100;
  const mainArmLength = input.width / 100;
  const depth = input.depth / 100;
  const returnDepth = input.returnDepth / 100;
  const board = input.boardThickness / 100;
  const back = input.backThickness / 100;
  const toeKick = isWallMounted ? 0 : 0.1;
  const side = findPart(result.parts, "side");
  const bottom = findPart(result.parts, "bottom");
  const top = findPart(result.parts, "top");
  const stretchers = findPart(result.parts, "top-stretcher");
  const hangingRail = findPart(result.parts, "hanging-rail");
  const fixedShelf = findPart(result.parts, "fixed-shelf");
  const shelf = findPart(result.parts, "shelf");
  const backPart = findPart(result.parts, "back");
  const plinth = findPart(result.parts, "plinth");
  const mainFront = findPart(result.parts, "front-main");
  const drawerFront = findPart(result.parts, "front-drawer");
  const upperFront = findPart(result.parts, "front-upper");
  const lowerFront = findPart(result.parts, "front-lower");

  const bodyHeight = Math.max((side?.length ?? input.height) / 100, board);
  const cabinetBaseY = toeKick / 2;
  const bodyCenterY = cabinetBaseY + bodyHeight / 2;
  const topY = cabinetBaseY + bodyHeight - board / 2;
  const bottomY = cabinetBaseY + board / 2;
  const leftX = -width / 2 + board / 2;
  const rightX = width / 2 - board / 2;
  const shelfZ = back / 2;
  const frontZ = depth / 2 + board / 2 + 0.002;
  const doorCount = result.metrics.doorLeafCount;
  const drawerCount = result.metrics.drawerCount;
  const horizontalDoorGap = doorCount === 2 ? 0.006 : 0;
  const verticalFrontGap = 0.006;

  function isSelected(part: CutlistPart | undefined) {
    return part ? part.id === selectedPartId : false;
  }

  if (isCornerLBase) {
    const armWidth = Math.max(mainArmLength, board * 4);
    const armDepth = Math.max(depth, board * 4);
    const returnArm = Math.max(returnDepth, armDepth);
    const returnX =
      input.cornerHand === "left"
        ? -armWidth / 2 + armDepth / 2
        : armWidth / 2 - armDepth / 2;
    const returnBackZ = -(returnArm - armDepth) / 2;
    const cornerFront = mainFront ?? upperFront ?? lowerFront;
    const cornerDoorWidth = Math.max(
      (cornerFront?.length ?? input.width / 2) / 100,
      0.08,
    );
    const cornerDoorHeight = Math.max(
      (cornerFront?.width ?? bodyHeight) / 100,
      0.08,
    );
    const doorCenterOffset = (cornerDoorWidth / 2) * Math.SQRT1_2;
    const doorOuterZ = armDepth / 2 + board * 0.28;
    const doorCenterZ = doorOuterZ - doorCenterOffset;
    const doorCenterY = cabinetBaseY + cornerDoorHeight / 2 + 0.01;

    function renderCornerDeck(
      part: CutlistPart,
      y: number,
      color: string,
      labelOffset: [number, number, number],
    ) {
      return (
        <>
          <Panel
            size={[armWidth, board, armDepth]}
            position={[0, y, 0]}
            color={color}
            highlighted={isSelected(part)}
            label={showPartLabels ? formatPartLabel(part) : undefined}
            labelOffset={labelOffset}
            grainDirection={part.grainDirection}
            lengthAxis="x"
            widthAxis="z"
          />
          <Panel
            size={[armDepth, board, returnArm]}
            position={[returnX, y, returnBackZ]}
            color={color}
            highlighted={isSelected(part)}
            grainDirection={part.grainDirection}
            lengthAxis="x"
            widthAxis="z"
          />
        </>
      );
    }

    return (
      <group>
        <Panel
          size={[board, bodyHeight, armDepth]}
          position={[
            input.cornerHand === "left"
              ? armWidth / 2 - board / 2
              : -armWidth / 2 + board / 2,
            bodyCenterY,
            0,
          ]}
          color="#a07751"
          highlighted={isSelected(side)}
          label={showPartLabels ? formatPartLabel(side) : undefined}
          labelOffset={[input.cornerHand === "left" ? 0.08 : -0.08, 0.05, 0]}
          grainDirection={side?.grainDirection}
          lengthAxis="y"
          widthAxis="z"
        />
        <Panel
          size={[armDepth, bodyHeight, board]}
          position={[returnX, bodyCenterY, -returnArm / 2 + board / 2]}
          color="#a07751"
          highlighted={isSelected(side)}
          label={showPartLabels ? formatPartLabel(side) : undefined}
          labelOffset={[0, 0.05, -0.08]}
          grainDirection={side?.grainDirection}
          lengthAxis="x"
          widthAxis="y"
        />

        {bottom
          ? renderCornerDeck(bottom, bottomY, "#b88d60", [0, 0.05, 0.04])
          : null}

        {top ? renderCornerDeck(top, topY, "#b88d60", [0, 0.05, 0.04]) : null}

        {stretchers ? (
          <>
            <Panel
              size={[armWidth, board, stretchers.width / 100]}
              position={[0, topY, armDepth / 2 - stretchers.width / 200]}
              color="#8b6a49"
              highlighted={isSelected(stretchers)}
              label={showPartLabels ? formatPartLabel(stretchers) : undefined}
              labelOffset={[0, 0.05, 0.06]}
              grainDirection={stretchers.grainDirection}
              lengthAxis="x"
              widthAxis="z"
            />
            <Panel
              size={[armDepth, board, Math.max(returnArm - board, board)]}
              position={[
                returnX,
                topY,
                -returnArm / 2 + Math.max(returnArm - board, board) / 2,
              ]}
              color="#8b6a49"
              highlighted={isSelected(stretchers)}
              grainDirection={stretchers.grainDirection}
              lengthAxis="x"
              widthAxis="z"
            />
          </>
        ) : null}

        {backPart ? (
          <>
            <Panel
              size={[armWidth, bodyHeight, back]}
              position={[0, bodyCenterY, -armDepth / 2 + back / 2]}
              color="#8093a1"
              highlighted={isSelected(backPart)}
              label={showPartLabels ? formatPartLabel(backPart) : undefined}
              labelOffset={[0, 0.05, -0.03]}
              grainDirection={backPart.grainDirection}
              lengthAxis="x"
              widthAxis="y"
            />
            <Panel
              size={[back, bodyHeight, returnArm]}
              position={[
                input.cornerHand === "left"
                  ? returnX + armDepth / 2 - back / 2
                  : returnX - armDepth / 2 + back / 2,
                bodyCenterY,
                returnBackZ,
              ]}
              color="#8093a1"
              highlighted={isSelected(backPart)}
              grainDirection={backPart.grainDirection}
              lengthAxis="z"
              widthAxis="y"
            />
          </>
        ) : null}

        {shelf
          ? Array.from(
              { length: Math.max(0, Math.floor(input.shelfCount)) },
              (_, index) => {
                const level = bodyHeight / (input.shelfCount + 1);
                const shelfY = cabinetBaseY + level * (index + 1);

                return (
                  <group key={`shelf-${index}`}>
                    <Panel
                      size={[armWidth, board, armDepth]}
                      position={[0, shelfY, 0]}
                      color="#d8bd87"
                      highlighted={isSelected(shelf)}
                      label={
                        showPartLabels ? formatPartLabel(shelf) : undefined
                      }
                      grainDirection={shelf.grainDirection}
                      lengthAxis="x"
                      widthAxis="z"
                    />
                    <Panel
                      size={[armDepth, board, returnArm]}
                      position={[returnX, shelfY, returnBackZ]}
                      color="#d8bd87"
                      highlighted={isSelected(shelf)}
                      grainDirection={shelf.grainDirection}
                      lengthAxis="x"
                      widthAxis="z"
                    />
                  </group>
                );
              },
            )
          : null}

        {cornerFront && doorCount > 0
          ? Array.from({ length: doorCount }, (_, index) => {
              const isLeftLeaf = index === 0;

              return (
                <group
                  key={`corner-door-${index}`}
                  position={[
                    isLeftLeaf ? -doorCenterOffset : doorCenterOffset,
                    doorCenterY,
                    doorCenterZ,
                  ]}
                  rotation={[0, isLeftLeaf ? Math.PI / 4 : -Math.PI / 4, 0]}
                >
                  <Panel
                    size={[cornerDoorWidth, cornerDoorHeight, board * 0.65]}
                    position={[0, 0, 0]}
                    color="#cf9860"
                    highlighted={isSelected(cornerFront)}
                    label={
                      showPartLabels ? formatPartLabel(cornerFront) : undefined
                    }
                    labelOffset={[0, 0.05, 0.03]}
                    grainDirection={cornerFront.grainDirection}
                    lengthAxis="x"
                    widthAxis="y"
                  />
                </group>
              );
            })
          : null}

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[8, 8]} />
          <shadowMaterial opacity={0.18} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <Panel
        size={[board, bodyHeight, depth]}
        position={[leftX, bodyCenterY, 0]}
        color="#a07751"
        highlighted={isSelected(side)}
        label={showPartLabels ? formatPartLabel(side) : undefined}
        labelOffset={[-0.08, 0.05, 0]}
        grainDirection={side?.grainDirection}
        lengthAxis="y"
        widthAxis="z"
      />
      <Panel
        size={[board, bodyHeight, depth]}
        position={[rightX, bodyCenterY, 0]}
        color="#a07751"
        highlighted={isSelected(side)}
        label={showPartLabels ? formatPartLabel(side) : undefined}
        labelOffset={[0.08, 0.05, 0]}
        grainDirection={side?.grainDirection}
        lengthAxis="y"
        widthAxis="z"
      />

      {bottom ? (
        <Panel
          size={[bottom.length / 100, board, bottom.width / 100]}
          position={[0, bottomY, shelfZ]}
          color="#b88d60"
          highlighted={isSelected(bottom)}
          label={showPartLabels ? formatPartLabel(bottom) : undefined}
          grainDirection={bottom.grainDirection}
          lengthAxis="x"
          widthAxis="z"
        />
      ) : null}

      {top ? (
        <Panel
          size={[top.length / 100, board, top.width / 100]}
          position={[0, topY, shelfZ]}
          color="#b88d60"
          highlighted={isSelected(top)}
          label={showPartLabels ? formatPartLabel(top) : undefined}
          grainDirection={top.grainDirection}
          lengthAxis="x"
          widthAxis="z"
        />
      ) : null}

      {stretchers ? (
        <>
          <Panel
            size={[stretchers.length / 100, board, stretchers.width / 100]}
            position={[0, topY, depth / 2 - stretchers.width / 200]}
            color="#8b6a49"
            highlighted={isSelected(stretchers)}
            label={showPartLabels ? formatPartLabel(stretchers) : undefined}
            labelOffset={[0, 0.05, 0.06]}
            grainDirection={stretchers.grainDirection}
            lengthAxis="x"
            widthAxis="z"
          />
          <Panel
            size={[stretchers.length / 100, board, stretchers.width / 100]}
            position={[0, topY, -depth / 2 + stretchers.width / 200 + back]}
            color="#8b6a49"
            highlighted={isSelected(stretchers)}
            label={showPartLabels ? formatPartLabel(stretchers) : undefined}
            labelOffset={[0, 0.05, -0.06]}
            grainDirection={stretchers.grainDirection}
            lengthAxis="x"
            widthAxis="z"
          />
        </>
      ) : null}

      {backPart ? (
        <Panel
          size={[width - 0.004, bodyHeight - 0.004, back]}
          position={[0, bodyCenterY, -depth / 2 + back / 2]}
          color="#8093a1"
          highlighted={isSelected(backPart)}
          label={showPartLabels ? formatPartLabel(backPart) : undefined}
          labelOffset={[0, 0.05, -0.03]}
          grainDirection={backPart.grainDirection}
          lengthAxis="x"
          widthAxis="y"
        />
      ) : null}

      {fixedShelf ? (
        <Panel
          size={[fixedShelf.length / 100, board, fixedShelf.width / 100]}
          position={[0, cabinetBaseY + bodyHeight * 0.5, shelfZ]}
          color="#bca16e"
          highlighted={isSelected(fixedShelf)}
          label={showPartLabels ? formatPartLabel(fixedShelf) : undefined}
          grainDirection={fixedShelf.grainDirection}
          lengthAxis="x"
          widthAxis="z"
        />
      ) : null}

      {shelf
        ? Array.from(
            { length: Math.max(0, Math.floor(input.shelfCount)) },
            (_, index) => {
              const level = bodyHeight / (input.shelfCount + 1);
              return (
                <Panel
                  key={`shelf-${index}`}
                  size={[shelf.length / 100, board, shelf.width / 100]}
                  position={[0, cabinetBaseY + level * (index + 1), shelfZ]}
                  color="#d8bd87"
                  highlighted={isSelected(shelf)}
                  label={showPartLabels ? formatPartLabel(shelf) : undefined}
                  grainDirection={shelf.grainDirection}
                  lengthAxis="x"
                  widthAxis="z"
                />
              );
            },
          )
        : null}

      {hangingRail ? (
        <>
          <Panel
            size={[hangingRail.length / 100, hangingRail.width / 100, board]}
            position={[
              0,
              topY - hangingRail.width / 200,
              -depth / 2 + board / 2 + 0.02,
            ]}
            color="#6c7d89"
            highlighted={isSelected(hangingRail)}
            label={showPartLabels ? formatPartLabel(hangingRail) : undefined}
            labelOffset={[0, 0.05, -0.03]}
            grainDirection={hangingRail.grainDirection}
            lengthAxis="x"
            widthAxis="y"
          />
          <Panel
            size={[hangingRail.length / 100, hangingRail.width / 100, board]}
            position={[
              0,
              bottomY + hangingRail.width / 200,
              -depth / 2 + board / 2 + 0.02,
            ]}
            color="#6c7d89"
            highlighted={isSelected(hangingRail)}
            label={showPartLabels ? formatPartLabel(hangingRail) : undefined}
            labelOffset={[0, 0.05, -0.03]}
            grainDirection={hangingRail.grainDirection}
            lengthAxis="x"
            widthAxis="y"
          />
        </>
      ) : null}

      {plinth ? (
        <Panel
          size={[plinth.length / 100, plinth.width / 100, board]}
          position={[0, toeKick / 2, depth / 2 - board / 2]}
          color="#70553a"
          highlighted={isSelected(plinth)}
          label={showPartLabels ? formatPartLabel(plinth) : undefined}
          labelOffset={[0, 0.05, 0.05]}
          grainDirection={plinth.grainDirection}
          lengthAxis="x"
          widthAxis="y"
        />
      ) : null}

      {mainFront
        ? Array.from({ length: doorCount }, (_, index) => {
            const doorWidth = Math.max(mainFront.length / 100, 0.08);
            const doorHeight = Math.max(mainFront.width / 100, 0.08);
            const offset =
              doorCount === 1 ? 0 : (doorWidth + horizontalDoorGap) / 2;
            const x = doorCount === 1 ? 0 : index === 0 ? -offset : offset;
            const centerY =
              drawerFront && drawerCount > 0
                ? cabinetBaseY + doorHeight / 2 + 0.01
                : cabinetBaseY + bodyHeight / 2;

            return (
              <Panel
                key={`door-main-${index}`}
                size={[doorWidth, doorHeight, board * 0.65]}
                position={[x, centerY, frontZ]}
                color="#cf9860"
                highlighted={isSelected(mainFront)}
                label={showPartLabels ? formatPartLabel(mainFront) : undefined}
                labelOffset={[0, 0.05, 0.03]}
                grainDirection={mainFront.grainDirection}
                lengthAxis="x"
                widthAxis="y"
              />
            );
          })
        : null}

      {drawerFront && drawerCount > 0
        ? Array.from({ length: drawerCount }, (_, index) => {
            const drawerWidth = Math.max(drawerFront.length / 100, 0.08);
            const drawerHeight = Math.max(drawerFront.width / 100, 0.08);
            const topEdge = cabinetBaseY + bodyHeight - 0.01;
            const centerY =
              topEdge -
              drawerHeight / 2 -
              index * (drawerHeight + verticalFrontGap);

            return (
              <Panel
                key={`drawer-front-${index}`}
                size={[drawerWidth, drawerHeight, board * 0.65]}
                position={[0, centerY, frontZ]}
                color={mainFront ? "#c98952" : "#cf9860"}
                highlighted={isSelected(drawerFront)}
                label={
                  showPartLabels ? formatPartLabel(drawerFront) : undefined
                }
                labelOffset={[0, 0.05, 0.03]}
                grainDirection={drawerFront.grainDirection}
                lengthAxis="x"
                widthAxis="y"
              />
            );
          })
        : null}

      {upperFront && lowerFront
        ? Array.from({ length: doorCount }, (_, columnIndex) => {
            const upperWidth = Math.max(upperFront.length / 100, 0.08);
            const upperHeight = Math.max(upperFront.width / 100, 0.08);
            const lowerWidth = Math.max(lowerFront.length / 100, 0.08);
            const lowerHeight = Math.max(lowerFront.width / 100, 0.08);
            const offset =
              doorCount === 1 ? 0 : (upperWidth + horizontalDoorGap) / 2;
            const x =
              doorCount === 1 ? 0 : columnIndex === 0 ? -offset : offset;
            const lowerCenter = cabinetBaseY + lowerHeight / 2 + 0.01;
            const upperCenter =
              cabinetBaseY + bodyHeight - upperHeight / 2 - 0.01;

            return (
              <group key={`door-split-${columnIndex}`}>
                <Panel
                  size={[upperWidth, upperHeight, board * 0.65]}
                  position={[x, upperCenter, frontZ]}
                  color="#cf9860"
                  highlighted={isSelected(upperFront)}
                  label={
                    showPartLabels ? formatPartLabel(upperFront) : undefined
                  }
                  labelOffset={[0, 0.05, 0.03]}
                  grainDirection={upperFront.grainDirection}
                  lengthAxis="x"
                  widthAxis="y"
                />
                <Panel
                  size={[lowerWidth, lowerHeight, board * 0.65]}
                  position={[x, lowerCenter, frontZ]}
                  color="#b8824a"
                  highlighted={isSelected(lowerFront)}
                  label={
                    showPartLabels ? formatPartLabel(lowerFront) : undefined
                  }
                  labelOffset={[0, 0.05, 0.03]}
                  grainDirection={lowerFront.grainDirection}
                  lengthAxis="x"
                  widthAxis="y"
                />
              </group>
            );
          })
        : null}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <shadowMaterial opacity={0.18} />
      </mesh>
    </group>
  );
}

export function CabinetPreview({
  input,
  result,
  selectedPartId,
}: CabinetPreviewProps) {
  const isCornerLBase =
    input.cabinetType === "corner-l-base" ||
    input.cabinetType === "corner-l-wall";
  const previewRotationY = isCornerLBase
    ? input.cornerHand === "left"
      ? 0.22
      : -0.22
    : -0.45;
  const previewOffsetX = 0;
  const previewOffsetZ = isCornerLBase ? 0.08 : 0.02;
  const previewScale = isCornerLBase ? 1.3 : 1.08;
  const cameraPosition = isCornerLBase ? [1.2, 1.95, 2.65] : [2.35, 2.05, 2.5];
  const previewDepthCm = isCornerLBase
    ? Math.max(input.depth, input.returnDepth)
    : input.depth;
  const selectedPart = result.parts.find((part) => part.id === selectedPartId);
  const previewFootprint = formatPreviewFootprint(
    input.width,
    input.height,
    previewDepthCm,
  );

  return (
    <div className="group relative isolate h-80 w-full overflow-hidden rounded-[1.5rem] border border-stone-950/10 bg-[radial-gradient(circle_at_top,_rgba(255,252,248,0.98),_rgba(233,221,203,0.94)_52%,_rgba(205,181,146,0.9)_100%)] shadow-[0_28px_70px_-42px_rgba(74,48,18,0.55)]">
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-wrap items-start justify-between gap-3">
        <div className="rounded-2xl border border-white/70 bg-white/78 px-3 py-2 shadow-[0_18px_45px_-32px_rgba(64,41,16,0.45)] backdrop-blur-sm">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
            عرض الاستديو
          </p>
          <p className="mt-1 text-sm font-semibold text-stone-950">
            {previewFootprint}
          </p>
          <p className="mt-1 text-[11px] text-stone-600">
            {result.metrics.totalPanels} قطعة محسوبة داخل المشهد
          </p>
        </div>
        <div className="rounded-2xl border border-stone-900/10 bg-stone-950/68 px-3 py-2 text-[11px] leading-5 text-white/90 shadow-[0_18px_45px_-32px_rgba(28,25,23,0.7)] backdrop-blur-sm">
          <p>اسحب للتدوير، وعجلة الماوس للتقريب.</p>
          <p>
            {selectedPart
              ? `القطعة المظللة الآن: ${selectedPart.name}`
              : "اضغط على أي جزء من الجدول لتراجع تموضعه داخل الموديل."}
          </p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-28 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.55),_transparent_68%)]" />
      <div className="pointer-events-none absolute inset-x-8 bottom-5 z-10 flex justify-end">
        <div className="rounded-full border border-white/65 bg-white/76 px-3 py-1.5 text-[11px] font-medium text-stone-700 shadow-sm backdrop-blur-sm">
          منظور أقرب وخلفية stage أوضح لقراءة الشكل بسرعة
        </div>
      </div>
      <Canvas
        camera={{
          position: cameraPosition as [number, number, number],
          fov: isCornerLBase ? 30 : 33,
        }}
        shadows="basic"
        dpr={[1, 1.5]}
      >
        <color attach="background" args={["#eadbc6"]} />
        <fog attach="fog" args={["#eadbc6", 3.6, 7.4]} />
        <ambientLight intensity={1.22} />
        <hemisphereLight
          intensity={0.68}
          groundColor="#b9a58c"
          color="#fff6eb"
        />
        <directionalLight
          castShadow
          intensity={1.8}
          position={[3.8, 6.2, 4.5]}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <spotLight
          intensity={0.95}
          position={[-3.2, 4.8, 3.8]}
          angle={0.42}
          penumbra={0.9}
        />
        <pointLight
          intensity={0.45}
          position={[0, 1.8, -2.4]}
          color="#ffe9c8"
        />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.502, 0]}
          receiveShadow
        >
          <planeGeometry args={[7.4, 7.4]} />
          <meshStandardMaterial
            color="#f0e2cf"
            roughness={0.98}
            metalness={0.02}
          />
        </mesh>
        <gridHelper
          args={[5.8, 18, "#c89d63", "#e6d4bc"]}
          position={[0, -0.495, 0]}
        />
        <mesh position={[0, 1.1, -1.85]} receiveShadow>
          <planeGeometry args={[5.8, 2.8]} />
          <meshStandardMaterial
            color="#efe3d4"
            roughness={1}
            metalness={0.01}
          />
        </mesh>
        <group
          position={[previewOffsetX, -0.5, previewOffsetZ]}
          rotation={[0, previewRotationY, 0]}
          scale={previewScale}
        >
          <CabinetModel
            input={input}
            result={result}
            selectedPartId={selectedPartId}
          />
        </group>
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={isCornerLBase ? 2.2 : 1.9}
          maxDistance={isCornerLBase ? 6.2 : 5.4}
          maxPolarAngle={isCornerLBase ? Math.PI / 1.95 : Math.PI / 2.05}
        />
      </Canvas>
    </div>
  );
}

export function ProjectPreview({
  units,
  onSelectUnit,
  onUnitPositionChange,
  onCanvasReady,
}: ProjectPreviewProps) {
  const positionSnapCm = 10;
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const sceneRef = useRef<Group | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const dragPlaneRef = useRef(new Plane(new Vector3(0, 1, 0), 0));
  const dragPointRef = useRef(new Vector3());
  const raycasterRef = useRef(new Raycaster());
  const pointerRef = useRef(new Vector2());
  const dragStateRef = useRef<{
    unitId: string;
    pointerOffsetX: number;
    pointerOffsetZ: number;
    worldY: number;
  } | null>(null);
  const [draggingUnitId, setDraggingUnitId] = useState<string | null>(null);

  function getPlanWidth(unit: ProjectPreviewProps["units"][number]) {
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
    const isQuarterTurn =
      normalizedRotation === 90 || normalizedRotation === 270;

    return isQuarterTurn ? baseDepth / 100 : baseWidth / 100;
  }

  function getPlanDepth(unit: ProjectPreviewProps["units"][number]) {
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
    const isQuarterTurn =
      normalizedRotation === 90 || normalizedRotation === 270;

    return isQuarterTurn ? baseWidth / 100 : baseDepth / 100;
  }

  const activeUnit = units.find((unit) => unit.active) ?? units[0] ?? null;
  const layoutBounds = units.reduce(
    (bounds, unit) => {
      const planWidth = getPlanWidth(unit);
      const planDepth = getPlanDepth(unit);

      return {
        minX: Math.min(bounds.minX, unit.position[0] - planWidth / 2),
        maxX: Math.max(bounds.maxX, unit.position[0] + planWidth / 2),
        minZ: Math.min(bounds.minZ, unit.position[2] - planDepth / 2),
        maxZ: Math.max(bounds.maxZ, unit.position[2] + planDepth / 2),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    },
  );
  const anchorBounds = units.reduce(
    (bounds, unit) => {
      const planWidth = getPlanWidth(unit);
      const planDepth = getPlanDepth(unit);

      return {
        minX: Math.min(bounds.minX, unit.basePosition[0] - planWidth / 2),
        maxX: Math.max(bounds.maxX, unit.basePosition[0] + planWidth / 2),
        minZ: Math.min(bounds.minZ, unit.basePosition[2] - planDepth / 2),
        maxZ: Math.max(bounds.maxZ, unit.basePosition[2] + planDepth / 2),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    },
  );
  const safeLayoutBounds = Number.isFinite(layoutBounds.minX)
    ? layoutBounds
    : { minX: -0.6, maxX: 0.6, minZ: -0.6, maxZ: 0.6 };
  const safeAnchorBounds = Number.isFinite(anchorBounds.minX)
    ? anchorBounds
    : { minX: -0.6, maxX: 0.6, minZ: -0.6, maxZ: 0.6 };

  const layoutWidth = round2(safeLayoutBounds.maxX - safeLayoutBounds.minX);
  const layoutDepth = round2(safeLayoutBounds.maxZ - safeLayoutBounds.minZ);
  const sceneCenterX = round2(
    (safeAnchorBounds.minX + safeAnchorBounds.maxX) / 2,
  );
  const sceneCenterZ = round2(
    (safeAnchorBounds.minZ + safeAnchorBounds.maxZ) / 2,
  );
  const isSingleUnit = units.length === 1;
  const farthestXFromCenter = Math.max(
    Math.abs(safeLayoutBounds.minX - sceneCenterX),
    Math.abs(safeLayoutBounds.maxX - sceneCenterX),
  );
  const farthestZFromCenter = Math.max(
    Math.abs(safeLayoutBounds.minZ - sceneCenterZ),
    Math.abs(safeLayoutBounds.maxZ - sceneCenterZ),
  );
  const sceneWidth = Math.max(
    isSingleUnit ? 3.8 : 4.8,
    round2(farthestXFromCenter * 2 + (isSingleUnit ? 1.8 : 2.4)),
  );
  const sceneDepth = Math.max(
    isSingleUnit ? 3.4 : 4.4,
    round2(farthestZFromCenter * 2 + (isSingleUnit ? 1.9 : 2.5)),
  );
  const sceneHeight = Math.max(
    3.2,
    units.reduce(
      (max, unit) =>
        Math.max(max, unit.position[1] + unit.input.height / 100 + 0.8),
      0,
    ),
  );
  const sceneSpan = Math.max(sceneWidth * 0.92, sceneDepth, sceneHeight * 1.04);
  const baseCameraDistance = isSingleUnit
    ? 4.35
    : Math.max(6, round2(sceneSpan * 0.92 + 1.85));
  const minCameraDistance = isSingleUnit
    ? 2.45
    : Math.max(3.6, round2(baseCameraDistance * 0.56));
  const maxCameraDistance = isSingleUnit
    ? 8.4
    : Math.max(11.5, round2(baseCameraDistance * 2.05));
  const targetY = Math.max(0.86, round2(sceneHeight * 0.32));
  const fogNear = Math.max(7, round2(baseCameraDistance * 0.82));
  const fogFar = Math.max(fogNear + 13, round2(maxCameraDistance * 1.7));
  const dragLimitX = Math.max(160, round2((layoutWidth * 100) / 2 + 60));
  const dragLimitZ = Math.max(160, round2((layoutDepth * 100) / 2 + 60));
  const activeUnitFootprint = activeUnit
    ? formatPreviewFootprint(
        round2(getPlanWidth(activeUnit) * 100),
        activeUnit.input.height,
        round2(getPlanDepth(activeUnit) * 100),
      )
    : null;

  function getScenePointFromClient(
    clientX: number,
    clientY: number,
    worldY: number,
  ) {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const canvasElement = canvasElementRef.current;

    if (!scene || !camera || !canvasElement) {
      return null;
    }

    const bounds = canvasElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
      return null;
    }

    pointerRef.current.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );

    raycasterRef.current.setFromCamera(pointerRef.current, camera);
    dragPlaneRef.current.set(new Vector3(0, 1, 0), -worldY);

    if (
      !raycasterRef.current.ray.intersectPlane(
        dragPlaneRef.current,
        dragPointRef.current,
      )
    ) {
      return null;
    }

    return scene.worldToLocal(dragPointRef.current.clone());
  }

  function stopDragging() {
    dragStateRef.current = null;
    setDraggingUnitId(null);

    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }
  }

  useEffect(() => {
    if (!draggingUnitId) {
      return undefined;
    }

    function handleWindowPointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const canvasElement = canvasElementRef.current;

      if (!dragState || !scene || !camera || !canvasElement) {
        return;
      }

      const bounds = canvasElement.getBoundingClientRect();
      if (!bounds.width || !bounds.height) {
        return;
      }
      const scenePoint = getScenePointFromClient(
        event.clientX,
        event.clientY,
        dragState.worldY,
      );

      if (!scenePoint) {
        return;
      }

      const nextX = clamp(
        snapToStep(
          (scenePoint.x - dragState.pointerOffsetX) * 100,
          positionSnapCm,
        ),
        -dragLimitX,
        dragLimitX,
      );
      const nextZ = clamp(
        snapToStep(
          (scenePoint.z - dragState.pointerOffsetZ) * 100,
          positionSnapCm,
        ),
        -dragLimitZ,
        dragLimitZ,
      );

      onUnitPositionChange?.(dragState.unitId, {
        x: nextX,
        z: nextZ,
      });
    }

    function handleWindowPointerUp() {
      stopDragging();
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
    };
  }, [
    dragLimitX,
    dragLimitZ,
    draggingUnitId,
    onUnitPositionChange,
    positionSnapCm,
  ]);

  useEffect(() => {
    onCanvasReady?.(canvasElementRef.current);

    return () => {
      onCanvasReady?.(null);
    };
  }, [onCanvasReady]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!camera || !controls) {
      return;
    }

    controls.target.set(0, targetY, 0);
    camera.position.set(
      sceneCenterX + round2(baseCameraDistance * (isSingleUnit ? 0.54 : 0.68)),
      Math.max(2.5, round2(sceneHeight * (isSingleUnit ? 0.48 : 0.62) + 0.95)),
      sceneCenterZ + round2(baseCameraDistance * (isSingleUnit ? 0.66 : 0.88)),
    );

    controls.target.set(sceneCenterX, targetY, sceneCenterZ);

    if (camera instanceof PerspectiveCamera) {
      camera.near = 0.1;
      camera.far = Math.max(50, baseCameraDistance * 8);
      camera.updateProjectionMatrix();
    }

    controls.minDistance = minCameraDistance;
    controls.maxDistance = maxCameraDistance;
    controls.update();
  }, [
    baseCameraDistance,
    isSingleUnit,
    maxCameraDistance,
    minCameraDistance,
    sceneCenterX,
    sceneCenterZ,
    sceneHeight,
    targetY,
    units.length,
  ]);

  function startDraggingUnit(
    unit: ProjectPreviewProps["units"][number],
    clientX: number,
    clientY: number,
    dragPlaneWorldY = unit.position[1] - 0.55,
  ) {
    const scenePoint = getScenePointFromClient(
      clientX,
      clientY,
      dragPlaneWorldY,
    );

    if (!scenePoint) {
      return;
    }

    dragStateRef.current = {
      unitId: unit.id,
      pointerOffsetX: scenePoint.x - unit.position[0],
      pointerOffsetZ: scenePoint.z - unit.position[2],
      worldY: dragPlaneWorldY,
    };
    setDraggingUnitId(unit.id);

    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }
  }

  return (
    <div
      className={cn(
        "group relative isolate h-[35rem] w-full overflow-hidden rounded-[1.75rem] border border-stone-950/10 bg-[radial-gradient(circle_at_top,_rgba(255,252,248,0.98),_rgba(233,220,201,0.94)_50%,_rgba(204,179,144,0.92)_100%)] shadow-[0_32px_90px_-46px_rgba(74,48,18,0.58)] lg:h-[40rem]",
        draggingUnitId ? "cursor-grabbing" : "cursor-grab",
      )}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="pointer-events-none absolute inset-x-5 top-5 z-10 flex flex-wrap items-start justify-between gap-3">
        <div className="rounded-2xl border border-white/75 bg-white/78 px-3 py-2 shadow-[0_18px_45px_-32px_rgba(64,41,16,0.45)] backdrop-blur-sm">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
            مسرح الترتيب
          </p>
          <p className="mt-1 text-sm font-semibold text-stone-950">
            {units.length} وحدة داخل المشهد
          </p>
          <p className="mt-1 text-[11px] text-stone-600">
            مجال العرض {formatPreviewDimension(sceneWidth * 100)} ×{" "}
            {formatPreviewDimension(sceneDepth * 100)}
          </p>
        </div>
        <div className="max-w-sm rounded-2xl border border-stone-900/10 bg-stone-950/70 px-3 py-2 text-[11px] leading-5 text-white/92 shadow-[0_18px_45px_-32px_rgba(28,25,23,0.7)] backdrop-blur-sm">
          <p>يمكنك سحب الوحدة من جسمها مباشرة أو من مقبض السحب أسفلها.</p>
          <p>أسهم الكيبورد = حركة 10 سم، و Shift + الأسهم = حركة دقيقة 1 سم.</p>
          <p>اسحب بالماوس على المساحة الفارغة لتدوير الكاميرا، وعجلة الماوس = تقريب وإبعاد.</p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-7 bottom-5 z-10 flex flex-wrap items-end justify-between gap-3">
        <div className="rounded-full border border-white/65 bg-white/76 px-3 py-1.5 text-[11px] font-medium text-stone-700 shadow-sm backdrop-blur-sm">
          {draggingUnitId
            ? `أنت الآن تحرك الوحدة داخل المسرح بخطوات ${positionSnapCm} سم`
            : `الحركة الآن تمسك على شبكة ${positionSnapCm} سم لتفادي الاهتزاز والقفز`}
        </div>
        {activeUnit && activeUnitFootprint ? (
          <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-right text-[11px] leading-5 text-stone-700 shadow-sm backdrop-blur-sm">
            <p className="font-semibold text-stone-950">
              الوحدة النشطة: {activeUnit.title}
            </p>
            <p>{activeUnitFootprint}</p>
          </div>
        ) : null}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-36 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.58),_transparent_68%)]" />
      <Canvas
        camera={{ position: [0, 3, 7.2], fov: 34 }}
        shadows="basic"
        dpr={[1, 1.5]}
        gl={{ preserveDrawingBuffer: true }}
        onCreated={({ camera, gl }) => {
          cameraRef.current = camera;
          canvasElementRef.current = gl.domElement;
          onCanvasReady?.(gl.domElement);
        }}
      >
        <color attach="background" args={["#e9dbc7"]} />
        <fog attach="fog" args={["#e9dbc7", fogNear, fogFar]} />
        <ambientLight intensity={1.18} />
        <hemisphereLight
          intensity={0.66}
          groundColor="#bba78c"
          color="#fff7ec"
        />
        <directionalLight
          castShadow
          intensity={1.82}
          position={[4.8, 7.2, 5.4]}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <spotLight
          intensity={0.95}
          position={[-4.2, 5.4, 5.2]}
          angle={0.42}
          penumbra={0.9}
        />
        <pointLight
          intensity={0.36}
          position={[sceneCenterX, 2.2, sceneCenterZ - sceneDepth / 2]}
          color="#ffe5bf"
        />

        <group ref={sceneRef} position={[0, -0.55, 0]}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[sceneCenterX, -0.004, sceneCenterZ]}
            receiveShadow
          >
            <planeGeometry args={[sceneWidth + 1.4, sceneDepth + 1.4]} />
            <meshStandardMaterial
              color="#f0e3d1"
              roughness={0.98}
              metalness={0.02}
            />
          </mesh>
          <gridHelper
            args={[
              Math.max(sceneWidth, sceneDepth) + 0.8,
              Math.max(14, Math.round(Math.max(sceneWidth, sceneDepth) * 4)),
              "#c79b61",
              "#e6d6c1",
            ]}
            position={[sceneCenterX, 0.012, sceneCenterZ]}
          />
          <mesh
            position={[
              sceneCenterX,
              sceneHeight / 2 - 0.2,
              sceneCenterZ - sceneDepth / 2 + 0.02,
            ]}
            receiveShadow
          >
            <planeGeometry args={[sceneWidth, sceneHeight]} />
            <meshStandardMaterial
              color="#eee4d6"
              roughness={0.98}
              metalness={0.02}
            />
          </mesh>
          <mesh
            position={[
              sceneCenterX - sceneWidth / 2 + 0.02,
              sceneHeight / 2 - 0.2,
              sceneCenterZ,
            ]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[sceneDepth, sceneHeight]} />
            <meshStandardMaterial
              color="#f4ecdf"
              roughness={1}
              metalness={0.01}
              transparent
              opacity={0.76}
            />
          </mesh>
          <mesh
            position={[
              sceneCenterX + sceneWidth / 2 - 0.02,
              sceneHeight / 2 - 0.2,
              sceneCenterZ,
            ]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <planeGeometry args={[sceneDepth, sceneHeight]} />
            <meshStandardMaterial
              color="#f6efe5"
              roughness={1}
              metalness={0.01}
              transparent
              opacity={0.44}
            />
          </mesh>

          {units.map((unit) => {
            const cabinetHeight = unit.input.height / 100;
            const isSelected = unit.active;
            const planWidth = getPlanWidth(unit);
            const planDepth = getPlanDepth(unit);

            return (
              <group
                key={unit.id}
                position={unit.position}
                rotation={[0, (unit.rotationY * Math.PI) / 180, 0]}
                onPointerDown={(event) => {
                  if (event.button !== 0) {
                    return;
                  }

                  event.stopPropagation();
                  onSelectUnit?.(unit.id);

                  startDraggingUnit(unit, event.clientX, event.clientY, event.point.y);
                }}
              >
                {isSelected ? (
                  <>
                    <mesh
                      rotation={[-Math.PI / 2, 0, 0]}
                      position={[0, 0.012, 0]}
                    >
                      <planeGeometry
                        args={[planWidth + 0.18, planDepth + 0.18]}
                      />
                      <meshBasicMaterial
                        color="#f1b24a"
                        transparent
                        opacity={0.16}
                      />
                    </mesh>
                    <mesh
                      rotation={[-Math.PI / 2, 0, 0]}
                      position={[0, 0.014, 0]}
                    >
                      <ringGeometry
                        args={[
                          Math.max(planWidth, planDepth) * 0.48,
                          Math.max(planWidth, planDepth) * 0.56,
                          48,
                        ]}
                      />
                      <meshBasicMaterial
                        color="#c9801f"
                        transparent
                        opacity={0.18}
                      />
                    </mesh>
                    <AxisGuide planWidth={planWidth} planDepth={planDepth} />
                    <DragHandle
                      active={isSelected}
                      dragging={draggingUnitId === unit.id}
                      planWidth={planWidth}
                      planDepth={planDepth}
                      snapStepCm={positionSnapCm}
                      onStartDrag={(clientX, clientY, dragPlaneWorldY) => {
                        onSelectUnit?.(unit.id);
                        startDraggingUnit(
                          unit,
                          clientX,
                          clientY,
                          dragPlaneWorldY ?? unit.position[1] - 0.49,
                        );
                      }}
                    />
                  </>
                ) : null}
                <CabinetModel
                  input={unit.input}
                  result={unit.result}
                  selectedPartId={null}
                  showPartLabels={false}
                />
                <Html
                  position={[0, cabinetHeight + 0.18, 0]}
                  center
                  distanceFactor={10}
                  transform
                  sprite
                >
                  <div
                    className={cn(
                      "select-none rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm transition",
                      unit.active
                        ? "border-amber-300 bg-stone-950/82 text-white shadow-[0_0_0_4px_rgba(245,158,11,0.18)]"
                        : "border-white/70 bg-white/80 text-stone-800",
                    )}
                    onPointerDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }

                      event.stopPropagation();
                      onSelectUnit?.(unit.id);
                      startDraggingUnit(
                        unit,
                        event.clientX,
                        event.clientY,
                        unit.position[1] -
                          0.55 +
                          Math.min(unit.input.height / 200, 0.45),
                      );
                    }}
                  >
                    {unit.title}
                  </div>
                </Html>
              </group>
            );
          })}

          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[sceneCenterX, 0, sceneCenterZ]}
            receiveShadow
          >
            <planeGeometry args={[sceneWidth, sceneDepth]} />
            <shadowMaterial opacity={0.18} />
          </mesh>
        </group>

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableDamping
          dampingFactor={0.09}
          minDistance={minCameraDistance}
          maxDistance={maxCameraDistance}
          maxPolarAngle={Math.PI / 2.05}
          rotateSpeed={0.78}
          mouseButtons={{
            LEFT: MOUSE.ROTATE,
            MIDDLE: MOUSE.DOLLY,
            RIGHT: MOUSE.ROTATE,
          }}
        />
      </Canvas>
    </div>
  );
}
