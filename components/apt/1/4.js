'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useControls, folder } from 'leva';
import * as THREE from 'three';

const GROUND_LEVEL = -1.4;

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

function yawFromVector(vec) {
  return Math.atan2(vec.x, vec.z);
}

function pushTransform(target, position, rotationY, scale) {
  target.push({
    position: position.toArray(),
    rotation: [0, rotationY, 0],
    scale,
  });
}

function createWingLayout(config, wing, accum, boundsTracker) {
  const {
    floors,
    moduleWidth,
    moduleHeight,
    moduleDepth,
    spacingAlong,
    spacingVertical,
    unitInset,
    frontWindowWidth,
    frontWindowHeight,
    backWindowWidth,
    backWindowHeight,
    frameThickness,
    frameDepth,
    mullionThickness,
    mullionDepth,
    transomThickness,
    balconySlabDepth,
    balconySlabThickness,
    railThickness,
    railDepth,
    postThickness,
    postDepth,
    frontSillOffset,
    backSillOffset,
    balconyDrop,
  } = config;

  const widthDir = new THREE.Vector3(Math.cos(wing.rotation), 0, Math.sin(wing.rotation)); // along columns
  const frontDir = new THREE.Vector3(Math.cos(wing.frontYaw), 0, Math.sin(wing.frontYaw)); // outward facade
  const backDir = frontDir.clone().multiplyScalar(-1);
  const origin = new THREE.Vector3().fromArray(wing.origin ?? [0, 0, 0]);
  const startOffset = wing.startOffset ?? 0;
  const columns = wing.columns;

  const towerDepth = moduleDepth + unitInset * 2;
  const towerHeight = floors * spacingVertical + moduleHeight;
  const towerBaseY = GROUND_LEVEL;
  const towerCenterY = towerBaseY + towerHeight / 2;

  const frontGlassDistance = towerDepth / 2 - Math.min(0.12, moduleDepth * 0.2) - 0.02;
  const frontFrameDistance = frontGlassDistance + frameDepth / 2 + 0.02;
  const frontMullionDistance = frontGlassDistance + mullionDepth / 2 + 0.01;
  const balconyFrontDistance = towerDepth / 2 + balconySlabDepth / 2 - unitInset * 0.35;
  const railDistance = towerDepth / 2 + balconySlabDepth - railDepth / 2 - unitInset * 0.35;
  const postDistance = towerDepth / 2 + balconySlabDepth - postDepth / 2 - unitInset * 0.32;

  const backGlassDistance = towerDepth / 2 - Math.min(0.1, moduleDepth * 0.18) - 0.02;
  const backFrameDistance = backGlassDistance + frameDepth / 2 + 0.01;
  const backMullionDistance = backGlassDistance + mullionDepth / 3;

  const frontYaw = yawFromVector(frontDir);
  const backYaw = yawFromVector(backDir);
  const alongYaw = wing.rotation;

  const walkwayLength = (columns - 1) * spacingAlong + moduleWidth + spacingAlong * 0.64;
  const walkwayWidth = towerDepth + moduleDepth * 0.8;
  const walkwayCenter = origin.clone()
    .add(widthDir.clone().multiplyScalar(startOffset + walkwayLength / 2 - spacingAlong * 0.32))
    .add(frontDir.clone().multiplyScalar(-(towerDepth * 0.5 + moduleDepth * 0.24)));

  accum.wingPads.push({
    position: walkwayCenter.toArray(),
    rotation: [0, alongYaw, 0],
    size: [walkwayLength, walkwayWidth],
  });

  for (let column = 0; column < columns; column += 1) {
    const offsetAlong = startOffset + moduleWidth / 2 + column * spacingAlong;
    const spine = origin.clone().add(widthDir.clone().multiplyScalar(offsetAlong));

    const bandPos = spine.clone();
    bandPos.y = towerCenterY;
    pushTransform(accum.bandTransforms, bandPos, alongYaw, [
      moduleWidth * 0.32,
      towerHeight,
      moduleDepth + Math.min(moduleDepth * 0.45, unitInset * 1.8),
    ]);

    for (let floor = 0; floor < floors; floor += 1) {
      const baseY = towerBaseY + floor * spacingVertical;
      const unitY = baseY + moduleHeight / 2;

      const frontUnit = spine.clone().add(frontDir.clone().multiplyScalar(towerDepth / 2 - moduleDepth / 2));
      frontUnit.y = unitY;
      const backUnit = spine.clone().add(backDir.clone().multiplyScalar(towerDepth / 2 - moduleDepth / 2));
      backUnit.y = unitY;

      pushTransform(accum.unitTransforms, frontUnit, alongYaw, [moduleWidth, moduleHeight, moduleDepth]);
      pushTransform(accum.unitTransforms, backUnit, alongYaw, [moduleWidth, moduleHeight, moduleDepth]);

      boundsTracker.expandByPoint(frontUnit);
      boundsTracker.expandByPoint(backUnit);

      const frontSillY = baseY + frontSillOffset;
      const backSillY = baseY + backSillOffset;
      const frontCenterY = frontSillY + frontWindowHeight / 2;
      const backCenterY = backSillY + backWindowHeight / 2;
      const frontTopY = frontCenterY + frontWindowHeight / 2;
      const frontBottomY = frontCenterY - frontWindowHeight / 2;
      const backTopY = backCenterY + backWindowHeight / 2;
      const backBottomY = backCenterY - backWindowHeight / 2;

      const frontGlassPos = spine.clone().add(frontDir.clone().multiplyScalar(frontGlassDistance));
      frontGlassPos.y = frontCenterY;
      pushTransform(accum.frontGlass, frontGlassPos, frontYaw, [frontWindowWidth, frontWindowHeight, 1]);

      const frontFrameBase = spine.clone().add(frontDir.clone().multiplyScalar(frontFrameDistance));
      const widthOffset = widthDir.clone().multiplyScalar(frontWindowWidth / 2 + frameThickness / 2);

      const topFramePos = frontFrameBase.clone();
      topFramePos.y = frontTopY + frameThickness / 2;
      pushTransform(accum.frontFrames, topFramePos, frontYaw, [
        frontWindowWidth + frameThickness * 2,
        frameThickness,
        frameDepth,
      ]);

      const bottomFramePos = frontFrameBase.clone();
      bottomFramePos.y = frontBottomY - frameThickness / 2;
      pushTransform(accum.frontFrames, bottomFramePos, frontYaw, [
        frontWindowWidth + frameThickness * 2,
        frameThickness,
        frameDepth,
      ]);

      const leftFramePos = frontFrameBase.clone().sub(widthOffset);
      leftFramePos.y = frontCenterY;
      pushTransform(accum.frontFrames, leftFramePos, frontYaw, [
        frameThickness,
        frontWindowHeight + frameThickness * 2,
        frameDepth,
      ]);

      const rightFramePos = frontFrameBase.clone().add(widthOffset);
      rightFramePos.y = frontCenterY;
      pushTransform(accum.frontFrames, rightFramePos, frontYaw, [
        frameThickness,
        frontWindowHeight + frameThickness * 2,
        frameDepth,
      ]);

      const frontMullionBase = spine.clone().add(frontDir.clone().multiplyScalar(frontMullionDistance));
      frontMullionBase.y = frontCenterY;
      const mullionOffset = widthDir.clone().multiplyScalar(frontWindowWidth * 0.22);

      const leftMullionPos = frontMullionBase.clone().sub(mullionOffset);
      pushTransform(accum.frontMullions, leftMullionPos, frontYaw, [
        mullionThickness,
        frontWindowHeight + frameThickness * 0.4,
        mullionDepth,
      ]);

      const rightMullionPos = frontMullionBase.clone().add(mullionOffset);
      pushTransform(accum.frontMullions, rightMullionPos, frontYaw, [
        mullionThickness,
        frontWindowHeight + frameThickness * 0.4,
        mullionDepth,
      ]);

      const transomPos = frontMullionBase.clone();
      transomPos.y = frontTopY - frontWindowHeight * 0.25;
      pushTransform(accum.frontMullions, transomPos, frontYaw, [
        frontWindowWidth + frameThickness * 1.2,
        transomThickness,
        mullionDepth,
      ]);

      const slabPos = spine.clone().add(frontDir.clone().multiplyScalar(balconyFrontDistance));
      slabPos.y = frontBottomY - frameThickness - balconySlabThickness / 2 - balconyDrop;
      pushTransform(accum.balconySlabs, slabPos, frontYaw, [
        frontWindowWidth * 1.04,
        balconySlabThickness,
        balconySlabDepth,
      ]);

      const railLevels = [0.28, 0.53, 0.74];
      railLevels.forEach((level) => {
        const railPos = spine.clone().add(frontDir.clone().multiplyScalar(railDistance));
        railPos.y = frontBottomY + frameThickness + frontWindowHeight * level;
        pushTransform(accum.balconyRails, railPos, frontYaw, [
          frontWindowWidth * 0.96,
          railThickness,
          railDepth,
        ]);
      });

      const postOffset = widthDir.clone().multiplyScalar(frontWindowWidth / 2 - frameThickness * 0.5);
      const postY = frontBottomY + frameThickness + (frontWindowHeight * 0.78) / 2;

      const leftPostPos = spine.clone()
        .add(frontDir.clone().multiplyScalar(postDistance))
        .sub(postOffset);
      leftPostPos.y = postY;
      pushTransform(accum.balconyPosts, leftPostPos, frontYaw, [
        postThickness,
        frontWindowHeight * 0.78,
        postDepth,
      ]);

      const rightPostPos = spine.clone()
        .add(frontDir.clone().multiplyScalar(postDistance))
        .add(postOffset);
      rightPostPos.y = postY;
      pushTransform(accum.balconyPosts, rightPostPos, frontYaw, [
        postThickness,
        frontWindowHeight * 0.78,
        postDepth,
      ]);

      const backGlassPos = spine.clone().add(backDir.clone().multiplyScalar(backGlassDistance));
      backGlassPos.y = backCenterY;
      pushTransform(accum.backGlass, backGlassPos, backYaw, [backWindowWidth, backWindowHeight, 1]);

      const backFrameBase = spine.clone().add(backDir.clone().multiplyScalar(backFrameDistance));
      const backWidthOffset = widthDir.clone().multiplyScalar(backWindowWidth / 2 + frameThickness / 2);

      const backTopFramePos = backFrameBase.clone();
      backTopFramePos.y = backTopY + frameThickness / 2;
      pushTransform(accum.backFrames, backTopFramePos, backYaw, [
        backWindowWidth + frameThickness * 1.8,
        frameThickness,
        frameDepth,
      ]);

      const backBottomFramePos = backFrameBase.clone();
      backBottomFramePos.y = backBottomY - frameThickness / 2;
      pushTransform(accum.backFrames, backBottomFramePos, backYaw, [
        backWindowWidth + frameThickness * 1.8,
        frameThickness,
        frameDepth,
      ]);

      const backLeftFramePos = backFrameBase.clone().sub(backWidthOffset);
      backLeftFramePos.y = backCenterY;
      pushTransform(accum.backFrames, backLeftFramePos, backYaw, [
        frameThickness,
        backWindowHeight + frameThickness * 2,
        frameDepth,
      ]);

      const backRightFramePos = backFrameBase.clone().add(backWidthOffset);
      backRightFramePos.y = backCenterY;
      pushTransform(accum.backFrames, backRightFramePos, backYaw, [
        frameThickness,
        backWindowHeight + frameThickness * 2,
        frameDepth,
      ]);

      const louverBase = spine.clone().add(backDir.clone().multiplyScalar(backMullionDistance));
      const louverLevels = [0.25, 0.45, 0.65, 0.85];
      louverLevels.forEach((level) => {
        const louverPos = louverBase.clone();
        louverPos.y = backBottomY + backWindowHeight * level;
        pushTransform(accum.backLouvers, louverPos, backYaw, [
          backWindowWidth * 0.94,
          transomThickness * 0.78,
          mullionDepth * 0.6,
        ]);
      });
    }
  }

  const wingExtent = origin.clone()
    .add(widthDir.clone().multiplyScalar(startOffset + (columns - 1) * spacingAlong + moduleWidth));
  boundsTracker.expandByPoint(wingExtent);
  boundsTracker.expandByPoint(origin.clone());
  boundsTracker.expandByPoint(wingExtent.clone().add(frontDir.clone().multiplyScalar(moduleDepth * 5)));
  boundsTracker.expandByPoint(wingExtent.clone().add(backDir.clone().multiplyScalar(moduleDepth * 2)));
}

