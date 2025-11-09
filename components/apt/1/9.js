'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useControls } from 'leva';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

const GROUND_LEVEL = -0.18;

const MATERIAL_ROLE_MAP = {
  lambert4SG: 'accent',
  lambert5SG: 'glass',
  lambert6SG: 'roof',
  lambert7SG: 'accent',
  lambert8SG: 'body',
  lambert10SG: 'accent',
  lambert11SG: 'body',
};

const SNAP_STEP = 1.2;
const MIN_DIMENSION = 0.8;
const BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
BOX_GEOMETRY.computeBoundingBox();
BOX_GEOMETRY.computeBoundingSphere();

function snapDownVector(vector) {
  return new THREE.Vector3(
    Math.floor(vector.x / SNAP_STEP) * SNAP_STEP,
    Math.floor(vector.y / SNAP_STEP) * SNAP_STEP,
    Math.floor(vector.z / SNAP_STEP) * SNAP_STEP,
  );
}

function snapUpVector(vector) {
  return new THREE.Vector3(
    Math.ceil(vector.x / SNAP_STEP) * SNAP_STEP,
    Math.ceil(vector.y / SNAP_STEP) * SNAP_STEP,
    Math.ceil(vector.z / SNAP_STEP) * SNAP_STEP,
  );
}

function clampSize(size) {
  return Math.max(size, MIN_DIMENSION);
}

function composeTransform(min, max) {
  const position = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const size = new THREE.Vector3().subVectors(max, min);
  size.set(
    clampSize(Math.round(size.x / SNAP_STEP) * SNAP_STEP),
    clampSize(Math.round(size.y / SNAP_STEP) * SNAP_STEP),
    clampSize(Math.round(size.z / SNAP_STEP) * SNAP_STEP),
  );
  position.set(
    Math.round(position.x / SNAP_STEP) * SNAP_STEP,
    Math.round(position.y / SNAP_STEP) * SNAP_STEP,
    Math.round(position.z / SNAP_STEP) * SNAP_STEP,
  );

  return {
    position: [position.x, position.y, position.z],
    scale: [size.x, size.y, size.z],
  };
}

function useDongTemplate() {
  const object = useLoader(OBJLoader, '/3d/housebig.obj');

  return useMemo(() => {
    if (!object) return null;

    const source = object.clone(true);
    const pivot = new THREE.Group();
    pivot.name = 'BanpoDongTemplate';

    source.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry = child.geometry.clone();
      child.geometry.computeVertexNormals();
    });

    pivot.add(source);
    pivot.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(pivot);
    const size = bounds.getSize(new THREE.Vector3());
    const min = bounds.min.clone();
    const center = bounds.getCenter(new THREE.Vector3());

    source.position.x -= center.x;
    source.position.z -= center.z;
    source.position.y -= min.y;
    pivot.updateMatrixWorld(true);

    const roleMaps = {
      body: new Map(),
      accent: new Map(),
      roof: new Map(),
    };

    source.updateMatrixWorld(true);

    source.traverse((child) => {
      if (!child.isMesh || child.geometry.attributes.position.count === 0) return;

      const role = MATERIAL_ROLE_MAP[child.material?.name] ?? 'body';
      if (role === 'glass') return;

      const box = new THREE.Box3().setFromObject(child);
      if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return;

      const snappedMin = snapDownVector(box.min);
      const snappedMax = snapUpVector(box.max);

      if (
        snappedMax.x - snappedMin.x < MIN_DIMENSION &&
        snappedMax.z - snappedMin.z < MIN_DIMENSION
      ) {
        return;
      }

      const key = [
        snappedMin.x.toFixed(3),
        snappedMin.y.toFixed(3),
        snappedMin.z.toFixed(3),
        snappedMax.x.toFixed(3),
        snappedMax.y.toFixed(3),
        snappedMax.z.toFixed(3),
      ].join('|');

      const targetMap = roleMaps[role] ?? roleMaps.body;
      const existing = targetMap.get(key);
      if (existing) {
        existing.min.min(snappedMin);
        existing.max.max(snappedMax);
      } else {
        targetMap.set(key, {
          min: snappedMin.clone(),
          max: snappedMax.clone(),
        });
      }
    });

    const abstract = Object.fromEntries(
      Object.entries(roleMaps).map(([role, map]) => [
        role,
        Array.from(map.values()).map(({ min: minVec, max: maxVec }) =>
          composeTransform(minVec, maxVec),
        ),
      ]),
    );

    return { size, abstract };
  }, [object]);
}

