'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useControls } from 'leva';
import * as THREE from 'three';

const GROUND_LEVEL = -2.1;

function useInstancedLayout(ref, transforms) {
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || transforms.length === 0) return;

    const dummy = new THREE.Object3D();
    const geometry = mesh.geometry;
    let baseBoundingBox = geometry.boundingBox;
    if (!baseBoundingBox) {
      geometry.computeBoundingBox();
      baseBoundingBox = geometry.boundingBox;
    }
    const aggregatedBounds = baseBoundingBox ? new THREE.Box3().makeEmpty() : null;
    const tempBox = baseBoundingBox ? baseBoundingBox.clone() : null;

    transforms.forEach((transform, index) => {
      const { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = transform;
      dummy.position.set(position[0], position[1], position[2]);
      dummy.rotation.set(rotation[0], rotation[1], rotation[2]);
      dummy.scale.set(scale[0], scale[1], scale[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      if (aggregatedBounds && tempBox) {
        tempBox.copy(baseBoundingBox);
        tempBox.applyMatrix4(dummy.matrix);
        aggregatedBounds.union(tempBox);
      }
    });

    if (aggregatedBounds && !aggregatedBounds.isEmpty()) {
      geometry.boundingBox = aggregatedBounds.clone();
      geometry.boundingSphere = aggregatedBounds.getBoundingSphere(new THREE.Sphere());
    }

    mesh.frustumCulled = false;
    mesh.instanceMatrix.needsUpdate = true;
  }, [transforms]);
}

function getTowerMetrics(config) {
  const { floors, modulesAcross, moduleWidth, gapX, moduleHeight, gapY, bodyDepth } = config;
  const bayWidth = moduleWidth + gapX;
  const towerWidth = (modulesAcross - 1) * bayWidth + moduleWidth;
  const towerHeight = floors * (moduleHeight + gapY) + moduleHeight;
  const towerDepth = bodyDepth;
  return { towerWidth, towerHeight, towerDepth, bayWidth };
}

function Tree({ position, scale = 1, palette }) {
  const height = 4.6 * scale;
  const trunkRadius = 0.22 * scale;
  return (
    <group position={[position[0], GROUND_LEVEL, position[1]]}>
      <mesh position={[0, height * 0.3, 0]} castShadow>
        <cylinderGeometry args={[trunkRadius * 0.7, trunkRadius, height * 0.6, 6]} />
        <meshStandardMaterial color={palette.treeTrunk} roughness={0.85} />
      </mesh>
      <mesh position={[0, height * 0.82, 0]} castShadow>
        <sphereGeometry args={[1.05 * scale, 12, 12]} />
        <meshStandardMaterial color={palette.garden} roughness={0.55} metalness={0.05} />
      </mesh>
    </group>
  );
}

