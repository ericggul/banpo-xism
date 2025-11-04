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
  }, [transforms, ref]);
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
    [config],
  );

  const towerBaseY = GROUND_LEVEL;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const unitRef = useRef();
  const bandRef = useRef();

  const unitTransforms = useMemo(() => {
    const transforms = [];
    const zFront = towerDepth / 2 - moduleDepth / 2;
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
  }, [floors, moduleHeight, spacingY, unitsPerRow, towerWidth, spacingX, towerDepth, moduleDepth, towerBaseY]);

  const bandTransforms = useMemo(() => {
    const transforms = [];
    const bandWidth = moduleWidth * 0.3;
    const bandDepth = moduleDepth + Math.min(moduleDepth * 0.4, unitInset * 1.6);
    for (let column = 0; column < unitsPerRow; column += 1) {
      const x = -towerWidth / 2 + column * spacingX;
      transforms.push({
        position: [x, towerCenterY, 0],
        scale: [bandWidth, towerHeight, bandDepth],
      });
    }
    return transforms;
  }, [unitsPerRow, moduleWidth, towerCenterY, towerHeight, towerWidth, spacingX, moduleDepth, unitInset]);

  const {
    frontGlass,
    frontFrames,
    frontMullions,
    balconySlabs,
    balconyRails,
    balconyPosts,
    backGlass,
    backFrames,
    backLouvers,
  } = useMemo(() => {
    const result = {
      frontGlass: [],
      frontFrames: [],
      frontMullions: [],
      balconySlabs: [],
      balconyRails: [],
      balconyPosts: [],
      backGlass: [],
      backFrames: [],
      backLouvers: [],
    };

    const frontWindowWidth = moduleWidth * 0.78;
    const frontWindowHeight = moduleHeight * 0.64;
    const backWindowWidth = moduleWidth * 0.52;
    const backWindowHeight = moduleHeight * 0.46;

    const frontSillOffset = moduleHeight * 0.18;
    const backSillOffset = moduleHeight * 0.34;

    const windowRecess = Math.min(0.12, moduleDepth * 0.2);
    const frameThickness = Math.max(0.08, moduleWidth * 0.02);
    const frameDepth = Math.min(0.18, moduleDepth * 0.24);
    const mullionThickness = Math.max(0.05, frameThickness * 0.6);
    const mullionDepth = frameDepth * 0.72;
    const transomThickness = Math.max(0.045, frameThickness * 0.65);

    const balconySlabDepth = Math.min(0.58, unitInset + 0.34);
    const balconySlabThickness = 0.12;
    const railThickness = 0.045;
    const railDepth = railThickness * 1.2;
    const postThickness = railThickness * 1.2;
    const postDepth = railDepth;

    const frontPlaneZ = towerDepth / 2 - windowRecess;
    const backPlaneZ = -frontPlaneZ;
    const frontFrameZ = frontPlaneZ + frameDepth / 2;
    const backFrameZ = backPlaneZ - frameDepth / 2;
    const frontGlassZ = frontPlaneZ - 0.015;
    const backGlassZ = backPlaneZ + 0.015;
    const balconyFrontZ = frontPlaneZ + balconySlabDepth / 2;

    for (let floor = 0; floor < floors; floor += 1) {
      const floorBaseY = towerBaseY + floor * spacingY;
      const frontSillY = floorBaseY + frontSillOffset;
      const backSillY = floorBaseY + backSillOffset;

      const frontCenterY = frontSillY + frontWindowHeight / 2;
      const backCenterY = backSillY + backWindowHeight / 2;

      const frontTopY = frontCenterY + frontWindowHeight / 2;
      const frontBottomY = frontCenterY - frontWindowHeight / 2;
      const backTopY = backCenterY + backWindowHeight / 2;
      const backBottomY = backCenterY - backWindowHeight / 2;

      for (let column = 0; column < unitsPerRow; column += 1) {
        const x = -towerWidth / 2 + column * spacingX;

        result.frontGlass.push({
          position: [x, frontCenterY, frontGlassZ],
          rotation: [0, 0, 0],
          scale: [frontWindowWidth, frontWindowHeight, 1],
        });

        result.frontFrames.push({
          position: [x, frontTopY + frameThickness / 2, frontFrameZ],
          scale: [frontWindowWidth + frameThickness * 2, frameThickness, frameDepth],
        });
        result.frontFrames.push({
          position: [x, frontBottomY - frameThickness / 2, frontFrameZ],
          scale: [frontWindowWidth + frameThickness * 2, frameThickness, frameDepth],
        });

        const frontLeftX = x - frontWindowWidth / 2 - frameThickness / 2;
        const frontRightX = x + frontWindowWidth / 2 + frameThickness / 2;
        result.frontFrames.push({
          position: [frontLeftX, frontCenterY, frontFrameZ],
          scale: [frameThickness, frontWindowHeight + frameThickness * 2, frameDepth],
        });
        result.frontFrames.push({
          position: [frontRightX, frontCenterY, frontFrameZ],
          scale: [frameThickness, frontWindowHeight + frameThickness * 2, frameDepth],
        });

        const mullionOffset = frontWindowWidth * 0.22;
        const mullionZ = frontPlaneZ + mullionDepth / 2;
        result.frontMullions.push({
          position: [x - mullionOffset, frontCenterY, mullionZ],
          scale: [mullionThickness, frontWindowHeight + frameThickness * 0.4, mullionDepth],
        });
        result.frontMullions.push({
          position: [x + mullionOffset, frontCenterY, mullionZ],
          scale: [mullionThickness, frontWindowHeight + frameThickness * 0.4, mullionDepth],
        });
        result.frontMullions.push({
          position: [x, frontTopY - frontWindowHeight * 0.25, mullionZ],
          scale: [frontWindowWidth + frameThickness * 1.2, transomThickness, mullionDepth],
        });

        const slabY = frontBottomY - frameThickness - balconySlabThickness / 2 - 0.06;
        result.balconySlabs.push({
          position: [x, slabY, balconyFrontZ],
          scale: [frontWindowWidth * 1.05, balconySlabThickness, balconySlabDepth],
        });

        const railZ = frontPlaneZ + balconySlabDepth - railDepth / 2;
        const railLevels = [0.24, 0.46, 0.68];
        railLevels.forEach((level) => {
          const railY = frontBottomY + frameThickness + frontWindowHeight * level;
          result.balconyRails.push({
            position: [x, railY, railZ],
            scale: [frontWindowWidth * 0.98, railThickness, railDepth],
          });
        });

        const postZ = frontPlaneZ + balconySlabDepth - postDepth / 2;
        const postHeight = frontWindowHeight * 0.78;
        const postY = frontBottomY + frameThickness + postHeight / 2;
        const postOffsetX = frontWindowWidth / 2 - frameThickness * 0.5;
        result.balconyPosts.push({
          position: [x - postOffsetX, postY, postZ],
          scale: [postThickness, postHeight, postDepth],
        });
        result.balconyPosts.push({
          position: [x + postOffsetX, postY, postZ],
          scale: [postThickness, postHeight, postDepth],
        });

        result.backGlass.push({
          position: [x, backCenterY, backGlassZ],
          rotation: [0, Math.PI, 0],
          scale: [backWindowWidth, backWindowHeight, 1],
        });

        result.backFrames.push({
          position: [x, backTopY + frameThickness / 2, backFrameZ],
          scale: [backWindowWidth + frameThickness * 1.8, frameThickness, frameDepth],
        });
        result.backFrames.push({
          position: [x, backBottomY - frameThickness / 2, backFrameZ],
          scale: [backWindowWidth + frameThickness * 1.8, frameThickness, frameDepth],
        });

        const backLeftX = x - backWindowWidth / 2 - frameThickness / 2;
        const backRightX = x + backWindowWidth / 2 + frameThickness / 2;
        result.backFrames.push({
          position: [backLeftX, backCenterY, backFrameZ],
          scale: [frameThickness, backWindowHeight + frameThickness * 2, frameDepth],
        });
        result.backFrames.push({
          position: [backRightX, backCenterY, backFrameZ],
          scale: [frameThickness, backWindowHeight + frameThickness * 2, frameDepth],
        });

        const louverDepth = mullionDepth * 0.66;
        const louverZ = backPlaneZ - louverDepth / 2;
        const louverLevels = [0.2, 0.4, 0.6, 0.8];
        louverLevels.forEach((level) => {
          const louverY = backBottomY + backWindowHeight * level;
          result.backLouvers.push({
            position: [x, louverY, louverZ],
            scale: [backWindowWidth * 0.95, transomThickness * 0.78, louverDepth],
          });
        });
      }
    }

    return result;
  }, [
    floors,
    unitsPerRow,
    moduleWidth,
    moduleHeight,
    moduleDepth,
    spacingX,
    spacingY,
    towerBaseY,
    towerDepth,
    towerWidth,
    unitInset,
  ]);

  const frontGlassRef = useRef();
  const frontFrameRef = useRef();
  const frontMullionRef = useRef();
  const balconySlabRef = useRef();
  const balconyRailRef = useRef();
  const balconyPostRef = useRef();
  const backGlassRef = useRef();
  const backFrameRef = useRef();
  const backLouverRef = useRef();

  useInstancedLayout(unitRef, unitTransforms);
  useInstancedLayout(bandRef, bandTransforms);
  useInstancedLayout(frontGlassRef, frontGlass);
  useInstancedLayout(frontFrameRef, frontFrames);
  useInstancedLayout(frontMullionRef, frontMullions);
  useInstancedLayout(balconySlabRef, balconySlabs);
  useInstancedLayout(balconyRailRef, balconyRails);
  useInstancedLayout(balconyPostRef, balconyPosts);
  useInstancedLayout(backGlassRef, backGlass);
  useInstancedLayout(backFrameRef, backFrames);
  useInstancedLayout(backLouverRef, backLouvers);

  return (
    <group position={position}>
      {unitTransforms.length > 0 && (
        <instancedMesh ref={unitRef} args={[null, null, unitTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[moduleWidth, moduleHeight, moduleDepth]} />
          <meshStandardMaterial color={palette.unit} roughness={0.85} metalness={0.05} />
        </instancedMesh>
      )}
      {bandTransforms.length > 0 && (
        <instancedMesh ref={bandRef} args={[null, null, bandTransforms.length]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.band} roughness={0.6} metalness={0.1} />
        </instancedMesh>
      )}
      {frontGlass.length > 0 && (
        <instancedMesh ref={frontGlassRef} args={[null, null, frontGlass.length]}>
          <planeGeometry args={[1, 1]} />
          <meshPhysicalMaterial
            color={palette.windowGlass ?? palette.window ?? '#a9bfd7'}
            roughness={0.08}
            metalness={0.1}
            transmission={0.72}
            thickness={0.4}
            transparent
            opacity={0.95}
            ior={1.45}
          />
        </instancedMesh>
      )}
      {frontFrames.length > 0 && (
        <instancedMesh ref={frontFrameRef} args={[null, null, frontFrames.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={palette.windowFrame ?? '#f2f1ee'}
            roughness={0.42}
            metalness={0.12}
          />
        </instancedMesh>
      )}
      {frontMullions.length > 0 && (
        <instancedMesh ref={frontMullionRef} args={[null, null, frontMullions.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={palette.windowFrame ?? '#f2f1ee'}
            roughness={0.35}
            metalness={0.18}
          />
        </instancedMesh>
      )}
      {balconySlabs.length > 0 && (
        <instancedMesh ref={balconySlabRef} args={[null, null, balconySlabs.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.balcony ?? '#cfd2cc'} roughness={0.6} metalness={0.08} />
        </instancedMesh>
      )}
      {balconyRails.length > 0 && (
        <instancedMesh ref={balconyRailRef} args={[null, null, balconyRails.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.railing ?? '#858b95'} roughness={0.25} metalness={0.65} />
        </instancedMesh>
      )}
      {balconyPosts.length > 0 && (
        <instancedMesh ref={balconyPostRef} args={[null, null, balconyPosts.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.railing ?? '#858b95'} roughness={0.28} metalness={0.62} />
        </instancedMesh>
      )}
      {backGlass.length > 0 && (
        <instancedMesh ref={backGlassRef} args={[null, null, backGlass.length]}>
          <planeGeometry args={[1, 1]} />
          <meshPhysicalMaterial
            color={palette.serviceGlass ?? palette.windowGlass ?? palette.window ?? '#b7c8d8'}
            roughness={0.15}
            metalness={0.08}
            transmission={0.58}
            thickness={0.32}
            transparent
            opacity={0.9}
            ior={1.4}
          />
        </instancedMesh>
      )}
      {backFrames.length > 0 && (
        <instancedMesh ref={backFrameRef} args={[null, null, backFrames.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.windowFrame ?? '#f2f1ee'} roughness={0.48} metalness={0.14} />
        </instancedMesh>
      )}
      {backLouvers.length > 0 && (
        <instancedMesh ref={backLouverRef} args={[null, null, backLouvers.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.railing ?? '#858b95'} roughness={0.35} metalness={0.32} />
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
      windowGlass: windowColor,
      windowFrame: '#f2f1ee',
      balcony: '#cfd2cc',
      railing: '#858b95',
      serviceGlass: '#b7c8d8',
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
