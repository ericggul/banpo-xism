'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import { useControls } from 'leva';
import * as THREE from 'three';

const mmToM = (value) => value / 1000;
const GROUND_LEVEL = -0.25;

// Floor-plate outline for a single Banpo Xi 35평형 unit (clockwise, mm coordinates).
// Source: public floor plan resources referenced in the brief.
const FLOOR_PLAN_MM = [
  [-6862.5, -5830],
  [6862.5, -5830],
  [6862.5, -1200],
  [5680, -1200],
  [5680, 1760],
  [6250, 1760],
  [6250, 4380],
  [3620, 4380],
  [3620, 5830],
  [2480, 5830],
  [2480, 3980],
  [-3180, 3980],
  [-3180, 5830],
  [-5580, 5830],
  [-5580, 4280],
  [-6300, 4280],
  [-6300, 1600],
  [-6862.5, 1600],
];

const FOOTPRINT_POINTS = FLOOR_PLAN_MM.map(([x, z]) => [mmToM(x), mmToM(z)]);

const FOOTPRINT_BOUNDS = FOOTPRINT_POINTS.reduce(
  (acc, [x, z]) => {
    acc.minX = Math.min(acc.minX, x);
    acc.maxX = Math.max(acc.maxX, x);
    acc.minZ = Math.min(acc.minZ, z);
    acc.maxZ = Math.max(acc.maxZ, z);
    return acc;
  },
  { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
);

const FOOTPRINT_WIDTH = FOOTPRINT_BOUNDS.maxX - FOOTPRINT_BOUNDS.minX;
const FOOTPRINT_DEPTH = FOOTPRINT_BOUNDS.maxZ - FOOTPRINT_BOUNDS.minZ;

// Typical Banpo Xi corridor core configuration (4 households per landing).
const CORE_SIZE = { width: 7.6, depth: 6.8 };
const CONNECTOR_LENGTH = 3.4;
const SLAB_THICKNESS_SCALE = 0.15;

const UNIT_HALF_WIDTH = FOOTPRINT_WIDTH / 2;
const UNIT_HALF_DEPTH = FOOTPRINT_DEPTH / 2;
const CORE_HALF_WIDTH = CORE_SIZE.width / 2;
const CORE_HALF_DEPTH = CORE_SIZE.depth / 2;

const STRUCTURE_HALF_WIDTH = CORE_HALF_WIDTH + CONNECTOR_LENGTH + UNIT_HALF_WIDTH;
const STRUCTURE_HALF_DEPTH = CORE_HALF_DEPTH + CONNECTOR_LENGTH + UNIT_HALF_DEPTH;

const DONG_WIDTH = STRUCTURE_HALF_WIDTH * 2;
const DONG_DEPTH = STRUCTURE_HALF_DEPTH * 2;

function useInstancedLayout(ref, transforms) {
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    if (transforms.length === 0) {
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }
    const dummy = new THREE.Object3D();
    transforms.forEach((transform, index) => {
      const {
        position = [0, 0, 0],
        rotation = [0, 0, 0],
        scale = [1, 1, 1],
      } = transform;

      dummy.position.set(position[0], position[1], position[2]);
      dummy.rotation.set(rotation[0], rotation[1], rotation[2]);
      dummy.scale.set(scale[0], scale[1], scale[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere?.();
    mesh.frustumCulled = false;
  }, [ref, transforms]);
}

const PODIUM_SCALE = 1.08;
const FACADE_MARGIN_X = 0.9;
const FACADE_MARGIN_Z = 0.9;
const TARGET_FRONT_MODULE = 3.1;
const TARGET_SIDE_MODULE = 3.4;
const WINDOW_SILL_RATIO = 0.22;
const MIN_SILL = 0.32;
const MIN_HEAD_CLEAR = 0.32;
const WINDOW_MIN_HEIGHT = 0.95;
const WINDOW_INSET = 0.12;
const FIN_WIDTH = 0.22;
const FIN_DEPTH = 0.32;
const FIN_OUTSET = 0.06;
const BELT_HEIGHT_RATIO = 0.16;
const BELT_DEPTH = 0.18;
const BELT_OUTSET = 0.03;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computeFacadeElements({ floors, floorHeight, towerWidth, towerDepth, baseY }) {
  const windowTransforms = [];
  const finTransforms = [];
  const beltTransforms = [];

  const halfWidth = towerWidth / 2;
  const halfDepth = towerDepth / 2;

  const frontSpan = Math.max(0.6, towerWidth - FACADE_MARGIN_X * 2);
  const sideSpan = Math.max(0.6, towerDepth - FACADE_MARGIN_Z * 2);

  const frontCols = Math.max(4, Math.round(frontSpan / TARGET_FRONT_MODULE));
  const sideCols = Math.max(3, Math.round(sideSpan / TARGET_SIDE_MODULE));

  const frontStep = frontCols > 1 ? frontSpan / (frontCols - 1) : frontSpan;
  const sideStep = sideCols > 1 ? sideSpan / (sideCols - 1) : sideSpan;

  const computeWindowWidth = (step, fallback) => Math.max(0.9, Math.min(step * 0.7, fallback));
  const frontWindowWidth = computeWindowWidth(frontStep, TARGET_FRONT_MODULE * 0.92);
  const sideWindowWidth = computeWindowWidth(sideStep, TARGET_SIDE_MODULE * 0.9);

  const headClear = Math.max(MIN_HEAD_CLEAR, floorHeight * 0.18);
  let sillHeight = Math.max(MIN_SILL, floorHeight * WINDOW_SILL_RATIO);
  let windowHeight = floorHeight - headClear - sillHeight;

  if (windowHeight < WINDOW_MIN_HEIGHT) {
    windowHeight = WINDOW_MIN_HEIGHT;
    const remaining = floorHeight - headClear - windowHeight;
    sillHeight = Math.max(MIN_SILL, remaining);
  }

  const centerYOffset = sillHeight + windowHeight / 2;

  const frontStartX = frontCols > 1 ? -halfWidth + FACADE_MARGIN_X : 0;
  const sideStartZ = sideCols > 1 ? -halfDepth + FACADE_MARGIN_Z : 0;

  const frontWindowZ = halfDepth - WINDOW_INSET;
  const backWindowZ = -frontWindowZ;
  const rightWindowX = halfWidth - WINDOW_INSET;
  const leftWindowX = -rightWindowX;

  for (let floorIndex = 0; floorIndex < floors; floorIndex += 1) {
    const y = baseY + floorIndex * floorHeight + centerYOffset;

    for (let col = 0; col < frontCols; col += 1) {
      const x = frontCols > 1 ? frontStartX + col * frontStep : 0;
      windowTransforms.push({
        position: [x, y, frontWindowZ],
        rotation: [0, 0, 0],
        scale: [frontWindowWidth, windowHeight, 1],
      });
      windowTransforms.push({
        position: [x, y, backWindowZ],
        rotation: [0, Math.PI, 0],
        scale: [frontWindowWidth, windowHeight, 1],
      });
    }

    for (let col = 0; col < sideCols; col += 1) {
      const z = sideCols > 1 ? sideStartZ + col * sideStep : 0;
      windowTransforms.push({
        position: [rightWindowX, y, z],
        rotation: [0, -Math.PI / 2, 0],
        scale: [sideWindowWidth, windowHeight, 1],
      });
      windowTransforms.push({
        position: [leftWindowX, y, z],
        rotation: [0, Math.PI / 2, 0],
        scale: [sideWindowWidth, windowHeight, 1],
      });
    }
  }

  const finHeight = floors * floorHeight;
  const finCenterY = baseY + finHeight / 2;
  const frontFinZ = halfDepth - FIN_DEPTH / 2 + FIN_OUTSET;
  const backFinZ = -frontFinZ;
  const rightFinX = halfWidth - FIN_DEPTH / 2 + FIN_OUTSET;
  const leftFinX = -rightFinX;

  const frontFinPositions = new Set();
  const sideFinPositions = new Set();

  const frontBoundaryOffset = frontCols > 1 ? frontStep / 2 : frontSpan / 2;
  const sideBoundaryOffset = sideCols > 1 ? sideStep / 2 : sideSpan / 2;

  frontFinPositions.add(frontStartX - frontBoundaryOffset);
  frontFinPositions.add(frontStartX + (frontCols - 1) * frontStep + frontBoundaryOffset);
  for (let i = 0; i < frontCols - 1; i += 1) {
    frontFinPositions.add(frontStartX + (i + 0.5) * frontStep);
  }

  sideFinPositions.add(sideStartZ - sideBoundaryOffset);
  sideFinPositions.add(sideStartZ + (sideCols - 1) * sideStep + sideBoundaryOffset);
  for (let i = 0; i < sideCols - 1; i += 1) {
    sideFinPositions.add(sideStartZ + (i + 0.5) * sideStep);
  }

  frontFinPositions.forEach((x) => {
    const clampedX = clamp(x, -halfWidth + 0.12, halfWidth - 0.12);
    finTransforms.push({
      position: [clampedX, finCenterY, frontFinZ],
      scale: [FIN_WIDTH, finHeight + 0.02, FIN_DEPTH],
    });
    finTransforms.push({
      position: [clampedX, finCenterY, backFinZ],
      scale: [FIN_WIDTH, finHeight + 0.02, FIN_DEPTH],
    });
  });

  sideFinPositions.forEach((z) => {
    const clampedZ = clamp(z, -halfDepth + 0.12, halfDepth - 0.12);
    finTransforms.push({
      position: [rightFinX, finCenterY, clampedZ],
      scale: [FIN_DEPTH, finHeight + 0.02, FIN_WIDTH],
    });
    finTransforms.push({
      position: [leftFinX, finCenterY, clampedZ],
      scale: [FIN_DEPTH, finHeight + 0.02, FIN_WIDTH],
    });
  });

  const beltHeight = Math.min(0.24, floorHeight * BELT_HEIGHT_RATIO);
  if (beltHeight > 0) {
    for (let level = 1; level < floors; level += 1) {
      const y = baseY + level * floorHeight;
      const frontScale = Math.max(0.6, towerWidth - FACADE_MARGIN_X * 0.4);
      const sideScale = Math.max(0.6, towerDepth - FACADE_MARGIN_Z * 0.4);

      beltTransforms.push({
        position: [0, y, halfDepth - BELT_DEPTH / 2 + BELT_OUTSET],
        scale: [frontScale, beltHeight, BELT_DEPTH],
      });
      beltTransforms.push({
        position: [0, y, -(halfDepth - BELT_DEPTH / 2 + BELT_OUTSET)],
        scale: [frontScale, beltHeight, BELT_DEPTH],
      });
      beltTransforms.push({
        position: [halfWidth - BELT_DEPTH / 2 + BELT_OUTSET, y, 0],
        scale: [BELT_DEPTH, beltHeight, sideScale],
      });
      beltTransforms.push({
        position: [-(halfWidth - BELT_DEPTH / 2 + BELT_OUTSET), y, 0],
        scale: [BELT_DEPTH, beltHeight, sideScale],
      });
    }
  }

  return { windowTransforms, finTransforms, beltTransforms };
}

function MinimalTower({ config, palette, position }) {
  const { floors, floorHeight, edgeColor } = config;

  const slabThickness = Math.min(0.45, floorHeight * SLAB_THICKNESS_SCALE);
  const towerHeight = Math.max(floorHeight * floors, floorHeight);
  const towerWidth = DONG_WIDTH;
  const towerDepth = DONG_DEPTH;

  const podiumWidth = towerWidth * PODIUM_SCALE;
  const podiumDepth = towerDepth * PODIUM_SCALE;

  const towerBaseY = GROUND_LEVEL + slabThickness;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const massGeometry = useMemo(
    () => new THREE.BoxGeometry(towerWidth, towerHeight, towerDepth),
    [towerWidth, towerHeight, towerDepth],
  );
  const podiumGeometry = useMemo(
    () => new THREE.BoxGeometry(podiumWidth, slabThickness, podiumDepth),
    [podiumWidth, podiumDepth, slabThickness],
  );
  const windowGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const finGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const beltGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  const { windowTransforms, finTransforms, beltTransforms } = useMemo(
    () =>
      computeFacadeElements({
        floors,
        floorHeight,
        towerWidth,
        towerDepth,
        baseY: towerBaseY,
      }),
    [floors, floorHeight, towerWidth, towerDepth, towerBaseY],
  );

  const massMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.mass,
        roughness: 0.7,
        metalness: 0.06,
      }),
    [palette.mass],
  );

  const podiumMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.plinth,
        roughness: 0.82,
        metalness: 0.04,
      }),
    [palette.plinth],
  );

  const finMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.fins,
        roughness: 0.6,
        metalness: 0.12,
      }),
    [palette.fins],
  );

  const beltMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.band,
        roughness: 0.64,
        metalness: 0.08,
      }),
    [palette.band],
  );

  const windowMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d8e2ef',
        emissive: '#32475b',
        emissiveIntensity: 0.08,
        roughness: 0.2,
        metalness: 0.68,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const windowRef = useRef();
  const finRef = useRef();
  const beltRef = useRef();

  useInstancedLayout(windowRef, windowTransforms);
  useInstancedLayout(finRef, finTransforms);
  useInstancedLayout(beltRef, beltTransforms);

  return (
    <group position={position}>
      <mesh
        geometry={podiumGeometry}
        position={[0, GROUND_LEVEL + slabThickness / 2, 0]}
        receiveShadow
      >
        <primitive attach="material" object={podiumMaterial} />
      </mesh>

      <mesh geometry={massGeometry} position={[0, towerCenterY, 0]} castShadow receiveShadow>
        <primitive attach="material" object={massMaterial} />
        <Edges color={edgeColor} threshold={20} />
      </mesh>

      {finTransforms.length > 0 && (
        <instancedMesh
          ref={finRef}
          args={[finGeometry, undefined, finTransforms.length]}
          castShadow
          receiveShadow
          matrixAutoUpdate={false}
        >
          <primitive attach="material" object={finMaterial} />
        </instancedMesh>
      )}

      {beltTransforms.length > 0 && (
        <instancedMesh
          ref={beltRef}
          args={[beltGeometry, undefined, beltTransforms.length]}
          castShadow
          receiveShadow
          matrixAutoUpdate={false}
        >
          <primitive attach="material" object={beltMaterial} />
        </instancedMesh>
      )}

      {windowTransforms.length > 0 && (
        <instancedMesh
          ref={windowRef}
          args={[windowGeometry, undefined, windowTransforms.length]}
          matrixAutoUpdate={false}
        >
          <primitive attach="material" object={windowMaterial} />
        </instancedMesh>
      )}
    </group>
  );
}

