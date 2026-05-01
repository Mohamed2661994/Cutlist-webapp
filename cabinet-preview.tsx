import { useEffect, useRef, useState } from "react";

import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import {
  MOUSE,
  Plane,
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
  const cameraPosition = isCornerLBase ? [0, 2.1, 3.45] : [2.9, 2.2, 3.2];
  const previewRotationY = isCornerLBase
    ? input.cornerHand === "left"
      ? 0.22
      : -0.22
    : -0.45;
  const previewOffsetX = 0;
  const previewOffsetZ = isCornerLBase ? 0.06 : 0;
  const previewScale = isCornerLBase ? 1.24 : 1;

  return (
    <div className="h-72 w-full overflow-hidden rounded-[1.25rem] border border-stone-200 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(233,225,212,0.92)_55%,_rgba(216,202,180,0.86)_100%)]">
      <Canvas
        camera={{
          position: cameraPosition as [number, number, number],
          fov: isCornerLBase ? 32 : 35,
        }}
        shadows="basic"
        dpr={[1, 1.5]}
      >
        <color attach="background" args={["#f4ede4"]} />
        <fog attach="fog" args={["#f4ede4", 4.5, 8]} />
        <ambientLight intensity={1.15} />
        <hemisphereLight
          intensity={0.55}
          groundColor="#cabca8"
          color="#fff8ee"
        />
        <directionalLight
          castShadow
          intensity={1.5}
          position={[4, 6, 5]}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <spotLight
          intensity={0.8}
          position={[-4, 5, 4]}
          angle={0.35}
          penumbra={0.8}
        />
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
          enablePan={false}
          minDistance={isCornerLBase ? 2.8 : 2.2}
          maxDistance={isCornerLBase ? 7 : 6}
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
}: ProjectPreviewProps) {
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

  const sceneWidth = Math.max(
    8,
    units.reduce(
      (max, unit) =>
        Math.max(max, Math.abs(unit.position[0]) * 2 + getPlanWidth(unit)),
      0,
    ) + 2,
  );
  const sceneDepth = Math.max(
    6,
    units.reduce(
      (max, unit) =>
        Math.max(max, Math.abs(unit.position[2]) * 2 + getPlanDepth(unit)),
      0,
    ) + 2,
  );
  const sceneHeight = Math.max(
    4,
    units.reduce(
      (max, unit) =>
        Math.max(max, unit.position[1] + unit.input.height / 100 + 0.8),
      0,
    ),
  );
  const dragLimitX = (sceneWidth / 2) * 100 + 120;
  const dragLimitZ = (sceneDepth / 2) * 100 + 120;

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
        (scenePoint.x - dragState.pointerOffsetX) * 100,
        -dragLimitX,
        dragLimitX,
      );
      const nextZ = clamp(
        (scenePoint.z - dragState.pointerOffsetZ) * 100,
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
  }, [dragLimitX, dragLimitZ, draggingUnitId, onUnitPositionChange]);

  function startDraggingUnit(
    unit: ProjectPreviewProps["units"][number],
    clientX: number,
    clientY: number,
  ) {
    const worldY = unit.position[1] - 0.55;
    const scenePoint = getScenePointFromClient(clientX, clientY, worldY);

    if (!scenePoint) {
      return;
    }

    dragStateRef.current = {
      unitId: unit.id,
      pointerOffsetX: scenePoint.x - unit.position[0],
      pointerOffsetZ: scenePoint.z - unit.position[2],
      worldY,
    };
    setDraggingUnitId(unit.id);

    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }
  }

  return (
    <div
      className={cn(
        "h-[26rem] w-full overflow-hidden rounded-[1.5rem] border border-stone-200 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(233,225,212,0.92)_58%,_rgba(216,202,180,0.9)_100%)]",
        draggingUnitId ? "cursor-grabbing" : "cursor-grab",
      )}
      onContextMenu={(event) => event.preventDefault()}
    >
      <Canvas
        camera={{ position: [0, 3, 7.2], fov: 34 }}
        shadows="basic"
        dpr={[1, 1.5]}
        onCreated={({ camera, gl }) => {
          cameraRef.current = camera;
          canvasElementRef.current = gl.domElement;
        }}
      >
        <color attach="background" args={["#f4ede4"]} />
        <fog attach="fog" args={["#f4ede4", 5.5, 11]} />
        <ambientLight intensity={1.1} />
        <hemisphereLight
          intensity={0.55}
          groundColor="#cabca8"
          color="#fff8ee"
        />
        <directionalLight
          castShadow
          intensity={1.45}
          position={[5, 7, 6]}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <spotLight
          intensity={0.75}
          position={[-4, 5, 5]}
          angle={0.35}
          penumbra={0.8}
        />

        <group ref={sceneRef} position={[0, -0.55, 0]} rotation={[0, -0.35, 0]}>
          <mesh
            position={[0, sceneHeight / 2 - 0.2, -sceneDepth / 2 + 0.02]}
            receiveShadow
          >
            <planeGeometry args={[sceneWidth, sceneHeight]} />
            <meshStandardMaterial
              color="#ece3d4"
              roughness={0.95}
              metalness={0.02}
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
                  startDraggingUnit(unit, event.clientX, event.clientY);
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
                      "select-none rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition",
                      unit.active
                        ? "border-amber-300 bg-amber-50 text-amber-950 shadow-[0_0_0_4px_rgba(245,158,11,0.18)]"
                        : "border-stone-200 bg-white/92 text-stone-800",
                    )}
                    onPointerDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }

                      event.stopPropagation();
                      onSelectUnit?.(unit.id);
                      startDraggingUnit(unit, event.clientX, event.clientY);
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
            position={[0, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[sceneWidth, sceneDepth]} />
            <shadowMaterial opacity={0.16} />
          </mesh>
        </group>

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minDistance={3.5}
          maxDistance={11}
          maxPolarAngle={Math.PI / 2.05}
          mouseButtons={{
            LEFT: MOUSE.PAN,
            MIDDLE: MOUSE.DOLLY,
            RIGHT: MOUSE.ROTATE,
          }}
        />
      </Canvas>
    </div>
  );
}
