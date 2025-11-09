'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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
const CONNECTOR_WIDTH = 2.8;
const CONNECTOR_GAP = 0.14; // leave a shadow margin to prevent z-fighting
const MIN_CONNECTOR_LENGTH = 0.6;
const CONNECTOR_LENGTH_GEOM = CONNECTOR_LENGTH - CONNECTOR_GAP;
const SLAB_THICKNESS_SCALE = 0.15;
const STORY_GAP = 0.3;
const SLAB_FOOTPRINT_MARGIN = 1.05;
const UNIT_GEOMETRY_EPS = 0.02;

const UNIT_HALF_WIDTH = FOOTPRINT_WIDTH / 2;
const UNIT_HALF_DEPTH = FOOTPRINT_DEPTH / 2;
const CORE_HALF_WIDTH = CORE_SIZE.width / 2;
const CORE_HALF_DEPTH = CORE_SIZE.depth / 2;

function rotatePoint(x, z, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos - z * sin,
    z: x * sin + z * cos,
  };
}

function addRectanglePoints(target, centerX, centerZ, halfWidth, halfDepth, rotation = 0) {
  const corners = [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ];
  corners.forEach(([cx, cz]) => {
    const rotated = rotatePoint(cx, cz, rotation);
    target.push({
      x: centerX + rotated.x,
      z: centerZ + rotated.z,
    });
  });
}