function materialForRole(role, palette) {
  if (role === 'glass') {
    return new THREE.MeshPhysicalMaterial({
      color: palette.glass,
      roughness: 0.1,
      metalness: 0.08,
      transmission: 0.62,
      thickness: 0.6,
      transparent: true,
      opacity: 0.92,
      reflectivity: 0.18,
    });
  }

  const color =
    role === 'accent'
      ? palette.accent
      : role === 'roof'
        ? palette.roof
        : palette.body;

  return new THREE.MeshStandardMaterial({
    color,
    roughness: role === 'roof' ? 0.55 : 0.7,
    metalness: 0.08,
  });
}

function InstancedBoxes({ matrices, material, castShadow }) {
  const ref = useRef();

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage?.(THREE.DynamicDrawUsage);

    if (!matrices || matrices.length === 0) {
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }

    matrices.forEach((matrix, index) => {
      mesh.setMatrixAt(index, matrix);
    });
    mesh.count = matrices.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.computeBoundingSphere?.();
  }, [matrices]);

  if (!matrices || matrices.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[BOX_GEOMETRY, material, matrices.length]}
      castShadow={castShadow}
      receiveShadow
    />
  );
}

function createRowOffsets(rows, magnitude) {
  if (rows <= 1 || magnitude === 0) return new Array(rows).fill(0);

  const raw = Array.from({ length: rows }, (_, row) => ((row % 2) * 2 - 1) * (magnitude * 0.5));
  const mean = raw.reduce((acc, value) => acc + value, 0) / rows;
  return raw.map((value) => value - mean);
}

