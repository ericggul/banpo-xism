'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const GROUND_LEVEL = -2.4;

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

function SeoulTower({
  id,
  floors = 18,
  columns = 16,
  width = 22,
  depth = 7,
  floorHeight = 0.58,
  podiumHeight = 1.4,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  bodyColor = '#e7ebf2',
  accentColor = '#c0ccda',
  balconyColor = '#9dafc4',
  windowColor = '#7b8fa7',
  emissiveColor = '#2b3f54',
}) {
  const bodyHeight = floors * floorHeight;
  const towerBaseY = GROUND_LEVEL + podiumHeight;
  const bodyCenterY = towerBaseY + bodyHeight / 2;
  const roofHeight = 0.5;
  const crownHeight = 1.1;
  const parapetHeight = 0.35;
  const marginX = Math.min(1.4, width * 0.12);
  const spacingX = columns > 1 ? (width - marginX * 2) / (columns - 1) : width;
  const windowWidth = Math.min(spacingX * 0.68, 1.55);
  const windowHeight = floorHeight - 0.24;
  const facadeZ = depth / 2 + 0.05;
  const balconyDepth = 1.3;

  const windowsRef = useRef();
  const balconyRef = useRef();
  const railingRef = useRef();
  const shadeRef = useRef();

  const windowTransforms = useMemo(() => {
    const transforms = [];
    for (let floor = 0; floor < floors; floor += 1) {
      const sillOffset = (floorHeight - windowHeight) / 2;
      const y = towerBaseY + floor * floorHeight + sillOffset + windowHeight / 2;
      for (let column = 0; column < columns; column += 1) {
        const x = -width / 2 + marginX + column * spacingX;
        transforms.push({
          position: [x, y, facadeZ],
        });
        transforms.push({
          position: [x, y, -facadeZ],
          rotation: [0, Math.PI, 0],
        });
      }
    }
    return transforms;
  }, [columns, facadeZ, floorHeight, floors, marginX, spacingX, towerBaseY, windowHeight, width]);

  const balconyTransforms = useMemo(() => {
    const transforms = [];
    for (let floor = 2; floor < floors; floor += 1) {
      const y = towerBaseY + floor * floorHeight - floorHeight * 0.25;
      transforms.push({
        position: [0, y, depth / 2 + balconyDepth / 2 - 0.12],
        scale: [width * 0.92, 0.14, balconyDepth],
      });
    }
    return transforms;
  }, [floorHeight, floors, towerBaseY, width, depth, balconyDepth]);

  const railingTransforms = useMemo(() => {
    const transforms = [];
    const railHeight = 0.72;
    for (let floor = 2; floor < floors; floor += 1) {
      const y = towerBaseY + floor * floorHeight + railHeight / 2 - 0.22;
      transforms.push({
        position: [0, y, depth / 2 + balconyDepth - 0.4],
        scale: [width * 0.9, railHeight, 0.08],
      });
    }
    return transforms;
  }, [floorHeight, floors, towerBaseY, width, depth, balconyDepth]);

  const shadeTransforms = useMemo(() => {
    const transforms = [];
    for (let column = 0; column < columns; column += 1) {
      if (column % 2 === 1) continue;
      const x = -width / 2 + marginX + column * spacingX;
      transforms.push({
        position: [x, bodyCenterY, depth / 2 + balconyDepth - 0.36],
        scale: [windowWidth * 0.92, bodyHeight * 1.02, 0.05],
      });
    }
    return transforms;
  }, [columns, marginX, spacingX, bodyCenterY, depth, balconyDepth, windowWidth, bodyHeight, width]);

  useInstancedLayout(windowsRef, windowTransforms);
  useInstancedLayout(balconyRef, balconyTransforms);
  useInstancedLayout(railingRef, railingTransforms);
  useInstancedLayout(shadeRef, shadeTransforms);

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, GROUND_LEVEL + podiumHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width * 0.94, podiumHeight, depth * 1.08]} />
        <meshStandardMaterial color="#d5dae0" />
      </mesh>

      <mesh position={[0, bodyCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, bodyHeight, depth]} />
        <meshStandardMaterial color={bodyColor} roughness={0.82} metalness={0.08} />
      </mesh>

      <mesh position={[0, towerBaseY + bodyHeight + roofHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width * 1.02, roofHeight, depth * 1.04]} />
        <meshStandardMaterial color="#f3f4f5" roughness={0.4} metalness={0.05} />
      </mesh>

      <mesh position={[0, towerBaseY + bodyHeight + roofHeight + parapetHeight / 2, depth / 2 - 0.2]} castShadow>
        <boxGeometry args={[width * 0.82, parapetHeight, 0.5]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>

      <mesh position={[0, towerBaseY + bodyHeight + roofHeight + parapetHeight + crownHeight / 2, depth / 2 - 0.32]} castShadow>
        <boxGeometry args={[width * 0.54, crownHeight, 0.72]} />
        <meshStandardMaterial color="#eef2f7" emissive={accentColor} emissiveIntensity={0.12} />
      </mesh>

      <mesh position={[0, bodyCenterY, depth / 2 - 0.06]} castShadow receiveShadow>
        <boxGeometry args={[width * 0.16, bodyHeight * 1.02, 0.3]} />
        <meshStandardMaterial color={accentColor} roughness={0.6} />
      </mesh>

      <mesh position={[0, bodyCenterY, -depth / 2 + 0.06]} castShadow receiveShadow>
        <boxGeometry args={[width * 0.16, bodyHeight * 1.02, 0.3]} />
        <meshStandardMaterial color={accentColor} roughness={0.6} />
      </mesh>

      {windowTransforms.length > 0 && (
        <instancedMesh ref={windowsRef} args={[null, null, windowTransforms.length]} castShadow>
          <boxGeometry args={[windowWidth, windowHeight, 0.08]} />
          <meshStandardMaterial color={windowColor} emissive={emissiveColor} emissiveIntensity={0.1} roughness={0.35} />
        </instancedMesh>
      )}

      {balconyTransforms.length > 0 && (
        <instancedMesh ref={balconyRef} args={[null, null, balconyTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={balconyColor} roughness={0.55} metalness={0.08} />
        </instancedMesh>
      )}

      {railingTransforms.length > 0 && (
        <instancedMesh ref={railingRef} args={[null, null, railingTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#e8ebef" roughness={0.4} />
        </instancedMesh>
      )}

      {shadeTransforms.length > 0 && (
        <instancedMesh ref={shadeRef} args={[null, null, shadeTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#b9c4d2" transparent opacity={0.4} />
        </instancedMesh>
      )}

      <mesh position={[width * 0.27, bodyCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[width * 0.16, bodyHeight * 1.04, depth * 0.78]} />
        <meshStandardMaterial color="#d9e0ea" roughness={0.65} />
      </mesh>

      <mesh position={[-width * 0.27, bodyCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[width * 0.16, bodyHeight * 1.04, depth * 0.78]} />
        <meshStandardMaterial color="#d9e0ea" roughness={0.65} />
      </mesh>

      <mesh position={[0, towerBaseY + 0.35, depth / 2 + balconyDepth - 0.24]} castShadow>
        <boxGeometry args={[width * 0.24, 0.7, 0.8]} />
        <meshStandardMaterial color="#a7b8c9" />
      </mesh>

      {id && (
        <mesh position={[0, towerBaseY + bodyHeight + roofHeight + parapetHeight + crownHeight + 0.25, depth / 2 - 0.05]} castShadow>
          <boxGeometry args={[4.2, 0.4, 0.2]} />
          <meshStandardMaterial color="#1f2a38" emissive="#111823" emissiveIntensity={0.18} />
        </mesh>
      )}
    </group>
  );
}

function Trees() {
  const trunkRef = useRef();
  const canopyRef = useRef();

  const trunkTransforms = useMemo(() => {
    const clusters = [
      [-26, -8],
      [-24, 6],
      [-10, 14],
      [12, 16],
      [24, -6],
      [18, -14],
    ];

    const transforms = [];
    clusters.forEach(([x, z]) => {
      for (let i = 0; i < 4; i += 1) {
        const offsetX = x + (Math.random() - 0.5) * 3.4;
        const offsetZ = z + (Math.random() - 0.5) * 3.4;
        const height = 2.6 + Math.random() * 0.9;
        transforms.push({
          position: [offsetX, GROUND_LEVEL + height / 2, offsetZ],
          scale: [0.38, height, 0.38],
        });
      }
    });

    return transforms;
  }, []);

  const canopyTransforms = useMemo(
    () =>
      trunkTransforms.map((transform) => {
        const canopyHeight = transform.scale[1] * 0.9;
        return {
          position: [transform.position[0], transform.position[1] + canopyHeight * 0.55, transform.position[2]],
          scale: [transform.scale[0] * 5.2, canopyHeight, transform.scale[2] * 5.2],
        };
      }),
    [trunkTransforms],
  );

  useInstancedLayout(trunkRef, trunkTransforms);
  useInstancedLayout(canopyRef, canopyTransforms);

  return (
    <group>
      {trunkTransforms.length > 0 && (
        <instancedMesh ref={trunkRef} args={[null, null, trunkTransforms.length]} castShadow>
          <cylinderGeometry args={[0.35, 0.5, 1, 6]} />
          <meshStandardMaterial color="#5a4631" roughness={0.9} />
        </instancedMesh>
      )}
      {canopyTransforms.length > 0 && (
        <instancedMesh ref={canopyRef} args={[null, null, canopyTransforms.length]} castShadow>
          <coneGeometry args={[1, 1, 7]} />
          <meshStandardMaterial color="#4c6f4f" roughness={0.8} />
        </instancedMesh>
      )}
    </group>
  );
}

function Landscaping() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#d1d3cf" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.01, 0]} receiveShadow>
        <planeGeometry args={[78, 42]} />
        <meshStandardMaterial color="#9fb4a1" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.005, 0]} receiveShadow>
        <planeGeometry args={[68, 18]} />
        <meshStandardMaterial color="#c8ccd2" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.004, 0]} receiveShadow>
        <planeGeometry args={[24, 46]} />
        <meshStandardMaterial color="#bfcad7" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-22, GROUND_LEVEL + 0.01, -2]} receiveShadow>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial color="#435d45" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[18, GROUND_LEVEL + 0.01, 4]} receiveShadow>
        <planeGeometry args={[16, 10]} />
        <meshStandardMaterial color="#3f5c41" />
      </mesh>

      <Trees />
    </group>
  );
}

