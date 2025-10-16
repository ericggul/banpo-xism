'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function ApartmentBlock() {
  const windowsRef = useRef();

  const windowPositions = useMemo(() => {
    const floors = 9;
    const columns = 12;
    const spacingX = 1.05;
    const spacingY = 0.45;
    const facadeOffset = 1.13;
    const positions = [];
    const startX = -((columns - 1) * spacingX) / 2;
    const startY = -1.05;

    for (let floor = 0; floor < floors; floor += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = startX + column * spacingX;
        const y = startY + floor * spacingY;
        positions.push([x, y, facadeOffset]);
        positions.push([x, y, -facadeOffset]);
      }
    }

    return positions;
  }, []);

  useEffect(() => {
    const mesh = windowsRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    windowPositions.forEach(([x, y, z], index) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [windowPositions]);

  return (
    <group>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[13.5, 4.5, 2.2]} />
        <meshStandardMaterial color="#d9d9d6" />
      </mesh>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[13.5, 0.6, 2.4]} />
        <meshStandardMaterial color="#cfcfca" />
      </mesh>
      <mesh position={[0, -1.2, 0]}>
        <boxGeometry args={[14.5, 0.3, 3.2]} />
        <meshStandardMaterial color="#e1e0dc" />
      </mesh>
      <mesh position={[0, -1.35, 1.4]}>
        <boxGeometry args={[13.5, 0.08, 1.6]} />
        <meshStandardMaterial color="#eae9e4" />
      </mesh>
      <mesh position={[0, -1.35, -1.4]}>
        <boxGeometry args={[13.5, 0.08, 1.6]} />
        <meshStandardMaterial color="#eae9e4" />
      </mesh>
      <mesh position={[3.7, 0.2, 0]}>
        <boxGeometry args={[2.4, 3.2, 2.3]} />
        <meshStandardMaterial color="#e2e1de" />
      </mesh>
      <mesh position={[3.7, 2.2, 0]}>
        <boxGeometry args={[2.4, 0.8, 2.5]} />
        <meshStandardMaterial color="#d1d0cb" />
      </mesh>
      <mesh position={[3.7, -1.3, 0]}>
        <boxGeometry args={[2.4, 0.3, 2.7]} />
        <meshStandardMaterial color="#e0ded9" />
      </mesh>
      <instancedMesh ref={windowsRef} args={[null, null, windowPositions.length]}>
        <boxGeometry args={[0.6, 0.32, 0.06]} />
        <meshStandardMaterial color="#62738f" emissive="#1d2a3a" emissiveIntensity={0.08} />
      </instancedMesh>
    </group>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#f1f1f1" />
    </mesh>
  );
}

export default function Apt1() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '480px' }}>
      <Canvas camera={{ position: [12, 6, 12], fov: 40 }}>
        <color attach="background" args={['#f5f7fa']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 12, 8]} intensity={1.1} castShadow />
        <ApartmentBlock />
        <Ground />
        <OrbitControls target={[0, 1, 0]} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
}
