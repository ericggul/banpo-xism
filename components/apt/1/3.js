'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
const CONNECTOR_LENGTH_GEOM = CONNECTOR_LENGTH - CONNECTOR_GAP;
const SLAB_THICKNESS_SCALE = 0.15;
const STORY_GAP = 0.3;
const SLAB_FOOTPRINT_MARGIN = 1.05;
const UNIT_GEOMETRY_EPS = 0.02;

const UNIT_HALF_WIDTH = FOOTPRINT_WIDTH / 2;
const UNIT_HALF_DEPTH = FOOTPRINT_DEPTH / 2;
const CORE_HALF_WIDTH = CORE_SIZE.width / 2;
const CORE_HALF_DEPTH = CORE_SIZE.depth / 2;

const EAST_OFFSET = CORE_HALF_WIDTH + CONNECTOR_LENGTH + UNIT_HALF_WIDTH;
const WEST_OFFSET = -EAST_OFFSET;
const SOUTH_OFFSET = CORE_HALF_DEPTH + CONNECTOR_LENGTH + UNIT_HALF_DEPTH;
const NORTH_OFFSET = -SOUTH_OFFSET;

const STRUCTURE_HALF_WIDTH = EAST_OFFSET + UNIT_HALF_WIDTH;
const STRUCTURE_HALF_DEPTH = SOUTH_OFFSET + UNIT_HALF_DEPTH;

const DONG_WIDTH = STRUCTURE_HALF_WIDTH * 2;
const DONG_DEPTH = STRUCTURE_HALF_DEPTH * 2;

const UNIT_LAYOUT = [
  { key: 'east', rotation: 0, position: [EAST_OFFSET, 0, 0] },
  { key: 'west', rotation: Math.PI, position: [WEST_OFFSET, 0, 0] },
  { key: 'south', rotation: -Math.PI / 2, position: [0, 0, SOUTH_OFFSET] },
  { key: 'north', rotation: Math.PI / 2, position: [0, 0, NORTH_OFFSET] },
];

const CONNECTOR_LAYOUT = [
  {
    key: 'east',
    type: 'x',
    position: [CORE_HALF_WIDTH + CONNECTOR_LENGTH / 2, 0, 0],
  },
  {
    key: 'west',
    type: 'x',
    position: [-(CORE_HALF_WIDTH + CONNECTOR_LENGTH / 2), 0, 0],
  },
  {
    key: 'south',
    type: 'z',
    position: [0, 0, CORE_HALF_DEPTH + CONNECTOR_LENGTH / 2],
  },
  {
    key: 'north',
    type: 'z',
    position: [0, 0, -(CORE_HALF_DEPTH + CONNECTOR_LENGTH / 2)],
  },
];

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

function computeDongPlanPoints() {
  const points = [];

  // Core footprint.
  addRectanglePoints(points, 0, 0, CORE_HALF_WIDTH, CORE_HALF_DEPTH);

  // Connector footprints.
  CONNECTOR_LAYOUT.forEach((connector) => {
    if (connector.type === 'x') {
      addRectanglePoints(
        points,
        connector.position[0],
        connector.position[2],
        CONNECTOR_LENGTH_GEOM / 2,
        CONNECTOR_WIDTH / 2,
      );
    } else {
      addRectanglePoints(
        points,
        connector.position[0],
        connector.position[2],
        CONNECTOR_WIDTH / 2,
        CONNECTOR_LENGTH_GEOM / 2,
      );
    }
  });

  // Household footprints.
  UNIT_LAYOUT.forEach((unit) => {
    const { position, rotation } = unit;
    FOOTPRINT_POINTS.forEach(([px, pz]) => {
      const rotated = rotatePoint(px, pz, rotation);
      points.push({
        x: position[0] + rotated.x,
        z: position[2] + rotated.z,
      });
    });
  });

  return points;
}

const DONG_PLAN_POINTS = computeDongPlanPoints();
const DONG_HULL_POINTS = computeConvexHull(DONG_PLAN_POINTS);
const CORE_GEOMETRY = new THREE.BoxGeometry(CORE_SIZE.width, 1, CORE_SIZE.depth);
const CONNECTOR_GEOMETRY_X = new THREE.BoxGeometry(CONNECTOR_LENGTH_GEOM, 1, CONNECTOR_WIDTH);
const CONNECTOR_GEOMETRY_Z = new THREE.BoxGeometry(CONNECTOR_WIDTH, 1, CONNECTOR_LENGTH_GEOM);

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

function useDongFootprintGeometry(height, margin = 0) {
  return useMemo(() => {
    if (DONG_HULL_POINTS.length === 0) return new THREE.BoxGeometry(1, height, 1);

    const centroid = DONG_HULL_POINTS.reduce(
      (acc, point) => {
        acc.x += point.x;
        acc.z += point.z;
        return acc;
      },
      { x: 0, z: 0 },
    );
    centroid.x /= DONG_HULL_POINTS.length;
    centroid.z /= DONG_HULL_POINTS.length;

    const expanded = DONG_HULL_POINTS.map((point) => {
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
  }, [height, margin]);
}

function MinimalTower({ config, palette, position }) {
  const { floors, floorHeight, edgeColor } = config;

  const slabThickness = Math.min(0.45, floorHeight * SLAB_THICKNESS_SCALE);
  const storyHeight = Math.max(0.5, floorHeight - STORY_GAP);
  const unitHeight = Math.max(0.3, storyHeight - UNIT_GEOMETRY_EPS);

  const unitGeometry = useFloorGeometry(unitHeight);
  const slabGeometry = useDongFootprintGeometry(slabThickness, SLAB_FOOTPRINT_MARGIN);
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
  const connectorGeometryX = useMemo(
    () => CONNECTOR_GEOMETRY_X.clone().scale(1, unitHeight, 1),
    [unitHeight],
  );
  const connectorGeometryZ = useMemo(
    () => CONNECTOR_GEOMETRY_Z.clone().scale(1, unitHeight, 1),
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
      UNIT_LAYOUT.forEach((unit) => {
        transforms.push({
          position: [unit.position[0], y, unit.position[2]],
          rotation: [0, unit.rotation, 0],
        });
      });
    });
    return transforms;
  }, [floorCenters]);

  const connectorTransforms = useMemo(() => {
    const x = [];
    const z = [];
    floorCenters.forEach((y) => {
      CONNECTOR_LAYOUT.forEach((connector) => {
        const transform = {
          position: [connector.position[0], y, connector.position[2]],
        };
        if (connector.type === 'x') {
          x.push(transform);
        } else {
          z.push(transform);
        }
      });
    });
    return { x, z };
  }, [floorCenters]);

  const coreRef = useRef();
  const unitRef = useRef();
  const connectorXRef = useRef();
  const connectorZRef = useRef();

  useInstancedLayout(coreRef, coreTransforms);
  useInstancedLayout(unitRef, unitTransforms);
  useInstancedLayout(connectorXRef, connectorTransforms.x);
  useInstancedLayout(connectorZRef, connectorTransforms.z);

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

      {connectorTransforms.x.length > 0 && (
        <instancedMesh
          ref={connectorXRef}
          args={[connectorGeometryX, undefined, connectorTransforms.x.length]}
          castShadow
          receiveShadow
          matrixAutoUpdate={false}
        >
          <primitive attach="material" object={connectorMaterial} />
        </instancedMesh>
      )}

      {connectorTransforms.z.length > 0 && (
        <instancedMesh
          ref={connectorZRef}
          args={[connectorGeometryZ, undefined, connectorTransforms.z.length]}
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
