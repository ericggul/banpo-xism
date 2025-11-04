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

function getTowerMetrics({ floors, unitsPerRow, moduleWidth, moduleHeight, moduleDepth, spacingX, spacingY, unitInset }) {
  const towerWidth = (unitsPerRow - 1) * spacingX + moduleWidth;
  const towerHeight = floors * spacingY + moduleHeight;
  const towerDepth = moduleDepth + unitInset * 2;
  return { towerWidth, towerHeight, towerDepth };
}

function MinimalTower({ config, palette, position }) {
  const { floors, unitsPerRow, moduleWidth, moduleHeight, moduleDepth, spacingX, spacingY, unitInset } = config;
  const { towerWidth, towerHeight, towerDepth } = useMemo(
    () => getTowerMetrics(config),
    [floors, unitsPerRow, moduleWidth, moduleHeight, moduleDepth, spacingX, spacingY, unitInset],
  );

  const towerBaseY = GROUND_LEVEL;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const unitRef = useRef();
  const bandRef = useRef();
  const windowRef = useRef();

  const unitTransforms = useMemo(() => {
    const transforms = [];
    const zFront = towerDepth / 2 - moduleDepth / 2 - unitInset;
    const zBack = -zFront;
    for (let floor = 0; floor < floors; floor += 1) {
      const y = towerBaseY + floor * spacingY + moduleHeight / 2;
      for (let column = 0; column < unitsPerRow; column += 1) {
        const x = -towerWidth / 2 + column * spacingX;
        transforms.push({ position: [x, y, zFront] });
        transforms.push({ position: [x, y, zBack] });
      }
    }
    return transforms;
  }, [floors, moduleHeight, spacingY, unitsPerRow, towerWidth, spacingX, towerDepth, moduleDepth, unitInset, towerBaseY]);

  const bandTransforms = useMemo(() => {
    const transforms = [];
    const bandWidth = moduleWidth * 0.3;
    const bandDepth = towerDepth;
    for (let column = 0; column < unitsPerRow; column += 1) {
      const x = -towerWidth / 2 + column * spacingX;
      transforms.push({
        position: [x, towerCenterY, 0],
        scale: [bandWidth, towerHeight, bandDepth],
      });
    }
    return transforms;
  }, [unitsPerRow, moduleWidth, towerDepth, towerCenterY, towerHeight, towerWidth, spacingX]);

  const windowTransforms = useMemo(() => {
    const transforms = [];
    const windowWidth = moduleWidth * 0.68;
    const windowHeight = moduleHeight * 0.65;
    const windowDepth = Math.min(0.22, moduleDepth * 0.25);
    const recessedOffset = moduleDepth / 2 - windowDepth / 2 - Math.min(0.06, moduleDepth * 0.12);
    const zFront = towerDepth / 2 - moduleDepth / 2 - unitInset + recessedOffset;
    const zBack = -zFront;

    for (let floor = 0; floor < floors; floor += 1) {
      const y = towerBaseY + floor * spacingY + moduleHeight / 2 + moduleHeight * 0.04;
      for (let column = 0; column < unitsPerRow; column += 1) {
        const x = -towerWidth / 2 + column * spacingX;
        transforms.push({
          position: [x, y, zFront],
          scale: [windowWidth, windowHeight, windowDepth],
        });
        transforms.push({
          position: [x, y, zBack],
          scale: [windowWidth, windowHeight, windowDepth],
        });
      }
    }
    return transforms;
  }, [
    floors,
    moduleWidth,
    moduleHeight,
    moduleDepth,
    spacingY,
    unitsPerRow,
    towerBaseY,
    towerDepth,
    towerWidth,
    spacingX,
    unitInset,
  ]);

  useInstancedLayout(unitRef, unitTransforms);
  useInstancedLayout(bandRef, bandTransforms);
  useInstancedLayout(windowRef, windowTransforms);

  return (
    <group position={position}>
      {unitTransforms.length > 0 && (
        <instancedMesh ref={unitRef} args={[null, null, unitTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[moduleWidth, moduleHeight, moduleDepth]} />
          <meshStandardMaterial color={palette.unit} roughness={0.85} metalness={0.05} />
        </instancedMesh>
      )}
    </group>
  );
}

function ApartmentComplex() {
  const {
    moduleWidth,
    moduleHeight,
    moduleDepth,
    unitsPerRow,
    unitColor,
    bandColor,
    windowColor,
  } = useControls('Tower', {
    moduleWidth: {
      value: 9,
      min: 4,
      max: 14,
      step: 0.1,
    },
    moduleHeight: {
      value: 1.05,
      min: 0.6,
      max: 2.2,
      step: 0.05,
    },
    moduleDepth: {
      value: 2,
      min: 1,
      max: 6,
      step: 0.1,
    },
    unitsPerRow: {
      value: 4,
      min: 2,
      max: 10,
      step: 1,
    },
    unitColor: {
      label: 'Unit Color',
      value: '#d7d9d5',
    },
    bandColor: {
      label: 'Band Color',
      value: '#ffffff',
    },
    windowColor: {
      label: 'Window Color',
      value: '#a9bfd7',
    },
  });

  const palette = useMemo(
    () => ({
      unit: unitColor,
      band: bandColor,
      window: windowColor,
    }),
    [unitColor, bandColor, windowColor],
  );

  const baseConfig = useMemo(
    () => ({
      floors: 25,
      unitsPerRow,
      moduleWidth,
      moduleHeight,
      moduleDepth,
      spacingX: moduleWidth + 0.22,
      spacingY: moduleHeight + 0.1,
      unitInset: 2.0 * 0.18,
    }),
    [moduleWidth, moduleHeight, moduleDepth, unitsPerRow],
  );

  const rows = 1;
  const cols = 5;

  const metrics = useMemo(
    () => getTowerMetrics(baseConfig),
    [baseConfig],
  );
  const towerWidth = metrics.towerWidth;
  const towerDepth = metrics.towerDepth;

  const towerSpacingX = towerWidth + 4;
  const towerSpacingZ = towerDepth + 15;



  const towerPlacements = useMemo(() => {
    const placements = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        placements.push({
          position: [
            (col - (cols - 1) / 2) * towerSpacingX,
            0,
            (row - (rows - 1) / 2) * towerSpacingZ,
          ],
          config: baseConfig,
        });
      }
    }
    return placements;
  }, [rows, cols, towerSpacingX, towerSpacingZ, baseConfig]);

  const complexWidth = cols * towerSpacingX + 48;
  const complexDepth = rows * towerSpacingZ + 48;

  const plazaWidth = towerWidth * 1.08;
  const plazaDepth = towerDepth * 0.78;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]} receiveShadow>
        <planeGeometry args={[complexWidth, complexDepth]} />
        <meshStandardMaterial color="#ebede9" />
      </mesh>

      {towerPlacements.map(({ position, config }, index) => (
        <MinimalTower key={`tower-${index}`} config={config} palette={palette} position={position} />
      ))}

      {towerPlacements.map(({ position }, index) => (
        <mesh
          key={`plaza-${index}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[position[0], GROUND_LEVEL - 0.01, position[2]]}
          receiveShadow
        >
          <planeGeometry args={[plazaWidth, plazaDepth]} />
          <meshStandardMaterial color="#d6d9d4" />
        </mesh>
      ))}
    </group>
  );
}

export default function AptComplex00() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '560px' }}>
      <Canvas shadows camera={{ position: [90, 60, 90], fov: 45,
      near: 0.1,
        far: 100000,
       }}>
        <color attach="background" args={['#f2f5f8']} />

        <hemisphereLight intensity={0.5} color="#fefdfa" groundColor="#d8d8d4" />
        <directionalLight
          position={[120, 150, 88]}
          intensity={1.35}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-180}
          shadow-camera-right={180}
          shadow-camera-top={140}
          shadow-camera-bottom={-140}
        />
        <ambientLight intensity={0.22} />

        <ApartmentComplex />

        <OrbitControls target={[0, 8, 0]} maxPolarAngle={Math.PI / 2.08} minDistance={12} maxDistance={220} enableDamping />
      </Canvas>
    </div>
  );
}