function createLShapedTower(config) {
  const accum = {
    unitTransforms: [],
    bandTransforms: [],
    frontGlass: [],
    frontFrames: [],
    frontMullions: [],
    balconySlabs: [],
    balconyRails: [],
    balconyPosts: [],
    backGlass: [],
    backFrames: [],
    backLouvers: [],
    wingPads: [],
  };

  const bounding = new THREE.Box3();
  bounding.makeEmpty();

  const baseConfig = {
    floors: config.floors,
    moduleWidth: config.moduleWidth,
    moduleHeight: config.moduleHeight,
    moduleDepth: config.moduleDepth,
    spacingAlong: config.spacingAlong,
    spacingVertical: config.spacingVertical,
    unitInset: config.unitInset,
    frontWindowWidth: config.moduleWidth * 0.78,
    frontWindowHeight: config.moduleHeight * 0.64,
    backWindowWidth: config.moduleWidth * 0.52,
    backWindowHeight: config.moduleHeight * 0.46,
    frontSillOffset: config.moduleHeight * 0.18,
    backSillOffset: config.moduleHeight * 0.34,
    frameThickness: Math.max(0.08, config.moduleWidth * 0.02),
    frameDepth: Math.min(0.18, config.moduleDepth * 0.24),
    mullionThickness: Math.max(0.05, config.moduleWidth * 0.015),
    mullionDepth: Math.min(0.12, config.moduleDepth * 0.22),
    transomThickness: Math.max(0.045, config.moduleWidth * 0.012),
    balconySlabDepth: Math.min(0.62, config.unitInset + 0.36),
    balconySlabThickness: 0.13,
    railThickness: 0.045,
    railDepth: 0.045 * 1.2,
    postThickness: 0.045 * 1.2,
    postDepth: 0.045 * 1.2,
    balconyDrop: 0.06,
  };

  config.wings.forEach((wing) => {
    createWingLayout(baseConfig, wing, accum, bounding);
  });

  const coreHeight = config.floors * config.spacingVertical + config.moduleHeight;
  const core = {
    size: [config.core.width, coreHeight * 0.94, config.core.depth],
    position: [config.core.offset[0], GROUND_LEVEL + (coreHeight * 0.94) / 2, config.core.offset[2]],
  };

  const boundsWithCore = bounding.clone().expandByPoint(new THREE.Vector3().fromArray(core.position));

  const center = boundsWithCore.getCenter(new THREE.Vector3());
  center.y = 0;

  const recentre = (items) => {
    items.forEach((item) => {
      item.position[0] -= center.x;
      item.position[1] -= center.y;
      item.position[2] -= center.z;
    });
  };

  [
    accum.unitTransforms,
    accum.bandTransforms,
    accum.frontGlass,
    accum.frontFrames,
    accum.frontMullions,
    accum.balconySlabs,
    accum.balconyRails,
    accum.balconyPosts,
    accum.backGlass,
    accum.backFrames,
    accum.backLouvers,
  ].forEach(recentre);

  accum.wingPads.forEach((pad) => {
    pad.position[0] -= center.x;
    pad.position[1] -= center.y;
    pad.position[2] -= center.z;
  });

  core.position[0] -= center.x;
  core.position[1] -= center.y;
  core.position[2] -= center.z;

  const footprint = boundsWithCore.getSize(new THREE.Vector3());

  return {
    transforms: accum,
    core,
    footprint: {
      width: footprint.x,
      depth: footprint.z,
    },
  };
}

