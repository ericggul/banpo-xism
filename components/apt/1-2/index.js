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

function MinimalistApartmentSculpture() {
  const palette = {
    base: '#dadcdb',
    slab: '#c7c9c8',
    cavity: '#86919a',
    edge: '#b4b7b6',
    sky: '#f2f3f5',
    ground: '#ececeb',
  };

  const floors = 22;
  const columns = 8;
  const stackDepth = 4;
  const moduleWidth = 2.9;
  const moduleHeight = 0.95;
  const moduleDepth = 1.2;
  const spacingX = moduleWidth + 0.16;
  const spacingY = moduleHeight + 0.12;
  const spacingZ = moduleDepth + 0.24;

  const towerWidth = (columns - 1) * spacingX + moduleWidth;
  const towerHeight = floors * spacingY + moduleHeight;
  const towerDepth = (stackDepth - 1) * spacingZ + moduleDepth;
  const baseHeight = 1.4;
  const towerBaseY = GROUND_LEVEL + baseHeight;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const cellRef = useRef();
  const slitRef = useRef();
  const slabRef = useRef();
  const edgeRef = useRef();

  const cellTransforms = useMemo(() => {
    const transforms = [];
    for (let depthIndex = 0; depthIndex < stackDepth; depthIndex += 1) {
      const z = -towerDepth / 2 + depthIndex * spacingZ;
      for (let floor = 0; floor < floors; floor += 1) {
        const y = towerBaseY + floor * spacingY + moduleHeight / 2;
        for (let column = 0; column < columns; column += 1) {
          const x = -towerWidth / 2 + column * spacingX;
          transforms.push({
            position: [x, y, z],
          });
        }
      }
    }
    return transforms;
  }, [columns, floors, moduleHeight, spacingX, spacingY, spacingZ, stackDepth, towerBaseY, towerDepth, towerWidth]);

  const slitTransforms = useMemo(() => {
    const transforms = [];
    for (let depthIndex = 0; depthIndex < stackDepth; depthIndex += 1) {
      const z = -towerDepth / 2 + depthIndex * spacingZ;
      for (let floor = 1; floor < floors; floor += 2) {
        const y = towerBaseY + floor * spacingY;
        transforms.push({
          position: [0, y, z],
          scale: [towerWidth * 1.02, 0.1, moduleDepth * 0.48],
        });
      }
    }
    return transforms;
  }, [floors, moduleDepth, spacingY, spacingZ, stackDepth, towerBaseY, towerWidth, towerDepth]);

  const slabTransforms = useMemo(() => {
    const transforms = [];
    for (let floor = 0; floor <= floors; floor += 1) {
      const y = towerBaseY + floor * spacingY - moduleHeight * 0.08;
      transforms.push({
        position: [0, y, 0],
        scale: [towerWidth * 1.04, 0.12, towerDepth * 1.06],
      });
    }
    transforms.push({
      position: [0, towerBaseY + towerHeight + 0.4, 0],
      scale: [towerWidth * 0.82, 0.4, towerDepth * 0.82],
    });
    return transforms;
  }, [floors, moduleHeight, spacingY, towerBaseY, towerDepth, towerHeight, towerWidth]);

  const edgeTransforms = useMemo(() => {
    const transforms = [];
    for (let column = 0; column < columns; column += 1) {
      const x = -towerWidth / 2 + column * spacingX;
      transforms.push({
        position: [x, towerCenterY, towerDepth / 2 + 0.1],
        scale: [0.24, towerHeight, 0.08],
      });
      transforms.push({
        position: [x, towerCenterY, -towerDepth / 2 - 0.1],
        scale: [0.24, towerHeight, 0.08],
      });
    }
    for (let depthIndex = 0; depthIndex < stackDepth; depthIndex += 1) {
      const z = -towerDepth / 2 + depthIndex * spacingZ;
      transforms.push({
        position: [towerWidth / 2 + 0.1, towerCenterY, z],
        scale: [0.08, towerHeight, moduleDepth * 0.8],
      });
      transforms.push({
        position: [-towerWidth / 2 - 0.1, towerCenterY, z],
        scale: [0.08, towerHeight, moduleDepth * 0.8],
      });
    }
    return transforms;
  }, [columns, moduleDepth, spacingX, spacingZ, stackDepth, towerCenterY, towerDepth, towerHeight, towerWidth]);

  useInstancedLayout(cellRef, cellTransforms);
  useInstancedLayout(slitRef, slitTransforms);
  useInstancedLayout(slabRef, slabTransforms);
  useInstancedLayout(edgeRef, edgeTransforms);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={palette.ground} />
      </mesh>

      <mesh position={[0, GROUND_LEVEL + baseHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[towerWidth * 1.2, baseHeight, towerDepth * 1.2]} />
        <meshStandardMaterial color={palette.base} roughness={0.92} />
      </mesh>

      <mesh position={[0, towerCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[towerWidth, towerHeight, towerDepth]} />
        <meshStandardMaterial color={palette.base} roughness={0.88} metalness={0.05} />
      </mesh>

      {slabTransforms.length > 0 && (
        <instancedMesh ref={slabRef} args={[null, null, slabTransforms.length]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.slab} roughness={0.86} />
        </instancedMesh>
      )}

      {edgeTransforms.length > 0 && (
        <instancedMesh ref={edgeRef} args={[null, null, edgeTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.edge} roughness={0.72} />
        </instancedMesh>
      )}

      {slitTransforms.length > 0 && (
        <instancedMesh ref={slitRef} args={[null, null, slitTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.cavity} roughness={0.4} metalness={0.08} />
        </instancedMesh>
      )}

      {cellTransforms.length > 0 && (
        <instancedMesh ref={cellRef} args={[null, null, cellTransforms.length]} castShadow>
          <boxGeometry args={[moduleWidth * 0.62, moduleHeight * 0.62, moduleDepth * 0.54]} />
          <meshStandardMaterial color={palette.edge} roughness={0.6} metalness={0.05} />
        </instancedMesh>
      )}
    </group>
  );
}

export default function Apt12() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '480px' }}>
      <Canvas shadows camera={{ position: [24, 18, 28], fov: 45 }}>
        <color attach="background" args={['#f2f3f5']} />
        <fog attach="fog" args={['#eef1f4', 50, 110]} />

        <hemisphereLight intensity={0.52} color="#fdfcf8" groundColor="#d6d6d3" />
        <directionalLight
          position={[28, 32, 22]}
          intensity={1.25}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={30}
          shadow-camera-bottom={-50}
        />
        <ambientLight intensity={0.24} />

        <MinimalistApartmentSculpture />

        <OrbitControls target={[0, 9, 0]} maxPolarAngle={Math.PI / 2.12} minDistance={12} maxDistance={70} enableDamping />
      </Canvas>
    </div>
  );
}