function computeConvexHull(points) {
  if (points.length <= 3) return points.slice();
  const sorted = [...points].sort((a, b) =>
    a.x === b.x ? a.z - b.z : a.x - b.x,
  );

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

function computeDongPlanPoints(unitLayout, connectorLayout) {
  const points = [];

  // Core footprint.
  addRectanglePoints(points, 0, 0, CORE_HALF_WIDTH, CORE_HALF_DEPTH);

  // Connector footprints.
  connectorLayout.forEach((connector) => {
    addRectanglePoints(
      points,
      connector.position[0],
      connector.position[2],
      connector.length / 2,
      CONNECTOR_WIDTH / 2,
      connector.rotation[1],
    );
  });

  // Household footprints.
  unitLayout.forEach((unit) => {
    const { position, planRotation } = unit;
    FOOTPRINT_POINTS.forEach(([px, pz]) => {
      const rotated = rotatePoint(px, pz, planRotation);
      points.push({
        x: position[0] + rotated.x,
        z: position[2] + rotated.z,
      });
    });
  });

  return points;
}

function computeBounds(points) {
  if (!points || points.length === 0) {
    return {
      minX: 0,
      maxX: 0,
      minZ: 0,
      maxZ: 0,
      width: 0,
      depth: 0,
    };
  }

  const bounds = points.reduce(
    (acc, point) => {
      acc.minX = Math.min(acc.minX, point.x);
      acc.maxX = Math.max(acc.maxX, point.x);
      acc.minZ = Math.min(acc.minZ, point.z);
      acc.maxZ = Math.max(acc.maxZ, point.z);
      return acc;
    },
    {
      minX: Infinity,
      maxX: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    },
  );

  bounds.width = bounds.maxX - bounds.minX;
  bounds.depth = bounds.maxZ - bounds.minZ;
  return bounds;
}

function buildDongLayout({
  unitSpread = {},
  unitAnglesDeg = {},
  dongRotationDeg = {},
}) {
  const spreadX = unitSpread.x ?? 0;
  const spreadY = unitSpread.y ?? 0;
  const spreadZ = unitSpread.z ?? 0;

  const unitAngleRadX = THREE.MathUtils.degToRad(unitAnglesDeg.x ?? 0);
  const unitAngleRadY = THREE.MathUtils.degToRad(unitAnglesDeg.y ?? 0);
  const unitAngleRadZ = THREE.MathUtils.degToRad(unitAnglesDeg.z ?? 0);

  const dongRotationRad = {
    x: THREE.MathUtils.degToRad(dongRotationDeg.x ?? 0),
    y: THREE.MathUtils.degToRad(dongRotationDeg.y ?? 0),
    z: THREE.MathUtils.degToRad(dongRotationDeg.z ?? 0),
  };

  const connectorLengthX = Math.max(MIN_CONNECTOR_LENGTH, CONNECTOR_LENGTH + spreadX);
  const connectorLengthZ = Math.max(MIN_CONNECTOR_LENGTH, CONNECTOR_LENGTH + spreadZ);

  const connectorGeomLengthX = Math.max(0.2, connectorLengthX - CONNECTOR_GAP);
  const connectorGeomLengthZ = Math.max(0.2, connectorLengthZ - CONNECTOR_GAP);

  const eastRadius = CORE_HALF_WIDTH + connectorLengthX + UNIT_HALF_WIDTH;
  const westRadius = eastRadius;
  const southRadius = CORE_HALF_DEPTH + connectorLengthZ + UNIT_HALF_DEPTH;
  const northRadius = southRadius;

  const baseYaw = {
    east: 0,
    west: Math.PI,
    south: -Math.PI / 2,
    north: Math.PI / 2,
  };

  const yawAdjust = {
    east: -1,
    west: 1,
    south: -1,
    north: 1,
  };

  const unitLayout = [
    {
      key: 'east',
      position: [eastRadius, spreadY, 0],
      planRotation: baseYaw.east + yawAdjust.east * unitAngleRadY,
      rotation: [unitAngleRadX, baseYaw.east + yawAdjust.east * unitAngleRadY, unitAngleRadZ],
    },
    {
      key: 'west',
      position: [-eastRadius, spreadY, 0],
      planRotation: baseYaw.west + yawAdjust.west * unitAngleRadY,
      rotation: [unitAngleRadX, baseYaw.west + yawAdjust.west * unitAngleRadY, unitAngleRadZ],
    },
    {
      key: 'south',
      position: [0, spreadY, southRadius],
      planRotation: baseYaw.south + yawAdjust.south * unitAngleRadY,
      rotation: [unitAngleRadX, baseYaw.south + yawAdjust.south * unitAngleRadY, unitAngleRadZ],
    },
    {
      key: 'north',
      position: [0, spreadY, -northRadius],
      planRotation: baseYaw.north + yawAdjust.north * unitAngleRadY,
      rotation: [unitAngleRadX, baseYaw.north + yawAdjust.north * unitAngleRadY, unitAngleRadZ],
    },
  ];

  const connectorLayout = [
    {
      key: 'east',
      position: [CORE_HALF_WIDTH + connectorLengthX / 2, spreadY, 0],
      rotation: [0, unitLayout[0].planRotation, 0],
      length: connectorLengthX,
      scale: [Math.max(0.1, connectorGeomLengthX / CONNECTOR_LENGTH_GEOM), 1, 1],
    },
    {
      key: 'west',
      position: [-(CORE_HALF_WIDTH + connectorLengthX / 2), spreadY, 0],
      rotation: [0, unitLayout[1].planRotation, 0],
      length: connectorLengthX,
      scale: [Math.max(0.1, connectorGeomLengthX / CONNECTOR_LENGTH_GEOM), 1, 1],
    },
    {
      key: 'south',
      position: [0, spreadY, CORE_HALF_DEPTH + connectorLengthZ / 2],
      rotation: [0, unitLayout[2].planRotation, 0],
      length: connectorLengthZ,
      scale: [Math.max(0.1, connectorGeomLengthZ / CONNECTOR_LENGTH_GEOM), 1, 1],
    },
    {
      key: 'north',
      position: [0, spreadY, -(CORE_HALF_DEPTH + connectorLengthZ / 2)],
      rotation: [0, unitLayout[3].planRotation, 0],
      length: connectorLengthZ,
      scale: [Math.max(0.1, connectorGeomLengthZ / CONNECTOR_LENGTH_GEOM), 1, 1],
    },
  ];

  const dongPlanPoints = computeDongPlanPoints(unitLayout, connectorLayout);
  const hullPoints = computeConvexHull(dongPlanPoints);
  const bounds = computeBounds(hullPoints);
  const rotatedHullPoints = hullPoints.map((point) => {
    const rotated = rotatePoint(point.x, point.z, dongRotationRad.y);
    return { x: rotated.x, z: rotated.z };
  });
  const rotatedBounds = computeBounds(rotatedHullPoints);

  const boundingRadius = hullPoints.reduce(
    (max, point) => Math.max(max, Math.hypot(point.x, point.z)),
    0,
  );

  return {
    unitLayout,
    connectorLayout,
    hullPoints,
    bounds,
    rotatedBounds,
    boundingRadius,
    dongRotationRad,
  };
}

const CORE_GEOMETRY = new THREE.BoxGeometry(CORE_SIZE.width, 1, CORE_SIZE.depth);
const CONNECTOR_GEOMETRY = new THREE.BoxGeometry(CONNECTOR_LENGTH_GEOM, 1, CONNECTOR_WIDTH);

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

function useFloorGeometry(floorHeight) {
  return useMemo(() => {
    const shape = new THREE.Shape();
    FLOOR_PLAN_MM.forEach(([x, z], index) => {
      const px = mmToM(x);
      const pz = mmToM(z);
      if (index === 0) {
        shape.moveTo(px, pz);
      } else {
        shape.lineTo(px, pz);
      }
    });
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: floorHeight,
      bevelEnabled: false,
    });

    // Make it stand upright: Y = vertical.
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, floorHeight / 2, 0);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.computeVertexNormals();

    return geometry;
  }, [floorHeight]);
}

