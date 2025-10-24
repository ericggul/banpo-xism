'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const GROUND_LEVEL = -2.1;

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

function MinimalApartmentGrid() {
  const palette = {
    unit: '#d7d9d5',
    band: '#8e99a2',
    ground: '#ebecea',
  };

  const floors = 20;
  const unitsPerRow = 6;
  const moduleWidth = 4;
  const moduleHeight = 1.05;
  const moduleDepth = 1.5;
  const spacingX = moduleWidth + 0.22;
  const spacingY = moduleHeight + 0.18;
  const unitInset = moduleDepth * 0.18;

  const towerWidth = (unitsPerRow - 1) * spacingX + moduleWidth;
  const towerHeight = floors * spacingY + moduleHeight;
  const towerDepth = moduleDepth + unitInset * 2;
  const towerBaseY = GROUND_LEVEL;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const unitRef = useRef();
  const bandRef = useRef();

  const unitTransforms = useMemo(() => {
    const transforms = [];
    const zFront = towerDepth / 2 - moduleDepth / 2 - unitInset;
    const zBack = -zFront;
    for (let floor = 0; floor < floors; floor += 1) {
      const y = towerBaseY + floor * spacingY + moduleHeight / 2;
      for (let column = 0; column < unitsPerRow; column += 1) {
        const x = -towerWidth / 2 + column * spacingX;
        transforms.push({
          position: [x, y, zFront],
        });
        transforms.push({
          position: [x, y, zBack],
        });
      }
    }
    return transforms;
  }, [floors, moduleHeight, moduleDepth, spacingX, spacingY, unitsPerRow, towerBaseY, towerDepth, towerWidth, unitInset]);

  const bandTransforms = useMemo(() => {
    const transforms = [];
    const bandWidth = moduleWidth * 0.32;
    const bandDepth = towerDepth;
    for (let column = 0; column < unitsPerRow; column += 1) {
      const x = -towerWidth / 2 + column * spacingX;
      transforms.push({
        position: [x, towerCenterY, 0],
        scale: [bandWidth, towerHeight, bandDepth],
      });
    }
    return transforms;
  }, [unitsPerRow, moduleWidth, moduleDepth, towerCenterY, towerHeight, towerWidth, towerDepth, spacingX]);

  useInstancedLayout(unitRef, unitTransforms);
  useInstancedLayout(bandRef, bandTransforms);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={palette.ground} />
      </mesh>

      {unitTransforms.length > 0 && (
        <instancedMesh ref={unitRef} args={[null, null, unitTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[moduleWidth, moduleHeight, moduleDepth]} />
          <meshStandardMaterial color={palette.unit} roughness={0.85} metalness={0.05} />
        </instancedMesh>
      )}

      {bandTransforms.length > 0 && (
        <instancedMesh ref={bandRef} args={[null, null, bandTransforms.length]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.band} roughness={0.6} metalness={0.1} />
        </instancedMesh>
      )}
    </group>
  );
}

export default function Apt14() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '480px' }}>
      <Canvas shadows camera={{ position: [26, 18, 30], fov: 45 }}>
        <color attach="background" args={['#f3f4f6']} />
        <fog attach="fog" args={['#eef1f3', 55, 120]} />

        <hemisphereLight intensity={0.5} color="#fefdf8" groundColor="#d7d7d3" />
        <directionalLight
          position={[30, 32, 24]}
          intensity={1.22}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={30}
          shadow-camera-bottom={-50}
        />
        <ambientLight intensity={0.22} />

        <MinimalApartmentGrid />

        <OrbitControls target={[0, 8, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={12} maxDistance={70} enableDamping />
      </Canvas>
    </div>
  );
}