function HelioTower({ config, palette, variant = {}, position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const mergedConfig = useMemo(
    () => ({
      ...config,
      floors: variant.floors ?? config.floors,
    }),
    [config, variant.floors],
  );

  const {
    floors,
    modulesAcross,
    moduleWidth,
    moduleHeight,
    gapX,
    gapY,
    bodyDepth,
    balconyDepth,
    podiumHeight,
    podiumMarginX,
    podiumMarginZ,
    roofHeight,
    windowDepth,
    facadeInset,
  } = mergedConfig;

  const { towerWidth, towerHeight, towerDepth, bayWidth } = useMemo(
    () => getTowerMetrics(mergedConfig),
    [mergedConfig],
  );

  const podiumWidth = towerWidth + podiumMarginX * 2;
  const podiumDepth = bodyDepth + podiumMarginZ * 2;

  const towerBaseY = GROUND_LEVEL + podiumHeight;
  const towerCenterY = towerBaseY + towerHeight / 2;
  const roofY = towerBaseY + towerHeight + roofHeight / 2;

  const balconyColumns = useMemo(() => {
    const fallback = modulesAcross <= 3 ? [1] : [1, 2, modulesAcross - 2];
    const provided = variant.balconyColumns ?? fallback;
    return provided.map((value) => Math.min(Math.max(0, value), modulesAcross - 1));
  }, [variant.balconyColumns, modulesAcross]);

  const accentColumns = useMemo(() => {
    const fallback = [Math.floor(modulesAcross / 2)];
    const provided = variant.accentColumns ?? fallback;
    return provided.map((value) => Math.min(Math.max(0, value), modulesAcross - 1));
  }, [variant.accentColumns, modulesAcross]);

  const skyGardenFloors = useMemo(() => variant.skyGardenFloors ?? [], [variant.skyGardenFloors]);

  const facadeFrontZ = bodyDepth / 2 - facadeInset;
  const facadeBackZ = -facadeFrontZ;

  const windowRef = useRef();
  const balconyRef = useRef();
  const railingRef = useRef();
  const frameRef = useRef();
  const accentRef = useRef();
  const slabRef = useRef();
  const planterRef = useRef();

  const windowTransforms = useMemo(() => {
    const transforms = [];
    const windowWidth = moduleWidth * 0.68;
    const windowHeight = moduleHeight * 0.72;
    const depthScale = windowDepth;

    for (let floor = 0; floor < floors; floor += 1) {
      const y = towerBaseY + floor * (moduleHeight + gapY) + moduleHeight * 0.52;
      for (let column = 0; column < modulesAcross; column += 1) {
        const x = -towerWidth / 2 + column * bayWidth;
        transforms.push({
          position: [x, y, facadeFrontZ],
          scale: [windowWidth, windowHeight, depthScale],
        });
        transforms.push({
          position: [x, y, facadeBackZ],
          scale: [windowWidth, windowHeight, depthScale],
        });
      }
    }
    return transforms;
  }, [
    floors,
    modulesAcross,
    moduleWidth,
    moduleHeight,
    gapY,
    towerBaseY,
    towerWidth,
    bayWidth,
    facadeFrontZ,
    facadeBackZ,
    windowDepth,
  ]);

  const balconyTransforms = useMemo(() => {
    const transforms = [];
    if (balconyDepth <= 0) return transforms;
    const slabThickness = Math.max(0.08, moduleHeight * 0.12);
    const columnsSet = new Set(balconyColumns);

    for (let floor = 0; floor < floors; floor += 1) {
      const y = towerBaseY + floor * (moduleHeight + gapY) + moduleHeight - slabThickness * 0.5;
      columnsSet.forEach((column) => {
        const x = -towerWidth / 2 + column * bayWidth;
        transforms.push({
          position: [x, y, facadeFrontZ + balconyDepth / 2],
          scale: [moduleWidth * 0.94, slabThickness, balconyDepth],
        });
      });
    }
    return transforms;
  }, [
    balconyDepth,
    moduleHeight,
    moduleWidth,
    gapY,
    floors,
    towerBaseY,
    towerWidth,
    bayWidth,
    facadeFrontZ,
    balconyColumns,
  ]);

  const railingTransforms = useMemo(() => {
    const transforms = [];
    if (balconyDepth <= 0.05) return transforms;
    const railHeight = moduleHeight * 0.58;
    const railThickness = 0.06;
    const columnsSet = new Set(balconyColumns);

    for (let floor = 0; floor < floors; floor += 1) {
      const y = towerBaseY + floor * (moduleHeight + gapY) + moduleHeight - railHeight / 2;
      columnsSet.forEach((column) => {
        const x = -towerWidth / 2 + column * bayWidth;
        transforms.push({
          position: [x, y, facadeFrontZ + balconyDepth - railThickness],
          scale: [moduleWidth * 0.9, railHeight, railThickness],
        });
      });
    }
    return transforms;
  }, [
    balconyDepth,
    moduleHeight,
    gapY,
    floors,
    towerBaseY,
    towerWidth,
    bayWidth,
    facadeFrontZ,
    balconyColumns,
    moduleWidth,
  ]);

  const frameTransforms = useMemo(() => {
    const transforms = [];
    const frameWidth = Math.max(0.22, moduleWidth * 0.16);
    const frameDepth = bodyDepth + balconyDepth * 0.6;

    for (let column = 0; column < modulesAcross; column += 1) {
      const x = -towerWidth / 2 + column * bayWidth;
      transforms.push({
        position: [x, towerCenterY, 0],
        scale: [frameWidth, towerHeight, frameDepth],
      });
    }

    transforms.push({
      position: [-towerWidth / 2 - frameWidth * 0.5, towerCenterY, 0],
      scale: [frameWidth * 0.8, towerHeight, frameDepth],
    });
    transforms.push({
      position: [towerWidth / 2 + frameWidth * 0.5, towerCenterY, 0],
      scale: [frameWidth * 0.8, towerHeight, frameDepth],
    });

    return transforms;
  }, [
    modulesAcross,
    moduleWidth,
    bodyDepth,
    balconyDepth,
    towerCenterY,
    towerHeight,
    towerWidth,
    bayWidth,
  ]);

  const accentTransforms = useMemo(() => {
    const transforms = [];
    const accentWidth = moduleWidth * 0.48;
    const accentDepth = bodyDepth + balconyDepth * 0.3;
    accentColumns.forEach((column) => {
      const x = -towerWidth / 2 + column * bayWidth;
      transforms.push({
        position: [x, towerCenterY, 0],
        scale: [accentWidth, towerHeight, accentDepth],
      });
    });
    return transforms;
  }, [accentColumns, moduleWidth, bodyDepth, balconyDepth, towerCenterY, towerHeight, towerWidth, bayWidth]);

  const slabTransforms = useMemo(() => {
    const transforms = [];
    const slabThickness = Math.max(0.08, moduleHeight * 0.12);
    for (let floor = 0; floor <= floors; floor += 4) {
      const y = towerBaseY + floor * (moduleHeight + gapY);
      transforms.push({
        position: [0, y, 0],
        scale: [towerWidth + 0.8, slabThickness, bodyDepth + balconyDepth * 0.5],
      });
    }
    return transforms;
  }, [floors, moduleHeight, gapY, towerBaseY, towerWidth, bodyDepth, balconyDepth]);

  const planterTransforms = useMemo(() => {
    const transforms = [];
    if (skyGardenFloors.length === 0) return transforms;
    const planterHeight = 0.32;
    skyGardenFloors.forEach((floorIndex) => {
      if (floorIndex < 0 || floorIndex >= floors) return;
      const y = towerBaseY + floorIndex * (moduleHeight + gapY) + moduleHeight + planterHeight / 2;
      transforms.push({
        position: [0, y, facadeFrontZ + balconyDepth * 0.45],
        scale: [towerWidth * 0.82, planterHeight, balconyDepth * 0.7],
      });
    });
    return transforms;
  }, [
    skyGardenFloors,
    floors,
    towerBaseY,
    moduleHeight,
    gapY,
    towerWidth,
    facadeFrontZ,
    balconyDepth,
  ]);

  useInstancedLayout(windowRef, windowTransforms);
  useInstancedLayout(balconyRef, balconyTransforms);
  useInstancedLayout(railingRef, railingTransforms);
  useInstancedLayout(frameRef, frameTransforms);
  useInstancedLayout(accentRef, accentTransforms);
  useInstancedLayout(slabRef, slabTransforms);
  useInstancedLayout(planterRef, planterTransforms);

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, GROUND_LEVEL + podiumHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[podiumWidth, podiumHeight, podiumDepth]} />
        <meshStandardMaterial color={palette.podium} roughness={0.78} />
      </mesh>

      <mesh position={[0, towerCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[towerWidth * 0.96, towerHeight, bodyDepth - 0.8]} />
        <meshStandardMaterial color={palette.body} roughness={0.82} metalness={0.04} />
      </mesh>

      <mesh position={[0, towerCenterY, -bodyDepth * 0.12]} castShadow receiveShadow>
        <boxGeometry args={[towerWidth * 0.28, towerHeight, bodyDepth * 0.38]} />
        <meshStandardMaterial color={palette.accentShadow} roughness={0.68} metalness={0.08} />
      </mesh>

      <group position={[0, roofY, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[towerWidth + 0.8, roofHeight, towerDepth + 0.8]} />
          <meshStandardMaterial color={palette.roof} roughness={0.65} metalness={0.08} />
        </mesh>
        <mesh position={[0, roofHeight * 0.35, -towerDepth * 0.08]} castShadow>
          <boxGeometry args={[towerWidth * 0.36, roofHeight * 0.8, towerDepth * 0.32]} />
          <meshStandardMaterial color={palette.roofAccent} roughness={0.58} metalness={0.12} />
        </mesh>
        <mesh position={[towerWidth * 0.3, roofHeight * 0.2, towerDepth * 0.18]} castShadow>
          <boxGeometry args={[towerWidth * 0.24, roofHeight * 0.6, towerDepth * 0.18]} />
          <meshStandardMaterial color={palette.roofAccent} roughness={0.58} metalness={0.12} />
        </mesh>
      </group>

      {frameTransforms.length > 0 && (
        <instancedMesh ref={frameRef} args={[null, null, frameTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.frame} roughness={0.78} metalness={0.06} />
        </instancedMesh>
      )}

      {accentTransforms.length > 0 && (
        <instancedMesh ref={accentRef} args={[null, null, accentTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.accent} roughness={0.7} metalness={0.08} />
        </instancedMesh>
      )}

      {slabTransforms.length > 0 && (
        <instancedMesh ref={slabRef} args={[null, null, slabTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.slab} roughness={0.82} metalness={0.03} />
        </instancedMesh>
      )}

      {balconyTransforms.length > 0 && (
        <instancedMesh ref={balconyRef} args={[null, null, balconyTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.balcony} roughness={0.76} metalness={0.04} />
        </instancedMesh>
      )}

      {railingTransforms.length > 0 && (
        <instancedMesh ref={railingRef} args={[null, null, railingTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.rail} roughness={0.55} metalness={0.22} />
        </instancedMesh>
      )}

      {windowTransforms.length > 0 && (
        <instancedMesh ref={windowRef} args={[null, null, windowTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.window} roughness={0.22} metalness={0.58} transparent opacity={0.92} />
        </instancedMesh>
      )}

      {planterTransforms.length > 0 && (
        <instancedMesh ref={planterRef} args={[null, null, planterTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.garden} roughness={0.7} metalness={0.04} />
        </instancedMesh>
      )}

      <mesh position={[towerWidth / 2 + 0.18, towerCenterY, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[towerHeight * 0.02, towerHeight * 0.64, bodyDepth * 0.34]} />
        <meshStandardMaterial color={palette.signage} roughness={0.75} />
      </mesh>
    </group>
  );
}

function ApartmentComplex() {
  const {
    floors,
    modulesAcross,
    moduleWidth,
    moduleHeight,
    bodyDepth,
    balconyDepth,
    gapX,
    gapY,
    towerColor,
    frameColor,
    accentColor,
    accentShadowColor,
    glassColor,
    balconyColor,
    railColor,
    roofColor,
    roofAccentColor,
    podiumColor,
    slabColor,
    plazaColor,
    pathColor,
    lawnColor,
    gardenColor,
    treeTrunkColor,
    communityColor,
  } = useControls('Helio City', {
    floors: { value: 29, min: 20, max: 32, step: 1 },
    modulesAcross: { value: 5, min: 3, max: 6, step: 1 },
    moduleWidth: { value: 6.6, min: 4.4, max: 8.4, step: 0.1 },
    moduleHeight: { value: 1.02, min: 0.7, max: 1.4, step: 0.02 },
    bodyDepth: { value: 7.6, min: 5.4, max: 9.5, step: 0.1 },
    balconyDepth: { value: 1.18, min: 0.4, max: 2.0, step: 0.05 },
    gapX: { value: 0.36, min: 0.12, max: 0.8, step: 0.02 },
    gapY: { value: 0.16, min: 0.08, max: 0.4, step: 0.02 },
    towerColor: { label: 'Facade Base', value: '#dfe4ec' },
    frameColor: { label: 'Frame', value: '#f5f7f9' },
    accentColor: { label: 'Accent Panel', value: '#c7cfd6' },
    accentShadowColor: { label: 'Core Panel', value: '#bcc4ca' },
    glassColor: { label: 'Glass', value: '#95b1c9' },
    balconyColor: { label: 'Balcony Slab', value: '#d3d6d2' },
    railColor: { label: 'Balcony Rail', value: '#b6bec7' },
    roofColor: { label: 'Roof Base', value: '#c7ccd0' },
    roofAccentColor: { label: 'Roof Pods', value: '#b9c0c5' },
    podiumColor: { label: 'Podium', value: '#d4d7d2' },
    slabColor: { label: 'Horizontal Bands', value: '#e6e9eb' },
    plazaColor: { label: 'Central Plaza', value: '#c9cec6' },
    pathColor: { label: 'Pathways', value: '#b7a085' },
    lawnColor: { label: 'Lawn Base', value: '#8ea685' },
    gardenColor: { label: 'Planter Green', value: '#6f916e' },
    treeTrunkColor: { label: 'Tree Trunk', value: '#7a6754' },
    communityColor: { label: 'Community Facilities', value: '#d8dad6' },
  });

  const palette = useMemo(
    () => ({
      body: towerColor,
      frame: frameColor,
      accent: accentColor,
      accentShadow: accentShadowColor,
      window: glassColor,
      balcony: balconyColor,
      rail: railColor,
      roof: roofColor,
      roofAccent: roofAccentColor,
      podium: podiumColor,
      slab: slabColor,
      plaza: plazaColor,
      path: pathColor,
      lawn: lawnColor,
      garden: gardenColor,
      signage: accentShadowColor,
      treeTrunk: treeTrunkColor,
      community: communityColor,
    }),
    [
      towerColor,
      frameColor,
      accentColor,
      accentShadowColor,
      glassColor,
      balconyColor,
      railColor,
      roofColor,
      roofAccentColor,
      podiumColor,
      slabColor,
      plazaColor,
      pathColor,
      lawnColor,
      gardenColor,
      treeTrunkColor,
      communityColor,
    ],
  );

  const baseConfig = useMemo(
    () => ({
      floors,
      modulesAcross,
      moduleWidth,
      moduleHeight,
      bodyDepth,
      balconyDepth,
      gapX,
      gapY,
      podiumHeight: 2.6,
      podiumMarginX: 2.3,
      podiumMarginZ: 2.5,
      roofHeight: 2.2,
      windowDepth: 0.18,
      facadeInset: 0.24,
    }),
    [floors, modulesAcross, moduleWidth, moduleHeight, bodyDepth, balconyDepth, gapX, gapY],
  );

  const { towerWidth, towerDepth } = useMemo(() => getTowerMetrics(baseConfig), [baseConfig]);

  const towerSpacingX = towerWidth + 18;
  const towerSpacingZ = towerDepth + 26;

  const towerDefinitions = useMemo(() => {
    const makeConfig = (overrides = {}) => ({ ...baseConfig, ...overrides });
    return [
      {
        position: [-towerSpacingX, 0, -towerSpacingZ * 0.58],
        rotation: [0, 0.04, 0],
        config: makeConfig({ floors: floors - 2 }),
        variant: {
          balconyColumns: [1, 2, 3],
          accentColumns: [2],
          skyGardenFloors: [14],
        },
      },
      {
        position: [0, 0, -towerSpacingZ * 0.7],
        rotation: [0, 0.01, 0],
        config: makeConfig(),
        variant: {
          balconyColumns: [1, 2, 3],
          accentColumns: [2],
          skyGardenFloors: [8, 17],
        },
      },
      {
        position: [towerSpacingX, 0, -towerSpacingZ * 0.58],
        rotation: [0, -0.05, 0],
        config: makeConfig({ floors: floors - 1 }),
        variant: {
          balconyColumns: [1, 2, 3],
          accentColumns: [2, 3],
        },
      },
      {
        position: [-towerSpacingX * 0.92, 0, towerSpacingZ * 0.28],
        rotation: [0, 0.08, 0],
        config: makeConfig({ floors: floors - 3 }),
        variant: {
          balconyColumns: [1, 2],
          accentColumns: [1, 2],
        },
      },
      {
        position: [towerSpacingX * 0.95, 0, towerSpacingZ * 0.34],
        rotation: [0, -0.08, 0],
        config: makeConfig({ floors: floors - 4 }),
        variant: {
          balconyColumns: [2, 3],
          accentColumns: [2],
        },
      },
      {
        position: [-towerSpacingX * 0.4, 0, towerSpacingZ * 0.95],
        rotation: [0, 0.03, 0],
        config: makeConfig({ floors: Math.max(18, floors - 8), modulesAcross: modulesAcross - 1 }),
        variant: {
          balconyColumns: [1, 2],
          accentColumns: [1],
        },
      },
      {
        position: [towerSpacingX * 0.42, 0, towerSpacingZ * 1.0],
        rotation: [0, -0.02, 0],
        config: makeConfig({ floors: Math.max(17, floors - 9), modulesAcross: modulesAcross - 1 }),
        variant: {
          balconyColumns: [1],
          accentColumns: [1],
        },
      },
    ];
  }, [baseConfig, floors, modulesAcross, towerSpacingX, towerSpacingZ]);

  const siteWidth = towerSpacingX * 3.4;
  const siteDepth = towerSpacingZ * 2.4;

  const innerLawnWidth = towerSpacingX * 1.9;
  const innerLawnDepth = towerSpacingZ * 1.28;

  const centralPlazaWidth = innerLawnWidth * 0.72;
  const centralPlazaDepth = innerLawnDepth * 0.62;

  const treePlacements = useMemo(
    () => [
      { position: [-towerSpacingX * 1.45, -towerSpacingZ * 0.9], scale: 1.1 },
      { position: [-towerSpacingX * 1.2, towerSpacingZ * 0.4], scale: 0.95 },
      { position: [-towerSpacingX * 0.4, towerSpacingZ * 1.35], scale: 1.15 },
      { position: [towerSpacingX * 0.5, towerSpacingZ * 1.4], scale: 1 },
      { position: [towerSpacingX * 1.25, -towerSpacingZ * 0.85], scale: 1.05 },
      { position: [towerSpacingX * 1.4, towerSpacingZ * 0.35], scale: 1.08 },
      { position: [-towerSpacingX * 0.1, -towerSpacingZ * 1.1], scale: 0.9 },
      { position: [towerSpacingX * 0.2, -towerSpacingZ * 1.2], scale: 1.0 },
      { position: [-towerSpacingX * 1.1, towerSpacingZ * 1.1], scale: 0.88 },
    ],
    [towerSpacingX, towerSpacingZ],
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.06, 0]} receiveShadow>
        <planeGeometry args={[siteWidth + 40, siteDepth + 40]} />
        <meshStandardMaterial color="#eef1f3" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]} receiveShadow>
        <planeGeometry args={[siteWidth, siteDepth]} />
        <meshStandardMaterial color={palette.lawn} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.01, 0]} receiveShadow>
        <planeGeometry args={[innerLawnWidth, innerLawnDepth]} />
        <meshStandardMaterial color={palette.plaza} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.005, 0]} receiveShadow>
        <planeGeometry args={[centralPlazaWidth, centralPlazaDepth]} />
        <meshStandardMaterial color={palette.path} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL, 0]} receiveShadow>
        <planeGeometry args={[centralPlazaWidth * 0.72, centralPlazaDepth * 0.68]} />
        <meshStandardMaterial color={palette.plaza} />
      </mesh>

      <mesh position={[towerSpacingX * 0.22, GROUND_LEVEL + 1.8, towerSpacingZ * 1.32]} castShadow receiveShadow>
        <boxGeometry args={[towerWidth * 0.9, 3.6, towerDepth * 0.65]} />
        <meshStandardMaterial color={palette.community} roughness={0.78} />
      </mesh>
      <mesh
        position={[towerSpacingX * 0.22, GROUND_LEVEL + 3.1, towerSpacingZ * 1.32]}
        scale={[towerWidth * 0.62, 0.12, towerDepth * 0.38]}
        rotation={[0, 0, 0]}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.path} roughness={0.64} />
      </mesh>

      <mesh position={[-towerSpacingX * 0.85, GROUND_LEVEL + 0.7, towerSpacingZ * 1.18]} castShadow receiveShadow>
        <boxGeometry args={[towerWidth * 0.48, 1.4, towerDepth * 0.4]} />
        <meshStandardMaterial color={palette.community} roughness={0.82} />
      </mesh>

      <mesh position={[towerSpacingX * 1.05, GROUND_LEVEL + 0.5, -towerSpacingZ * 0.92]} castShadow receiveShadow>
        <boxGeometry args={[towerWidth * 0.45, 1, towerDepth * 0.38]} />
        <meshStandardMaterial color={palette.community} roughness={0.8} />
      </mesh>

      <mesh position={[0, GROUND_LEVEL + 0.04, towerSpacingZ * 0.4]} rotation={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[towerWidth * 0.38, 0.08, towerDepth * 0.8]} />
        <meshStandardMaterial color={palette.path} />
      </mesh>

      <mesh position={[0, GROUND_LEVEL + 0.04, -towerSpacingZ * 0.1]} rotation={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[towerWidth * 0.9, 0.08, towerDepth * 0.24]} />
        <meshStandardMaterial color={palette.path} />
      </mesh>

      <mesh position={[-towerSpacingX * 0.4, GROUND_LEVEL + 0.05, -towerSpacingZ * 0.25]} rotation={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[towerWidth * 0.2, 0.1, towerDepth * 0.4]} />
        <meshStandardMaterial color={palette.plaza} />
      </mesh>

      <mesh position={[towerSpacingX * 0.4, GROUND_LEVEL + 0.05, -towerSpacingZ * 0.25]} rotation={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[towerWidth * 0.2, 0.1, towerDepth * 0.4]} />
        <meshStandardMaterial color={palette.plaza} />
      </mesh>

      <mesh position={[towerSpacingX * 0.88, GROUND_LEVEL + 0.12, towerSpacingZ * 0.62]} castShadow receiveShadow>
        <boxGeometry args={[towerWidth * 0.28, 0.24, towerDepth * 0.22]} />
        <meshStandardMaterial color={palette.path} />
      </mesh>
      <mesh position={[towerSpacingX * 0.88, GROUND_LEVEL + 0.24, towerSpacingZ * 0.62]} castShadow>
        <cylinderGeometry args={[towerWidth * 0.12, towerWidth * 0.12, 0.18, 24]} />
        <meshStandardMaterial color={palette.garden} />
      </mesh>

      {towerDefinitions.map(({ position, rotation, config, variant }, index) => (
        <HelioTower key={`tower-${index}`} config={config} palette={palette} variant={variant} position={position} rotation={rotation} />
      ))}

      {treePlacements.map((tree, index) => (
        <Tree key={`tree-${index}`} position={tree.position} scale={tree.scale} palette={palette} />
      ))}
    </group>
  );
}

export default function AptComplex00() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '560px' }}>
      <Canvas
        shadows
        camera={{
          position: [110, 72, 120],
          fov: 43,
          near: 0.1,
          far: 100000,
        }}
      >
        <color attach="background" args={['#f3f6f8']} />

        <hemisphereLight intensity={0.42} color="#fbf9f6" groundColor="#d6d6d1" />
        <directionalLight
          position={[160, 180, 120]}
          intensity={1.3}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-220}
          shadow-camera-right={220}
          shadow-camera-top={180}
          shadow-camera-bottom={-180}
        />
        <ambientLight intensity={0.28} />

        <ApartmentComplex />

        <OrbitControls
          target={[0, 12, 0]}
          maxPolarAngle={Math.PI / 2.08}
          minDistance={25}
          maxDistance={260}
          enableDamping
        />
      </Canvas>
    </div>
  );
}