function useDongFootprintGeometry(height, margin = 0, hullPoints) {
  return useMemo(() => {
    if (!hullPoints || hullPoints.length === 0) return new THREE.BoxGeometry(1, height, 1);

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
  }, [height, hullPoints, margin]);
}

function MinimalTower({ config, palette, position, layout }) {
  const { floors, floorHeight, edgeColor } = config;
  const { unitLayout, connectorLayout, hullPoints, dongRotationRad } = layout;

  const slabThickness = Math.min(0.45, floorHeight * SLAB_THICKNESS_SCALE);
  const storyHeight = Math.max(0.5, floorHeight - STORY_GAP);
  const unitHeight = Math.max(0.3, storyHeight - UNIT_GEOMETRY_EPS);

  const unitGeometry = useFloorGeometry(unitHeight);
  const slabGeometry = useDongFootprintGeometry(slabThickness, SLAB_FOOTPRINT_MARGIN, hullPoints);
  const coreGeometry = useMemo(() => CORE_GEOMETRY.clone().scale(1, unitHeight, 1), [unitHeight]);
  const coreMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.core,
        roughness: 0.68,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    [palette.core],
  );
  const connectorGeometry = useMemo(
    () => CONNECTOR_GEOMETRY.clone().scale(1, unitHeight, 1),
    [unitHeight],
  );
  const connectorMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.corridor,
        roughness: 0.7,
        metalness: 0.04,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    [palette.corridor],
  );
  const unitMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.unit,
        roughness: 0.78,
        metalness: 0.08,
      }),
    [palette.unit],
  );

  const floorCenters = useMemo(() => {
    const centers = [];
    for (let level = 0; level < floors; level += 1) {
      const levelBase = GROUND_LEVEL + slabThickness + level * floorHeight;
      centers.push(levelBase + storyHeight / 2);
    }
    return centers;
  }, [floors, floorHeight, slabThickness, storyHeight]);

  const coreTransforms = useMemo(
    () => floorCenters.map((y) => ({ position: [0, y, 0] })),
    [floorCenters],
  );

  const unitTransforms = useMemo(() => {
    const transforms = [];
    floorCenters.forEach((y) => {
      unitLayout.forEach((unit) => {
        transforms.push({
          position: [unit.position[0], y + unit.position[1], unit.position[2]],
          rotation: unit.rotation,
        });
      });
    });
    return transforms;
  }, [floorCenters, unitLayout]);

  const connectorTransforms = useMemo(() => {
    const transforms = [];
    floorCenters.forEach((y) => {
      connectorLayout.forEach((connector) => {
        transforms.push({
          position: [connector.position[0], y + connector.position[1], connector.position[2]],
          rotation: connector.rotation,
          scale: connector.scale,
        });
      });
    });
    return transforms;
  }, [connectorLayout, floorCenters]);

  const coreRef = useRef();
  const unitRef = useRef();
  const connectorRef = useRef();

  useInstancedLayout(coreRef, coreTransforms);
  useInstancedLayout(unitRef, unitTransforms);
  useInstancedLayout(connectorRef, connectorTransforms);

  return (
    <group position={position} rotation={[dongRotationRad.x, dongRotationRad.y, dongRotationRad.z]}>
      <mesh
        geometry={slabGeometry}
        position={[0, GROUND_LEVEL + slabThickness / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette.plinth} roughness={0.82} metalness={0.04} />
      </mesh>

      {coreTransforms.length > 0 && (
        <instancedMesh
          ref={coreRef}
          args={[coreGeometry, undefined, coreTransforms.length]}
          castShadow
          receiveShadow
          matrixAutoUpdate={false}
        >
          <primitive attach="material" object={coreMaterial} />
        </instancedMesh>
      )}

      {connectorTransforms.length > 0 && (
        <instancedMesh
          ref={connectorRef}
          args={[connectorGeometry, undefined, connectorTransforms.length]}
          castShadow
          receiveShadow
          matrixAutoUpdate={false}
        >
          <primitive attach="material" object={connectorMaterial} />
        </instancedMesh>
      )}

      {unitTransforms.length > 0 && (
        <instancedMesh
          ref={unitRef}
          args={[unitGeometry, undefined, unitTransforms.length]}
          castShadow
          receiveShadow
          matrixAutoUpdate={false}
        >
          <primitive attach="material" object={unitMaterial} />
        </instancedMesh>
      )}
    </group>
  );
}

