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

function GalleryRibbonSlab() {
  const palette = {
    unit: '#d9dbd7',
    slab: '#c9ccc8',
    fin: '#b9bcb8',
    rail: '#a6adb5',
    core: '#cfd2d0',
    ground: '#ececeb',
  };

  const floors = 18;
  const unitsPerRow = 12;
  const moduleWidth = 2.8;
  const moduleHeight = 0.96;
  const moduleDepth = 1.24;
  const spacingX = moduleWidth + 0.18;
  const spacingY = moduleHeight + 0.16;

  const corridorEvery = 2; // every second floor becomes a gallery corridor side

  const towerWidth = (unitsPerRow - 1) * spacingX + moduleWidth;
  const towerHeight = floors * spacingY + moduleHeight;
  const towerDepth = moduleDepth * 2.2;
  const towerBaseY = GROUND_LEVEL;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const unitRef = useRef();
  const slabRef = useRef();
  const finRef = useRef();
  const railRef = useRef();
  const coreRef = useRef();
  const pilotisRef = useRef();

  const unitTransforms = useMemo(() => {
    const transforms = [];
    const frontZ = towerDepth / 2 - moduleDepth / 2;
    const backZ = -frontZ;

    for (let floor = 0; floor < floors; floor += 1) {
      const y = towerBaseY + floor * spacingY + moduleHeight / 2;
      const isCorridorFloor = floor % corridorEvery === 0;
      for (let column = 0; column < unitsPerRow; column += 1) {
        const x = -towerWidth / 2 + column * spacingX;
        // Always place front units
        transforms.push({ position: [x, y, frontZ] });
        // Back units only on non-corridor floors
        if (!isCorridorFloor) {
          transforms.push({ position: [x, y, backZ] });
        }
      }
    }
    return transforms;
  }, [floors, corridorEvery, moduleDepth, moduleHeight, spacingX, towerBaseY, towerDepth, towerWidth, unitsPerRow]);

  const slabTransforms = useMemo(() => {
    const transforms = [];
    const slabThickness = 0.12;
    for (let floor = 0; floor <= floors; floor += 1) {
      const y = towerBaseY + floor * spacingY - moduleHeight * 0.08;
      transforms.push({
        position: [0, y, 0],
        scale: [towerWidth * 1.02, slabThickness, towerDepth * 1.02],
      });
    }
    return transforms;
  }, [floors, moduleHeight, spacingY, towerBaseY, towerDepth, towerWidth]);

  const finTransforms = useMemo(() => {
    const transforms = [];
    const frontZ = towerDepth / 2 + 0.1;
    const backZ = -frontZ;
    const finThickness = moduleWidth * 0.18;
    const finDepth = moduleDepth * 0.22;

    for (let column = 0; column < unitsPerRow; column += 1) {
      const x = -towerWidth / 2 + column * spacingX;
      transforms.push({ position: [x, towerCenterY, frontZ], scale: [finThickness, towerHeight, finDepth] });
      transforms.push({ position: [x, towerCenterY, backZ], scale: [finThickness, towerHeight, finDepth] });
    }
    return transforms;
  }, [unitsPerRow, moduleWidth, moduleDepth, spacingX, towerCenterY, towerHeight, towerDepth, towerWidth]);

  const railTransforms = useMemo(() => {
    const transforms = [];
    const backZ = -towerDepth / 2 + 0.18;
    const railHeight = 0.08;
    for (let floor = 0; floor < floors; floor += 1) {
      const isCorridorFloor = floor % corridorEvery === 0;
      if (!isCorridorFloor) continue;
      const y = towerBaseY + floor * spacingY + moduleHeight * 0.45;
      transforms.push({ position: [0, y, backZ], scale: [towerWidth * 0.98, railHeight, 0.06] });
    }
    return transforms;
  }, [floors, corridorEvery, moduleHeight, spacingY, towerBaseY, towerWidth, towerDepth]);

  const coreTransforms = useMemo(() => {
    const transforms = [];
    const coreWidth = moduleWidth * 1.1;
    const coreDepth = moduleDepth * 0.9;
    const coreXs = [-towerWidth / 3.2, towerWidth / 3.2];
    coreXs.forEach((x) => {
      transforms.push({ position: [x, towerCenterY, 0], scale: [coreWidth, towerHeight, coreDepth] });
    });
    return transforms;
  }, [moduleWidth, moduleDepth, towerCenterY, towerHeight, towerWidth]);

  const pilotisTransforms = useMemo(() => {
    const transforms = [];
    const frontZ = towerDepth / 2 - moduleDepth / 2;
    const backZ = -frontZ;
    const pilotisHeight = spacingY * 0.6;
    for (let column = 0; column < unitsPerRow; column += 1) {
      if (column % 2 !== 0) continue;
      const x = -towerWidth / 2 + column * spacingX;
      transforms.push({ position: [x, towerBaseY + pilotisHeight / 2 - spacingY * 0.4, frontZ], scale: [moduleWidth * 0.24, pilotisHeight, moduleDepth * 0.42] });
      transforms.push({ position: [x, towerBaseY + pilotisHeight / 2 - spacingY * 0.4, backZ], scale: [moduleWidth * 0.24, pilotisHeight, moduleDepth * 0.42] });
    }
    return transforms;
  }, [moduleDepth, moduleWidth, spacingX, spacingY, towerBaseY, towerDepth, towerWidth, unitsPerRow]);

  useInstancedLayout(unitRef, unitTransforms);
  useInstancedLayout(slabRef, slabTransforms);
  useInstancedLayout(finRef, finTransforms);
  useInstancedLayout(railRef, railTransforms);
  useInstancedLayout(coreRef, coreTransforms);
  useInstancedLayout(pilotisRef, pilotisTransforms);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]} receiveShadow>
        <planeGeometry args={[110, 110]} />
        <meshStandardMaterial color={palette.ground} />
      </mesh>

      {slabTransforms.length > 0 && (
        <instancedMesh ref={slabRef} args={[null, null, slabTransforms.length]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.slab} roughness={0.9} />
        </instancedMesh>
      )}

      {coreTransforms.length > 0 && (
        <instancedMesh ref={coreRef} args={[null, null, coreTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.core} roughness={0.84} />
        </instancedMesh>
      )}

      {finTransforms.length > 0 && (
        <instancedMesh ref={finRef} args={[null, null, finTransforms.length]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.fin} roughness={0.72} />
        </instancedMesh>
      )}

      {railTransforms.length > 0 && (
        <instancedMesh ref={railRef} args={[null, null, railTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.rail} roughness={0.4} metalness={0.06} />
        </instancedMesh>
      )}

      {pilotisTransforms.length > 0 && (
        <instancedMesh ref={pilotisRef} args={[null, null, pilotisTransforms.length]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.core} roughness={0.86} />
        </instancedMesh>
      )}

      {unitTransforms.length > 0 && (
        <instancedMesh ref={unitRef} args={[null, null, unitTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[moduleWidth, moduleHeight, moduleDepth]} />
          <meshStandardMaterial color={palette.unit} roughness={0.82} metalness={0.04} />
        </instancedMesh>
      )}
    </group>
  );
}

export default function Apt18() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '480px' }}>
      <Canvas shadows camera={{ position: [28, 18, 32], fov: 45 }}>
        <color attach="background" args={['#f3f5f7']} />
        <fog attach="fog" args={['#eef1f4', 60, 125]} />

        <hemisphereLight intensity={0.5} color="#fdfcf8" groundColor="#d8d8d4" />
        <directionalLight
          position={[32, 34, 24]}
          intensity={1.24}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-52}
          shadow-camera-right={52}
          shadow-camera-top={32}
          shadow-camera-bottom={-52}
        />
        <ambientLight intensity={0.22} />

        <GalleryRibbonSlab />

        <OrbitControls target={[0, 8, 0]} maxPolarAngle={Math.PI / 2.08} minDistance={12} maxDistance={72} enableDamping />
      </Canvas>
    </div>
  );
}

