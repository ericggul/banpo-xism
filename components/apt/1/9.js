'use client';

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const GROUND_LEVEL = -2.1;

function RectilinearApartmentTower() {
  const palette = {
    tower: '#d6dbe1',
    stripe: '#cfd4db',
    base: '#c3c9d1',
    roof: '#bdc3cb',
    edges: '#aeb5bf',
    ground: '#f3f4f6',
  };

  const towerWidth = 16;
  const towerDepth = 5.4;
  const towerHeight = 26;
  const floors = 22;

  const towerGeometry = useMemo(() => {
    const geometry = new THREE.BoxGeometry(towerWidth, towerHeight, towerDepth, 1, floors, 1);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);

    const baseColor = new THREE.Color(palette.base);
    const bodyColor = new THREE.Color(palette.tower);
    const stripeColor = new THREE.Color(palette.stripe);
    const roofColor = new THREE.Color(palette.roof);

    for (let i = 0; i < position.count; i += 1) {
      const y = position.getY(i);
      const normalized = (y + towerHeight / 2) / towerHeight;
      let targetColor = bodyColor;

      if (normalized < 0.08) {
        targetColor = baseColor;
      } else if (normalized > 0.94) {
        targetColor = roofColor;
      } else {
        const band = Math.floor(normalized * floors);
        targetColor = band % 2 === 0 ? bodyColor : stripeColor;
      }

      const offset = i * 3;
      colors[offset] = targetColor.r;
      colors[offset + 1] = targetColor.g;
      colors[offset + 2] = targetColor.b;
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }, [floors, palette.base, palette.roof, palette.stripe, palette.tower, towerDepth, towerHeight, towerWidth]);

  const edgeGeometry = useMemo(() => new THREE.EdgesGeometry(towerGeometry, 22), [towerGeometry]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={palette.ground} />
      </mesh>

      <mesh geometry={towerGeometry} position={[0, GROUND_LEVEL + towerHeight / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.82} metalness={0.06} />
      </mesh>

      <lineSegments geometry={edgeGeometry} position={[0, GROUND_LEVEL + towerHeight / 2, 0]}>
        <lineBasicMaterial color={palette.edges} />
      </lineSegments>
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

        <RectilinearApartmentTower />

        <OrbitControls target={[0, 8, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={12} maxDistance={70} enableDamping />
      </Canvas>
    </div>
  );
}
