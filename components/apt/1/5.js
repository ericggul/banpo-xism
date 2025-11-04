'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useControls } from 'leva';
import * as THREE from 'three';

const mmToM = (value) => value / 1000;
const GROUND_LEVEL = -0.25;

// 116A plan dimensions derived from annotated drawing (mm converted to m).
const PLAN_WIDTH_PX = 620;
const PLAN_HEIGHT_PX = 519;
const PLAN_WIDTH_M = mmToM(13725);
const PLAN_DEPTH_M = mmToM(11660);
const SCALE_X = PLAN_WIDTH_M / PLAN_WIDTH_PX;
const SCALE_Z = PLAN_DEPTH_M / PLAN_HEIGHT_PX;

const SLAB_THICKNESS_SCALE = 0.15;
const STORY_GAP = 0.3;
const SLAB_FOOTPRINT_MARGIN = 0.35;
const UNIT_GEOMETRY_EPS = 0.02;

// Rectangles traced from the color-coded 116A SVG.
const UNIT_RECT_DEFS = [
  { id: 'balcony-west', zone: 'balcony', x: 57, y: 145, width: 81, height: 102 },
  { id: 'balcony-east', zone: 'balcony', x: 504, y: 62, width: 116, height: 83 },
  { id: 'utility-west', zone: 'utility', x: 0, y: 456, width: 24, height: 63 },
  { id: 'utility-east', zone: 'utility', x: 504, y: 0, width: 67, height: 62 },
  { id: 'bedroom-west-outer', zone: 'bedroom', x: 0, y: 279, width: 90, height: 177 },
  { id: 'bedroom-west-inner', zone: 'bedroom', x: 24, y: 310, width: 114, height: 209 },
  { id: 'bedroom-east-inner', zone: 'bedroom', x: 352, y: 310, width: 152, height: 209 },
  { id: 'bedroom-east-outer', zone: 'bedroom', x: 418, y: 145, width: 202, height: 165 },
  { id: 'bedroom-front', zone: 'bedroom', x: 418, y: 0, width: 86, height: 145 },
  { id: 'loggia-east', zone: 'loggia', x: 504, y: 310, width: 116, height: 58 },
  { id: 'kitchen', zone: 'kitchen', x: 216, y: 0, width: 202, height: 106 },
  { id: 'living-west', zone: 'living', x: 138, y: 310, width: 214, height: 209 },
  { id: 'living-central', zone: 'living', x: 90, y: 247, width: 328, height: 63 },
  { id: 'living-east', zone: 'living', x: 234, y: 106, width: 184, height: 141 },
  { id: 'foyer', zone: 'foyer', x: 138, y: 181, width: 96, height: 66 },
  { id: 'core-east', zone: 'core', x: 571, y: 0, width: 49, height: 62 },
  { id: 'core-mid', zone: 'core', x: 369, y: 0, width: 49, height: 40 },
  { id: 'core-center', zone: 'core', x: 216, y: 0, width: 30, height: 40 },
  { id: 'core-west', zone: 'core', x: 57, y: 247, width: 33, height: 32 },
];

const DEFAULT_ZONE_COLORS = {
  living: '#F1BD68',
  bedroom: '#F7E9C2',
  balcony: '#E5F2F8',
  kitchen: '#FCF2E6',
  utility: '#D9D9D9',
  loggia: '#FBF2E3',
  foyer: '#FAFAFA',
  core: '#3E403F',
  plinth: '#C7CAC4',
};

const BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);

const SINGLE_UNIT_RECTS = UNIT_RECT_DEFS.map((rect) => {
  const centerX = (rect.x + rect.width / 2 - PLAN_WIDTH_PX / 2) * SCALE_X;
  const centerZ = (PLAN_HEIGHT_PX / 2 - (rect.y + rect.height / 2)) * SCALE_Z;
  return {
    zone: rect.zone,
    centerX,
    centerZ,
    width: rect.width * SCALE_X,
    depth: rect.height * SCALE_Z,
  };
});

function buildDoubleRectBase() {
  const result = [];
  SINGLE_UNIT_RECTS.forEach((rect) => {
    result.push({ ...rect });
    if (Math.abs(rect.centerX) > 1e-6) {
      result.push({ ...rect, centerX: -rect.centerX });
    }
  });
  return result;
}

const DOUBLE_RECT_BASE = buildDoubleRectBase();

