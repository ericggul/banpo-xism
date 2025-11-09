'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useControls } from 'leva';
import * as THREE from 'three';

const mmToM = (value) => value / 1000;
const GROUND_LEVEL = -0.25;

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

function directionIndex({ dx, dy }) {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 0 : 2; // East or West
  }
  if (dy !== 0) {
    return dy > 0 ? 1 : 3; // South or North (image Y grows downward)
  }
  return 0;
}

function buildUnitOutlineFromPlan(plan) {
  if (!plan) return [];
  const { overallDimensions, spaces } = plan;
  if (!overallDimensions || !Array.isArray(spaces) || spaces.length === 0) {
    return [];
  }

  const { width, height } = overallDimensions;
  const normalizedSpaces = spaces.map(({ startCoordinate, endCoordinate }) => {
    if (!startCoordinate || !endCoordinate) {
      return null;
    }
    const [sx, sy] = startCoordinate;
    const [ex, ey] = endCoordinate;
    return {
      minX: Math.min(sx, ex),
      maxX: Math.max(sx, ex),
      minY: Math.min(sy, ey),
      maxY: Math.max(sy, ey),
    };
  }).filter(Boolean);

  if (normalizedSpaces.length === 0) return [];

  const xSet = new Set([0, width]);
  const ySet = new Set([0, height]);
  normalizedSpaces.forEach(({ minX, maxX, minY, maxY }) => {
    xSet.add(minX);
    xSet.add(maxX);
    ySet.add(minY);
    ySet.add(maxY);
  });

  const xs = Array.from(xSet).sort((a, b) => a - b);
  const ys = Array.from(ySet).sort((a, b) => a - b);
  const xIndex = new Map(xs.map((value, index) => [value, index]));
  const yIndex = new Map(ys.map((value, index) => [value, index]));

  const occupied = Array.from({ length: xs.length - 1 }, () =>
    Array(ys.length - 1).fill(false),
  );

  normalizedSpaces.forEach(({ minX, maxX, minY, maxY }) => {
    const startXi = xIndex.get(minX) ?? 0;
    const endXi = xIndex.get(maxX) ?? xs.length - 1;
    const startYi = yIndex.get(minY) ?? 0;
    const endYi = yIndex.get(maxY) ?? ys.length - 1;

    for (let xi = startXi; xi < endXi; xi += 1) {
      for (let yi = startYi; yi < endYi; yi += 1) {
        occupied[xi][yi] = true;
      }
    }
  });

  // Fill vertical gaps between extremal occupied cells in each column to include circulation zones.
  for (let xi = 0; xi < occupied.length; xi += 1) {
    let first = -1;
    let last = -1;
    for (let yi = 0; yi < occupied[xi].length; yi += 1) {
      if (!occupied[xi][yi]) continue;
      if (first === -1) first = yi;
      last = yi;
    }
    if (first === -1 || last === -1) continue;
    for (let yi = first; yi <= last; yi += 1) {
      occupied[xi][yi] = true;
    }
  }

  const edges = new Map();
  const toggleEdge = (x1, y1, x2, y2) => {
    const key = `${x1},${y1}->${x2},${y2}`;
    const reverseKey = `${x2},${y2}->${x1},${y1}`;
    if (edges.has(reverseKey)) {
      edges.delete(reverseKey);
      return;
    }
    if (edges.has(key)) {
      edges.delete(key);
      return;
    }
    edges.set(key, {
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
    });
  };

  for (let xi = 0; xi < xs.length - 1; xi += 1) {
    for (let yi = 0; yi < ys.length - 1; yi += 1) {
      if (!occupied[xi][yi]) continue;

      const x0 = xs[xi];
      const x1 = xs[xi + 1];
      const y0 = ys[yi];
      const y1 = ys[yi + 1];

      toggleEdge(x0, y0, x1, y0); // top
      toggleEdge(x1, y0, x1, y1); // right
      toggleEdge(x1, y1, x0, y1); // bottom
      toggleEdge(x0, y1, x0, y0); // left
    }
  }

  if (edges.size === 0) {
    return [];
  }

  const adjacency = new Map();
  const addAdjacency = (from, to, edgeKey) => {
    const key = `${from.x},${from.y}`;
    if (!adjacency.has(key)) adjacency.set(key, []);
    adjacency.get(key).push({
      point: to,
      edgeKey,
      dir: { dx: to.x - from.x, dy: to.y - from.y },
    });
  };

  edges.forEach((edge, key) => {
    addAdjacency(edge.start, edge.end, key);
    addAdjacency(edge.end, edge.start, key);
  });

  const points = Array.from(adjacency.keys()).map((hash) => {
    const [x, y] = hash.split(',').map(Number);
    return { key: hash, x, y };
  });
  points.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  const start = points[0];

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const toOutlinePoint = (point) => ({
    x: point.x - halfWidth,
    z: point.y - halfHeight,
  });

  const outline = [toOutlinePoint(start)];
  const usedEdges = new Set();
  const startKey = `${start.x},${start.y}`;
  const pointKey = (point) => `${point.x},${point.y}`;
  let current = { x: start.x, y: start.y };
  let prevDir = 1; // pretend we arrived from above to encourage eastward start
  let safety = 0;

  while (safety < edges.size + 10) {
    const options = adjacency.get(pointKey(current));
    if (!options || options.length === 0) {
      break;
    }

    const candidateOrder = [
      (prevDir + 3) % 4,
      prevDir,
      (prevDir + 1) % 4,
      (prevDir + 2) % 4,
    ];

    let nextOption = null;
    for (const dirIdx of candidateOrder) {
      nextOption = options.find(
        (option) => !usedEdges.has(option.edgeKey) && directionIndex(option.dir) === dirIdx,
      );
      if (nextOption) break;
    }

    if (!nextOption) {
      break;
    }

    usedEdges.add(nextOption.edgeKey);
    const nextPoint = nextOption.point;
    prevDir = directionIndex(nextOption.dir);
    current = nextPoint;
    if (pointKey(current) === startKey) {
      break;
    }

    outline.push(toOutlinePoint(current));
    safety += 1;
  }

  if (outline.length < 3) {
    return [
      { x: -halfWidth, z: -halfHeight },
      { x: halfWidth, z: -halfHeight },
      { x: halfWidth, z: halfHeight },
      { x: -halfWidth, z: halfHeight },
    ];
  }

  return outline;
}

