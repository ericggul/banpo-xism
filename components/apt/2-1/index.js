'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const GRID_ROWS = 5;
const GRID_COLS = 8;
const SPACING_X = 36;
const SPACING_Z = 28;
const GROUND_LEVEL = -2;

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
  return {
    position: [
      rotatedPosition[0] + offset.position[0],
      rotatedPosition[1] + offset.position[1],
      rotatedPosition[2] + offset.position[2],
    ],
    rotation: [
      transform.rotation?.[0] ?? 0,
      (transform.rotation?.[1] ?? 0) + angle,
      transform.rotation?.[2] ?? 0,
    ],
    scale: transform.scale ?? [1, 1, 1],
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
  const floorCount = 16;
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
  const buildingOffsets = useMemo(() => createBuildingOffsets(), []);

  const partInstances = useMemo(
    () =>
      parts.map((part) => ({
        key: part.name,
        geometry: part.geometry,
        args: part.args,
        material: part.material,
        transforms: replicateTransforms([part.transform], buildingOffsets),
      })),
    [parts, buildingOffsets],
  );

  const windowTransforms = useMemo(
    () => replicateTransforms(baseWindowTransforms, buildingOffsets),
    [baseWindowTransforms, buildingOffsets],
  );

  const railingTransforms = useMemo(
    () => replicateTransforms(baseRailingTransforms, buildingOffsets),
    [baseRailingTransforms, buildingOffsets],
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.04, 0]}>
        <planeGeometry args={[campusWidth * 0.7, SPACING_Z * 0.8]} />
        <meshStandardMaterial color="#d1d8da" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.04, 0]}>
        <planeGeometry args={[SPACING_X * 0.8, campusDepth * 0.7]} />
        <meshStandardMaterial color="#d1d8da" />
      </mesh>
      <mesh position={[0, GROUND_LEVEL + 0.15, 0]}>
        <boxGeometry args={[6, 0.4, 6]} />
        <meshStandardMaterial color="#8fa58b" />
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
    </div>
  );
}