function buildPlanPoints(rects) {
  const points = [];
  rects.forEach(({ centerX, centerZ, width, depth }) => {
    const hx = width / 2;
    const hz = depth / 2;
    points.push({ x: centerX - hx, z: centerZ - hz });
    points.push({ x: centerX + hx, z: centerZ - hz });
    points.push({ x: centerX + hx, z: centerZ + hz });
    points.push({ x: centerX - hx, z: centerZ + hz });
  });
  return points;
}

function computeConvexHull(points) {
  if (points.length <= 3) return points.slice();
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.z - b.z : a.x - b.x));

  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

  const lower = [];
  sorted.forEach((point) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  });

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

const DONG_PLAN_POINTS = buildPlanPoints(DOUBLE_RECT_BASE);
const DONG_HULL_POINTS = computeConvexHull(DONG_PLAN_POINTS);
const DONG_HALF_EXTENTS = DONG_HULL_POINTS.reduce(
  (acc, point) => ({
    x: Math.max(acc.x, Math.abs(point.x)),
    z: Math.max(acc.z, Math.abs(point.z)),
  }),
  { x: 0, z: 0 },
);
const DONG_WIDTH = DONG_HALF_EXTENTS.x * 2;
const DONG_DEPTH = DONG_HALF_EXTENTS.z * 2;

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

function useHullGeometry(hullPoints, height, margin = 0) {
  return useMemo(() => {
    if (!hullPoints || hullPoints.length === 0) {
      return new THREE.BoxGeometry(1, height, 1);
    }

    const centroid = hullPoints.reduce(
      (acc, point) => {
        acc.x += point.x;
        acc.z += point.z;
        return acc;
      },
      { x: 0, z: 0 },
    );

    centroid.x /= hullPoints.length;
    centroid.z /= hullPoints.length;

    const expanded = hullPoints.map((point) => {
      if (margin <= 0) return point;
      const dirX = point.x - centroid.x;
      const dirZ = point.z - centroid.z;
      const length = Math.hypot(dirX, dirZ) || 1;
      return {
        x: point.x + (dirX / length) * margin,
        z: point.z + (dirZ / length) * margin,
      };
    });

    const shape = new THREE.Shape();
    expanded.forEach(({ x, z }, index) => {
      if (index === 0) {
        shape.moveTo(x, z);
      } else {
        shape.lineTo(x, z);
      }
    });
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: height,
      bevelEnabled: false,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, height / 2, 0);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.computeVertexNormals();
    return geometry;
  }, [hullPoints, height, margin]);
}

function ZoneInstancedMesh({ geometry, material, transforms, castShadow = true, receiveShadow = true }) {
  const ref = useRef();
  useInstancedLayout(ref, transforms);

  if (transforms.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, transforms.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      matrixAutoUpdate={false}
    >
      <primitive attach="material" object={material} />
    </instancedMesh>
  );
}

function MinimalTower({ config, palette, zoneMaterials, position }) {
  const { floors, floorHeight } = config;

  const slabThickness = Math.min(0.45, floorHeight * SLAB_THICKNESS_SCALE);
  const storyHeight = Math.max(0.5, floorHeight - STORY_GAP);
  const unitHeight = Math.max(0.3, storyHeight - UNIT_GEOMETRY_EPS);

  const slabGeometry = useHullGeometry(DONG_HULL_POINTS, slabThickness, SLAB_FOOTPRINT_MARGIN);

  const baseRectTransforms = useMemo(
    () =>
      DOUBLE_RECT_BASE.map((rect) => ({
        zone: rect.zone,
        position: [rect.centerX, 0, rect.centerZ],
        scale: [rect.width, unitHeight, rect.depth],
      })),
    [unitHeight],
  );

  const floorCenters = useMemo(() => {
    const centers = [];
    for (let level = 0; level < floors; level += 1) {
      const levelBase = GROUND_LEVEL + slabThickness + level * floorHeight;
      centers.push(levelBase + storyHeight / 2);
    }
    return centers;
  }, [floors, floorHeight, slabThickness, storyHeight]);

  const zoneTransforms = useMemo(() => {
    const map = new Map();
    floorCenters.forEach((y) => {
      baseRectTransforms.forEach((rect) => {
        if (!map.has(rect.zone)) {
          map.set(rect.zone, []);
        }
        map.get(rect.zone).push({
          position: [rect.position[0], y, rect.position[2]],
          scale: rect.scale,
        });
      });
    });
    return map;
  }, [baseRectTransforms, floorCenters]);

  const zoneEntries = useMemo(() => Array.from(zoneTransforms.entries()), [zoneTransforms]);

  return (
    <group position={position}>
      <mesh
        geometry={slabGeometry}
        position={[0, GROUND_LEVEL + slabThickness / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette.plinth} roughness={0.82} metalness={0.04} />
      </mesh>

      {zoneEntries.map(([zone, transforms]) => (
        <ZoneInstancedMesh
          key={zone}
          geometry={BOX_GEOMETRY}
          material={zoneMaterials[zone]}
          transforms={transforms}
          castShadow={zone !== 'balcony' && zone !== 'loggia'}
          receiveShadow
        />
      ))}
    </group>
  );
}

function ApartmentComplex({ layoutConfig, palette, zoneMaterials }) {
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
          config={{ floors, floorHeight }}
          palette={palette}
          zoneMaterials={zoneMaterials}
          position={position}
        />
      ))}
    </group>
  );
}