const FLOOR_PLAN_JSON = {
  floorPlan: {
    overallDimensions: {
      width: 13725,
      height: 11660,
    },
    spaces: [
      {
        type: '침실 (드레스룸 포함)',
        comment: '좌측 침실',
        startCoordinate: [0, 3185],
        endCoordinate: [3210, 11660],
      },
      {
        type: '침실 (드레스룸 포함)',
        comment: '우측 상단 침실 (드레스룸 영역 포함)',
        startCoordinate: [6115, 3395],
        endCoordinate: [10525, 6950],
      },
      {
        type: '침실 (드레스룸 포함)',
        comment: '우측 하단 침실',
        startCoordinate: [7920, 6950],
        endCoordinate: [11130, 11660],
      },
      {
        type: '거실 (주방/식당 포함)',
        comment: '거실',
        startCoordinate: [3210, 3185],
        endCoordinate: [7920, 11660],
      },
      {
        type: '거실 (주방/식당 포함)',
        comment: '주방 및 식당',
        startCoordinate: [2015, 1410],
        endCoordinate: [6115, 3395],
      },
      {
        type: '화장실',
        comment: '좌측 상단 화장실',
        startCoordinate: [0, 465],
        endCoordinate: [2015, 2890],
      },
      {
        type: '화장실',
        comment: '우측 상단 화장실',
        startCoordinate: [8060, 0],
        endCoordinate: [10525, 1410],
      },
      {
        type: '발코니',
        comment: '상단 발코니',
        startCoordinate: [2015, 0],
        endCoordinate: [6115, 1410],
      },
      {
        type: '발코니',
        comment: '우측 하단 발코니',
        startCoordinate: [11130, 6950],
        endCoordinate: [13725, 11660],
      },
    ],
  },
};

const UNIT_OUTLINE_POINTS_MM = buildUnitOutlineFromPlan(FLOOR_PLAN_JSON.floorPlan);
const UNIT_OUTLINE_POINTS_MM_MIRRORED = UNIT_OUTLINE_POINTS_MM.slice().reverse().map(({ x, z }) => ({
  x: -x,
  z,
}));

