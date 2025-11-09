'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const GROUND_LEVEL = -2.2;

const BASE_CONFIG = {
  floors: 20,
  mainColumns: 9,
  sideColumns: 6,
  depthSegments: 2,
  moduleWidth: 2.9,
  moduleHeight: 0.98,
  moduleDepth: 1.28,
  spacingX: 2.9 + 0.18,
  spacingY: 0.98 + 0.16,
  spacingZ: 1.28 + 0.28,
  podiumHeight: 1.1,
};

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

function MinimalStackedSlab() {
  const {
    floors,
    mainColumns,
    sideColumns,
    depthSegments,
    moduleWidth,
    moduleHeight,
    moduleDepth,
    spacingX,
    spacingY,
    spacingZ,
    podiumHeight,
  } = BASE_CONFIG;

  const palette = {
    unit: '#d8d9d5',
    frame: '#b7bbb6',
    window: '#9aa7b5',
    slab: '#c9cbc7',
    podium: '#d5d7d3',
    connector: '#aeb5be',
    ground: '#ececeb',
  };

  const towerBaseY = GROUND_LEVEL + podiumHeight;
  const towerHeight = floors * spacingY + moduleHeight;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const unitRef = useRef();
  const windowRef = useRef();
  const frameRef = useRef();
  const slabRef = useRef();

  const {
    unitTransforms,
    windowTransforms,
    frameTransforms,
    slabTransforms,
    podiumTransform,
    connectorTransforms,
  } = useMemo(() => {
    const units = [];
    const windows = [];
    const frames = [];
    const slabs = [];
    const connectors = [];

    const bounds = {
      minX: Infinity,
      maxX: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    };

    const recordBounds = (position, scale) => {
      if (!position || !scale) return;
      const halfX = scale[0] / 2;
      const halfZ = scale[2] / 2;
      const minX = position[0] - halfX;
      const maxX = position[0] + halfX;
      const minZ = position[2] - halfZ;
      const maxZ = position[2] + halfZ;
      if (minX < bounds.minX) bounds.minX = minX;
      if (maxX > bounds.maxX) bounds.maxX = maxX;
      if (minZ < bounds.minZ) bounds.minZ = minZ;
      if (maxZ > bounds.maxZ) bounds.maxZ = maxZ;
    };

    const paneOffsets = [-moduleWidth * 0.28, moduleWidth * 0.28];
    const windowPaneWidth = moduleWidth * 0.36;
    const windowPaneHeight = moduleHeight * 0.64;
    const windowThickness = Math.min(moduleDepth * 0.32, 0.4);
    const windowInset = Math.min(moduleDepth * 0.26, 0.3);
    const windowSill = moduleHeight * 0.22;
    const frameThickness = moduleWidth * 0.22;
    const frameDepth = Math.min(moduleDepth * 0.24, 0.36);
    const slabThickness = 0.12;

    const wingConfigs = [
      {
        key: 'main',
        columns: mainColumns,
        depthCount: depthSegments,
        axisIndex: 0,
        depthIndex: 2,
        axisStart: moduleWidth / 2,
        depthStart: moduleDepth / 2,
        axisDirection: 1,
        depthDirection: 1,
        unitScale: [moduleWidth, moduleHeight, moduleDepth],
        windowScale: [windowPaneWidth, windowPaneHeight, windowThickness],
        frameScale: [frameThickness, towerHeight, frameDepth],
      },
      {
        key: 'side',
        columns: sideColumns,
        depthCount: depthSegments,
        axisIndex: 2,
        depthIndex: 0,
        axisStart: moduleWidth / 2,
        depthStart: -moduleDepth / 2,
        axisDirection: 1,
        depthDirection: -1,
        unitScale: [moduleDepth, moduleHeight, moduleWidth],
        windowScale: [windowThickness, windowPaneHeight, windowPaneWidth],
        frameScale: [frameDepth, towerHeight, frameThickness],
      },
    ];

    wingConfigs.forEach((wing) => {
      const axisSpan = (wing.columns - 1) * spacingX;
      const depthSpan = (wing.depthCount - 1) * spacingZ;
      const axisCenter = wing.axisStart + wing.axisDirection * axisSpan / 2;
      const depthCenter = wing.depthStart + wing.depthDirection * depthSpan / 2;
      const wingAxisExtent = axisSpan + moduleWidth;
      const wingDepthExtent = depthSpan + moduleDepth;

      for (let floor = 0; floor <= floors; floor += 1) {
        const slabY = towerBaseY + floor * spacingY - moduleHeight * 0.08;
        const slabScale = wing.axisIndex === 0
          ? [wingAxisExtent * 1.02, slabThickness, wingDepthExtent * 1.02]
          : [wingDepthExtent * 1.02, slabThickness, wingAxisExtent * 1.02];
        const slabPosition = [0, slabY, 0];
        slabPosition[wing.axisIndex] = axisCenter;
        slabPosition[wing.depthIndex] = depthCenter;
        slabs.push({ position: slabPosition, scale: slabScale });
        recordBounds(slabPosition, slabScale);
      }

      for (let depthIndex = 0; depthIndex < wing.depthCount; depthIndex += 1) {
        const centerDepth = wing.depthStart + wing.depthDirection * depthIndex * spacingZ;

        for (let column = 0; column < wing.columns; column += 1) {
          const centerAxis = wing.axisStart + wing.axisDirection * column * spacingX;

          for (let floor = 0; floor < floors; floor += 1) {
            const centerY = towerBaseY + floor * spacingY + moduleHeight / 2;
            const unitPosition = [0, centerY, 0];
            unitPosition[wing.axisIndex] = centerAxis;
            unitPosition[wing.depthIndex] = centerDepth;
            const unitTransform = { position: unitPosition, scale: wing.unitScale };
            units.push(unitTransform);
            recordBounds(unitPosition, wing.unitScale);

            const windowY = centerY - moduleHeight / 2 + windowSill + windowPaneHeight / 2;
            const depthSize = wing.unitScale[wing.depthIndex];
            const insideFace = centerDepth - wing.depthDirection * (depthSize / 2);
            const outerFace = centerDepth + wing.depthDirection * (depthSize / 2);
            const faces = [
              insideFace + wing.depthDirection * windowInset,
              outerFace - wing.depthDirection * windowInset,
            ];

            faces.forEach((plane) => {
              paneOffsets.forEach((offset) => {
                const windowPosition = [0, windowY, 0];
                windowPosition[wing.axisIndex] = centerAxis + offset;
                windowPosition[wing.depthIndex] = plane;
                windows.push({
                  position: windowPosition,
                  scale: wing.windowScale,
                });
              });
            });
          }
        }
      }

      const depthSize = wing.unitScale[wing.depthIndex];
      const insideFace = wing.depthStart - wing.depthDirection * (depthSize / 2);
      const outerCenter = wing.depthStart + wing.depthDirection * (wing.depthCount - 1) * spacingZ;
      const outerFace = outerCenter + wing.depthDirection * (depthSize / 2);

      for (let column = 0; column < wing.columns; column += 1) {
        const centerAxis = wing.axisStart + wing.axisDirection * column * spacingX;

        const innerFramePosition = [0, towerCenterY, 0];
        innerFramePosition[wing.axisIndex] = centerAxis;
        innerFramePosition[wing.depthIndex] = insideFace + wing.depthDirection * (frameDepth / 2);
        frames.push({ position: innerFramePosition, scale: wing.frameScale });
        recordBounds(innerFramePosition, wing.frameScale);

        const outerFramePosition = [0, towerCenterY, 0];
        outerFramePosition[wing.axisIndex] = centerAxis;
        outerFramePosition[wing.depthIndex] = outerFace - wing.depthDirection * (frameDepth / 2);
        frames.push({ position: outerFramePosition, scale: wing.frameScale });
        recordBounds(outerFramePosition, wing.frameScale);
      }
    });

    connectors.push({
      position: [moduleDepth * 0.6, towerBaseY + floors * spacingY * 0.45, moduleDepth * 0.6],
      scale: [moduleWidth * 1.4, moduleHeight * 0.5, moduleWidth * 1.4],
    });

    const podiumWidth = bounds.maxX - bounds.minX + moduleWidth * 0.8;
    const podiumDepth = bounds.maxZ - bounds.minZ + moduleWidth * 0.8;
    const podiumTransform = {
      position: [
        (bounds.minX + bounds.maxX) / 2,
        GROUND_LEVEL + podiumHeight / 2,
        (bounds.minZ + bounds.maxZ) / 2,
      ],
      scale: [podiumWidth, podiumHeight, podiumDepth],
    };

    return {
      unitTransforms: units,
      windowTransforms: windows,
      frameTransforms: frames,
      slabTransforms: slabs,
      podiumTransform,
      connectorTransforms: connectors,
    };
  }, []);

  useInstancedLayout(unitRef, unitTransforms);
  useInstancedLayout(windowRef, windowTransforms);
  useInstancedLayout(frameRef, frameTransforms);
  useInstancedLayout(slabRef, slabTransforms);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={palette.ground} />
      </mesh>

      <mesh position={podiumTransform.position} scale={podiumTransform.scale} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.podium} roughness={0.9} />
      </mesh>

      {connectorTransforms.map((transform, index) => (
        <mesh key={`connector-${index}`} position={transform.position} scale={transform.scale} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.connector} roughness={0.64} metalness={0.08} />
        </mesh>
      ))}

      {slabTransforms.length > 0 && (
        <instancedMesh ref={slabRef} args={[null, null, slabTransforms.length]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.slab} roughness={0.8} />
        </instancedMesh>
      )}

      {frameTransforms.length > 0 && (
        <instancedMesh ref={frameRef} args={[null, null, frameTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.frame} roughness={0.72} />
        </instancedMesh>
      )}

      {unitTransforms.length > 0 && (
        <instancedMesh ref={unitRef} args={[null, null, unitTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.unit} roughness={0.86} metalness={0.04} />
        </instancedMesh>
      )}

      {windowTransforms.length > 0 && (
        <instancedMesh ref={windowRef} args={[null, null, windowTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.window} roughness={0.32} metalness={0.35} />
        </instancedMesh>
      )}
    </group>
  );
}

export default function Apt15() {
  const {
    floors,
    mainColumns,
    sideColumns,
    depthSegments,
    moduleWidth,
    moduleHeight,
    moduleDepth,
    spacingX,
    spacingY,
    spacingZ,
    podiumHeight,
  } = BASE_CONFIG;

  const towerBaseY = GROUND_LEVEL + podiumHeight;
  const towerHeight = floors * spacingY + moduleHeight;

  const minX = -moduleDepth - (depthSegments - 1) * spacingZ;
  const maxX = moduleWidth + (mainColumns - 1) * spacingX;
  const minZ = 0;
  const maxZ = moduleWidth + (sideColumns - 1) * spacingX;

  const targetX = (minX + maxX) / 2;
  const targetZ = (minZ + maxZ) / 2;
  const targetY = towerBaseY + towerHeight * 0.4;

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '480px' }}>
      <Canvas shadows camera={{ position: [34, 20, 32], fov: 45 }}>
        <color attach="background" args={['#f3f5f7']} />
        <fog attach="fog" args={['#eef1f4', 60, 120]} />

        <hemisphereLight intensity={0.52} color="#fdfcf8" groundColor="#d8d8d4" />
        <directionalLight
          position={[32, 34, 26]}
          intensity={1.26}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-54}
          shadow-camera-right={54}
          shadow-camera-top={36}
          shadow-camera-bottom={-54}
        />
        <ambientLight intensity={0.24} />

        <MinimalStackedSlab />

        <OrbitControls
          target={[targetX, targetY, targetZ]}
          maxPolarAngle={Math.PI / 2.08}
          minDistance={12}
          maxDistance={80}
          enableDamping
        />
      </Canvas>
    </div>
  );
}
