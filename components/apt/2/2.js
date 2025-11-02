'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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
    const bandWidth = moduleWidth * 0.32;
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

  useInstancedLayout(unitRef, unitTransforms);
  useInstancedLayout(bandRef, bandTransforms);

  return (
    <group position={position}>
      {unitTransforms.length > 0 && (
        <instancedMesh ref={unitRef} args={[null, null, unitTransforms.length]}  >
          <boxGeometry args={[moduleWidth, moduleHeight, moduleDepth]} />
          <meshStandardMaterial color={palette.unit} roughness={0.85} metalness={0.05} />
        </instancedMesh>
      )}
      {/* {bandTransforms.length > 0 && (
        <instancedMesh ref={bandRef} args={[null, null, bandTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.band} roughness={0.6} metalness={0.1} />
        </instancedMesh>
      )} */}
    </group>
  );
}

function ApartmentComplex() {
  const palette = {
    unit: '#d7d9d5',
    band: '#d7d9d5',
  };

  const baseConfig = {
    floors: 25,
    unitsPerRow: 6,
    moduleWidth: 5.5,
    moduleHeight: 1.05,
    moduleDepth: 4,
    spacingX: 5.5 + 0.22,
    spacingY: 1.05 + 0.18,
    unitInset:2.0 * 0.18,
  };

  const metrics = useMemo(
    () => getTowerMetrics(baseConfig),
    [
      baseConfig.floors,
      baseConfig.unitsPerRow,
      baseConfig.moduleWidth,
      baseConfig.moduleHeight,
      baseConfig.moduleDepth,
      baseConfig.spacingX,
      baseConfig.spacingY,
      baseConfig.unitInset,
    ],
  );
  const towerWidth = metrics.towerWidth;
  const towerDepth = metrics.towerDepth;

  const towerSpacingX = towerWidth + 4;
  const towerSpacingZ = towerDepth + 15;

  const rows = 10;
  const cols = 5;

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
  }, [rows, cols, towerSpacingX, towerSpacingZ]);

  const complexWidth = cols * towerSpacingX + 48;
  const complexDepth = rows * towerSpacingZ + 48;

  const plazaWidth = towerWidth * 1.08;
  const plazaDepth = towerDepth * 0.78;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]}>
        <planeGeometry args={[complexWidth, complexDepth]} />
        <meshStandardMaterial color="#ebede9" />
      </mesh>

      {towerPlacements.map(({ position, config }, index) => (
        <MinimalTower key={`tower-${index}`} config={config} palette={palette} position={position} />
      ))}

    </group>
  );
}

export default function AptComplex00() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '560px' }}>
      <Canvas  camera={{ position: [90, 60, 90], fov: 45,
      near: 0.01,
        far: 100000,
       }}>
        <color attach="background" args={['#f2f5f8']} />

        <hemisphereLight intensity={0.5} color="#fefdfa" groundColor="#d8d8d4" />
        <directionalLight
          position={[120, 150, 88]}
          intensity={1.35}
        />
        <ambientLight intensity={0.22} />

        <ApartmentComplex />

        <OrbitControls target={[0, 8, 0]} maxPolarAngle={Math.PI / 2.08} minDistance={12} maxDistance={260} enableDamping />
      </Canvas>
    </div>
  );
}
