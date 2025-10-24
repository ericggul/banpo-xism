'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const GROUND_LEVEL = -2;

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

function MinimalStackedSlab() {
  const palette = {
    unit: '#dadbd7',
    frame: '#b9bcb8',
    skybridge: '#a6adb5',
    ground: '#ececeb',
    core: '#ced2d0',
  };

  const floors = 18;
  const unitsPerRow = 9;
  const moduleWidth = 2.9;
  const moduleHeight = 0.96;
  const moduleDepth = 1.28;
  const spacingX = moduleWidth + 0.18;
  const spacingY = moduleHeight + 0.16;
  const faceOffset = moduleDepth * 0.6;
  const mechanicalGapFloor = 9;

  const towerWidth = (unitsPerRow - 1) * spacingX + moduleWidth;
  const towerHeight = floors * spacingY + moduleHeight;
  const towerDepth = moduleDepth * 2 + faceOffset * 0.4;
  const towerBaseY = GROUND_LEVEL;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const unitRef = useRef();
  const frameRef = useRef();
  const slabRef = useRef();
  const coreRef = useRef();
  const pilotisRef = useRef();

  const unitTransforms = useMemo(() => {
    const transforms = [];
    const frontZ = towerDepth / 2 - moduleDepth / 2;
    const backZ = -frontZ;

    for (let floor = 0; floor < floors; floor += 1) {
      if (floor === mechanicalGapFloor) continue;
      const y = towerBaseY + floor * spacingY + moduleHeight / 2;
      for (let column = 0; column < unitsPerRow; column += 1) {
        const x = -towerWidth / 2 + column * spacingX;
        transforms.push({ position: [x, y, frontZ] });
        transforms.push({ position: [x, y, backZ] });
      }
    }
    return transforms;
  }, [floors, mechanicalGapFloor, moduleDepth, moduleHeight, spacingX, spacingY, towerBaseY, towerDepth, towerWidth, unitsPerRow]);

  const slabTransforms = useMemo(() => {
    const transforms = [];
    const frontZ = towerDepth / 2 - moduleDepth / 2;
    const backZ = -frontZ;
    const slabThickness = 0.12;

    for (let floor = 0; floor <= floors; floor += 1) {
      const y = towerBaseY + floor * spacingY - moduleHeight * 0.08;
      transforms.push({
        position: [0, y, frontZ],
        scale: [towerWidth * 1.02, slabThickness, moduleDepth * 0.98],
      });
      transforms.push({
        position: [0, y, backZ],
        scale: [towerWidth * 1.02, slabThickness, moduleDepth * 0.98],
      });
    }
    return transforms;
  }, [floors, moduleDepth, moduleHeight, spacingY, towerBaseY, towerWidth, towerDepth]);

  const frameTransforms = useMemo(() => {
    const transforms = [];
    const frontZ = towerDepth / 2;
    const backZ = -frontZ;
    const frameThickness = moduleWidth * 0.26;
    const frameDepth = moduleDepth * 0.24;

    for (let column = 0; column < unitsPerRow; column += 1) {
      const x = -towerWidth / 2 + column * spacingX;
      transforms.push({
        position: [x, towerCenterY, frontZ],
        scale: [frameThickness, towerHeight, frameDepth],
      });
      transforms.push({
        position: [x, towerCenterY, backZ],
        scale: [frameThickness, towerHeight, frameDepth],
      });
    }

    return transforms;
  }, [unitsPerRow, moduleWidth, moduleDepth, towerCenterY, towerDepth, towerHeight, towerWidth, spacingX]);

  const coreTransforms = useMemo(() => {
    const transforms = [];
    const coreWidth = moduleWidth * 1.2;
    const coreDepth = moduleDepth * 0.8;
    const frontZ = towerDepth / 2 - moduleDepth - faceOffset * 0.2;
    const backZ = -frontZ;
    const coreXPositions = [-towerWidth / 3, towerWidth / 3];

    coreXPositions.forEach((x) => {
      transforms.push({
        position: [x, towerCenterY, 0],
        scale: [coreWidth, towerHeight, coreDepth],
      });
      transforms.push({
        position: [x, towerCenterY, frontZ],
        scale: [coreWidth * 0.55, towerHeight, coreDepth * 0.92],
      });
      transforms.push({
        position: [x, towerCenterY, backZ],
        scale: [coreWidth * 0.55, towerHeight, coreDepth * 0.92],
      });
    });

    return transforms;
  }, [moduleDepth, moduleWidth, towerCenterY, towerDepth, towerHeight, towerWidth, faceOffset]);

  const pilotisTransforms = useMemo(() => {
    const transforms = [];
    const frontZ = towerDepth / 2 - moduleDepth / 2;
    const backZ = -frontZ;
    const pilotisHeight = spacingY * 0.6;
    for (let column = 0; column < unitsPerRow; column += 1) {
      if (column % 2 !== 0) continue;
      const x = -towerWidth / 2 + column * spacingX;
      transforms.push({
        position: [x, towerBaseY + pilotisHeight / 2 - spacingY * 0.4, frontZ],
        scale: [moduleWidth * 0.25, pilotisHeight, moduleDepth * 0.4],
      });
      transforms.push({
        position: [x, towerBaseY + pilotisHeight / 2 - spacingY * 0.4, backZ],
        scale: [moduleWidth * 0.25, pilotisHeight, moduleDepth * 0.4],
      });
    }
    return transforms;
  }, [moduleDepth, moduleWidth, spacingX, spacingY, towerBaseY, towerDepth, towerWidth, unitsPerRow]);

  useInstancedLayout(unitRef, unitTransforms);
  useInstancedLayout(slabRef, slabTransforms);
  useInstancedLayout(frameRef, frameTransforms);
  useInstancedLayout(coreRef, coreTransforms);
  useInstancedLayout(pilotisRef, pilotisTransforms);

  const skybridgeY = towerBaseY + mechanicalGapFloor * spacingY + moduleHeight * 0.3;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]} receiveShadow>
        <planeGeometry args={[110, 110]} />
        <meshStandardMaterial color={palette.ground} />
      </mesh>

      {unitTransforms.length > 0 && (
        <instancedMesh ref={unitRef} args={[null, null, unitTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[moduleWidth, moduleHeight, moduleDepth]} />
          <meshStandardMaterial color={palette.unit} roughness={0.84} metalness={0.04} />
        </instancedMesh>
      )}

      {frameTransforms.length > 0 && (
        <instancedMesh ref={frameRef} args={[null, null, frameTransforms.length]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.frame} roughness={0.68} />
        </instancedMesh>
      )}

      {/* {coreTransforms.length > 0 && (
        <instancedMesh ref={coreRef} args={[null, null, coreTransforms.length]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.core} roughness={0.7} />
        </instancedMesh>
      )} */}


    </group>
  );
}

export default function Apt15() {
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

        <MinimalStackedSlab />

        <OrbitControls target={[0, 8, 0]} maxPolarAngle={Math.PI / 2.08} minDistance={12} maxDistance={72} enableDamping />
      </Canvas>
    </div>
  );
}
