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
      const position = transform.position ?? [0, 0, 0];
      const rotation = transform.rotation ?? [0, 0, 0];
      const scale = transform.scale ?? [1, 1, 1];

      dummy.position.set(position[0], position[1], position[2]);
      dummy.rotation.set(rotation[0], rotation[1], rotation[2]);
      dummy.scale.set(scale[0], scale[1], scale[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [transforms]);
}

function MinimalApartmentTower() {
  const palette = {
    concrete: '#dadad6',
    shadowConcrete: '#c8c8c2',
    grid: '#bcbcb6',
    void: '#8e9aa1',
    ground: '#efefec',
    sky: '#f4f6f8',
  };

  const floors = 18;
  const columns = 9;
  const moduleWidth = 2.8;
  const moduleHeight = 0.9;
  const moduleDepth = 1.4;
  const spacingX = moduleWidth + 0.2;
  const spacingY = moduleHeight + 0.18;
  const spacingZ = moduleDepth + 0.36;
  const facadeDepth = spacingZ / 2;

  const towerWidth = (columns - 1) * spacingX + moduleWidth;
  const towerDepth = spacingZ * 2;
  const towerHeight = floors * spacingY + moduleHeight;
  const podiumHeight = 1.6;
  const towerBaseY = GROUND_LEVEL + podiumHeight;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const cellRef = useRef();
  const voidRef = useRef();
  const ribRef = useRef();
  const slabRef = useRef();

  const cellTransforms = useMemo(() => {
    const transforms = [];
    for (let level = 0; level < floors; level += 1) {
      const y = towerBaseY + level * spacingY + moduleHeight / 2;
      for (let column = 0; column < columns; column += 1) {
        const x = -towerWidth / 2 + column * spacingX;
        transforms.push({
          position: [x, y, facadeDepth],
        });
        transforms.push({
          position: [x, y, -facadeDepth],
          rotation: [0, Math.PI, 0],
        });
      }
    }
    return transforms;
  }, [columns, facadeDepth, floors, spacingX, spacingY, towerBaseY, towerWidth, moduleHeight]);

  const voidTransforms = useMemo(() => {
    const transforms = [];
    for (let level = 1; level < floors; level += 2) {
      const y = towerBaseY + level * spacingY + moduleHeight * 0.55;
      for (let column = 0; column < columns; column += 1) {
        if (column % 2 === 0) continue;
        const x = -towerWidth / 2 + column * spacingX;
        transforms.push({
          position: [x, y, 0],
          scale: [moduleWidth * 1.02, moduleHeight * 0.6, towerDepth * 0.18],
        });
      }
    }
    return transforms;
  }, [columns, floors, moduleHeight, moduleWidth, spacingX, spacingY, towerBaseY, towerDepth, towerWidth]);

  const ribTransforms = useMemo(() => {
    const transforms = [];
    for (let column = 0; column < columns; column += 1) {
      const x = -towerWidth / 2 + column * spacingX;
      transforms.push({
        position: [x, towerCenterY, towerDepth / 2 + 0.16],
        scale: [0.32, towerHeight, 0.16],
      });
      transforms.push({
        position: [x, towerCenterY, -towerDepth / 2 - 0.16],
        scale: [0.32, towerHeight, 0.16],
      });
    }
    return transforms;
  }, [columns, spacingX, towerCenterY, towerDepth, towerHeight, towerWidth]);

  const slabTransforms = useMemo(() => {
    const transforms = [];
    for (let level = 0; level <= floors; level += 1) {
      const y = towerBaseY + level * spacingY - moduleHeight * 0.1;
      transforms.push({
        position: [0, y, 0],
        scale: [towerWidth * 1.02, 0.08, towerDepth * 1.02],
      });
    }
    return transforms;
  }, [floors, moduleHeight, spacingY, towerBaseY, towerDepth, towerWidth]);

  useInstancedLayout(cellRef, cellTransforms);
  useInstancedLayout(voidRef, voidTransforms);
  useInstancedLayout(ribRef, ribTransforms);
  useInstancedLayout(slabRef, slabTransforms);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={palette.ground} />
      </mesh>

      <mesh position={[0, GROUND_LEVEL + podiumHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[towerWidth * 1.14, podiumHeight, towerDepth * 1.12]} />
        <meshStandardMaterial color={palette.shadowConcrete} roughness={0.9} />
      </mesh>

      <mesh position={[0, towerCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[towerWidth, towerHeight, towerDepth]} />
        <meshStandardMaterial color={palette.concrete} roughness={0.88} metalness={0.04} />
      </mesh>

      {slabTransforms.length > 0 && (
        <instancedMesh ref={slabRef} args={[null, null, slabTransforms.length]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.shadowConcrete} roughness={0.92} />
        </instancedMesh>
      )}

      {ribTransforms.length > 0 && (
        <instancedMesh ref={ribRef} args={[null, null, ribTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.grid} roughness={0.8} />
        </instancedMesh>
      )}

      {cellTransforms.length > 0 && (
        <instancedMesh ref={cellRef} args={[null, null, cellTransforms.length]} castShadow>
          <boxGeometry args={[moduleWidth * 0.72, moduleHeight * 0.72, moduleDepth * 0.6]} />
          <meshStandardMaterial color={palette.grid} roughness={0.6} metalness={0.05} />
        </instancedMesh>
      )}

      {voidTransforms.length > 0 && (
        <instancedMesh ref={voidRef} args={[null, null, voidTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.void} metalness={0.1} roughness={0.45} />
        </instancedMesh>
      )}

      <mesh position={[0, towerBaseY + towerHeight + 0.4, 0]} castShadow>
        <boxGeometry args={[towerWidth * 0.84, 0.32, towerDepth * 0.84]} />
        <meshStandardMaterial color={palette.grid} roughness={0.6} />
      </mesh>
    </group>
  );
}

export default function Apt11() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '460px' }}>
      <Canvas shadows camera={{ position: [20, 16, 24], fov: 45 }}>
        <color attach="background" args={['#f3f4f6']} />
        <fog attach="fog" args={['#eef1f3', 40, 90]} />

        <hemisphereLight intensity={0.5} color="#fdfcf8" groundColor="#d8d8d4" />
        <directionalLight
          position={[22, 28, 18]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={30}
          shadow-camera-bottom={-40}
        />
        <ambientLight intensity={0.2} />

        <MinimalApartmentTower />

        <OrbitControls target={[0, 8, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={10} maxDistance={60} enableDamping />
      </Canvas>
    </div>
  );
}

