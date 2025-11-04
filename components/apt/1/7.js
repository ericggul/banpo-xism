'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useControls } from 'leva';
import * as THREE from 'three';

const GROUND_LEVEL = -2.1;
const EPS = 0.01;

function useInstancedLayout(ref, transforms) {
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || !transforms || transforms.length === 0) return;

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

function MinimalTower({ config, palette, position, rotationY = 0 }) {
  const {
    floors,
    unitsPerRow,
    moduleWidth,
    moduleHeight,
    moduleDepth,
    spacingX,
    spacingY,
    unitInset,
    accentFloors = [],
  } = config;
  const { towerWidth, towerHeight, towerDepth } = useMemo(
    () => getTowerMetrics(config),
    [config],
  );

  const towerBaseY = GROUND_LEVEL;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const unitRef = useRef();
  const bandRef = useRef();
  const frontGlassRef = useRef();
  const frontFrameRef = useRef();
  const frontMullionRef = useRef();
  const frontBalconySlabRef = useRef();
  const frontBalconyRailRef = useRef();
  const frontBalconyPostRef = useRef();
  const backGlassRef = useRef();
  const backFrameRef = useRef();
  const backLouverRef = useRef();
  const backServiceSlabRef = useRef();
  const backServiceRailRef = useRef();
  const backServicePostRef = useRef();
  const backPipeRef = useRef();
  const backDividerRef = useRef();
  const accentRef = useRef();

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
    const bandWidth = moduleWidth * 0.28;
    const bandDepth = moduleDepth + Math.min(moduleDepth * 0.45, unitInset * 1.8);
    for (let column = 0; column < unitsPerRow; column += 1) {
      const x = -towerWidth / 2 + column * spacingX;
      transforms.push({
        position: [x, towerCenterY, 0],
        scale: [bandWidth, towerHeight, bandDepth],
      });
    }
    return transforms;
  }, [unitsPerRow, moduleWidth, moduleDepth, unitInset, towerCenterY, towerHeight, towerWidth, spacingX]);

  const accentTransforms = useMemo(() => {
    const transforms = [];
    if (!accentFloors || accentFloors.length === 0) return transforms;
    const bandHeight = Math.max(0.16, moduleHeight * 0.18);
    const bandThickness = Math.min(0.24, moduleDepth * 0.22);
    const frontZ = towerDepth / 2 + bandThickness / 2 + EPS;
    const backZ = -frontZ;
    const sideX = towerWidth / 2 + bandThickness / 2 + EPS;

    accentFloors.forEach((floorIdx) => {
      const y = towerBaseY + floorIdx * spacingY + moduleHeight / 2;
      transforms.push({ position: [0, y, frontZ], scale: [towerWidth + moduleWidth * 0.08, bandHeight, bandThickness] });
      transforms.push({ position: [0, y, backZ], scale: [towerWidth + moduleWidth * 0.08, bandHeight, bandThickness] });
      transforms.push({ position: [sideX, y, 0], rotation: [0, Math.PI / 2, 0], scale: [towerDepth + moduleDepth * 0.08, bandHeight, bandThickness] });
      transforms.push({ position: [-sideX, y, 0], rotation: [0, Math.PI / 2, 0], scale: [towerDepth + moduleDepth * 0.08, bandHeight, bandThickness] });
    });
    return transforms;
  }, [accentFloors, towerBaseY, spacingY, moduleHeight, towerWidth, moduleWidth, towerDepth, moduleDepth]);

  const {
    frontGlass,
    frontFrames,
    frontMullions,
    frontBalconySlabs,
    frontBalconyRails,
    frontBalconyPosts,
    backGlass,
    backFrames,
    backLouvers,
    backServiceSlabs,
    backServiceRails,
    backServicePosts,
    backPipeStacks,
    backDividerPanels,
  } = useMemo(() => {
    const result = {
      frontGlass: [],
      frontFrames: [],
      frontMullions: [],
      frontBalconySlabs: [],
      frontBalconyRails: [],
      frontBalconyPosts: [],
      backGlass: [],
      backFrames: [],
      backLouvers: [],
      backServiceSlabs: [],
      backServiceRails: [],
      backServicePosts: [],
      backPipeStacks: [],
      backDividerPanels: [],
    };

    const frontWindowWidth = moduleWidth * 0.78;
    const frontWindowHeight = moduleHeight * 0.64;
    const serviceWindowWidth = moduleWidth * 0.34;
    const serviceWindowHeight = moduleHeight * 0.44;

    const frontSillOffset = moduleHeight * 0.18;
    const serviceSillOffset = moduleHeight * 0.33;

    const windowRecessFront = Math.min(0.1, moduleDepth * 0.18);
    const serviceWindowRecess = Math.min(0.08, moduleDepth * 0.16);

    const frameThickness = Math.max(0.08, moduleWidth * 0.02);
    const frameDepth = Math.min(0.18, moduleDepth * 0.24);
    const mullionThickness = Math.max(0.05, frameThickness * 0.62);
    const mullionDepth = frameDepth * 0.72;
    const transomThickness = Math.max(0.045, frameThickness * 0.65);

    const serviceFrameThickness = Math.max(0.06, frameThickness * 0.78);
    const serviceFrameDepth = frameDepth * 0.78;
    const serviceMullionThickness = serviceFrameThickness * 0.6;
    const serviceLouverDepth = mullionDepth * 0.64;

    const balconyDepth = Math.min(0.56, unitInset + 0.32);
    const balconyThickness = 0.12;
    const balconyRailThickness = 0.045;
    const balconyRailDepth = balconyRailThickness * 1.15;
    const balconyPostThickness = balconyRailThickness * 1.12;
    const balconyPostDepth = balconyRailDepth;

    const serviceWalkDepth = Math.min(0.44, unitInset + 0.28);
    const serviceWalkThickness = 0.1;
    const serviceRailThickness = 0.038;
    const serviceRailDepth = serviceRailThickness * 0.95;
    const servicePostThickness = serviceRailThickness * 1.35;
    const servicePostDepth = serviceRailDepth * 1.1;

    const pipeThickness = 0.07;
    const pipeDepth = pipeThickness;

    const frontPlaneZ = towerDepth / 2 - windowRecessFront;
    const backPlaneZ = -towerDepth / 2 + serviceWindowRecess;
    const frontFrameZ = frontPlaneZ + frameDepth / 2;
    const backFrameZ = backPlaneZ - serviceFrameDepth / 2;
    const frontGlassZ = frontPlaneZ - 0.015;
    const backGlassZ = backPlaneZ + 0.012;
    const frontMullionZ = frontPlaneZ + mullionDepth / 2;
    const serviceLouverZ = backPlaneZ - serviceLouverDepth / 2;
    const balconyFrontZ = frontPlaneZ + balconyDepth / 2;
    const serviceWalkCenterZ = backPlaneZ - serviceWalkDepth / 2;
    const serviceRailZ = backPlaneZ - serviceWalkDepth + serviceRailDepth / 2;
    const pipeZ = backPlaneZ - serviceWalkDepth * 0.55;

    const serviceWindowOffsets = unitsPerRow > 1 ? [-moduleWidth * 0.22, moduleWidth * 0.22] : [0];
    const walkwayWidth = moduleWidth * 0.92;
    const railSpan = moduleWidth * 0.9;
    const walkwayHalfWidth = walkwayWidth / 2;

    for (let floor = 0; floor < floors; floor += 1) {
      const floorBaseY = towerBaseY + floor * spacingY;
      const frontSillY = floorBaseY + frontSillOffset;
      const serviceSillY = floorBaseY + serviceSillOffset;

      const frontCenterY = frontSillY + frontWindowHeight / 2;
      const backCenterY = serviceSillY + serviceWindowHeight / 2;

      const frontTopY = frontCenterY + frontWindowHeight / 2;
      const frontBottomY = frontCenterY - frontWindowHeight / 2;
      const serviceTopY = backCenterY + serviceWindowHeight / 2;
      const serviceBottomY = backCenterY - serviceWindowHeight / 2;

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

        const sideMullionOffset = frontWindowWidth * 0.24;
        result.frontMullions.push({
          position: [x - sideMullionOffset, frontCenterY, frontMullionZ],
          scale: [mullionThickness, frontWindowHeight + frameThickness * 0.4, mullionDepth],
        });
        result.frontMullions.push({
          position: [x + sideMullionOffset, frontCenterY, frontMullionZ],
          scale: [mullionThickness, frontWindowHeight + frameThickness * 0.4, mullionDepth],
        });
        result.frontMullions.push({
          position: [x, frontTopY - frontWindowHeight * 0.27, frontMullionZ],
          scale: [frontWindowWidth + frameThickness * 1.1, transomThickness, mullionDepth],
        });

        const balconySlabY = frontBottomY - frameThickness - balconyThickness / 2 - 0.06;
        result.frontBalconySlabs.push({
          position: [x, balconySlabY, balconyFrontZ],
          scale: [frontWindowWidth * 1.05, balconyThickness, balconyDepth],
        });

        const frontRailZ = frontPlaneZ + balconyDepth - balconyRailDepth / 2;
        const frontRailLevels = [0.25, 0.5, 0.74];
        frontRailLevels.forEach((level) => {
          const railY = frontBottomY + frameThickness + frontWindowHeight * level;
          result.frontBalconyRails.push({
            position: [x, railY, frontRailZ],
            scale: [frontWindowWidth * 0.98, balconyRailThickness, balconyRailDepth],
          });
        });

        const frontPostHeight = frontWindowHeight * 0.78;
        const frontPostY = frontBottomY + frameThickness + frontPostHeight / 2;
        const frontPostOffsetX = frontWindowWidth / 2 - frameThickness * 0.45;
        result.frontBalconyPosts.push({
          position: [x - frontPostOffsetX, frontPostY, frontRailZ],
          scale: [balconyPostThickness, frontPostHeight, balconyPostDepth],
        });
        result.frontBalconyPosts.push({
          position: [x + frontPostOffsetX, frontPostY, frontRailZ],
          scale: [balconyPostThickness, frontPostHeight, balconyPostDepth],
        });

        serviceWindowOffsets.forEach((offset) => {
          const serviceX = x + offset;

          result.backGlass.push({
            position: [serviceX, backCenterY, backGlassZ],
            rotation: [0, Math.PI, 0],
            scale: [serviceWindowWidth, serviceWindowHeight, 1],
          });

          result.backFrames.push({
            position: [serviceX, serviceTopY + serviceFrameThickness / 2, backFrameZ],
            scale: [serviceWindowWidth + serviceFrameThickness * 2, serviceFrameThickness, serviceFrameDepth],
          });
          result.backFrames.push({
            position: [serviceX, serviceBottomY - serviceFrameThickness / 2, backFrameZ],
            scale: [serviceWindowWidth + serviceFrameThickness * 2, serviceFrameThickness, serviceFrameDepth],
          });

          const serviceLeftX = serviceX - serviceWindowWidth / 2 - serviceFrameThickness / 2;
          const serviceRightX = serviceX + serviceWindowWidth / 2 + serviceFrameThickness / 2;
          result.backFrames.push({
            position: [serviceLeftX, backCenterY, backFrameZ],
            scale: [serviceFrameThickness, serviceWindowHeight + serviceFrameThickness * 2, serviceFrameDepth],
          });
          result.backFrames.push({
            position: [serviceRightX, backCenterY, backFrameZ],
            scale: [serviceFrameThickness, serviceWindowHeight + serviceFrameThickness * 2, serviceFrameDepth],
          });

          result.backLouvers.push({
            position: [serviceX, backCenterY, serviceLouverZ],
            scale: [serviceMullionThickness, serviceWindowHeight + serviceFrameThickness * 0.6, serviceLouverDepth],
          });

          const louverLevels = [0.2, 0.4, 0.6, 0.8];
          louverLevels.forEach((level) => {
            const louverY = serviceBottomY + serviceWindowHeight * level;
            result.backLouvers.push({
              position: [serviceX, louverY, serviceLouverZ],
              scale: [serviceWindowWidth * 0.94, serviceMullionThickness, serviceLouverDepth],
            });
          });
        });

        if (serviceWalkDepth > 0.05) {
          const serviceSlabY = serviceBottomY - serviceFrameThickness - serviceWalkThickness / 2 - 0.05;
          result.backServiceSlabs.push({
            position: [x, serviceSlabY, serviceWalkCenterZ],
            scale: [walkwayWidth, serviceWalkThickness, serviceWalkDepth + 0.05],
          });

          const serviceRailLevels = [0.24, 0.56];
          serviceRailLevels.forEach((level) => {
            const railY =
              serviceSlabY +
              serviceWalkThickness / 2 +
              level * (serviceWindowHeight + serviceFrameThickness * 0.7);
            result.backServiceRails.push({
              position: [x, railY, serviceRailZ],
              scale: [railSpan, serviceRailThickness, serviceRailDepth],
            });
          });

          const servicePostHeight =
            serviceRailLevels[serviceRailLevels.length - 1] *
              (serviceWindowHeight + serviceFrameThickness * 0.7) +
            serviceRailThickness * 0.8;
          const servicePostY = serviceSlabY + serviceWalkThickness / 2 + servicePostHeight / 2;
          const servicePostOffsetX = walkwayHalfWidth - servicePostThickness * 0.8;
          result.backServicePosts.push({
            position: [x - servicePostOffsetX, servicePostY, serviceRailZ],
            scale: [servicePostThickness, servicePostHeight, servicePostDepth],
          });
          result.backServicePosts.push({
            position: [x + servicePostOffsetX, servicePostY, serviceRailZ],
            scale: [servicePostThickness, servicePostHeight, servicePostDepth],
          });

          const pipeHeight = spacingY - 0.14;
          const pipeY = serviceSlabY + serviceWalkThickness / 2 + pipeHeight / 2;
          const pipeOffsets = [-moduleWidth * 0.36, moduleWidth * 0.36];
          pipeOffsets.forEach((offset) => {
            result.backPipeStacks.push({
              position: [x + offset, pipeY, pipeZ],
              scale: [pipeThickness, pipeHeight, pipeDepth],
            });
          });
        }

        if (floor === 0) {
          result.backDividerPanels.push({
            position: [x, towerBaseY + towerHeight / 2, backPlaneZ + serviceFrameDepth * 0.35],
            scale: [Math.max(0.06, moduleWidth * 0.018), towerHeight, serviceFrameDepth * 0.85],
          });
        }
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
    towerWidth,
    towerHeight,
    towerDepth,
    unitInset,
  ]);

  useInstancedLayout(unitRef, unitTransforms);
  useInstancedLayout(bandRef, bandTransforms);
  useInstancedLayout(frontGlassRef, frontGlass);
  useInstancedLayout(frontFrameRef, frontFrames);
  useInstancedLayout(frontMullionRef, frontMullions);
  useInstancedLayout(frontBalconySlabRef, frontBalconySlabs);
  useInstancedLayout(frontBalconyRailRef, frontBalconyRails);
  useInstancedLayout(frontBalconyPostRef, frontBalconyPosts);
  useInstancedLayout(backGlassRef, backGlass);
  useInstancedLayout(backFrameRef, backFrames);
  useInstancedLayout(backLouverRef, backLouvers);
  useInstancedLayout(backServiceSlabRef, backServiceSlabs);
  useInstancedLayout(backServiceRailRef, backServiceRails);
  useInstancedLayout(backServicePostRef, backServicePosts);
  useInstancedLayout(backPipeRef, backPipeStacks);
  useInstancedLayout(backDividerRef, backDividerPanels);
  useInstancedLayout(accentRef, accentTransforms);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
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
          <meshStandardMaterial color={palette.windowFrame ?? '#f2f1ee'} roughness={0.42} metalness={0.12} />
        </instancedMesh>
      )}
      {frontMullions.length > 0 && (
        <instancedMesh ref={frontMullionRef} args={[null, null, frontMullions.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.windowFrame ?? '#f2f1ee'} roughness={0.35} metalness={0.18} />
        </instancedMesh>
      )}
      {frontBalconySlabs.length > 0 && (
        <instancedMesh ref={frontBalconySlabRef} args={[null, null, frontBalconySlabs.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.balcony ?? '#cfd2cc'} roughness={0.6} metalness={0.08} />
        </instancedMesh>
      )}
      {frontBalconyRails.length > 0 && (
        <instancedMesh ref={frontBalconyRailRef} args={[null, null, frontBalconyRails.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.railing ?? '#858b95'} roughness={0.25} metalness={0.65} />
        </instancedMesh>
      )}
      {frontBalconyPosts.length > 0 && (
        <instancedMesh ref={frontBalconyPostRef} args={[null, null, frontBalconyPosts.length]}>
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
          <meshStandardMaterial color={palette.serviceFrame ?? palette.windowFrame ?? '#dcded6'} roughness={0.48} metalness={0.14} />
        </instancedMesh>
      )}
      {backLouvers.length > 0 && (
        <instancedMesh ref={backLouverRef} args={[null, null, backLouvers.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.serviceRail ?? palette.railing ?? '#7c828c'} roughness={0.35} metalness={0.32} />
        </instancedMesh>
      )}
      {backServiceSlabs.length > 0 && (
        <instancedMesh ref={backServiceSlabRef} args={[null, null, backServiceSlabs.length]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.serviceSlab ?? '#c9ccc5'} roughness={0.72} metalness={0.05} />
        </instancedMesh>
      )}
      {backServiceRails.length > 0 && (
        <instancedMesh ref={backServiceRailRef} args={[null, null, backServiceRails.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.serviceRail ?? '#7a8089'} roughness={0.3} metalness={0.55} />
        </instancedMesh>
      )}
      {backServicePosts.length > 0 && (
        <instancedMesh ref={backServicePostRef} args={[null, null, backServicePosts.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.serviceRail ?? '#7a8089'} roughness={0.32} metalness={0.5} />
        </instancedMesh>
      )}
      {backPipeStacks.length > 0 && (
        <instancedMesh ref={backPipeRef} args={[null, null, backPipeStacks.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.utilityPipe ?? '#9aa3ad'} roughness={0.3} metalness={0.6} />
        </instancedMesh>
      )}
      {backDividerPanels.length > 0 && (
        <instancedMesh ref={backDividerRef} args={[null, null, backDividerPanels.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.serviceFrame ?? '#dcded6'} roughness={0.52} metalness={0.08} />
        </instancedMesh>
      )}
      {accentTransforms.length > 0 && (
        <instancedMesh ref={accentRef} args={[null, null, accentTransforms.length]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.accent ?? '#8fb3e5'} roughness={0.35} metalness={0.05} />
        </instancedMesh>
      )}
      <mesh position={[0, towerBaseY + towerHeight + moduleHeight * 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[towerWidth * 1.02, moduleHeight * 0.18, towerDepth * 1.02]} />
        <meshStandardMaterial color={palette.roof ?? '#cfd3d8'} roughness={0.6} metalness={0.05} />
      </mesh>
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
    accentColor,
    roofColor,
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
    accentColor: {
      label: 'Accent Color',
      value: '#8fb3e5',
    },
    roofColor: {
      label: 'Roof Color',
      value: '#cfd3d8',
    },
  });

  const palette = useMemo(
    () => ({
      unit: unitColor,
      band: bandColor,
      window: windowColor,
      windowGlass: windowColor,
      windowFrame: '#f3f3ef',
      balcony: '#ced2cb',
      railing: '#7d828f',
      serviceGlass: '#b9c4cf',
      serviceFrame: '#d9dcd5',
      serviceRail: '#7b808a',
      serviceSlab: '#c8ccc4',
      utilityPipe: '#9ca3ad',
      accent: accentColor,
      roof: roofColor,
    }),
    [unitColor, bandColor, windowColor, accentColor, roofColor],
  );

  const baseConfig = useMemo(
    () => ({
      floors: 27,
      unitsPerRow,
      moduleWidth,
      moduleHeight,
      moduleDepth,
      spacingX: moduleWidth + 0.22,
      spacingY: moduleHeight + 0.1,
      unitInset: 2.0 * 0.18,
      accentFloors: [14, 26],
    }),
    [moduleWidth, moduleHeight, moduleDepth, unitsPerRow],
  );

  const rows = 3;
  const cols = 6;

  const metrics = useMemo(
    () => getTowerMetrics(baseConfig),
    [baseConfig],
  );
  const towerWidth = metrics.towerWidth;
  const towerDepth = metrics.towerDepth;

  const towerSpacingX = towerWidth + 5.5;
  const towerSpacingZ = towerDepth + 18;



  const towerPlacements = useMemo(() => {
    const placements = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const skipCenter = row === 1 && (col === 2 || col === 3);
        if (skipCenter) continue;

        const floorsDelta = (row === 0 ? 2 : row === 1 ? 0 : 1) + ((col % 2 === 0) ? 1 : -1);
        const rotationY = ((row + col) % 3 === 0) ? Math.PI / 36 : 0;
        const accentTop = Math.max(16, baseConfig.floors + floorsDelta - 2);
        placements.push({
          position: [
            (col - (cols - 1) / 2) * towerSpacingX,
            0,
            (row - (rows - 1) / 2) * towerSpacingZ,
          ],
          rotationY,
          config: {
            ...baseConfig,
            floors: Math.max(22, baseConfig.floors + floorsDelta),
            accentFloors: [14, accentTop],
          },
        });
      }
    }
    return placements;
  }, [rows, cols, towerSpacingX, towerSpacingZ, baseConfig]);

  const complexWidth = cols * towerSpacingX + 64;
  const complexDepth = rows * towerSpacingZ + 64;

  const plazaWidth = towerWidth * 1.08;
  const plazaDepth = towerDepth * 0.78;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.02, 0]} receiveShadow>
        <planeGeometry args={[complexWidth, complexDepth]} />
        <meshStandardMaterial color="#ebede9" />
      </mesh>

      {/* green belts */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.015, -towerSpacingZ * 0.2]} receiveShadow>
        <planeGeometry args={[complexWidth * 0.85, complexDepth * 0.42]} />
        <meshStandardMaterial color="#cfe3cf" />
      </mesh>

      {/* podium strip along one side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[complexWidth * 0.28, GROUND_LEVEL - 0.005, complexDepth * 0.22]} receiveShadow>
        <boxGeometry args={[complexWidth * 0.42, towerDepth * 0.55, 1.1]} />
        <meshStandardMaterial color="#d0d3d6" />
      </mesh>

      {towerPlacements.map(({ position, config, rotationY }, index) => (
        <MinimalTower key={`tower-${index}`} config={config} palette={palette} position={position} rotationY={rotationY} />
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
      <Canvas shadows camera={{ position: [160, 90, 160], fov: 45,
      near: 0.1,
        far: 100000,
       }}>
        <color attach="background" args={['#f2f5f8']} />
        <hemisphereLight intensity={0.55} color="#fefdfa" groundColor="#d8d8d4" />
        <directionalLight
          position={[160, 180, 120]}
          intensity={1.25}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-180}
          shadow-camera-right={180}
          shadow-camera-top={140}
          shadow-camera-bottom={-140}
        />
        <ambientLight intensity={0.24} />

        <ApartmentComplex />

        <OrbitControls target={[0, 8, 0]} maxPolarAngle={Math.PI / 2.08} minDistance={12} maxDistance={360} enableDamping />
      </Canvas>
    </div>
  );
}