function ApartmentComplex({ layoutConfig, palette, edgeColor }) {
  const { floors, floorHeight, rows, columns, towerGapX, towerGapZ } = layoutConfig;

  const towerSpacingX = DONG_WIDTH + towerGapX;
  const towerSpacingZ = DONG_DEPTH + towerGapZ;

  const towerPlacements = useMemo(() => {
    const placements = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        placements.push({
          position: [
            (col - (columns - 1) / 2) * towerSpacingX,
            0,
            (row - (rows - 1) / 2) * towerSpacingZ,
          ],
        });
      }
    }
    return placements;
  }, [rows, columns, towerSpacingX, towerSpacingZ]);

  const spanWidth = DONG_WIDTH + Math.max(0, columns - 1) * towerSpacingX;
  const spanDepth = DONG_DEPTH + Math.max(0, rows - 1) * towerSpacingZ;
  const complexWidth = spanWidth + 24;
  const complexDepth = spanDepth + 24;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.06, 0]} receiveShadow>
        <planeGeometry args={[complexWidth, complexDepth]} />
        <meshStandardMaterial color="#e5e9e3" />
      </mesh>

      {towerPlacements.map(({ position }, index) => (
        <MinimalTower
          key={`tower-${index}`}
          config={{ floors, floorHeight, edgeColor }}
          palette={palette}
          position={position}
        />
      ))}
    </group>
  );
}

