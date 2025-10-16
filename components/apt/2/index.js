'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function applyInstancedTransforms(mesh, transforms) {
  const dummy = new THREE.Object3D();

  transforms.forEach((transform, index) => {
    const [px, py, pz] = transform.position;
    const [rx, ry, rz] = transform.rotation ?? [0, 0, 0];
    const [sx, sy, sz] = transform.scale ?? [1, 1, 1];

    dummy.position.set(px, py, pz);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
}

function ApartmentBlock() {
  const windowsRef = useRef(null);
  const railingRef = useRef(null);

  const {
    windowTransforms,
    railingTransforms,
    podiumHeight,
    towerHeight,
    towerCenterY,
    groupOffset,
  } = useMemo(() => {
    const floorCount = 16;
    const floorHeight = 0.55;
    const podiumHeightLocal = 1.2;
    const groundLevel = -2;
    const towerHeightLocal = floorCount * floorHeight + 1.1;
    const towerCenterLocal = groundLevel + podiumHeightLocal + towerHeightLocal / 2;
    const baseWindowY = groundLevel + podiumHeightLocal + 0.35;
    const columnSpacing = 0.9;
    const depthSpacing = 0.9;

    const transforms = [];
    const railing = [];

    const addFacade = ({
      columns,
      floors = floorCount,
      start,
      right,
      up,
      rotation = [0, 0, 0],
      balcony = false,
    }) => {
      for (let floor = 0; floor < floors; floor += 1) {
        for (let column = 0; column < columns; column += 1) {
          const px = start[0] + right[0] * column + up[0] * floor;
          const py = start[1] + right[1] * column + up[1] * floor;
          const pz = start[2] + right[2] * column + up[2] * floor;

          transforms.push({
            position: [px, py, pz],
            rotation,
          });

          if (balcony && floor % 2 === 1) {
            const balconyY = py - 0.18;
            railing.push({
              position: [px, balconyY, pz + (rotation[1] === 0 ? 0.28 : 0)],
              rotation,
            });
          }
        }
      }
    };

    const wingXCenter = -6;
    const wingZCenter = 6;
    const halfDepth = 1.7;

    const wingXColumns = 12;
    const wingXStartX = wingXCenter - ((wingXColumns - 1) * columnSpacing) / 2;

    addFacade({
      columns: wingXColumns,
      start: [wingXStartX, baseWindowY, halfDepth + 0.2],
      right: [columnSpacing, 0, 0],
      up: [0, floorHeight, 0],
      rotation: [0, 0, 0],
      balcony: true,
    });

    addFacade({
      columns: wingXColumns,
      start: [wingXStartX, baseWindowY, -halfDepth - 0.2],
      right: [columnSpacing, 0, 0],
      up: [0, floorHeight, 0],
      rotation: [0, Math.PI, 0],
    });

    const wingZColumns = 12;
    const wingZStartZ = wingZCenter - ((wingZColumns - 1) * depthSpacing) / 2;

    addFacade({
      columns: wingZColumns,
      start: [halfDepth + 0.2, baseWindowY, wingZStartZ],
      right: [0, 0, depthSpacing],
      up: [0, floorHeight, 0],
      rotation: [0, Math.PI / 2, 0],
      balcony: true,
    });

    addFacade({
      columns: wingZColumns,
      start: [-halfDepth - 0.2, baseWindowY, wingZStartZ],
      right: [0, 0, depthSpacing],
      up: [0, floorHeight, 0],
      rotation: [0, -Math.PI / 2, 0],
    });

    const minX = -12;
    const maxX = 1.7;
    const minZ = -1.7;
    const maxZ = 12;
    const offsetX = (maxX + minX) / 2;
    const offsetZ = (maxZ + minZ) / 2;

    return {
      windowTransforms: transforms,
      railingTransforms: railing,
      podiumHeight: podiumHeightLocal,
      towerHeight: towerHeightLocal,
      towerCenterY: towerCenterLocal,
      groupOffset: [-offsetX, 0, -offsetZ],
    };
  }, []);

  useEffect(() => {
    if (windowsRef.current) {
      applyInstancedTransforms(windowsRef.current, windowTransforms);
    }
    if (railingRef.current) {
      applyInstancedTransforms(railingRef.current, railingTransforms);
    }
  }, [windowTransforms, railingTransforms]);

  const roofHeight = 0.6;
  const crownHeight = 1.1;

  return (
    <group position={groupOffset}>
      <mesh position={[-4.8, -2 + podiumHeight / 2, 4.2]}>
        <boxGeometry args={[18, podiumHeight, 14]} />
        <meshStandardMaterial color="#d6dbe4" />
      </mesh>
      <mesh position={[-6, towerCenterY, 0]}>
        <boxGeometry args={[12, towerHeight, 3.4]} />
        <meshStandardMaterial color="#ecf0f5" />
      </mesh>
      <mesh position={[0, towerCenterY, 6]}>
        <boxGeometry args={[3.4, towerHeight, 12]} />
        <meshStandardMaterial color="#e5e9f1" />
      </mesh>
      <mesh position={[-2.4, 1.2, 2.4]}>
        <boxGeometry args={[7, 2.4, 7]} />
        <meshStandardMaterial color="#ccd5e1" />
      </mesh>
      <mesh position={[-1.2, towerCenterY, 1.2]}>
        <boxGeometry args={[2, towerHeight + 0.8, 2]} />
        <meshStandardMaterial color="#a9bcd3" metalness={0.2} roughness={0.35} />
      </mesh>
      <mesh position={[-6, towerCenterY + towerHeight / 2 + roofHeight / 2, 0]}>
        <boxGeometry args={[12.2, roofHeight, 3.6]} />
        <meshStandardMaterial color="#f6f7f9" />
      </mesh>
      <mesh position={[0, towerCenterY + towerHeight / 2 + roofHeight / 2, 6]}>
        <boxGeometry args={[3.6, roofHeight, 12.2]} />
        <meshStandardMaterial color="#f6f7f9" />
      </mesh>
      <mesh position={[-3, towerCenterY + towerHeight / 2 + roofHeight + crownHeight / 2, 3]}>
        <boxGeometry args={[8.5, crownHeight, 8.5]} />
        <meshStandardMaterial color="#e3e7ee" emissive="#bcc7d6" emissiveIntensity={0.03} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4.8, -1.4, 8]}>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial color="#e8ecef" />
      </mesh>
      <instancedMesh ref={windowsRef} args={[null, null, windowTransforms.length]}>
        <boxGeometry args={[0.7, 0.42, 0.08]} />
        <meshStandardMaterial
          color="#7f8ea7"
          emissive="#1f2a3b"
          emissiveIntensity={0.07}
          metalness={0.1}
          roughness={0.35}
        />
      </instancedMesh>
      <instancedMesh ref={railingRef} args={[null, null, railingTransforms.length]}>
        <boxGeometry args={[0.74, 0.08, 0.32]} />
        <meshStandardMaterial color="#c9d4de" roughness={0.6} metalness={0.05} />
      </instancedMesh>
    </group>
  );
}

function Landscape() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color="#f4f6f8" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.98, 8]}>
        <planeGeometry args={[18, 10]} />
        <meshStandardMaterial color="#d9e2e1" />
      </mesh>
      <mesh position={[0, -1.75, 10]}>
        <boxGeometry args={[2.4, 0.5, 2.4]} />
        <meshStandardMaterial color="#8f9f71" />
      </mesh>
    </group>
  );
}

export default function Apt2() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '520px' }}>
      <Canvas camera={{ position: [18, 10, 18], fov: 45 }}>
        <color attach="background" args={['#f5f7fa']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[14, 18, 12]} intensity={1.1} castShadow />
        <ApartmentBlock />
        <Landscape />
        <OrbitControls target={[0, 3.2, 0]} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
    </div>
  );
}
