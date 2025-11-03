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
  const floorCount = 52;
  const floorHeight = 0.62;
  const podiumHeight = 1.05;
  const podiumRoofThickness = 0.35;
  const groundLevel = GROUND_LEVEL;
  const towerHeight = floorCount * floorHeight + 1;
  const towerBaseY = groundLevel + podiumHeight;
  const crownHeight = 0.7;

  const eastCenterX = -7.8;
  const eastCenterZ = 0.4;
  const westCenterX = -0.4;
  const westCenterZ = 6.2;

  const eastTowerWidth = 9.6;
  const eastTowerDepth = 3.2;
  const westTowerWidth = 3.2;
  const westTowerDepth = 10.2;

  const rawParts = [
    {
      name: 'podium-plinth',
      geometry: 'box',
      args: [28, podiumHeight, 18],
      material: { color: '#f1eee9', roughness: 0.38, metalness: 0.08 },
      transform: {
        position: [-2.6, groundLevel + podiumHeight / 2 - 0.05, 4.8],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-roof-slab',
      geometry: 'box',
      args: [22, podiumRoofThickness, 12],
      material: { color: '#f7f5f1', roughness: 0.24, metalness: 0.05 },
      transform: {
        position: [-2.6, groundLevel + podiumHeight + podiumRoofThickness / 2, 4.8],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-lobby',
      geometry: 'box',
      args: [18, 1.6, 8],
      material: { color: '#a6b4c1', metalness: 0.36, roughness: 0.25, transparent: true, opacity: 0.85 },
      transform: {
        position: [-2.6, groundLevel + podiumHeight + 0.8, 4.8],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-canopy',
      geometry: 'box',
      args: [20, 0.14, 10],
      material: { color: '#fcfbf8', roughness: 0.22, metalness: 0.08 },
      transform: {
        position: [-2.6, groundLevel + podiumHeight + 1.92, 4.8],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-courtyard',
      geometry: 'plane',
      args: [20, 10],
      material: { color: '#f5f3ef' },
      transform: {
        position: [-2.6, groundLevel - 1.2, -0.8],
        rotation: [-Math.PI / 2, 0, 0],
      },
    },
    {
      name: 'podium-water',
      geometry: 'plane',
      args: [14, 6],
      material: { color: '#d7e2ec', metalness: 0.2, roughness: 0.14 },
      transform: {
        position: [-2.6, groundLevel - 1.18, -0.8],
        rotation: [-Math.PI / 2, 0, 0],
      },
    },
    {
      name: 'tower-east-core',
      geometry: 'box',
      args: [eastTowerWidth, towerHeight, eastTowerDepth],
      material: { color: '#f9f7f3', roughness: 0.22, metalness: 0.14 },
      transform: {
        position: [eastCenterX, towerBaseY + towerHeight / 2, eastCenterZ],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-east-glass',
      geometry: 'box',
      args: [eastTowerWidth * 0.86, towerHeight * 0.98, eastTowerDepth * 0.9],
      material: { color: '#a5b9c9', metalness: 0.32, roughness: 0.18 },
      transform: {
        position: [eastCenterX + 0.08, towerBaseY + towerHeight / 2, eastCenterZ + 0.18],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-east-crown',
      geometry: 'box',
      args: [eastTowerWidth * 0.9, crownHeight, eastTowerDepth * 0.94],
      material: { color: '#ebe7df', roughness: 0.24, metalness: 0.16 },
      transform: {
        position: [eastCenterX + 0.08, towerBaseY + towerHeight + crownHeight / 2, eastCenterZ + 0.18],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-west-core',
      geometry: 'box',
      args: [westTowerWidth, towerHeight * 0.98, westTowerDepth],
      material: { color: '#f8f6f2', roughness: 0.22, metalness: 0.14 },
      transform: {
        position: [westCenterX, towerBaseY + towerHeight * 0.49, westCenterZ],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-west-glass',
      geometry: 'box',
      args: [westTowerWidth * 0.86, towerHeight * 0.94, westTowerDepth * 0.92],
      material: { color: '#a8bbc8', metalness: 0.3, roughness: 0.2 },
      transform: {
        position: [westCenterX + 0.06, towerBaseY + towerHeight * 0.49, westCenterZ - 0.12],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-west-crown',
      geometry: 'box',
      args: [westTowerWidth * 0.9, crownHeight, westTowerDepth * 0.96],
      material: { color: '#ece7de', roughness: 0.24, metalness: 0.16 },
      transform: {
        position: [westCenterX + 0.06, towerBaseY + towerHeight * 0.98 + crownHeight / 2, westCenterZ - 0.12],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'sky-bridge',
      geometry: 'box',
      args: [7.2, 0.6, 5.4],
      material: { color: '#f3f0ea', roughness: 0.26, metalness: 0.14 },
      transform: {
        position: [-4.6, towerBaseY + towerHeight * 0.56, 3.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'sky-bridge-glass',
      geometry: 'box',
      args: [6.6, 0.46, 5],
      material: { color: '#b3c4d1', metalness: 0.32, roughness: 0.2 },
      transform: {
        position: [-4.6, towerBaseY + towerHeight * 0.56 + 0.16, 3.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-plaza',
      geometry: 'plane',
      args: [22, 14],
      material: { color: '#f6f4ef' },
      transform: {
        position: [-2.6, -1.4, 8.2],
        rotation: [-Math.PI / 2, 0, 0],
      },
    },
  ];

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
  const gardenTransforms = [];

  const columnSpacing = 0.78;
  const depthSpacing = 0.8;
  const baseWindowY = towerBaseY + 0.32;

  const buildFacade = ({
    columns,
    floors = floorCount,
    start,
    right,
    up,
    rotation = [0, 0, 0],
    balcony = false,
    balconyEvery = 0,
    balconyOffset = 1,
    balconyDepth = 0.22,
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

        if (balcony && balconyEvery > 0 && floor % balconyEvery === balconyOffset) {
          railingTransforms.push({
            position: [
              px - offsetX,
              py - 0.2,
              pz - offsetZ + (rotation[1] === 0 ? balconyDepth : 0),
            ],
            rotation,
          });
        }
      }
    }
  };

  const eastColumns = 14;
  const eastHalfDepth = eastTowerDepth / 2;
  const eastStartX = eastCenterX - ((eastColumns - 1) * columnSpacing) / 2;

  buildFacade({
    columns: eastColumns,
    start: [eastStartX, baseWindowY, eastCenterZ + eastHalfDepth - 0.05],
    right: [columnSpacing, 0, 0],
    up: [0, floorHeight, 0],
    rotation: [0, 0, 0],
    balcony: true,
    balconyEvery: 6,
    balconyOffset: 2,
    balconyDepth: 0.22,
  });

  buildFacade({
    columns: eastColumns,
    start: [eastStartX, baseWindowY, eastCenterZ - eastHalfDepth + 0.05],
    right: [columnSpacing, 0, 0],
    up: [0, floorHeight, 0],
    rotation: [0, Math.PI, 0],
    balconyEvery: 0,
  });

  const westColumns = 12;
  const westHalfWidth = westTowerWidth / 2;
  const westHalfDepth = westTowerDepth / 2;
  const westStartX = westCenterX - ((westColumns - 1) * columnSpacing) / 2;

  buildFacade({
    columns: westColumns,
    start: [westStartX, baseWindowY, westCenterZ + westHalfDepth - 0.05],
    right: [columnSpacing, 0, 0],
    up: [0, floorHeight, 0],
    rotation: [0, 0, 0],
    balcony: true,
    balconyEvery: 5,
    balconyOffset: 1,
    balconyDepth: 0.2,
  });

  buildFacade({
    columns: westColumns,
    start: [westStartX, baseWindowY, westCenterZ - westHalfDepth + 0.05],
    right: [columnSpacing, 0, 0],
    up: [0, floorHeight, 0],
    rotation: [0, Math.PI, 0],
    balconyEvery: 0,
  });

  const finHeight = towerHeight * 0.92;
  const finCenterY = towerBaseY + finHeight / 2;
  const finScale = [0.1, finHeight, 0.36];

  for (let column = 1; column < eastColumns - 1; column += 3) {
    const px = eastStartX + column * columnSpacing;
    finTransforms.push({
      position: [px - offsetX, finCenterY, eastCenterZ + eastHalfDepth - 0.02 - offsetZ],
      rotation: [0, 0, 0],
      scale: finScale,
    });
    finTransforms.push({
      position: [px - offsetX, finCenterY, eastCenterZ - eastHalfDepth + 0.02 - offsetZ],
      rotation: [0, Math.PI, 0],
      scale: finScale,
    });
  }

  for (let column = 1; column < westColumns - 1; column += 3) {
    const px = westStartX + column * columnSpacing;
    finTransforms.push({
      position: [px - offsetX, finCenterY, westCenterZ + westHalfDepth - 0.02 - offsetZ],
      rotation: [0, 0, 0],
      scale: finScale,
    });
    finTransforms.push({
      position: [px - offsetX, finCenterY, westCenterZ - westHalfDepth + 0.02 - offsetZ],
      rotation: [0, Math.PI, 0],
      scale: finScale,
    });
  }

  const gardenLevels = [12, 28, 44];
  gardenLevels.forEach((level, index) => {
    const py = towerBaseY + level * floorHeight;
    const width = 4.4 - index * 0.3;
    const depth = 2.2 - index * 0.2;

    gardenTransforms.push({
      position: [eastCenterX + 0.1 - offsetX, py, eastCenterZ + eastHalfDepth + 0.18 - offsetZ],
      rotation: [0, 0, 0],
      scale: [width, 0.22, depth],
    });

    gardenTransforms.push({
      position: [westCenterX + 0.12 - offsetX, py, westCenterZ - westHalfDepth - 0.5 - offsetZ],
      rotation: [0, 0, 0],
      scale: [3 - index * 0.2, 0.2, 3.6 - index * 0.28],
    });
  });

  const podiumPlanters = [
    [-10.6, groundLevel + podiumHeight + 0.18, 10.4, 5.6, 0.24, 2],
    [4.4, groundLevel + podiumHeight + 0.18, 10.8, 6.2, 0.22, 1.6],
    [-2.6, groundLevel + podiumHeight + 0.18, -2.2, 9.2, 0.2, 3],
  ];

  podiumPlanters.forEach(([px, py, pz, sx, sy, sz]) => {
    gardenTransforms.push({
      position: [px - offsetX, py, pz - offsetZ],
      rotation: [0, 0, 0],
      scale: [sx, sy, sz],
    });
  });

  return {
    parts,
    windowTransforms,
    railingTransforms,
    finTransforms,
    gardenTransforms,
  };
}

function createBuildingOffsets() {
  const offsets = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const jitterX = ((row % 2) - 0.5) * 2.8;
      const jitterZ = ((col % 2) - 0.5) * 2.2;
      const x = (col - (GRID_COLS - 1) / 2) * SPACING_X + jitterX;
      const z = (row - (GRID_ROWS - 1) / 2) * SPACING_Z + jitterZ;
      const rotation = 0;
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

  const clampRadius = MAX_GRID_RADIUS * 1.1;

  return offsets.map((offset) => {
    const [x, baseY, z] = offset.position;

    const radius = Math.hypot(x, z);
    const radius01 = MAX_GRID_RADIUS === 0 ? 0 : radius / MAX_GRID_RADIUS;
    const angle = Math.atan2(z, x);

    const kleinTheta = angle * (1.8 + waveFrequency * 0.18) + radius01 * Math.PI * (1.1 + waveFrequency * 0.1);
    const loop = Math.sin(kleinTheta) * kleinFold * 9;
    const pinchRadius = radius * (1 - pinch * radius01 * 0.8);
    const targetRadius = pinchRadius + loop + Math.cos(angle * (waveFrequency + 0.4)) * hyperWeave * 0.08;
    const clamped = Math.max(-clampRadius, Math.min(clampRadius, targetRadius));

    const twist = twistIntensity * radius01 * 0.7;
    const targetAngle = angle + twist;

    const targetPosition = [
      Math.cos(targetAngle) * clamped,
      baseY + Math.sin(kleinTheta * 0.4) * verticalBloom * 0.24,
      Math.sin(targetAngle) * clamped,
    ];

    const finalPosition = lerpVec3([x, baseY, z], targetPosition, t);
    const finalYaw = twist * t;
    const pitch = Math.cos(kleinTheta * 0.32) * verticalBloom * 0.006 * t;
    const roll = Math.sin(kleinTheta * 0.28) * verticalBloom * 0.006 * t;
    const scaleMod = 1 + Math.sin(kleinTheta) * scalePulse * 0.4;

    return {
      position: finalPosition,
      rotation: finalYaw,
      extraRotation: [pitch, 0, roll],
      scale: [lerp(1, Math.max(0.6, scaleMod), t), lerp(1, Math.max(0.7, scaleMod), t), lerp(1, Math.max(0.6, scaleMod), t)],
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
    '미니멀 왜곡',
    {
      distortion: { value: 0, min: 0, max: 1, step: 0.01 },
      morph: folder(
        {
          twistIntensity: { value: 0.35, min: 0, max: 1.4, step: 0.01 },
          kleinFold: { value: 0.28, min: 0, max: 0.8, step: 0.01 },
          hyperWeave: { value: 9, min: 0, max: 24, step: 0.5 },
          verticalBloom: { value: 5, min: 0, max: 20, step: 0.5 },
          scalePulse: { value: 0.12, min: 0, max: 0.4, step: 0.01 },
          waveFrequency: { value: 1.6, min: 0.2, max: 4, step: 0.1 },
          pinch: { value: 0.08, min: -0.3, max: 0.3, step: 0.01 },
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

  const gardenTransforms = useMemo(
    () => replicateTransforms(baseGardenTransforms, warpedOffsets),
    [baseGardenTransforms, warpedOffsets],
  );

  const windowsRef = useRef(null);
  const railingsRef = useRef(null);
  const finsRef = useRef(null);
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
        <boxGeometry args={[0.68, 0.44, 0.05]} />
        <meshStandardMaterial
          color="#95aabd"
          emissive="#1d2732"
          emissiveIntensity={0.06}
          metalness={0.24}
          roughness={0.22}
        />
      </instancedMesh>
      <instancedMesh ref={railingsRef} args={[null, null, railingTransforms.length]}>
        <boxGeometry args={[0.7, 0.08, 0.28]} />
        <meshStandardMaterial color="#e5dacc" roughness={0.34} metalness={0.1} />
      </instancedMesh>
      {finTransforms.length > 0 && (
        <instancedMesh ref={finsRef} args={[null, null, finTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#f4f1eb" metalness={0.26} roughness={0.22} />
        </instancedMesh>
      )}
      {gardenTransforms.length > 0 && (
        <instancedMesh ref={gardensRef} args={[null, null, gardenTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#7b9d87" roughness={0.68} metalness={0.08} />
        </instancedMesh>
      )}
    </group>
  );
}

function Landscape() {
  const campusWidth = GRID_COLS * SPACING_X + 38;
  const campusDepth = GRID_ROWS * SPACING_Z + 38;
  const waterWidth = campusWidth * 0.24;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.05, 0]}>
        <planeGeometry args={[campusWidth, campusDepth]} />
        <meshStandardMaterial color="#f8f6f2" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.045, 0]}>
        <planeGeometry args={[campusWidth * 0.72, campusDepth * 0.7]} />
        <meshStandardMaterial color="#e7e2d9" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.042, SPACING_Z * 0.14]}>
        <planeGeometry args={[campusWidth * 0.32, campusDepth * 0.26]} />
        <meshStandardMaterial color="#d9d2c7" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-SPACING_X * 0.2, GROUND_LEVEL - 0.04, -SPACING_Z * 0.2]}>
        <planeGeometry args={[waterWidth, campusDepth * 0.2]} />
        <meshStandardMaterial color="#d4e2ee" metalness={0.2} roughness={0.16} />
      </mesh>
      <mesh position={[0, GROUND_LEVEL + 0.12, 0]}>
        <boxGeometry args={[9.6, 0.26, 9.6]} />
        <meshStandardMaterial color="#9eb29b" roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[SPACING_X * 0.16, GROUND_LEVEL + 0.14, SPACING_Z * 0.16]}>
        <boxGeometry args={[campusWidth * 0.28, 0.2, 2]} />
        <meshStandardMaterial color="#f1ebe2" roughness={0.32} metalness={0.12} />
      </mesh>
    </group>
  );
}

export default function Apt23SeoulMinimal() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '640px' }}>
      <Canvas camera={{ position: [110, 52, 122], fov: 45 }}>
        <color attach="background" args={['#faf7f2']} />
        <ambientLight intensity={0.54} />
        <directionalLight position={[118, 146, 84]} intensity={0.98} castShadow />
        <hemisphereLight intensity={0.42} groundColor="#f2ede5" />
        <ApartmentComplex />
        <Landscape />
        <OrbitControls target={[0, 5.6, 2.8]} maxPolarAngle={Math.PI / 2.18} />
      </Canvas>
      <Leva collapsed />
    </div>
  );
}