export default function AptComplex13() {
  const controls = useControls('Apartment', {
    floors: { value: 28, min: 12, max: 45, step: 1 },
    floorHeight: { value: 3.05, min: 2.6, max: 3.6, step: 0.05, label: 'Floor Height (m)' },
    rows: { value: 4, min: 1, max: 6, step: 1 },
    columns: { value: 3, min: 1, max: 6, step: 1 },
    towerGapX: { value: 8, min: 3, max: 20, step: 0.5, label: 'Gap X (m)' },
    towerGapZ: { value: 12, min: 3, max: 20, step: 0.5, label: 'Gap Z (m)' },
    unitColor: { value: '#d8dad7', label: 'Facade Mass' },
    coreColor: { value: '#c3c6c2', label: 'Vertical Fins' },
    corridorColor: { value: '#dfe1dd', label: 'Belt Panels' },
    plinthColor: { value: '#c7cac4', label: 'Podium' },
    edgeColor: { value: '#6e726e', label: 'Edge Highlight' },
  });

  const palette = useMemo(
    () => ({
      mass: controls.unitColor,
      fins: controls.coreColor,
      band: controls.corridorColor,
      plinth: controls.plinthColor,
    }),
    [
      controls.unitColor,
      controls.coreColor,
      controls.corridorColor,
      controls.plinthColor,
    ],
  );

  const layoutConfig = useMemo(
    () => ({
      floors: controls.floors,
      floorHeight: controls.floorHeight,
      rows: controls.rows,
      columns: controls.columns,
      towerGapX: controls.towerGapX,
      towerGapZ: controls.towerGapZ,
    }),
    [
      controls.floors,
      controls.floorHeight,
      controls.rows,
      controls.columns,
      controls.towerGapX,
      controls.towerGapZ,
    ],
  );

  const cameraSettings = useMemo(() => {
    const spanWidth =
      DONG_WIDTH + Math.max(0, controls.columns - 1) * (DONG_WIDTH + controls.towerGapX);
    const spanDepth =
      DONG_DEPTH + Math.max(0, controls.rows - 1) * (DONG_DEPTH + controls.towerGapZ);
    const height = controls.floorHeight * controls.floors;

    const radiusX = spanWidth * 0.75 + 14;
    const radiusZ = spanDepth * 0.95 + 16;
    const lookHeight = height * 0.58;
    const span = Math.max(spanWidth, spanDepth);

    return {
      position: [radiusX, height * 1.2, radiusZ],
      target: [0, lookHeight, 0],
      minDistance: Math.max(span * 0.45, 14),
      maxDistance: Math.max(span * 4.8, 80),
    };
  }, [
    controls.columns,
    controls.rows,
    controls.towerGapX,
    controls.towerGapZ,
    controls.floorHeight,
    controls.floors,
  ]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '560px' }}>
      <Canvas
        shadows
        camera={{
          position: cameraSettings.position,
          fov: 46,
          near: 0.1,
          far: 3000,
        }}
      >
        <color attach="background" args={['#f2f5f8']} />

        <hemisphereLight intensity={0.65} color="#f8f6f2" groundColor="#d0d0cc" />
        <directionalLight
          position={[110, 210, 140]}
          intensity={1.25}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-360}
          shadow-camera-right={360}
          shadow-camera-top={260}
          shadow-camera-bottom={-260}
          shadow-bias={-0.00012}
        />
        <ambientLight intensity={0.22} />

        <ApartmentComplex
          layoutConfig={layoutConfig}
          palette={palette}
          edgeColor={controls.edgeColor}
        />

        <OrbitControls
          target={cameraSettings.target}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={cameraSettings.minDistance}
          maxDistance={cameraSettings.maxDistance}
          enableDamping
        />
      </Canvas>
    </div>
  );
}