function MinimalTower({ config, palette }) {
  const layout = useMemo(() => createLShapedTower(config), [config]);
  const {
    transforms: {
      unitTransforms,
      bandTransforms,
      frontGlass,
      frontFrames,
      frontMullions,
      balconySlabs,
      balconyRails,
      balconyPosts,
      backGlass,
      backFrames,
      backLouvers,
      wingPads,
    },
    core,
    footprint,
  } = layout;

  const unitRef = useRef();
  const bandRef = useRef();
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
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, GROUND_LEVEL - 0.04, 0]}
        receiveShadow
      >
        <planeGeometry args={[footprint.width * 2.6, footprint.depth * 2.4]} />
        <meshStandardMaterial color={palette.site ?? '#ebece8'} roughness={0.78} metalness={0.02} />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, GROUND_LEVEL - 0.02, 0]}
        receiveShadow
      >
        <planeGeometry args={[footprint.width * 1.64, footprint.depth * 1.58]} />
        <meshStandardMaterial color={palette.plaza ?? '#dadfda'} roughness={0.74} metalness={0.03} />
      </mesh>

      {wingPads.map((pad, index) => (
        <mesh
          key={`pad-${index}`}
          rotation={[-Math.PI / 2, pad.rotation[1], 0]}
          position={[pad.position[0], GROUND_LEVEL - 0.015, pad.position[2]]}
          receiveShadow
        >
          <planeGeometry args={pad.size} />
          <meshStandardMaterial color={palette.podium ?? '#d0d5cf'} roughness={0.68} metalness={0.05} />
        </mesh>
      ))}

      <mesh position={core.position} castShadow receiveShadow>
        <boxGeometry args={core.size} />
        <meshStandardMaterial color={palette.core ?? '#c8cdc7'} roughness={0.58} metalness={0.1} />
      </mesh>

      {unitTransforms.length > 0 && (
        <instancedMesh ref={unitRef} args={[null, null, unitTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.unit} roughness={0.82} metalness={0.06} />
        </instancedMesh>
      )}

      {bandTransforms.length > 0 && (
        <instancedMesh ref={bandRef} args={[null, null, bandTransforms.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.band} roughness={0.54} metalness={0.12} />
        </instancedMesh>
      )}

      {frontGlass.length > 0 && (
        <instancedMesh ref={frontGlassRef} args={[null, null, frontGlass.length]}>
          <planeGeometry args={[1, 1]} />
          <meshPhysicalMaterial
            color={palette.windowGlass ?? palette.window ?? '#a9bfd7'}
            roughness={0.09}
            metalness={0.08}
            transmission={0.74}
            thickness={0.38}
            transparent
            opacity={0.94}
            ior={1.45}
          />
        </instancedMesh>
      )}

      {frontFrames.length > 0 && (
        <instancedMesh ref={frontFrameRef} args={[null, null, frontFrames.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.windowFrame ?? '#f2f1ee'} roughness={0.4} metalness={0.16} />
        </instancedMesh>
      )}

      {frontMullions.length > 0 && (
        <instancedMesh ref={frontMullionRef} args={[null, null, frontMullions.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.windowFrame ?? '#f2f1ee'} roughness={0.34} metalness={0.18} />
        </instancedMesh>
      )}

      {balconySlabs.length > 0 && (
        <instancedMesh ref={balconySlabRef} args={[null, null, balconySlabs.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.balcony ?? '#cfd2cc'} roughness={0.62} metalness={0.08} />
        </instancedMesh>
      )}

      {balconyRails.length > 0 && (
        <instancedMesh ref={balconyRailRef} args={[null, null, balconyRails.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.railing ?? '#7f8794'} roughness={0.28} metalness={0.6} />
        </instancedMesh>
      )}

      {balconyPosts.length > 0 && (
        <instancedMesh ref={balconyPostRef} args={[null, null, balconyPosts.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.railing ?? '#7f8794'} roughness={0.3} metalness={0.58} />
        </instancedMesh>
      )}

      {backGlass.length > 0 && (
        <instancedMesh ref={backGlassRef} args={[null, null, backGlass.length]}>
          <planeGeometry args={[1, 1]} />
          <meshPhysicalMaterial
            color={palette.serviceGlass ?? '#bccbd9'}
            roughness={0.14}
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
          <meshStandardMaterial color={palette.windowFrame ?? '#f2f1ee'} roughness={0.46} metalness={0.14} />
        </instancedMesh>
      )}

      {backLouvers.length > 0 && (
        <instancedMesh ref={backLouverRef} args={[null, null, backLouvers.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={palette.railing ?? '#7f8794'} roughness={0.36} metalness={0.32} />
        </instancedMesh>
      )}
    </group>
  );
}

function ApartmentScene() {
  const {
    floors,
    wingAUnits,
    wingBUnits,
    moduleWidth,
    moduleHeight,
    moduleDepth,
    unitColor,
    bandColor,
    windowColor,
    balconyColor,
    railingColor,
    plazaColor,
    siteColor,
    coreColor,
    spreadX,
    spreadY,
    spreadZ,
    angleX,
    angleY,
    angleZ,
  } = useControls(() => ({
    Massing: folder(
      {
        floors: {
          value: 30,
          min: 18,
          max: 45,
          step: 1,
        },
        WingUnits: folder(
          {
            wingAUnits: {
              label: 'Wing A (동측)',
              value: 6,
              min: 3,
              max: 12,
              step: 1,
            },
            wingBUnits: {
              label: 'Wing B (남측)',
              value: 8,
              min: 3,
              max: 12,
              step: 1,
            },
          },
          { collapsed: false },
        ),
      },
      { collapsed: false },
    ),
    Modules: folder(
      {
        Dimensions: folder(
          {
            moduleWidth: {
              label: 'Width',
              value: 8.8,
              min: 5,
              max: 12,
              step: 0.1,
            },
            moduleHeight: {
              label: 'Height',
              value: 1.1,
              min: 0.8,
              max: 2,
              step: 0.05,
            },
            moduleDepth: {
              label: 'Depth',
              value: 2.5,
              min: 1.6,
              max: 4.2,
              step: 0.1,
            },
          },
          { collapsed: false },
        ),
      },
      { collapsed: false },
    ),
    Palette: folder(
      {
        Exterior: folder(
          {
            unitColor: {
              label: 'Unit',
              value: '#d9dbd7',
            },
            bandColor: {
              label: 'Band',
              value: '#f3f4f0',
            },
            windowColor: {
              label: 'Window',
              value: '#a9bfd7',
            },
            balconyColor: {
              label: 'Balcony',
              value: '#cfd2cc',
            },
            railingColor: {
              label: 'Railing',
              value: '#7a808b',
            },
          },
          { collapsed: true },
        ),
        Ground: folder(
          {
            plazaColor: {
              label: 'Plaza',
              value: '#dadfd7',
            },
            siteColor: {
              label: 'Site',
              value: '#ebece8',
            },
            coreColor: {
              label: 'Core',
              value: '#c8cdc7',
            },
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
    Transform: folder(
      {
        UnitSpread: folder(
          {
            spreadX: {
              label: 'X',
              value: 0,
              min: -120,
              max: 120,
              step: 0.5,
            },
            spreadY: {
              label: 'Y',
              value: 0,
              min: -50,
              max: 120,
              step: 0.5,
            },
            spreadZ: {
              label: 'Z',
              value: 0,
              min: -120,
              max: 120,
              step: 0.5,
            },
          },
          { collapsed: true },
        ),
        UnitAngle: folder(
          {
            angleX: {
              label: 'X',
              value: 0,
              min: -Math.PI,
              max: Math.PI,
              step: 0.01,
            },
            angleY: {
              label: 'Y',
              value: 0,
              min: -Math.PI,
              max: Math.PI,
              step: 0.01,
            },
            angleZ: {
              label: 'Z',
              value: 0,
              min: -Math.PI,
              max: Math.PI,
              step: 0.01,
            },
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
  }));

  const palette = useMemo(
    () => ({
      unit: unitColor,
      band: bandColor,
      window: windowColor,
      windowGlass: windowColor,
      windowFrame: '#f5f4f0',
      balcony: balconyColor,
      railing: railingColor,
      serviceGlass: '#bccbd9',
      plaza: plazaColor,
      podium: '#d0d5cf',
      site: siteColor,
      core: coreColor,
    }),
    [unitColor, bandColor, windowColor, balconyColor, railingColor, plazaColor, siteColor, coreColor],
  );

  const spacingAlong = moduleWidth + 0.24;
  const spacingVertical = moduleHeight + 0.12;
  const unitInset = moduleDepth * 0.42;

  const wingOffset = spacingAlong * 0.5 + moduleWidth * 0.2 + moduleDepth * 0.65;
  const config = useMemo(
    () => ({
      floors,
      moduleWidth,
      moduleHeight,
      moduleDepth,
      spacingAlong,
      spacingVertical,
      unitInset,
      wings: [
        {
          name: 'A',
          columns: wingAUnits,
          rotation: 0,
          frontYaw: Math.PI / 2,
          origin: [0, 0, 0],
          startOffset: moduleWidth * 0.4,
        },
        {
          name: 'B',
          columns: wingBUnits,
          rotation: Math.PI / 2,
          frontYaw: Math.PI,
          origin: [wingOffset, 0, 0],
          startOffset: moduleWidth * 0.4,
        },
      ],
      core: {
        width: moduleWidth * 1.15,
        depth: moduleWidth * 1.05,
        offset: [wingOffset * 0.32, 0, moduleDepth * 0.3],
      },
    }),
    [floors, moduleWidth, moduleHeight, moduleDepth, spacingAlong, spacingVertical, unitInset, wingAUnits, wingBUnits, wingOffset],
  );

  return (
    <group position={[spreadX, spreadY, spreadZ]} rotation={[angleX, angleY, angleZ]}>
      <MinimalTower config={config} palette={palette} />
    </group>
  );
}

export default function AptComplexGeneration2() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '560px' }}>
      <Canvas
        shadows
        camera={{
          position: [120, 80, 118],
          fov: 45,
          near: 0.1,
          far: 1500,
        }}
      >
        <color attach="background" args={['#f2f5f8']} />

        <hemisphereLight intensity={0.55} color="#fefdfa" groundColor="#d8d8d4" />
        <directionalLight
          position={[140, 170, 120]}
          intensity={1.28}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-260}
          shadow-camera-right={260}
          shadow-camera-top={200}
          shadow-camera-bottom={-200}
        />
        <ambientLight intensity={0.24} />

        <ApartmentScene />

        <OrbitControls
          target={[0, 10, 0]}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={22}
          maxDistance={260}
          enableDamping
        />
      </Canvas>
    </div>
  );
}