export default function AptComplex116A() {
  const controls = useControls('Apartment', {
    floors: { value: 28, min: 12, max: 45, step: 1 },
    floorHeight: { value: 3.05, min: 2.6, max: 3.6, step: 0.05, label: 'Floor Height (m)' },
    rows: { value: 4, min: 1, max: 6, step: 1 },
    columns: { value: 3, min: 1, max: 6, step: 1 },
    towerGapX: { value: 8, min: 3, max: 20, step: 0.5, label: 'Gap X (m)' },
    towerGapZ: { value: 12, min: 3, max: 20, step: 0.5, label: 'Gap Z (m)' },
    livingColor: { value: DEFAULT_ZONE_COLORS.living, label: 'Living Color' },
    bedroomColor: { value: DEFAULT_ZONE_COLORS.bedroom, label: 'Bedroom Color' },
    balconyColor: { value: DEFAULT_ZONE_COLORS.balcony, label: 'Balcony Color' },
    kitchenColor: { value: DEFAULT_ZONE_COLORS.kitchen, label: 'Kitchen Color' },
    utilityColor: { value: DEFAULT_ZONE_COLORS.utility, label: 'Utility Color' },
    loggiaColor: { value: DEFAULT_ZONE_COLORS.loggia, label: 'Loggia Color' },
    foyerColor: { value: DEFAULT_ZONE_COLORS.foyer, label: 'Foyer Color' },
    coreColor: { value: DEFAULT_ZONE_COLORS.core, label: 'Core Color' },
    plinthColor: { value: DEFAULT_ZONE_COLORS.plinth, label: 'Podium Color' },
  });

  const palette = useMemo(
    () => ({
      living: controls.livingColor,
      bedroom: controls.bedroomColor,
      balcony: controls.balconyColor,
      kitchen: controls.kitchenColor,
      utility: controls.utilityColor,
      loggia: controls.loggiaColor,
      foyer: controls.foyerColor,
      core: controls.coreColor,
      plinth: controls.plinthColor,
    }),
    [
      controls.livingColor,
      controls.bedroomColor,
      controls.balconyColor,
      controls.kitchenColor,
      controls.utilityColor,
      controls.loggiaColor,
      controls.foyerColor,
      controls.coreColor,
      controls.plinthColor,
    ],
  );

  const zoneMaterials = useMemo(
    () => ({
      living: new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.05 }),
      bedroom: new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.04 }),
      balcony: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 }),
      kitchen: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.12 }),
      utility: new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.02 }),
      loggia: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.06 }),
      foyer: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.05 }),
      core: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.02 }),
    }),
    [],
  );

  useEffect(() => () => {
    Object.values(zoneMaterials).forEach((material) => material.dispose());
  }, [zoneMaterials]);

  useEffect(() => {
    zoneMaterials.living.color.set(palette.living);
    zoneMaterials.bedroom.color.set(palette.bedroom);
    zoneMaterials.balcony.color.set(palette.balcony);
    zoneMaterials.kitchen.color.set(palette.kitchen);
    zoneMaterials.utility.color.set(palette.utility);
    zoneMaterials.loggia.color.set(palette.loggia);
    zoneMaterials.foyer.color.set(palette.foyer);
    zoneMaterials.core.color.set(palette.core);
  }, [palette, zoneMaterials]);

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
    const spanWidth = DONG_WIDTH + Math.max(0, controls.columns - 1) * (DONG_WIDTH + controls.towerGapX);
    const spanDepth = DONG_DEPTH + Math.max(0, controls.rows - 1) * (DONG_DEPTH + controls.towerGapZ);
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

        <ApartmentComplex layoutConfig={layoutConfig} palette={palette} zoneMaterials={zoneMaterials} />

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