function ApartmentScene({ layoutConfig, palette }) {
  const dongTemplate = useDongTemplate();
  const { size, abstract } = dongTemplate ?? {};

  const scale = layoutConfig.dongScale;
  const scaledWidth = size ? size.x * scale : 0;
  const scaledDepth = size ? size.z * scale : 0;
  const scaledHeight = size ? size.y * scale : 0;

  const spacingX = scaledWidth + layoutConfig.gapX;
  const spacingZ = scaledDepth + layoutConfig.gapZ;
  const rowOffsets = useMemo(
    () => createRowOffsets(layoutConfig.rows, layoutConfig.rowOffset),
    [layoutConfig.rows, layoutConfig.rowOffset],
  );

  const placements = useMemo(() => {
    const items = [];
    const baseY = GROUND_LEVEL + layoutConfig.lift;

    for (let row = 0; row < layoutConfig.rows; row += 1) {
      for (let col = 0; col < layoutConfig.columns; col += 1) {
        const x =
          (col - (layoutConfig.columns - 1) / 2) * spacingX + (rowOffsets[row] ?? 0);
        const z = (row - (layoutConfig.rows - 1) / 2) * spacingZ;
        const rotation =
          layoutConfig.rotateAlternate && ((row + col) % 2 === 1) ? Math.PI : 0;

        items.push({
          position: [x, baseY, z],
          rotation: [0, rotation, 0],
        });
      }
    }

    return items;
  }, [
    layoutConfig.columns,
    layoutConfig.rows,
    layoutConfig.rotateAlternate,
    rowOffsets,
    spacingX,
    spacingZ,
    layoutConfig.lift,
  ]);

  const spanWidth =
    scaledWidth + Math.max(0, layoutConfig.columns - 1) * spacingX;
  const spanDepth =
    scaledDepth + Math.max(0, layoutConfig.rows - 1) * spacingZ;
  const siteWidth = spanWidth + layoutConfig.marginX;
  const siteDepth = spanDepth + layoutConfig.marginZ;

  const plazaWidth = scaledWidth + layoutConfig.plazaPadding;
  const plazaDepth = scaledDepth + layoutConfig.plazaPadding * 0.68;

  const { camera } = useThree();
  useEffect(() => {
    if (!scaledHeight) return;

    const span = Math.max(spanWidth, spanDepth);
    const radiusX = span * 0.58 + 48;
    const radiusZ = span * 0.72 + 56;
    const height = Math.max((scaledHeight + layoutConfig.lift) * 1.2, 90);

    camera.position.set(radiusX, height, radiusZ);
    camera.near = 0.1;
    camera.far = 5000;
    camera.updateProjectionMatrix();
  }, [camera, layoutConfig.lift, scaledHeight, spanDepth, spanWidth]);

  const orbitTarget = useMemo(
    () => [0, layoutConfig.lift + scaledHeight * 0.52, 0],
    [layoutConfig.lift, scaledHeight],
  );

  const orbitBounds = Math.max(spanWidth, spanDepth);

  const placementMatrices = useMemo(() => {
    return placements.map((placement) => {
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3(
        placement.position[0],
        placement.position[1],
        placement.position[2],
      );
      const quaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(placement.rotation[0], placement.rotation[1], placement.rotation[2]),
      );
      matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
      return matrix;
    });
  }, [placements]);

  const abstractMatrices = useMemo(() => {
    if (!abstract) return null;

    const matrixByRole = {};

    Object.entries(abstract).forEach(([role, transforms]) => {
      if (!transforms || transforms.length === 0) return;

      const baseMatrices = transforms.map((transform) => {
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3(
          transform.position[0] * scale,
          transform.position[1] * scale,
          transform.position[2] * scale,
        );
        const scaleVec = new THREE.Vector3(
          transform.scale[0] * scale,
          transform.scale[1] * scale,
          transform.scale[2] * scale,
        );
        matrix.compose(position, new THREE.Quaternion(), scaleVec);
        return matrix;
      });

      const combined = [];
      placementMatrices.forEach((placementMatrix) => {
        baseMatrices.forEach((baseMatrix) => {
          const finalMatrix = placementMatrix.clone().multiply(baseMatrix);
          combined.push(finalMatrix);
        });
      });

      matrixByRole[role] = combined;
    });

    return matrixByRole;
  }, [abstract, placementMatrices, scale]);

  const materials = useMemo(
    () => ({
      body: materialForRole('body', palette),
      accent: materialForRole('accent', palette),
      roof: materialForRole('roof', palette),
    }),
    [palette],
  );

  useEffect(
    () => () => {
      Object.values(materials).forEach((material) => material.dispose());
    },
    [materials],
  );

  return (
    <>
      <group>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, GROUND_LEVEL - 0.06, 0]}
          receiveShadow
        >
          <planeGeometry args={[siteWidth, siteDepth]} />
          <meshStandardMaterial color={palette.ground} />
        </mesh>

        {placements.map((placement, index) => (
          <mesh
            key={`plaza-${index}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[
              placement.position[0],
              GROUND_LEVEL - 0.03,
              placement.position[2],
            ]}
            receiveShadow
          >
            <planeGeometry args={[plazaWidth, plazaDepth]} />
            <meshStandardMaterial color={palette.plaza} roughness={0.78} metalness={0.04} />
          </mesh>
        ))}

        {abstractMatrices?.body && abstractMatrices.body.length > 0 && (
          <InstancedBoxes
            matrices={abstractMatrices.body}
            material={materials.body}
            castShadow
          />
        )}

        {abstractMatrices?.accent && abstractMatrices.accent.length > 0 && (
          <InstancedBoxes
            matrices={abstractMatrices.accent}
            material={materials.accent}
            castShadow
          />
        )}

        {abstractMatrices?.roof && abstractMatrices.roof.length > 0 && (
          <InstancedBoxes
            matrices={abstractMatrices.roof}
            material={materials.roof}
            castShadow={false}
          />
        )}
      </group>

      <OrbitControls
        target={orbitTarget}
        maxPolarAngle={Math.PI / 2.08}
        minDistance={orbitBounds * 0.45 + 28}
        maxDistance={orbitBounds * 4.6 + 64}
        enableDamping
      />
    </>
  );
}

export default function AptComplexDong() {
  const layout = useControls('Layout', {
    rows: { value: 4, min: 1, max: 6, step: 1 },
    columns: { value: 3, min: 1, max: 6, step: 1 },
    gapX: { value: 28, min: 6, max: 80, step: 1, label: 'Gap X (m)' },
    gapZ: { value: 36, min: 6, max: 80, step: 1, label: 'Gap Z (m)' },
    rowOffset: { value: 12, min: 0, max: 40, step: 1, label: 'Row Offset (m)' },
    rotateAlternate: { value: true, label: 'Alternate Rotation' },
    dongScale: { value: 1, min: 0.6, max: 1.4, step: 0.05, label: 'Scale' },
    lift: { value: 2.4, min: 0, max: 8, step: 0.1, label: 'Lift Height (m)' },
  });

  const site = useControls('Site', {
    marginX: { value: 48, min: 12, max: 96, step: 2, label: 'Site Margin X' },
    marginZ: { value: 60, min: 12, max: 120, step: 2, label: 'Site Margin Z' },
    plazaPadding: { value: 18, min: 6, max: 40, step: 1, label: 'Plaza Size' },
  });

  const paletteControls = useControls('Palette', {
    bodyColor: { value: '#d7d9d4', label: 'Facade' },
    accentColor: { value: '#bfc3bb', label: 'Accent' },
    roofColor: { value: '#c8ccc4', label: 'Roof' },
    glassColor: { value: '#c1d2df', label: 'Glass' },
    groundColor: { value: '#e5e9e3', label: 'Ground' },
    plazaColor: { value: '#d2d5cf', label: 'Plaza' },
  });

  const {
    rows,
    columns,
    gapX,
    gapZ,
    rowOffset,
    rotateAlternate,
    dongScale,
    lift,
  } = layout;
  const { marginX, marginZ, plazaPadding } = site;

  const layoutConfig = useMemo(
    () => ({
      rows,
      columns,
      gapX,
      gapZ,
      rowOffset,
      rotateAlternate,
      dongScale,
      lift,
      marginX,
      marginZ,
      plazaPadding,
    }),
    [
      columns,
      dongScale,
      gapX,
      gapZ,
      lift,
      marginX,
      marginZ,
      plazaPadding,
      rowOffset,
      rotateAlternate,
      rows,
    ],
  );

  const palette = useMemo(
    () => ({
      body: paletteControls.bodyColor,
      accent: paletteControls.accentColor,
      roof: paletteControls.roofColor,
      glass: paletteControls.glassColor,
      ground: paletteControls.groundColor,
      plaza: paletteControls.plazaColor,
    }),
    [
      paletteControls.accentColor,
      paletteControls.bodyColor,
      paletteControls.glassColor,
      paletteControls.groundColor,
      paletteControls.plazaColor,
      paletteControls.roofColor,
    ],
  );

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '560px' }}>
      <Canvas
        shadows
        camera={{
          position: [180, 160, 210],
          fov: 46,
          near: 0.1,
          far: 5000,
        }}
      >
        <color attach="background" args={['#f2f5f8']} />

        <hemisphereLight intensity={0.58} color="#f6f4ef" groundColor="#d2d2cc" />
        <directionalLight
          position={[140, 220, 160]}
          intensity={1.26}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-420}
          shadow-camera-right={420}
          shadow-camera-top={320}
          shadow-camera-bottom={-320}
          shadow-bias={-0.00012}
        />
        <ambientLight intensity={0.24} />

        <Suspense fallback={null}>
          <ApartmentScene layoutConfig={layoutConfig} palette={palette} />
        </Suspense>
      </Canvas>
    </div>
  );
}