function ApartmentComplex({ layoutConfig, palette, edgeColor, dongLayout }) {
  const { floors, floorHeight, rows, columns, towerGapX, towerGapZ } = layoutConfig;
  const { rotatedBounds, boundingRadius } = dongLayout;

  const baseWidth = Math.max(1, rotatedBounds.width, boundingRadius * 2);
  const baseDepth = Math.max(1, rotatedBounds.depth, boundingRadius * 2);

  const towerSpacingX = baseWidth + towerGapX;
  const towerSpacingZ = baseDepth + towerGapZ;

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
  }, [columns, rows, towerSpacingX, towerSpacingZ]);

  const spanWidth = baseWidth + Math.max(0, columns - 1) * towerSpacingX;
  const spanDepth = baseDepth + Math.max(0, rows - 1) * towerSpacingZ;
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
          layout={dongLayout}
        />
      ))}
    </group>
  );
}

export default function AptComplex13() {
  const controls = useControls('Apartment', {
    floors: { value: 28, min: 12, max: 45, step: 1 },
    floorHeight: { value: 3.05, min: 2.6, max: 3.6, step: 0.05, label: 'Floor Height (m)' },
    rows: { value: 8, min: 1, max: 10, step: 1 },
    columns: { value: 8, min: 1, max: 10, step: 1 },
    towerGapX: { value: 15, min: 3, max: 30, step: 0.5, label: 'Gap X (m)' },
    towerGapZ: { value: 20, min: 3, max: 30, step: 0.5, label: 'Gap Z (m)' },
    unitSpreadX: { value: 0, min: -4, max: 8, step: 0.1, label: 'Unit Spread X (m)' },
    unitSpreadY: { value: 0, min: -2, max: 2, step: 0.05, label: 'Unit Spread Y (m)' },
    unitSpreadZ: { value: 0, min: -4, max: 8, step: 0.1, label: 'Unit Spread Z (m)' },
    unitAngleX: { value: 0, min: -45, max: 45, step: 1, label: 'Unit Angle X (°)' },
    unitAngleY: { value: 0, min: -90, max: 90, step: 1, label: 'Unit Angle Y (°)' },
    unitAngleZ: { value: 0, min: -45, max: 45, step: 1, label: 'Unit Angle Z (°)' },
    dongRotationX: { value: 0, min: -45, max: 45, step: 1, label: 'Dong Rotation X (°)' },
    dongRotationY: { value: 0, min: -90, max: 90, step: 1, label: 'Dong Rotation Y (°)' },
    dongRotationZ: { value: 0, min: -45, max: 45, step: 1, label: 'Dong Rotation Z (°)' },
    unitColor: { value: '#d8dad7', label: 'Facade' },
    coreColor: { value: '#c3c6c2', label: 'Core' },
    corridorColor: { value: '#dfe1dd', label: 'Corridor' },
    plinthColor: { value: '#c7cac4', label: 'Podium' },
    edgeColor: { value: '#6e726e', label: 'Edge Highlight' },
  });

  const palette = useMemo(
    () => ({
      unit: controls.unitColor,
      core: controls.coreColor,
      corridor: controls.corridorColor,
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

  const dongLayout = useMemo(
    () =>
      buildDongLayout({
        unitSpread: {
          x: controls.unitSpreadX,
          y: controls.unitSpreadY,
          z: controls.unitSpreadZ,
        },
        unitAnglesDeg: {
          x: controls.unitAngleX,
          y: controls.unitAngleY,
          z: controls.unitAngleZ,
        },
        dongRotationDeg: {
          x: controls.dongRotationX,
          y: controls.dongRotationY,
          z: controls.dongRotationZ,
        },
      }),
    [
      controls.unitAngleX,
      controls.unitAngleY,
      controls.unitAngleZ,
      controls.dongRotationX,
      controls.dongRotationY,
      controls.dongRotationZ,
      controls.unitSpreadX,
      controls.unitSpreadY,
      controls.unitSpreadZ,
    ],
  );

  const cameraSettings = useMemo(() => {
    const baseWidth = Math.max(1, dongLayout.rotatedBounds.width, dongLayout.boundingRadius * 2);
    const baseDepth = Math.max(1, dongLayout.rotatedBounds.depth, dongLayout.boundingRadius * 2);
    const towerSpacingX = baseWidth + controls.towerGapX;
    const towerSpacingZ = baseDepth + controls.towerGapZ;
    const spanWidth = baseWidth + Math.max(0, controls.columns - 1) * towerSpacingX;
    const spanDepth = baseDepth + Math.max(0, controls.rows - 1) * towerSpacingZ;
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
    dongLayout,
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
          dongLayout={dongLayout}
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
