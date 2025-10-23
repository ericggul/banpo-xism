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
  const podiumHeight = 1.2;
  const groundLevel = GROUND_LEVEL;
  const towerHeight = floorCount * floorHeight + 1.1;
  const towerCenterY = groundLevel + podiumHeight + towerHeight / 2;
  const roofHeight = 0.6;
  const crownHeight = 1.1;

  const rawParts = [
    {
      name: 'podium',
      geometry: 'box',
      args: [18, podiumHeight, 14],
      material: { color: '#d6dbe4' },
      transform: {
        position: [-4.8, groundLevel + podiumHeight / 2, 4.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-long',
      geometry: 'box',
      args: [12, towerHeight, 3.4],
      material: { color: '#ecf0f5' },
      transform: {
        position: [-6, towerCenterY, 0],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-short',
      geometry: 'box',
      args: [3.4, towerHeight, 12],
      material: { color: '#e5e9f1' },
      transform: {
        position: [0, towerCenterY, 6],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'sky-bridge',
      geometry: 'box',
      args: [7, 2.4, 7],
      material: { color: '#ccd5e1' },
      transform: {
        position: [-2.4, 1.2, 2.4],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'core',
      geometry: 'box',
      args: [2, towerHeight + 0.8, 2],
      material: { color: '#a9bcd3', metalness: 0.2, roughness: 0.35 },
      transform: {
        position: [-1.2, towerCenterY, 1.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'roof-long',
      geometry: 'box',
      args: [12.2, roofHeight, 3.6],
      material: { color: '#f6f7f9' },
      transform: {
        position: [-6, towerCenterY + towerHeight / 2 + roofHeight / 2, 0],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'roof-short',
      geometry: 'box',
      args: [3.6, roofHeight, 12.2],
      material: { color: '#f6f7f9' },
      transform: {
        position: [0, towerCenterY + towerHeight / 2 + roofHeight / 2, 6],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'crown',
      geometry: 'box',
      args: [8.5, crownHeight, 8.5],
      material: { color: '#e3e7ee', emissive: '#bcc7d6', emissiveIntensity: 0.03 },
      transform: {
        position: [-3, towerCenterY + towerHeight / 2 + roofHeight + crownHeight / 2, 3],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-plaza',
      geometry: 'plane',
      args: [10, 6],
      material: { color: '#e8ecef' },
      transform: {
        position: [-4.8, -1.4, 8],
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

  const columnSpacing = 0.9;
  const depthSpacing = 0.9;
  const baseWindowY = groundLevel + podiumHeight + 0.35;
  const wingXCenter = -6;
  const wingZCenter = 6;
  const halfDepth = 1.7;

  const wingXColumns = 12;
  const wingXStartX = wingXCenter - ((wingXColumns - 1) * columnSpacing) / 2;

  const wingZColumns = 12;
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

        if (balcony && floor % 2 === 1) {
          railingTransforms.push({
            position: [
              px - offsetX,
              py - 0.18,
              pz - offsetZ + (rotation[1] === 0 ? 0.28 : 0),
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

  return {
    parts,
    windowTransforms,
    railingTransforms,
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
  const { parts, windowTransforms: baseWindowTransforms, railingTransforms: baseRailingTransforms } = blueprint;
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

  const windowsRef = useRef(null);
  const railingsRef = useRef(null);

  useEffect(() => {
    applyInstancedTransforms(windowsRef.current, windowTransforms);
  }, [windowTransforms]);

  useEffect(() => {
    applyInstancedTransforms(railingsRef.current, railingTransforms);
  }, [railingTransforms]);

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
        <boxGeometry args={[0.7, 0.42, 0.08]} />
        <meshStandardMaterial
          color="#7f8ea7"
          emissive="#1f2a3b"
          emissiveIntensity={0.07}
          metalness={0.1}
          roughness={0.35}
        />
      </instancedMesh>
      <instancedMesh ref={railingsRef} args={[null, null, railingTransforms.length]}>
        <boxGeometry args={[0.74, 0.08, 0.32]} />
        <meshStandardMaterial color="#c9d4de" roughness={0.6} metalness={0.05} />
      </instancedMesh>
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
        <meshStandardMaterial color="#eef2f5" />
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
