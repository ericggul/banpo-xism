'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const GROUND_LEVEL = -2.5;

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

function LayeredSlabTower() {
  const palette = {
    slab: '#c5c5c1',
    fin: '#b5b5b1',
    plane_inner: '#979fa8',
    plane_glass: '#a7bdcc',
    plane_facade: '#d5d8dc',
    ground: '#e0e0dc',
    core: '#a9a9a5',
  };

  const floors = 15;
  const columns = 24;
  const moduleWidth = 1.8;
  const moduleHeight = 1.0;
  const moduleDepth = 3.0;
  const spacingX = moduleWidth + 0.1;
  const spacingY = moduleHeight + 0.15;

  const towerWidth = (columns - 1) * spacingX;
  const towerHeight = floors * spacingY;
  const towerDepth = moduleDepth;
  const towerBaseY = GROUND_LEVEL;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const slabRef = useRef();
  const finRef = useRef();
  const innerPlaneRef = useRef();
  const glassPlaneRef = useRef();
  const facadePlaneRef = useRef();

  const slabTransforms = useMemo(() => {
    return Array.from({ length: floors + 1 }, (_, floor) => ({
      position: [0, towerBaseY + floor * spacingY - moduleHeight / 2 - (spacingY - moduleHeight) / 2, 0],
      scale: [towerWidth + moduleWidth, 0.08, towerDepth * 0.8],
    }));
  }, [floors, spacingY, towerBaseY, towerDepth, towerWidth, moduleWidth, moduleHeight]);

  const finTransforms = useMemo(() => {
    return Array.from({ length: columns + 1 }, (_, column) => ({
      position: [-towerWidth / 2 + column * spacingX - spacingX / 2, towerCenterY, 0],
      scale: [0.05, towerHeight, towerDepth * 0.8],
    }));
  }, [columns, spacingX, towerCenterY, towerHeight, towerDepth, towerWidth]);

  const { innerTransforms, glassTransforms, facadeTransforms } = useMemo(() => {
    const inner = [];
    const glass = [];
    const facade = [];
    const planeThickness = 0.03;

    for (let floor = 0; floor < floors; floor++) {
      const y = towerBaseY + floor * spacingY;
      for (let column = 0; column < columns; column++) {
        const x = -towerWidth / 2 + column * spacingX - spacingX / 2 + moduleWidth / 2;
        
        inner.push({
          position: [x, y, -towerDepth * 0.3],
          scale: [moduleWidth, moduleHeight, planeThickness],
        });

        const glassZ = (Math.random() - 0.5) * towerDepth * 0.2;
        glass.push({
          position: [x, y, glassZ],
          scale: [moduleWidth, moduleHeight, planeThickness],
        });

        const facadeZ = towerDepth * 0.3 + (Math.random() - 0.5) * 0.2;
        facade.push({
          position: [x, y, facadeZ],
          scale: [moduleWidth, moduleHeight * (0.4 + Math.random() * 0.5), planeThickness],
        });
      }
    }
    return { innerTransforms: inner, glassTransforms: glass, facadeTransforms: facade };
  }, [columns, floors, moduleHeight, moduleWidth, spacingX, spacingY, towerBaseY, towerDepth, towerWidth]);

  useInstancedLayout(slabRef, slabTransforms);
  useInstancedLayout(finRef, finTransforms);
  useInstancedLayout(innerPlaneRef, innerTransforms);
  useInstancedLayout(glassPlaneRef, glassTransforms);
  useInstancedLayout(facadePlaneRef, facadeTransforms);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={palette.ground} />
      </mesh>
      
      <mesh position={[-towerWidth/4, towerCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[moduleWidth * 2, towerHeight, moduleDepth * 1.1]} />
        <meshStandardMaterial color={palette.core} roughness={0.8} />
      </mesh>

      <mesh position={[towerWidth/4, towerCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[moduleWidth * 2, towerHeight, moduleDepth * 1.1]} />
        <meshStandardMaterial color={palette.core} roughness={0.8} />
      </mesh>

      {slabTransforms.length > 0 && (
        <instancedMesh ref={slabRef} args={[null, null, slabTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.slab} roughness={0.8} />
        </instancedMesh>
      )}

      {finTransforms.length > 0 && (
        <instancedMesh ref={finRef} args={[null, null, finTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.fin} roughness={0.7} />
        </instancedMesh>
      )}

      {innerTransforms.length > 0 && (
        <instancedMesh ref={innerPlaneRef} args={[null, null, innerTransforms.length]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.plane_inner} roughness={0.6} />
        </instancedMesh>
      )}

      {glassTransforms.length > 0 && (
        <instancedMesh ref={glassPlaneRef} args={[null, null, glassTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.plane_glass} roughness={0.2} metalness={0.1} transparent opacity={0.5} />
        </instancedMesh>
      )}

      {facadeTransforms.length > 0 && (
        <instancedMesh ref={facadePlaneRef} args={[null, null, facadeTransforms.length]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.plane_facade} roughness={0.9} />
        </instancedMesh>
      )}
    </group>
  );
}

export default function Apt17() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '480px' }}>
      <Canvas shadows camera={{ position: [-30, 16, 35], fov: 45 }}>
        <color attach="background" args={['#f0f2f5']} />
        <fog attach="fog" args={['#f0f2f5', 65, 140]} />

        <hemisphereLight intensity={0.5} color="#ffffff" groundColor="#d4d4d8" />
        <directionalLight
          position={[40, 40, 20]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={40}
          shadow-camera-bottom={-60}
        />
        <ambientLight intensity={0.25} />

        <LayeredSlabTower />

        <OrbitControls target={[0, 6, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={15} maxDistance={80} enableDamping />
      </Canvas>
    </div>
  );
}