function ApartmentComplex() {
  const towers = useMemo(
    () => [
      {
        id: '101',
        floors: 21,
        columns: 18,
        width: 26,
        depth: 7.2,
        floorHeight: 0.56,
        podiumHeight: 1.5,
        position: [-18, 0, -4],
        rotation: [0, Math.PI / 28, 0],
        bodyColor: '#e6ebf3',
        accentColor: '#bcc9da',
        balconyColor: '#94a8bc',
      },
      {
        id: '102',
        floors: 19,
        columns: 17,
        width: 24,
        depth: 7,
        floorHeight: 0.58,
        podiumHeight: 1.5,
        position: [0, 0, 2],
        rotation: [0, -Math.PI / 40, 0],
        bodyColor: '#e8edf4',
        accentColor: '#c4cfdd',
        balconyColor: '#8ea4bd',
      },
      {
        id: '103',
        floors: 17,
        columns: 14,
        width: 22,
        depth: 6.8,
        floorHeight: 0.6,
        podiumHeight: 1.4,
        position: [16, 0, 6],
        rotation: [0, Math.PI / 36, 0],
        bodyColor: '#e3e8f0',
        accentColor: '#b7c3d4',
        balconyColor: '#899eb8',
      },
    ],
    [],
  );

  return (
    <group>
      <Landscaping />

      <mesh position={[0, GROUND_LEVEL + 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[16, 0.22, 30]} />
        <meshStandardMaterial color="#d4dae2" />
      </mesh>

      <mesh position={[0, GROUND_LEVEL + 0.68, 0]} castShadow receiveShadow>
        <boxGeometry args={[8, 1.2, 12]} />
        <meshStandardMaterial color="#edf1f6" />
      </mesh>

      <mesh position={[0, GROUND_LEVEL + 0.75, -2]} castShadow receiveShadow>
        <boxGeometry args={[11, 0.6, 4]} />
        <meshStandardMaterial color="#b9c5d6" />
      </mesh>

      {towers.map((tower) => (
        <SeoulTower key={tower.id} {...tower} />
      ))}
    </group>
  );
}

export default function Apt1() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '540px' }}>
      <Canvas shadows camera={{ position: [32, 18, 34], fov: 45 }}>
        <color attach="background" args={['#e7eef9']} />
        <fog attach="fog" args={['#e7eef9', 60, 120]} />

        <hemisphereLight intensity={0.4} color="#fdfdfc" groundColor="#d1d7dd" />
        <directionalLight
          position={[28, 32, 22]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
        />
        <directionalLight position={[-18, 20, -16]} intensity={0.35} color="#cdd5e3" />

        <ApartmentComplex />

        <OrbitControls target={[0, 5, 0]} maxPolarAngle={Math.PI / 2.18} minDistance={14} maxDistance={80} enableDamping />
      </Canvas>
    </div>
  );
}