const FOOTPRINT_POINTS = UNIT_OUTLINE_POINTS_MM.map(({ x, z }) => [mmToM(x), mmToM(z)]);
const FOOTPRINT_POINTS_MIRRORED = UNIT_OUTLINE_POINTS_MM_MIRRORED.map(({ x, z }) => [mmToM(x), mmToM(z)]);

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

const SLAB_THICKNESS_SCALE = 0.15;
const STORY_GAP = 0.3;
const SLAB_FOOTPRINT_MARGIN = 1.05;
const UNIT_GEOMETRY_EPS = 0.02;

const UNIT_HALF_WIDTH = FOOTPRINT_WIDTH / 2;
const UNIT_HALF_DEPTH = FOOTPRINT_DEPTH / 2;
const UNIT_GAP = 0.4; // small breathing space between mirrored households
const UNIT_OFFSET_X = UNIT_HALF_WIDTH + UNIT_GAP / 2;

const STRUCTURE_HALF_WIDTH = UNIT_OFFSET_X + UNIT_HALF_WIDTH;
const STRUCTURE_HALF_DEPTH = UNIT_HALF_DEPTH;

const DONG_WIDTH = STRUCTURE_HALF_WIDTH * 2;
const DONG_DEPTH = STRUCTURE_HALF_DEPTH * 2;

function computeDongPlanPoints() {
  const points = [];

  FOOTPRINT_POINTS.forEach(([px, pz]) => {
    points.push({
      x: -UNIT_OFFSET_X + px,
      z: pz,
    });
  });

  FOOTPRINT_POINTS_MIRRORED.forEach(([px, pz]) => {
    points.push({
      x: UNIT_OFFSET_X + px,
      z: pz,
    });
  });

  return points;
}

const DONG_PLAN_POINTS = computeDongPlanPoints();
const DONG_HULL_POINTS = computeConvexHull(DONG_PLAN_POINTS);

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

function useUnitGeometry(outlinePointsMM, floorHeight) {
  return useMemo(() => {
    if (!outlinePointsMM || outlinePointsMM.length === 0) {
      return new THREE.BoxGeometry(1, floorHeight, 1);
    }

    const shape = new THREE.Shape();
    outlinePointsMM.forEach(({ x, z }, index) => {
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
  }, [outlinePointsMM, floorHeight]);
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
  const { floors, floorHeight } = config;

  const slabThickness = Math.min(0.45, floorHeight * SLAB_THICKNESS_SCALE);
  const storyHeight = Math.max(0.5, floorHeight - STORY_GAP);
  const unitHeight = Math.max(0.3, storyHeight - UNIT_GEOMETRY_EPS);

  const unitGeometryLeft = useUnitGeometry(UNIT_OUTLINE_POINTS_MM, unitHeight);
  const unitGeometryRight = useUnitGeometry(UNIT_OUTLINE_POINTS_MM_MIRRORED, unitHeight);
  const slabGeometry = useDongFootprintGeometry(slabThickness, SLAB_FOOTPRINT_MARGIN);

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

  const unitTransformsLeft = useMemo(
    () => floorCenters.map((y) => ({ position: [-UNIT_OFFSET_X, y, 0] })),
    [floorCenters],
  );

  const unitTransformsRight = useMemo(
    () => floorCenters.map((y) => ({ position: [UNIT_OFFSET_X, y, 0] })),
    [floorCenters],
  );

  const unitLeftRef = useRef();
  const unitRightRef = useRef();

  useInstancedLayout(unitLeftRef, unitTransformsLeft);
  useInstancedLayout(unitRightRef, unitTransformsRight);

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

      {unitTransformsLeft.length > 0 && (
        <instancedMesh
          ref={unitLeftRef}
          args={[unitGeometryLeft, undefined, unitTransformsLeft.length]}
          castShadow
          receiveShadow
          matrixAutoUpdate={false}
        >
          <primitive attach="material" object={unitMaterial} />
        </instancedMesh>
      )}

      {unitTransformsRight.length > 0 && (
        <instancedMesh
          ref={unitRightRef}
          args={[unitGeometryRight, undefined, unitTransformsRight.length]}
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

function ApartmentComplex({ layoutConfig, palette }) {
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
        <MinimalTower key={`tower-${index}`} config={{ floors, floorHeight }} palette={palette} position={position} />
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

        <ApartmentComplex layoutConfig={layoutConfig} palette={palette} />

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
