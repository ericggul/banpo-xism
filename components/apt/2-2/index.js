'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Leva, folder, useControls } from 'leva';
import * as THREE from 'three';

const GRID_ROWS = 10;
const GRID_COLS = 10;
const SPACING_X = 36;
const SPACING_Z = 28;
const GROUND_LEVEL = -2;
const MAX_GRID_RADIUS = Math.hypot(((GRID_COLS - 1) * SPACING_X) / 2, ((GRID_ROWS - 1) * SPACING_Z) / 2);

const lerp = (a, b, t) => a + (b - a) * t;
const lerpVec3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function applyInstancedTransforms(mesh, transforms) {
  if (!mesh) return;

  const dummy = new THREE.Object3D();
  transforms.forEach((transform, index) => {
    const [px, py, pz] = transform.position;
    const [rx, ry, rz] = transform.rotation ?? [0, 0, 0];
    const [sx, sy, sz] = transform.scale ?? [1, 1, 1];

    dummy.position.set(px, py, pz);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function rotateY([x, y, z], angle) {
  if (!angle) return [x, y, z];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - z * sin, y, x * sin + z * cos];
}

function transformWithOffset(transform, offset) {
  const angle = offset.rotation ?? 0;
  const rotatedPosition = rotateY(transform.position, angle);
  const extraRotation = offset.extraRotation ?? [0, 0, 0];
  const baseRotation = transform.rotation ?? [0, 0, 0];
  const transformScale = transform.scale ?? [1, 1, 1];
  const offsetScale = offset.scale ?? [1, 1, 1];
  return {
    position: [
      rotatedPosition[0] + offset.position[0],
      rotatedPosition[1] + offset.position[1],
      rotatedPosition[2] + offset.position[2],
    ],
    rotation: [
      baseRotation[0] + extraRotation[0],
      baseRotation[1] + angle + extraRotation[1],
      baseRotation[2] + extraRotation[2],
    ],
    scale: [
      transformScale[0] * offsetScale[0],
      transformScale[1] * offsetScale[1],
      transformScale[2] * offsetScale[2],
    ],
  };
}

function replicateTransforms(transforms, offsets) {
  const result = [];
  offsets.forEach((offset) => {
    transforms.forEach((transform) => {
      result.push(transformWithOffset(transform, offset));
    });
  });
  return result;
}

function createBlueprint() {
  const floorCount = 70;
  const floorHeight = 0.55;
  const podiumHeight = 1.6;
  const podiumTerraceHeight = 0.7;
  const groundLevel = GROUND_LEVEL;
  const towerHeight = floorCount * floorHeight + 1.1;
  const towerCenterY = groundLevel + podiumHeight + towerHeight / 2;
  const towerBaseY = groundLevel + podiumHeight;
  const roofHeight = 0.9;
  const crownHeight = 1.4;
  const skyLoungeHeight = 1.3;
  const spireHeight = 2.6;

  const rawParts = [
    {
      name: 'podium-base',
      geometry: 'box',
      args: [32, podiumHeight, 22],
      material: { color: '#d3d8e0', metalness: 0.08, roughness: 0.55 },
      transform: {
        position: [-4.5, groundLevel + podiumHeight / 2 - 0.08, 4.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-terrace',
      geometry: 'box',
      args: [24, podiumTerraceHeight, 16],
      material: { color: '#eaeef3', metalness: 0.12, roughness: 0.4 },
      transform: {
        position: [-4.5, groundLevel + podiumHeight + podiumTerraceHeight / 2, 4.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-lobby-glass',
      geometry: 'box',
      args: [20, 1.8, 12],
      material: { color: '#b7c6da', metalness: 0.65, roughness: 0.18, transparent: true, opacity: 0.82 },
      transform: {
        position: [-4.5, groundLevel + podiumHeight + 1.2, 4.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-canopy',
      geometry: 'box',
      args: [26, 0.22, 20],
      material: { color: '#f5f7fb', metalness: 0.22, roughness: 0.32 },
      transform: {
        position: [-4.5, groundLevel + podiumHeight + 2.1, 4.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-north',
      geometry: 'box',
      args: [11.6, towerHeight, 3.2],
      material: { color: '#f1f4fb', roughness: 0.32, metalness: 0.18 },
      transform: {
        position: [-7.2, towerCenterY, -0.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-north-glass',
      geometry: 'box',
      args: [7.2, towerHeight, 2.2],
      material: { color: '#c4d4e7', roughness: 0.16, metalness: 0.42 },
      transform: {
        position: [-7.2, towerCenterY, -0.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-south',
      geometry: 'box',
      args: [3.2, towerHeight * 0.98, 11.8],
      material: { color: '#f2f5fa', roughness: 0.28, metalness: 0.2 },
      transform: {
        position: [-0.2, towerCenterY - 0.1, 6.4],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-south-glass',
      geometry: 'box',
      args: [2.4, towerHeight * 0.98, 7.4],
      material: { color: '#c0d0e4', roughness: 0.15, metalness: 0.38 },
      transform: {
        position: [-0.2, towerCenterY - 0.1, 6.4],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-core-glow',
      geometry: 'box',
      args: [2.6, towerHeight + 1.2, 2.6],
      material: { color: '#a9bed8', metalness: 0.3, roughness: 0.32, emissive: '#9fb4d1', emissiveIntensity: 0.08 },
      transform: {
        position: [-3.4, towerCenterY + 0.2, 1.8],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'sky-atrium',
      geometry: 'box',
      args: [10.4, skyLoungeHeight, 7.6],
      material: { color: '#d9e1eb', roughness: 0.28, metalness: 0.22, emissive: '#dfe6f2', emissiveIntensity: 0.08 },
      transform: {
        position: [-4.2, towerBaseY + towerHeight * 0.35, 3.5],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'sky-bridge',
      geometry: 'box',
      args: [8.4, 1.6, 4.4],
      material: { color: '#cfd8e5', roughness: 0.22, metalness: 0.25 },
      transform: {
        position: [-2.2, towerBaseY + towerHeight * 0.62, 2.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'crown-plate',
      geometry: 'box',
      args: [12.8, roofHeight, 4],
      material: { color: '#f6f7fb', roughness: 0.2, metalness: 0.32 },
      transform: {
        position: [-7.2, towerBaseY + towerHeight + roofHeight / 2, -0.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'crown-plate-south',
      geometry: 'box',
      args: [3.6, roofHeight, 12.8],
      material: { color: '#f6f7fb', roughness: 0.2, metalness: 0.32 },
      transform: {
        position: [-0.2, towerBaseY + towerHeight + roofHeight / 2, 6.4],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'crown-halo',
      geometry: 'box',
      args: [9.6, crownHeight, 9.6],
      material: { color: '#e7edf6', emissive: '#9dbdff', emissiveIntensity: 0.15, roughness: 0.22, metalness: 0.45 },
      transform: {
        position: [-3.6, towerBaseY + towerHeight + roofHeight + crownHeight / 2, 3.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'crown-spire',
      geometry: 'box',
      args: [2.2, spireHeight, 2.2],
      material: { color: '#f1f6ff', emissive: '#aac6ff', emissiveIntensity: 0.25, metalness: 0.5, roughness: 0.2 },
      transform: {
        position: [-3.6, towerBaseY + towerHeight + roofHeight + crownHeight + spireHeight / 2, 3.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-plaza',
      geometry: 'plane',
      args: [24, 14],
      material: { color: '#ebeff4' },
      transform: {
        position: [-4.5, -1.4, 8.2],
        rotation: [-Math.PI / 2, 0, 0],
      },
    },
  ];

  // Compute bounds to center the blueprint.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  rawParts.forEach((part) => {
    const [px, , pz] = part.transform.position;
    const [sx, , sz] = part.geometry === 'plane' ? [part.args[0], 0, part.args[1]] : part.args;
    minX = Math.min(minX, px - sx / 2);
    maxX = Math.max(maxX, px + sx / 2);
    minZ = Math.min(minZ, pz - sz / 2);
    maxZ = Math.max(maxZ, pz + sz / 2);
  });

  const offsetX = (minX + maxX) / 2;
  const offsetZ = (minZ + maxZ) / 2;

  const parts = rawParts.map((part) => ({
    ...part,
    transform: {
      ...part.transform,
      position: [
        part.transform.position[0] - offsetX,
        part.transform.position[1],
        part.transform.position[2] - offsetZ,
      ],
    },
  }));

  const windowTransforms = [];
  const railingTransforms = [];
  const finTransforms = [];
  const lightBarTransforms = [];
  const gardenTransforms = [];

  const columnSpacing = 0.82;
  const depthSpacing = 0.82;
  const baseWindowY = groundLevel + podiumHeight + 0.45;
  const wingXCenter = -7.2;
  const wingZCenter = 6.4;
  const halfDepth = 1.6;

  const wingXColumns = 14;
  const wingXStartX = wingXCenter - ((wingXColumns - 1) * columnSpacing) / 2;

  const wingZColumns = 14;
  const wingZStartZ = wingZCenter - ((wingZColumns - 1) * depthSpacing) / 2;

  const buildFacade = ({
    columns,
    floors = floorCount,
    start,
    right,
    up,
    rotation = [0, 0, 0],
    balcony = false,
  }) => {
    for (let floor = 0; floor < floors; floor += 1) {
      for (let column = 0; column < columns; column += 1) {
        const px = start[0] + right[0] * column + up[0] * floor;
        const py = start[1] + right[1] * column + up[1] * floor;
        const pz = start[2] + right[2] * column + up[2] * floor;

        windowTransforms.push({
          position: [px - offsetX, py, pz - offsetZ],
          rotation,
        });

        if (balcony && floor % 3 === 1) {
          railingTransforms.push({
            position: [
              px - offsetX,
              py - 0.22,
              pz - offsetZ + (rotation[1] === 0 ? 0.26 : 0),
            ],
            rotation,
          });
        }
      }
    }
  };

  buildFacade({
    columns: wingXColumns,
    start: [wingXStartX, baseWindowY, halfDepth + 0.2],
    right: [columnSpacing, 0, 0],
    up: [0, floorHeight, 0],
    rotation: [0, 0, 0],
    balcony: true,
  });

  buildFacade({
    columns: wingXColumns,
    start: [wingXStartX, baseWindowY, -halfDepth - 0.2],
    right: [columnSpacing, 0, 0],
    up: [0, floorHeight, 0],
    rotation: [0, Math.PI, 0],
  });

  buildFacade({
    columns: wingZColumns,
    start: [halfDepth + 0.2, baseWindowY, wingZStartZ],
    right: [0, 0, depthSpacing],
    up: [0, floorHeight, 0],
    rotation: [0, Math.PI / 2, 0],
    balcony: true,
  });

  buildFacade({
    columns: wingZColumns,
    start: [-halfDepth - 0.2, baseWindowY, wingZStartZ],
    right: [0, 0, depthSpacing],
    up: [0, floorHeight, 0],
    rotation: [0, -Math.PI / 2, 0],
  });

  const finHeight = towerHeight * 0.92;
  const finCenterY = towerBaseY + finHeight / 2;
  const finDepthOffset = halfDepth + 0.92;

  for (let column = 0; column < wingXColumns; column += 2) {
    const px = wingXStartX + column * columnSpacing;
    finTransforms.push({
      position: [px - offsetX, finCenterY, finDepthOffset - offsetZ],
      rotation: [0, 0, 0],
      scale: [0.18, finHeight, 0.5],
    });
    finTransforms.push({
      position: [px - offsetX, finCenterY, -finDepthOffset - offsetZ],
      rotation: [0, Math.PI, 0],
      scale: [0.18, finHeight, 0.5],
    });
  }

  const shortTowerFaceOffset = 2.1;
  for (let column = 0; column < wingZColumns; column += 2) {
    const pz = wingZStartZ + column * depthSpacing;
    finTransforms.push({
      position: [shortTowerFaceOffset - offsetX, finCenterY, pz - offsetZ],
      rotation: [0, Math.PI / 2, 0],
      scale: [0.18, finHeight * 0.92, 0.5],
    });
    finTransforms.push({
      position: [-shortTowerFaceOffset - offsetX, finCenterY, pz - offsetZ],
      rotation: [0, -Math.PI / 2, 0],
      scale: [0.18, finHeight * 0.92, 0.5],
    });
  }

  const lightBarHeight = towerHeight * 1.05;
  const lightBarCenterY = towerBaseY + lightBarHeight / 2;
  const lightBarScale = [0.18, lightBarHeight, 0.18];
  const lightBarPositions = [
    [-12.4, lightBarCenterY, -1.6, 0],
    [-12.4, lightBarCenterY, 1.4, 0],
    [-1.6, lightBarCenterY, 9.2, 0],
    [1.4, lightBarCenterY, 9.2, 0],
    [-5.6, towerBaseY + towerHeight * 0.48, 3.2, Math.PI / 2],
    [-1.6, towerBaseY + towerHeight * 0.74, 3.2, Math.PI / 2],
  ];

  lightBarPositions.forEach(([px, py, pz, ry]) => {
    lightBarTransforms.push({
      position: [px - offsetX, py, pz - offsetZ],
      rotation: [0, ry, 0],
      scale: lightBarScale,
    });
  });

  const skyGardenFloors = [14, 28, 42, 58];
  skyGardenFloors.forEach((floor, index) => {
    const py = towerBaseY + floor * floorHeight;
    const width = 9 - index * 0.6;
    const depth = 6 - index * 0.45;
    const secondaryWidth = 4.8 - index * 0.35;
    const secondaryDepth = 3.6 - index * 0.28;

    gardenTransforms.push({
      position: [-4.6 - offsetX, py, 3.2 - offsetZ],
      rotation: [0, 0, 0],
      scale: [width, 0.32, depth],
    });

    gardenTransforms.push({
      position: [-0.6 - offsetX, py, 7.2 - offsetZ],
      rotation: [0, Math.PI / 2, 0],
      scale: [secondaryWidth, 0.28, secondaryDepth],
    });
  });

  const podiumGardenY = groundLevel + podiumHeight + podiumTerraceHeight + 0.18;
  const podiumPlanters = [
    [-12.4, podiumGardenY, -4.2],
    [3.8, podiumGardenY, -4],
    [-12.4, podiumGardenY, 12.6],
    [3.8, podiumGardenY, 12.8],
    [-4.2, podiumGardenY, 14.2],
    [-4.2, podiumGardenY, -7.2],
  ];

  podiumPlanters.forEach(([px, py, pz]) => {
    gardenTransforms.push({
      position: [px - offsetX, py, pz - offsetZ],
      rotation: [0, 0, 0],
      scale: [3.6, 0.36, 1.6],
    });
  });

  return {
    parts,
    windowTransforms,
    railingTransforms,
    finTransforms,
    lightBarTransforms,
    gardenTransforms,
  };
}

function createBuildingOffsets() {
  const offsets = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const jitterX = ((row % 2) - 0.5) * 4;
      const jitterZ = ((col % 2) - 0.5) * 3;
      const x = (col - (GRID_COLS - 1) / 2) * SPACING_X + jitterX;
      const z = (row - (GRID_ROWS - 1) / 2) * SPACING_Z + jitterZ;
      const rotation = (row + col) % 2 === 0 ? 0 : Math.PI / 2;
      offsets.push({ position: [x, 0, z], rotation });
    }
  }
  return offsets;
}

function createWarpedOffsets(offsets, params) {
  const {
    distortion,
    twistIntensity,
    kleinFold,
    hyperWeave,
    verticalBloom,
    scalePulse,
    waveFrequency,
    pinch,
  } = params;

  const t = Math.min(Math.max(distortion, 0), 1);

  if (t === 0) {
    return offsets.map((offset) => ({
      position: [...offset.position],
      rotation: offset.rotation ?? 0,
      extraRotation: [0, 0, 0],
      scale: [1, 1, 1],
    }));
  }

  const clampRadius = MAX_GRID_RADIUS * 1.25;

  return offsets.map((offset, index) => {
    const [x, baseY, z] = offset.position;
    const baseRotation = offset.rotation ?? 0;

    const radius = Math.hypot(x, z);
    const radius01 = MAX_GRID_RADIUS === 0 ? 0 : radius / MAX_GRID_RADIUS;
    const angle = Math.atan2(z, x);

    const row = Math.floor(index / GRID_COLS);
    const col = index % GRID_COLS;
    const gridU = GRID_COLS > 1 ? col / (GRID_COLS - 1) : 0;
    const gridV = GRID_ROWS > 1 ? row / (GRID_ROWS - 1) : 0;
    const checker = (row + col) % 2 === 0 ? 1 : -1;

    const kleinTheta = angle * (2.2 + waveFrequency * 0.35) + radius01 * Math.PI * (1.4 + waveFrequency * 0.15);
    const kleinLoop = Math.sin(kleinTheta) * kleinFold * 18;
    const kleinTwist = Math.cos(kleinTheta * 0.5) * kleinFold * 0.45;

    const pinchFactor = 1 - pinch * radius01;
    const targetRadius =
      radius * pinchFactor +
      kleinLoop +
      Math.cos(angle * (waveFrequency + 0.5) + radius01 * Math.PI * 1.2) * hyperWeave * 0.18;
    const targetRadiusClamped = Math.max(-clampRadius, Math.min(clampRadius, targetRadius));

    const twist = twistIntensity * radius01 * 1.4 + kleinTwist;
    const vortex = Math.sin(kleinTheta + checker * Math.PI * 0.25) * 0.65;
    const targetAngle = angle + twist + vortex * (1 - radius01 * 0.6);

    const hyper = Math.sin(kleinTheta * 1.12 + gridU * Math.PI * 2) * hyperWeave;
    const hyperOffsetX = Math.sin(hyper * 0.03) * hyperWeave * 0.35;
    const hyperOffsetZ = Math.cos(hyper * 0.028) * hyperWeave * 0.35;

    const targetPosition = [
      Math.cos(targetAngle) * targetRadiusClamped + hyperOffsetX,
      baseY +
        Math.sin(kleinTheta * 0.5) * verticalBloom * 0.6 +
        Math.cos(angle * (waveFrequency + 0.5) + gridV * Math.PI) * verticalBloom * 0.4 +
        hyper * 0.04,
      Math.sin(targetAngle) * targetRadiusClamped + hyperOffsetZ,
    ];

    const finalPosition = lerpVec3([x, baseY, z], targetPosition, t);

    const yawDelta = targetAngle - angle + Math.sin(kleinTheta + gridV * Math.PI * 1.5) * 0.4;
    const finalYaw = baseRotation + yawDelta * t;

    const pitch = Math.cos(kleinTheta * 0.5 + gridV * Math.PI) * verticalBloom * 0.012;
    const roll = Math.sin(kleinTheta * 0.33 + gridU * Math.PI * 2) * verticalBloom * 0.01;

    const scalePulseValue = 1 + Math.sin(kleinTheta + gridU * Math.PI) * scalePulse;
    const scaleYValue = 1 + Math.cos(kleinTheta * 0.5 - gridV * Math.PI) * scalePulse * 0.65;
    const safeScaleX = Math.max(0.2, scalePulseValue);
    const safeScaleY = Math.max(0.3, scaleYValue);

    return {
      position: finalPosition,
      rotation: finalYaw,
      extraRotation: [pitch * t, 0, roll * t],
      scale: [lerp(1, safeScaleX, t), lerp(1, safeScaleY, t), lerp(1, safeScaleX, t)],
    };
  });
}

function InstancedPart({ geometry, args, material, transforms }) {
  const meshRef = useRef(null);

  useEffect(() => {
    if (transforms.length === 0) return;
    applyInstancedTransforms(meshRef.current, transforms);
  }, [transforms]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, transforms.length]}>
      {geometry === 'box' ? <boxGeometry args={args} /> : <planeGeometry args={args} />}
      <meshStandardMaterial {...material} />
    </instancedMesh>
  );
}

function ApartmentComplex() {
  const blueprint = useMemo(() => createBlueprint(), []);
  const {
    parts,
    windowTransforms: baseWindowTransforms,
    railingTransforms: baseRailingTransforms,
    finTransforms: baseFinTransforms,
    lightBarTransforms: baseLightBarTransforms,
    gardenTransforms: baseGardenTransforms,
  } = blueprint;
  const baseOffsets = useMemo(() => createBuildingOffsets(), []);
  const {
    distortion,
    twistIntensity,
    kleinFold,
    hyperWeave,
    verticalBloom,
    scalePulse,
    waveFrequency,
    pinch,
  } = useControls(
    '클라인 왜곡',
    {
      distortion: { value: 0, min: 0, max: 1, step: 0.01 },
      morph: folder(
        {
          twistIntensity: { value: 0.9, min: 0, max: 2.4, step: 0.01 },
          kleinFold: { value: 0.75, min: 0, max: 1.8, step: 0.01 },
          hyperWeave: { value: 26, min: 0, max: 60, step: 0.5 },
          verticalBloom: { value: 12, min: 0, max: 45, step: 0.5 },
          scalePulse: { value: 0.25, min: 0, max: 0.8, step: 0.01 },
          waveFrequency: { value: 2.4, min: 0.2, max: 6, step: 0.1 },
          pinch: { value: 0.3, min: -0.6, max: 0.8, step: 0.01 },
        },
        { collapsed: true },
      ),
    },
  );

  const warpedOffsets = useMemo(
    () =>
      createWarpedOffsets(baseOffsets, {
        distortion,
        twistIntensity,
        kleinFold,
        hyperWeave,
        verticalBloom,
        scalePulse,
        waveFrequency,
        pinch,
      }),
    [baseOffsets, distortion, twistIntensity, kleinFold, hyperWeave, verticalBloom, scalePulse, waveFrequency, pinch],
  );

  const partInstances = useMemo(
    () =>
      parts.map((part) => ({
        key: part.name,
        geometry: part.geometry,
        args: part.args,
        material: part.material,
        transforms: replicateTransforms([part.transform], warpedOffsets),
      })),
    [parts, warpedOffsets],
  );

  const windowTransforms = useMemo(
    () => replicateTransforms(baseWindowTransforms, warpedOffsets),
    [baseWindowTransforms, warpedOffsets],
  );

  const railingTransforms = useMemo(
    () => replicateTransforms(baseRailingTransforms, warpedOffsets),
    [baseRailingTransforms, warpedOffsets],
  );

  const finTransforms = useMemo(
    () => replicateTransforms(baseFinTransforms, warpedOffsets),
    [baseFinTransforms, warpedOffsets],
  );

  const lightBarTransforms = useMemo(
    () => replicateTransforms(baseLightBarTransforms, warpedOffsets),
    [baseLightBarTransforms, warpedOffsets],
  );

  const gardenTransforms = useMemo(
    () => replicateTransforms(baseGardenTransforms, warpedOffsets),
    [baseGardenTransforms, warpedOffsets],
  );

  const windowsRef = useRef(null);
  const railingsRef = useRef(null);
  const finsRef = useRef(null);
  const lightBarsRef = useRef(null);
  const gardensRef = useRef(null);

  useEffect(() => {
    applyInstancedTransforms(windowsRef.current, windowTransforms);
  }, [windowTransforms]);

  useEffect(() => {
    applyInstancedTransforms(railingsRef.current, railingTransforms);
  }, [railingTransforms]);

  useEffect(() => {
    if (!finsRef.current || finTransforms.length === 0) return;
    applyInstancedTransforms(finsRef.current, finTransforms);
  }, [finTransforms]);

  useEffect(() => {
    if (!lightBarsRef.current || lightBarTransforms.length === 0) return;
    applyInstancedTransforms(lightBarsRef.current, lightBarTransforms);
  }, [lightBarTransforms]);

  useEffect(() => {
    if (!gardensRef.current || gardenTransforms.length === 0) return;
    applyInstancedTransforms(gardensRef.current, gardenTransforms);
  }, [gardenTransforms]);

  return (
    <group>
      {partInstances.map((part) => (
        <InstancedPart
          key={part.key}
          geometry={part.geometry}
          args={part.args}
          material={part.material}
          transforms={part.transforms}
        />
      ))}
      <instancedMesh ref={windowsRef} args={[null, null, windowTransforms.length]}>
        <boxGeometry args={[0.82, 0.48, 0.05]} />
        <meshStandardMaterial
          color="#9ab4d0"
          emissive="#1b2f46"
          emissiveIntensity={0.12}
          metalness={0.2}
          roughness={0.26}
        />
      </instancedMesh>
      <instancedMesh ref={railingsRef} args={[null, null, railingTransforms.length]}>
        <boxGeometry args={[0.74, 0.08, 0.32]} />
        <meshStandardMaterial color="#d5dee7" roughness={0.48} metalness={0.08} />
      </instancedMesh>
      {finTransforms.length > 0 && (
        <instancedMesh ref={finsRef} args={[null, null, finTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#eef2f9" metalness={0.4} roughness={0.25} />
        </instancedMesh>
      )}
      {lightBarTransforms.length > 0 && (
        <instancedMesh ref={lightBarsRef} args={[null, null, lightBarTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#e6ecf9"
            emissive="#89a8ff"
            emissiveIntensity={0.4}
            metalness={0.35}
            roughness={0.18}
          />
        </instancedMesh>
      )}
      {gardenTransforms.length > 0 && (
        <instancedMesh ref={gardensRef} args={[null, null, gardenTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#6f9f81" roughness={0.8} metalness={0.05} />
        </instancedMesh>
      )}
    </group>
  );
}

function Landscape() {
  const campusWidth = GRID_COLS * SPACING_X + 40;
  const campusDepth = GRID_ROWS * SPACING_Z + 40;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.05, 0]}>
        <planeGeometry args={[campusWidth, campusDepth]} />
        <meshStandardMaterial color="#f2f5f8" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.045, 0]}>
        <planeGeometry args={[campusWidth * 0.72, SPACING_Z * 0.82]} />
        <meshStandardMaterial color="#d7dde2" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.04, 0]}>
        <planeGeometry args={[SPACING_X * 0.82, campusDepth * 0.72]} />
        <meshStandardMaterial color="#d0d6db" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.035, SPACING_Z * 0.12]}>
        <planeGeometry args={[campusWidth * 0.32, SPACING_Z * 0.3]} />
        <meshStandardMaterial
          color="#cbe3f6"
          metalness={0.3}
          roughness={0.18}
          transparent
          opacity={0.86}
        />
      </mesh>
      <mesh position={[0, GROUND_LEVEL + 0.12, 0]}>
        <boxGeometry args={[10, 0.32, 10]} />
        <meshStandardMaterial color="#8fae95" roughness={0.65} metalness={0.05} />
      </mesh>
      <mesh position={[0, GROUND_LEVEL + 0.18, SPACING_Z * 0.12]}>
        <boxGeometry args={[campusWidth * 0.36, 0.18, 2.4]} />
        <meshStandardMaterial color="#f5f6f8" roughness={0.28} metalness={0.22} />
      </mesh>
    </group>
  );
}

export default function Apt21() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '640px' }}>
      <Canvas camera={{ position: [120, 60, 130], fov: 45 }}>
        <color attach="background" args={['#f5f7fa']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[120, 150, 80]} intensity={1.1} castShadow />
        <hemisphereLight intensity={0.4} groundColor="#f0f3f7" />
        <ApartmentComplex />
        <Landscape />
        <OrbitControls target={[0, 5, 0]} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
      <Leva collapsed />
    </div>
  );
}
