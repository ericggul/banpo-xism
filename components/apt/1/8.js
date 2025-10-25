'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const GROUND_LEVEL = -2.2;

function useInstancedLayout(ref, transforms) {
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || transforms.length === 0) return;

    const dummy = new THREE.Object3D();
    transforms.forEach((transform, index) => {
      const { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = transform;
      dummy.position.set(position[0], position[1], position[2]);
      dummy.rotation.set(rotation[0], rotation[1], rotation[2]);
      dummy.scale.set(scale[0], scale[1], scale[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [transforms]);
}

function LinearSlabAtrium() {
  const palette = {
    ground: '#ececeb',
    base: '#d9dbd7',
    unit: '#d5d7d3',
    balcony: '#c0c4c1',
    frame: '#b1b6b2',
    belt: '#a4adb4',
    corridor: '#909aa5',
    pilotis: '#c6c9c6',
    crown: '#cfd2d0',
  };

  const floors = 18;
  const unitsPerRow = 12;
  const moduleWidth = 2.9;
  const moduleHeight = 0.94;
  const moduleDepth = 1.28;
  const backOffset = 0.12;
  const spacingX = moduleWidth + 0.2;
  const spacingY = moduleHeight + 0.18;

  const towerWidth = (unitsPerRow - 1) * spacingX + moduleWidth;
  const towerHeight = floors * spacingY + moduleHeight;
  const towerDepth = moduleDepth * 2 + backOffset * 2;
  const baseHeight = 1.2;
  const towerBaseY = GROUND_LEVEL + baseHeight;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const frontZ = towerDepth / 2 - moduleDepth / 2;
  const backZ = -frontZ;
  const corridorZ = 0;
  const corridorThickness = moduleDepth * 0.4;

  const unitRef = useRef();
  const balconyRef = useRef();
  const frameRef = useRef();
  const beltRef = useRef();
  const corridorRef = useRef();
  const pilotisRef = useRef();

  const corridorColumns = useMemo(() => new Set([unitsPerRow / 2 - 1, unitsPerRow / 2]), [unitsPerRow]);
  const beltFloors = useMemo(() => new Set([0, 5, 10, 15]), []);

  const unitTransforms = useMemo(() => {
    const transforms = [];
    for (let floor = 0; floor < floors; floor += 1) {
      const y = towerBaseY + floor * spacingY + moduleHeight / 2;
      for (let column = 0; column < unitsPerRow; column += 1) {
        const x = -towerWidth / 2 + column * spacingX;
        const skipForAtrium = corridorColumns.has(column);
        if (skipForAtrium) continue;
        transforms.push({ position: [x, y, frontZ] });
        transforms.push({ position: [x, y, backZ] });
      }
    }
    return transforms;
  }, [corridorColumns, floors, frontZ, backZ, moduleHeight, spacingX, spacingY, towerBaseY, towerWidth, unitsPerRow]);

  const balconyTransforms = useMemo(() => {
    const transforms = [];
    const balconyDepth = moduleDepth * 0.18;
    const balconyThickness = 0.12;
    for (let floor = 1; floor < floors; floor += 1) {
      if (beltFloors.has(floor)) continue;
      const y = towerBaseY + floor * spacingY + moduleHeight * 0.68;
      transforms.push({
        position: [0, y, frontZ + moduleDepth / 2 + balconyDepth / 2],
        scale: [towerWidth * 0.96, balconyThickness, balconyDepth],
      });
    }
    return transforms;
  }, [beltFloors, floors, frontZ, moduleDepth, moduleHeight, spacingY, towerBaseY, towerWidth]);

  const frameTransforms = useMemo(() => {
    const transforms = [];
    const frameThickness = moduleWidth * 0.22;
    const frameDepth = moduleDepth * 0.28;
    for (let column = 0; column < unitsPerRow; column += 1) {
      const x = -towerWidth / 2 + column * spacingX;
      transforms.push({ position: [x, towerCenterY, frontZ + moduleDepth / 2 + frameDepth / 2], scale: [frameThickness, towerHeight, frameDepth] });
      transforms.push({ position: [x, towerCenterY, backZ - moduleDepth / 2 - frameDepth / 2], scale: [frameThickness, towerHeight, frameDepth] });
    }
    return transforms;
  }, [moduleWidth, moduleDepth, spacingX, towerCenterY, towerHeight, towerWidth, unitsPerRow, frontZ, backZ]);

  const beltTransforms = useMemo(() => {
    const transforms = [];
    const beltHeight = 0.14;
    for (let floor = 0; floor <= floors; floor += 1) {
      if (!beltFloors.has(floor) && floor !== floors) continue;
      const y = towerBaseY + floor * spacingY - moduleHeight * 0.1;
      transforms.push({ position: [0, y, frontZ], scale: [towerWidth * 1.02, beltHeight, moduleDepth * 1.02] });
      transforms.push({ position: [0, y, backZ], scale: [towerWidth * 1.02, beltHeight, moduleDepth * 1.02] });
    }
    return transforms;
  }, [beltFloors, floors, frontZ, backZ, moduleDepth, moduleHeight, spacingY, towerBaseY, towerWidth]);

  const corridorTransforms = useMemo(() => {
    const transforms = [];
    const corridorHeight = moduleHeight * 0.72;
    for (let floor = 0; floor < floors; floor += 1) {
      const y = towerBaseY + floor * spacingY + corridorHeight / 2 - moduleHeight * 0.05;
      transforms.push({
        position: [0, y, corridorZ],
        scale: [towerWidth * 0.58, corridorHeight, corridorThickness],
      });
    }
    return transforms;
  }, [floors, corridorThickness, moduleHeight, spacingY, towerBaseY, towerWidth]);

  const pilotisTransforms = useMemo(() => {
    const transforms = [];
    const pilotisHeight = baseHeight * 0.82;
    const y = GROUND_LEVEL + pilotisHeight / 2 - 0.06;
    for (let column = 1; column < unitsPerRow; column += 2) {
      const x = -towerWidth / 2 + column * spacingX;
      transforms.push({ position: [x, y, corridorZ], scale: [moduleWidth * 0.24, pilotisHeight, moduleDepth * 0.56] });
    }
    return transforms;
  }, [baseHeight, corridorZ, moduleDepth, moduleWidth, spacingX, towerWidth, unitsPerRow]);

  useInstancedLayout(unitRef, unitTransforms);
  useInstancedLayout(balconyRef, balconyTransforms);
  useInstancedLayout(frameRef, frameTransforms);
  useInstancedLayout(beltRef, beltTransforms);
  useInstancedLayout(corridorRef, corridorTransforms);
  useInstancedLayout(pilotisRef, pilotisTransforms);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.01, 0]} receiveShadow>
        <planeGeometry args={[110, 110]} />
        <meshStandardMaterial color={palette.ground} />
      </mesh>

      <mesh position={[0, GROUND_LEVEL + baseHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[towerWidth * 1.12, baseHeight, towerDepth * 1.08]} />
        <meshStandardMaterial color={palette.base} roughness={0.88} />
      </mesh>

      <mesh position={[0, towerBaseY + towerHeight + 0.35, corridorZ]} castShadow>
        <boxGeometry args={[towerWidth * 0.86, 0.28, corridorThickness * 1.32]} />
        <meshStandardMaterial color={palette.crown} roughness={0.64} />
      </mesh>

      {pilotisTransforms.length > 0 && (
        <instancedMesh ref={pilotisRef} args={[null, null, pilotisTransforms.length]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.pilotis} roughness={0.78} />
        </instancedMesh>
      )}

      {frameTransforms.length > 0 && (
        <instancedMesh ref={frameRef} args={[null, null, frameTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.frame} roughness={0.7} />
        </instancedMesh>
      )}

      {beltTransforms.length > 0 && (
        <instancedMesh ref={beltRef} args={[null, null, beltTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.belt} roughness={0.55} />
        </instancedMesh>
      )}

      {corridorTransforms.length > 0 && (
        <instancedMesh ref={corridorRef} args={[null, null, corridorTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.corridor} roughness={0.46} metalness={0.08} />
        </instancedMesh>
      )}

      {balconyTransforms.length > 0 && (
        <instancedMesh ref={balconyRef} args={[null, null, balconyTransforms.length]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.balcony} roughness={0.82} />
        </instancedMesh>
      )}

      {unitTransforms.length > 0 && (
        <instancedMesh ref={unitRef} args={[null, null, unitTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[moduleWidth, moduleHeight, moduleDepth]} />
          <meshStandardMaterial color={palette.unit} roughness={0.84} metalness={0.04} />
        </instancedMesh>
      )}
    </group>
  );
}

export default function Apt19() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '480px' }}>
      <Canvas shadows camera={{ position: [26, 18, 30], fov: 45 }}>
        <color attach="background" args={['#f2f3f5']} />
        <fog attach="fog" args={['#eef1f3', 55, 120]} />

        <hemisphereLight intensity={0.5} color="#fefdf8" groundColor="#d7d7d3" />
        <directionalLight
          position={[30, 32, 24]}
          intensity={1.22}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-48}
          shadow-camera-right={48}
          shadow-camera-top={32}
          shadow-camera-bottom={-48}
        />
        <ambientLight intensity={0.22} />

        <LinearSlabAtrium />

        <OrbitControls target={[0, 8, 0]} maxPolarAngle={Math.PI / 2.12} minDistance={12} maxDistance={70} enableDamping />
      </Canvas>
    </div>
  );
}

