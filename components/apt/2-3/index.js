'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Leva, folder, useControls } from 'leva';
import * as THREE from 'three';

const GRID_ROWS = 10;
const GRID_COLS = 10;
const SPACING_X = 36;
const SPACING_Z = 28;
const GROUND_LEVEL = -2;
const MAX_GRID_RADIUS = Math.hypot(((GRID_COLS - 1) * SPACING_X) / 2, ((GRID_ROWS - 1) * SPACING_Z) / 2);

const lerp = (a, b, t) => a + (b - a) * t;
const lerpVec3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function applyInstancedTransforms(mesh, transforms) {
  if (!mesh) return;

  const dummy = new THREE.Object3D();
  transforms.forEach((transform, index) => {
    const [px, py, pz] = transform.position;
    const [rx, ry, rz] = transform.rotation ?? [0, 0, 0];
    const [sx, sy, sz] = transform.scale ?? [1, 1, 1];

    dummy.position.set(px, py, pz);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function rotateY([x, y, z], angle) {
  if (!angle) return [x, y, z];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - z * sin, y, x * sin + z * cos];
}

function transformWithOffset(transform, offset) {
  const angle = offset.rotation ?? 0;
  const rotatedPosition = rotateY(transform.position, angle);
  const extraRotation = offset.extraRotation ?? [0, 0, 0];
  const baseRotation = transform.rotation ?? [0, 0, 0];
  const transformScale = transform.scale ?? [1, 1, 1];
  const offsetScale = offset.scale ?? [1, 1, 1];
  return {
    position: [
      rotatedPosition[0] + offset.position[0],
      rotatedPosition[1] + offset.position[1],
      rotatedPosition[2] + offset.position[2],
    ],
    rotation: [
      baseRotation[0] + extraRotation[0],
      baseRotation[1] + angle + extraRotation[1],
      baseRotation[2] + extraRotation[2],
    ],
    scale: [
      transformScale[0] * offsetScale[0],
      transformScale[1] * offsetScale[1],
      transformScale[2] * offsetScale[2],
    ],
  };
}

function replicateTransforms(transforms, offsets) {
  const result = [];
  offsets.forEach((offset) => {
    transforms.forEach((transform) => {
      result.push(transformWithOffset(transform, offset));
    });
  });
  return result;
}

function createBlueprint() {
  const floorCount = 62;
  const floorHeight = 0.58;
  const podiumHeight = 1.45;
  const podiumTerraceHeight = 0.6;
  const groundLevel = GROUND_LEVEL;
  const towerHeight = floorCount * floorHeight + 1.3;
  const towerBaseY = groundLevel + podiumHeight;
  const crownHeight = 1.2;
  const lanternHeight = 1.5;
  const skyDeckHeight = 1.1;
  const parapetHeight = 0.52;

  const eastBaseHeight = towerHeight * 0.36;
  const eastMidHeight = towerHeight * 0.38;
  const eastTopHeight = towerHeight - eastBaseHeight - eastMidHeight;

  const westBaseHeight = towerHeight * 0.34;
  const westMidHeight = towerHeight * 0.4;
  const westTopHeight = towerHeight - westBaseHeight - westMidHeight;

  const eastCenterX = -8.2;
  const eastCenterZ = 0.3;
  const westCenterX = -0.6;
  const westCenterZ = 7.4;

  const rawParts = [
    {
      name: 'podium-plinth',
      geometry: 'box',
      args: [34, podiumHeight, 24],
      material: { color: '#e5dfd5', roughness: 0.52, metalness: 0.15 },
      transform: {
        position: [-3.6, groundLevel + podiumHeight / 2 - 0.05, 5.4],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-terrace',
      geometry: 'box',
      args: [26, podiumTerraceHeight, 18],
      material: { color: '#f5f1e8', roughness: 0.38, metalness: 0.12 },
      transform: {
        position: [-3.6, groundLevel + podiumHeight + podiumTerraceHeight / 2, 5.4],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-lobby-glass',
      geometry: 'box',
      args: [22, 2.05, 14],
      material: { color: '#bcc5d6', metalness: 0.55, roughness: 0.2, transparent: true, opacity: 0.85 },
      transform: {
        position: [-3.6, groundLevel + podiumHeight + 1.1, 5.4],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-canopy',
      geometry: 'box',
      args: [28, 0.26, 20],
      material: { color: '#fbf3e5', metalness: 0.28, roughness: 0.32 },
      transform: {
        position: [-3.6, groundLevel + podiumHeight + 2.2, 5.4],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-step-plate',
      geometry: 'box',
      args: [20, 0.2, 12],
      material: { color: '#d9d2c6', roughness: 0.58, metalness: 0.08 },
      transform: {
        position: [-3.6, groundLevel + 0.1, 0.8],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-water',
      geometry: 'plane',
      args: [18, 8],
      material: { color: '#d5e9f6', metalness: 0.18, roughness: 0.12 },
      transform: {
        position: [-3.6, groundLevel + 0.04, 0.8],
        rotation: [-Math.PI / 2, 0, 0],
      },
    },
    {
      name: 'podium-pavilion',
      geometry: 'box',
      args: [6.4, 1.4, 6.4],
      material: { color: '#ece3d5', roughness: 0.36, metalness: 0.18 },
      transform: {
        position: [-12.4, groundLevel + podiumHeight + 0.7, -1.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-pavilion-glass',
      geometry: 'box',
      args: [5, 2.6, 5],
      material: { color: '#b6c1d3', metalness: 0.42, roughness: 0.2, transparent: true, opacity: 0.78 },
      transform: {
        position: [-12.4, groundLevel + podiumHeight + 1.7, -1.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-gallery',
      geometry: 'box',
      args: [14, 0.32, 10],
      material: { color: '#f0eadf', roughness: 0.42, metalness: 0.14 },
      transform: {
        position: [4.2, groundLevel + podiumHeight + podiumTerraceHeight, 11.4],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-skywalk',
      geometry: 'box',
      args: [18, 0.22, 6],
      material: { color: '#f4eadd', roughness: 0.34, metalness: 0.22 },
      transform: {
        position: [-3.6, groundLevel + podiumHeight + podiumTerraceHeight + 0.22, 11.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-sculpture-base',
      geometry: 'box',
      args: [2.6, 0.4, 2.6],
      material: { color: '#eee6da', roughness: 0.48, metalness: 0.16 },
      transform: {
        position: [5.8, groundLevel + podiumHeight + 0.2, -2.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-sculpture',
      geometry: 'box',
      args: [2, 3, 2],
      material: { color: '#c8b08a', roughness: 0.28, metalness: 0.35 },
      transform: {
        position: [5.8, groundLevel + podiumHeight + 1.5, -2.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-east-base',
      geometry: 'box',
      args: [10.8, eastBaseHeight, 3.6],
      material: { color: '#f4eee4', roughness: 0.34, metalness: 0.16 },
      transform: {
        position: [eastCenterX, towerBaseY + eastBaseHeight / 2, eastCenterZ],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-east-mid',
      geometry: 'box',
      args: [9.6, eastMidHeight, 3.2],
      material: { color: '#f8f3ea', roughness: 0.26, metalness: 0.2 },
      transform: {
        position: [eastCenterX + 0.05, towerBaseY + eastBaseHeight + eastMidHeight / 2, eastCenterZ + 0.28],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-east-top',
      geometry: 'box',
      args: [8.6, eastTopHeight, 2.9],
      material: { color: '#fdf8ef', roughness: 0.22, metalness: 0.24 },
      transform: {
        position: [eastCenterX + 0.1, towerBaseY + eastBaseHeight + eastMidHeight + eastTopHeight / 2, eastCenterZ + 0.46],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-east-parapet',
      geometry: 'box',
      args: [8.9, parapetHeight, 3.1],
      material: { color: '#d8cbb6', roughness: 0.34, metalness: 0.32 },
      transform: {
        position: [eastCenterX + 0.1, towerBaseY + towerHeight + parapetHeight / 2, eastCenterZ + 0.46],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-east-lantern',
      geometry: 'box',
      args: [5.4, lanternHeight, 2.2],
      material: { color: '#ffe8c8', emissive: '#f6cf8c', emissiveIntensity: 0.18, roughness: 0.18, metalness: 0.32 },
      transform: {
        position: [eastCenterX + 0.1, towerBaseY + towerHeight + parapetHeight + lanternHeight / 2, eastCenterZ + 0.46],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-east-spire',
      geometry: 'box',
      args: [1.2, 2.6, 1.2],
      material: { color: '#ffe2a4', emissive: '#ffd27a', emissiveIntensity: 0.22, metalness: 0.4, roughness: 0.18 },
      transform: {
        position: [eastCenterX + 0.1, towerBaseY + towerHeight + parapetHeight + lanternHeight + 1.3, eastCenterZ + 0.46],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-west-base',
      geometry: 'box',
      args: [3.6, westBaseHeight, 12.6],
      material: { color: '#f3ece1', roughness: 0.32, metalness: 0.18 },
      transform: {
        position: [westCenterX, towerBaseY + westBaseHeight / 2, westCenterZ],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-west-mid',
      geometry: 'box',
      args: [3.3, westMidHeight, 11.4],
      material: { color: '#f6efe4', roughness: 0.26, metalness: 0.22 },
      transform: {
        position: [westCenterX + 0.12, towerBaseY + westBaseHeight + westMidHeight / 2, westCenterZ - 0.2],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-west-top',
      geometry: 'box',
      args: [3, westTopHeight, 10.2],
      material: { color: '#fbf7ed', roughness: 0.22, metalness: 0.26 },
      transform: {
        position: [westCenterX + 0.18, towerBaseY + westBaseHeight + westMidHeight + westTopHeight / 2, westCenterZ - 0.35],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-west-parapet',
      geometry: 'box',
      args: [3.2, parapetHeight, 10.4],
      material: { color: '#d9cbb5', roughness: 0.34, metalness: 0.3 },
      transform: {
        position: [westCenterX + 0.18, towerBaseY + towerHeight + parapetHeight / 2, westCenterZ - 0.35],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-west-lantern',
      geometry: 'box',
      args: [2, lanternHeight, 4.8],
      material: { color: '#ffe6c0', emissive: '#f3c977', emissiveIntensity: 0.16, metalness: 0.34, roughness: 0.2 },
      transform: {
        position: [westCenterX + 0.18, towerBaseY + towerHeight + parapetHeight + lanternHeight / 2, westCenterZ - 0.35],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'tower-west-spire',
      geometry: 'box',
      args: [0.9, 2.2, 0.9],
      material: { color: '#ffd89c', emissive: '#ffc870', emissiveIntensity: 0.2, metalness: 0.42, roughness: 0.18 },
      transform: {
        position: [westCenterX + 0.18, towerBaseY + towerHeight + parapetHeight + lanternHeight + 1.1, westCenterZ - 0.35],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'sky-bridge',
      geometry: 'box',
      args: [9.6, skyDeckHeight, 4],
      material: { color: '#efe4d4', roughness: 0.26, metalness: 0.24 },
      transform: {
        position: [-4.8, towerBaseY + towerHeight * 0.58, 3.4],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'sky-bridge-glass',
      geometry: 'box',
      args: [9.6, skyDeckHeight * 0.65, 3.6],
      material: { color: '#cad3df', metalness: 0.45, roughness: 0.2, transparent: true, opacity: 0.65 },
      transform: {
        position: [-4.8, towerBaseY + towerHeight * 0.58 + 0.12, 3.4],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'sky-deck-plate',
      geometry: 'box',
      args: [7.2, 0.32, 6],
      material: { color: '#f5ecde', roughness: 0.32, metalness: 0.18 },
      transform: {
        position: [-4.8, towerBaseY + towerHeight * 0.58 + skyDeckHeight / 2 + 0.3, 3.4],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'crown-ring',
      geometry: 'box',
      args: [6.8, crownHeight, 6.8],
      material: { color: '#ebd6b4', emissive: '#f7dfa7', emissiveIntensity: 0.08, roughness: 0.24, metalness: 0.4 },
      transform: {
        position: [-4.4, towerBaseY + towerHeight + parapetHeight + crownHeight / 2, 3.6],
        rotation: [0, 0, 0],
      },
    },
    {
      name: 'podium-plaza',
      geometry: 'plane',
      args: [26, 16],
      material: { color: '#f3f0e7' },
      transform: {
        position: [-3.6, -1.2, 9.6],
        rotation: [-Math.PI / 2, 0, 0],
      },
    },
  ];

  // Compute bounds to center the blueprint.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  rawParts.forEach((part) => {
    const [px, , pz] = part.transform.position;
    const [sx, , sz] = part.geometry === 'plane' ? [part.args[0], 0, part.args[1]] : part.args;
    minX = Math.min(minX, px - sx / 2);
    maxX = Math.max(maxX, px + sx / 2);
    minZ = Math.min(minZ, pz - sz / 2);
    maxZ = Math.max(maxZ, pz + sz / 2);
  });

  const offsetX = (minX + maxX) / 2;
  const offsetZ = (minZ + maxZ) / 2;

  const parts = rawParts.map((part) => ({
    ...part,
    transform: {
      ...part.transform,
      position: [
        part.transform.position[0] - offsetX,
        part.transform.position[1],
        part.transform.position[2] - offsetZ,
      ],
    },
  }));

  const windowTransforms = [];
  const railingTransforms = [];
  const finTransforms = [];
  const lightBarTransforms = [];
  const gardenTransforms = [];

  const columnSpacing = 0.76;
  const depthSpacing = 0.8;
  const baseWindowY = towerBaseY + 0.3;

  const buildFacade = ({
    columns,
    floors = floorCount,
    start,
    right,
    up,
    rotation = [0, 0, 0],
    balcony = false,
    balconyEvery = 3,
    balconyOffset = 1,
    balconyDepth = 0.26,
  }) => {
    for (let floor = 0; floor < floors; floor += 1) {
      for (let column = 0; column < columns; column += 1) {
        const px = start[0] + right[0] * column + up[0] * floor;
        const py = start[1] + right[1] * column + up[1] * floor;
        const pz = start[2] + right[2] * column + up[2] * floor;

        windowTransforms.push({
          position: [px - offsetX, py, pz - offsetZ],
          rotation,
        });

        if (balcony && balconyEvery > 0 && floor % balconyEvery === balconyOffset) {
          railingTransforms.push({
            position: [
              px - offsetX,
              py - 0.24,
              pz - offsetZ + (rotation[1] === 0 ? balconyDepth : 0),
            ],
            rotation,
          });
        }
      }
    }
  };

  const eastColumns = 16;
  const eastHalfDepth = 1.8;
  const eastHalfWidth = ((eastColumns - 1) * columnSpacing) / 2;
  const eastStartX = eastCenterX - eastHalfWidth;

  buildFacade({
    columns: eastColumns,
    start: [eastStartX, baseWindowY, eastCenterZ + eastHalfDepth + 0.18],
    right: [columnSpacing, 0, 0],
    up: [0, floorHeight, 0],
    rotation: [0, 0, 0],
    balcony: true,
    balconyEvery: 4,
    balconyOffset: 2,
    balconyDepth: 0.32,
  });

  buildFacade({
    columns: eastColumns,
    start: [eastStartX, baseWindowY, eastCenterZ - eastHalfDepth - 0.18],
    right: [columnSpacing, 0, 0],
    up: [0, floorHeight, 0],
    rotation: [0, Math.PI, 0],
    balcony: true,
    balconyEvery: 5,
    balconyOffset: 3,
    balconyDepth: 0.24,
  });

  const eastSideColumns = 12;
  const eastSideStartZ = eastCenterZ - ((eastSideColumns - 1) * depthSpacing) / 2;

  buildFacade({
    columns: eastSideColumns,
    start: [eastCenterX + eastHalfWidth + 0.2, baseWindowY, eastSideStartZ],
    right: [0, 0, depthSpacing],
    up: [0, floorHeight, 0],
    rotation: [0, Math.PI / 2, 0],
  });

  buildFacade({
    columns: eastSideColumns,
    start: [eastCenterX - eastHalfWidth - 0.2, baseWindowY, eastSideStartZ],
    right: [0, 0, depthSpacing],
    up: [0, floorHeight, 0],
    rotation: [0, -Math.PI / 2, 0],
  });

  const westHalfWidth = 1.8;
  const westHalfDepth = 6.3;
  const westLongColumns = 18;
  const westStartZ = westCenterZ - ((westLongColumns - 1) * depthSpacing) / 2;

  buildFacade({
    columns: westLongColumns,
    start: [westCenterX + westHalfWidth + 0.2, baseWindowY, westStartZ],
    right: [0, 0, depthSpacing],
    up: [0, floorHeight, 0],
    rotation: [0, Math.PI / 2, 0],
    balcony: true,
    balconyEvery: 5,
    balconyOffset: 2,
    balconyDepth: 0.28,
  });

  buildFacade({
    columns: westLongColumns,
    start: [westCenterX - westHalfWidth - 0.2, baseWindowY, westStartZ],
    right: [0, 0, depthSpacing],
    up: [0, floorHeight, 0],
    rotation: [0, -Math.PI / 2, 0],
  });

  const westFrontColumns = 10;
  const westStartX = westCenterX - ((westFrontColumns - 1) * columnSpacing) / 2;

  buildFacade({
    columns: westFrontColumns,
    start: [westStartX, baseWindowY, westCenterZ + westHalfDepth + 0.22],
    right: [columnSpacing, 0, 0],
    up: [0, floorHeight, 0],
    rotation: [0, 0, 0],
    balcony: true,
    balconyEvery: 4,
    balconyOffset: 1,
    balconyDepth: 0.3,
  });

  buildFacade({
    columns: westFrontColumns,
    start: [westStartX, baseWindowY, westCenterZ - westHalfDepth - 0.22],
    right: [columnSpacing, 0, 0],
    up: [0, floorHeight, 0],
    rotation: [0, Math.PI, 0],
  });

  const finHeight = towerHeight * 0.92;
  const finCenterY = towerBaseY + finHeight / 2;
  const finScaleFront = [0.16, finHeight, 0.44];
  const finScaleSide = [0.16, finHeight * 0.94, 0.44];

  for (let column = 0; column < eastColumns; column += 2) {
    const px = eastStartX + column * columnSpacing;
    finTransforms.push({
      position: [px - offsetX, finCenterY, eastCenterZ + eastHalfDepth + 0.42 - offsetZ],
      rotation: [0, 0, 0],
      scale: finScaleFront,
    });
    finTransforms.push({
      position: [px - offsetX, finCenterY, eastCenterZ - eastHalfDepth - 0.42 - offsetZ],
      rotation: [0, Math.PI, 0],
      scale: finScaleFront,
    });
  }

  for (let column = 0; column < eastSideColumns; column += 3) {
    const pz = eastSideStartZ + column * depthSpacing;
    finTransforms.push({
      position: [eastCenterX + eastHalfWidth + 0.46 - offsetX, finCenterY, pz - offsetZ],
      rotation: [0, Math.PI / 2, 0],
      scale: finScaleSide,
    });
    finTransforms.push({
      position: [eastCenterX - eastHalfWidth - 0.46 - offsetX, finCenterY, pz - offsetZ],
      rotation: [0, -Math.PI / 2, 0],
      scale: finScaleSide,
    });
  }

  for (let column = 0; column < westLongColumns; column += 3) {
    const pz = westStartZ + column * depthSpacing;
    finTransforms.push({
      position: [westCenterX + westHalfWidth + 0.38 - offsetX, finCenterY, pz - offsetZ],
      rotation: [0, Math.PI / 2, 0],
      scale: finScaleSide,
    });
    finTransforms.push({
      position: [westCenterX - westHalfWidth - 0.38 - offsetX, finCenterY, pz - offsetZ],
      rotation: [0, -Math.PI / 2, 0],
      scale: finScaleSide,
    });
  }

  for (let column = 0; column < westFrontColumns; column += 2) {
    const px = westStartX + column * columnSpacing;
    finTransforms.push({
      position: [px - offsetX, finCenterY, westCenterZ + westHalfDepth + 0.48 - offsetZ],
      rotation: [0, 0, 0],
      scale: finScaleFront,
    });
    finTransforms.push({
      position: [px - offsetX, finCenterY, westCenterZ - westHalfDepth - 0.48 - offsetZ],
      rotation: [0, Math.PI, 0],
      scale: finScaleFront,
    });
  }

  const lightBarHeight = towerHeight * 1.02;
  const lightBarCenterY = towerBaseY + lightBarHeight / 2;
  const lightBarScale = [0.12, lightBarHeight, 0.12];
  const lightBarPositions = [
    [eastCenterX - eastHalfWidth - 0.52, lightBarCenterY, eastCenterZ + eastHalfDepth + 0.46, 0],
    [eastCenterX + eastHalfWidth + 0.52, lightBarCenterY, eastCenterZ + eastHalfDepth + 0.46, 0],
    [eastCenterX - eastHalfWidth - 0.52, lightBarCenterY, eastCenterZ - eastHalfDepth - 0.46, 0],
    [eastCenterX + eastHalfWidth + 0.52, lightBarCenterY, eastCenterZ - eastHalfDepth - 0.46, 0],
    [westCenterX + westHalfWidth + 0.34, lightBarCenterY, westCenterZ + westHalfDepth + 0.52, 0],
    [westCenterX - westHalfWidth - 0.34, lightBarCenterY, westCenterZ + westHalfDepth + 0.52, 0],
    [westCenterX + westHalfWidth + 0.34, lightBarCenterY, westCenterZ - westHalfDepth - 0.52, 0],
    [westCenterX - westHalfWidth - 0.34, lightBarCenterY, westCenterZ - westHalfDepth - 0.52, 0],
    [-4.8, towerBaseY + towerHeight * 0.58 + skyDeckHeight * 0.45, 3.4 + 2.6, Math.PI / 2],
    [-4.8, towerBaseY + towerHeight * 0.58 + skyDeckHeight * 0.45, 3.4 - 2.6, Math.PI / 2],
  ];

  lightBarPositions.forEach(([px, py, pz, ry]) => {
    lightBarTransforms.push({
      position: [px - offsetX, py, pz - offsetZ],
      rotation: [0, ry, 0],
      scale: lightBarScale,
    });
  });

  const skyGardenLevels = [14, 28, 44, 58];
  skyGardenLevels.forEach((level, index) => {
    const py = towerBaseY + level * floorHeight;
    const width = 6.2 - index * 0.5;
    const depth = 3.2 - index * 0.32;

    gardenTransforms.push({
      position: [eastCenterX + 0.12 - offsetX, py, eastCenterZ + eastHalfDepth + 0.25 - offsetZ],
      rotation: [0, 0, 0],
      scale: [width, 0.28, depth],
    });

    gardenTransforms.push({
      position: [westCenterX + 0.2 - offsetX, py, westCenterZ - westHalfDepth - 0.7 - offsetZ],
      rotation: [0, 0, 0],
      scale: [3.4 - index * 0.24, 0.24, 4.6 - index * 0.36],
    });
  });

  gardenTransforms.push({
    position: [-4.8 - offsetX, towerBaseY + towerHeight * 0.58 + skyDeckHeight / 2 + 0.12, 3.4 + 2.4 - offsetZ],
    rotation: [0, 0, 0],
    scale: [6.2, 0.26, 1.6],
  });

  gardenTransforms.push({
    position: [-4.8 - offsetX, towerBaseY + towerHeight * 0.58 + skyDeckHeight / 2 + 0.12, 3.4 - 2.4 - offsetZ],
    rotation: [0, 0, 0],
    scale: [6.2, 0.26, 1.6],
  });

  const podiumPlanters = [
    [-12.2, groundLevel + podiumHeight + 0.32, 11.4, 6.2, 0.34, 2.2],
    [4.8, groundLevel + podiumHeight + podiumTerraceHeight + 0.24, 12.4, 7.4, 0.3, 2],
    [-3.6, groundLevel + podiumHeight + podiumTerraceHeight + 0.24, -2.4, 12, 0.28, 3.6],
    [6.2, groundLevel + podiumHeight + 0.26, 0.8, 4, 0.28, 4.6],
  ];

  podiumPlanters.forEach(([px, py, pz, sx, sy, sz]) => {
    gardenTransforms.push({
      position: [px - offsetX, py, pz - offsetZ],
      rotation: [0, 0, 0],
      scale: [sx, sy, sz],
    });
  });

  return {
    parts,
    windowTransforms,
    railingTransforms,
    finTransforms,
    lightBarTransforms,
    gardenTransforms,
  };
}

function createBuildingOffsets() {
  const offsets = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const jitterX = ((row % 2) - 0.5) * 4;
      const jitterZ = ((col % 2) - 0.5) * 3;
      const x = (col - (GRID_COLS - 1) / 2) * SPACING_X + jitterX;
      const z = (row - (GRID_ROWS - 1) / 2) * SPACING_Z + jitterZ;
      const rotation = (row + col) % 2 === 0 ? 0 : Math.PI / 2;
      offsets.push({ position: [x, 0, z], rotation });
    }
  }
  return offsets;
}

function createWarpedOffsets(offsets, params) {
  const {
    distortion,
    twistIntensity,
    kleinFold,
    hyperWeave,
    verticalBloom,
    scalePulse,
    waveFrequency,
    pinch,
  } = params;

  const t = Math.min(Math.max(distortion, 0), 1);

  if (t === 0) {
    return offsets.map((offset) => ({
      position: [...offset.position],
      rotation: offset.rotation ?? 0,
      extraRotation: [0, 0, 0],
      scale: [1, 1, 1],
    }));
  }

  const clampRadius = MAX_GRID_RADIUS * 1.25;

  return offsets.map((offset, index) => {
    const [x, baseY, z] = offset.position;
    const baseRotation = offset.rotation ?? 0;

    const radius = Math.hypot(x, z);
    const radius01 = MAX_GRID_RADIUS === 0 ? 0 : radius / MAX_GRID_RADIUS;
    const angle = Math.atan2(z, x);

    const row = Math.floor(index / GRID_COLS);
    const col = index % GRID_COLS;
    const gridU = GRID_COLS > 1 ? col / (GRID_COLS - 1) : 0;
    const gridV = GRID_ROWS > 1 ? row / (GRID_ROWS - 1) : 0;
    const checker = (row + col) % 2 === 0 ? 1 : -1;

    const kleinTheta = angle * (2.2 + waveFrequency * 0.35) + radius01 * Math.PI * (1.4 + waveFrequency * 0.15);
    const kleinLoop = Math.sin(kleinTheta) * kleinFold * 18;
    const kleinTwist = Math.cos(kleinTheta * 0.5) * kleinFold * 0.45;

    const pinchFactor = 1 - pinch * radius01;
    const targetRadius =
      radius * pinchFactor +
      kleinLoop +
      Math.cos(angle * (waveFrequency + 0.5) + radius01 * Math.PI * 1.2) * hyperWeave * 0.18;
    const targetRadiusClamped = Math.max(-clampRadius, Math.min(clampRadius, targetRadius));

    const twist = twistIntensity * radius01 * 1.4 + kleinTwist;
    const vortex = Math.sin(kleinTheta + checker * Math.PI * 0.25) * 0.65;
    const targetAngle = angle + twist + vortex * (1 - radius01 * 0.6);

    const hyper = Math.sin(kleinTheta * 1.12 + gridU * Math.PI * 2) * hyperWeave;
    const hyperOffsetX = Math.sin(hyper * 0.03) * hyperWeave * 0.35;
    const hyperOffsetZ = Math.cos(hyper * 0.028) * hyperWeave * 0.35;

    const targetPosition = [
      Math.cos(targetAngle) * targetRadiusClamped + hyperOffsetX,
      baseY +
        Math.sin(kleinTheta * 0.5) * verticalBloom * 0.6 +
        Math.cos(angle * (waveFrequency + 0.5) + gridV * Math.PI) * verticalBloom * 0.4 +
        hyper * 0.04,
      Math.sin(targetAngle) * targetRadiusClamped + hyperOffsetZ,
    ];

    const finalPosition = lerpVec3([x, baseY, z], targetPosition, t);

    const yawDelta = targetAngle - angle + Math.sin(kleinTheta + gridV * Math.PI * 1.5) * 0.4;
    const finalYaw = baseRotation + yawDelta * t;

    const pitch = Math.cos(kleinTheta * 0.5 + gridV * Math.PI) * verticalBloom * 0.012;
    const roll = Math.sin(kleinTheta * 0.33 + gridU * Math.PI * 2) * verticalBloom * 0.01;

    const scalePulseValue = 1 + Math.sin(kleinTheta + gridU * Math.PI) * scalePulse;
    const scaleYValue = 1 + Math.cos(kleinTheta * 0.5 - gridV * Math.PI) * scalePulse * 0.65;
    const safeScaleX = Math.max(0.2, scalePulseValue);
    const safeScaleY = Math.max(0.3, scaleYValue);

    return {
      position: finalPosition,
      rotation: finalYaw,
      extraRotation: [pitch * t, 0, roll * t],
      scale: [lerp(1, safeScaleX, t), lerp(1, safeScaleY, t), lerp(1, safeScaleX, t)],
    };
  });
}

function InstancedPart({ geometry, args, material, transforms }) {
  const meshRef = useRef(null);

  useEffect(() => {
    if (transforms.length === 0) return;
    applyInstancedTransforms(meshRef.current, transforms);
  }, [transforms]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, transforms.length]}>
      {geometry === 'box' ? <boxGeometry args={args} /> : <planeGeometry args={args} />}
      <meshStandardMaterial {...material} />
    </instancedMesh>
  );
}

function ApartmentComplex() {
  const blueprint = useMemo(() => createBlueprint(), []);
  const {
    parts,
    windowTransforms: baseWindowTransforms,
    railingTransforms: baseRailingTransforms,
    finTransforms: baseFinTransforms,
    lightBarTransforms: baseLightBarTransforms,
    gardenTransforms: baseGardenTransforms,
  } = blueprint;
  const baseOffsets = useMemo(() => createBuildingOffsets(), []);
  const {
    distortion,
    twistIntensity,
    kleinFold,
    hyperWeave,
    verticalBloom,
    scalePulse,
    waveFrequency,
    pinch,
  } = useControls(
    '파라메트릭 왜곡',
    {
      distortion: { value: 0, min: 0, max: 1, step: 0.01 },
      morph: folder(
        {
          twistIntensity: { value: 0.7, min: 0, max: 2.4, step: 0.01 },
          kleinFold: { value: 0.55, min: 0, max: 1.8, step: 0.01 },
          hyperWeave: { value: 20, min: 0, max: 60, step: 0.5 },
          verticalBloom: { value: 10, min: 0, max: 45, step: 0.5 },
          scalePulse: { value: 0.2, min: 0, max: 0.8, step: 0.01 },
          waveFrequency: { value: 2.1, min: 0.2, max: 6, step: 0.1 },
          pinch: { value: 0.18, min: -0.6, max: 0.8, step: 0.01 },
        },
        { collapsed: true },
      ),
    },
  );

  const warpedOffsets = useMemo(
    () =>
      createWarpedOffsets(baseOffsets, {
        distortion,
        twistIntensity,
        kleinFold,
        hyperWeave,
        verticalBloom,
        scalePulse,
        waveFrequency,
        pinch,
      }),
    [baseOffsets, distortion, twistIntensity, kleinFold, hyperWeave, verticalBloom, scalePulse, waveFrequency, pinch],
  );

  const partInstances = useMemo(
    () =>
      parts.map((part) => ({
        key: part.name,
        geometry: part.geometry,
        args: part.args,
        material: part.material,
        transforms: replicateTransforms([part.transform], warpedOffsets),
      })),
    [parts, warpedOffsets],
  );

  const windowTransforms = useMemo(
    () => replicateTransforms(baseWindowTransforms, warpedOffsets),
    [baseWindowTransforms, warpedOffsets],
  );

  const railingTransforms = useMemo(
    () => replicateTransforms(baseRailingTransforms, warpedOffsets),
    [baseRailingTransforms, warpedOffsets],
  );

  const finTransforms = useMemo(
    () => replicateTransforms(baseFinTransforms, warpedOffsets),
    [baseFinTransforms, warpedOffsets],
  );

  const lightBarTransforms = useMemo(
    () => replicateTransforms(baseLightBarTransforms, warpedOffsets),
    [baseLightBarTransforms, warpedOffsets],
  );

  const gardenTransforms = useMemo(
    () => replicateTransforms(baseGardenTransforms, warpedOffsets),
    [baseGardenTransforms, warpedOffsets],
  );

  const windowsRef = useRef(null);
  const railingsRef = useRef(null);
  const finsRef = useRef(null);
  const lightBarsRef = useRef(null);
  const gardensRef = useRef(null);

  useEffect(() => {
    applyInstancedTransforms(windowsRef.current, windowTransforms);
  }, [windowTransforms]);

  useEffect(() => {
    applyInstancedTransforms(railingsRef.current, railingTransforms);
  }, [railingTransforms]);

  useEffect(() => {
    if (!finsRef.current || finTransforms.length === 0) return;
    applyInstancedTransforms(finsRef.current, finTransforms);
  }, [finTransforms]);

  useEffect(() => {
    if (!lightBarsRef.current || lightBarTransforms.length === 0) return;
    applyInstancedTransforms(lightBarsRef.current, lightBarTransforms);
  }, [lightBarTransforms]);

  useEffect(() => {
    if (!gardensRef.current || gardenTransforms.length === 0) return;
    applyInstancedTransforms(gardensRef.current, gardenTransforms);
  }, [gardenTransforms]);

  return (
    <group>
      {partInstances.map((part) => (
        <InstancedPart
          key={part.key}
          geometry={part.geometry}
          args={part.args}
          material={part.material}
          transforms={part.transforms}
        />
      ))}
      <instancedMesh ref={windowsRef} args={[null, null, windowTransforms.length]}>
        <boxGeometry args={[0.78, 0.46, 0.06]} />
        <meshStandardMaterial
          color="#a1b6c6"
          emissive="#1f2d3a"
          emissiveIntensity={0.1}
          metalness={0.24}
          roughness={0.24}
        />
      </instancedMesh>
      <instancedMesh ref={railingsRef} args={[null, null, railingTransforms.length]}>
        <boxGeometry args={[0.78, 0.08, 0.34]} />
        <meshStandardMaterial color="#f0e5d2" roughness={0.4} metalness={0.1} />
      </instancedMesh>
      {finTransforms.length > 0 && (
        <instancedMesh ref={finsRef} args={[null, null, finTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#d8c0a0" metalness={0.52} roughness={0.28} />
        </instancedMesh>
      )}
      {lightBarTransforms.length > 0 && (
        <instancedMesh ref={lightBarsRef} args={[null, null, lightBarTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#f5e3c5"
            emissive="#f7d184"
            emissiveIntensity={0.55}
            metalness={0.22}
            roughness={0.16}
          />
        </instancedMesh>
      )}
      {gardenTransforms.length > 0 && (
        <instancedMesh ref={gardensRef} args={[null, null, gardenTransforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#7fa98c" roughness={0.72} metalness={0.08} />
        </instancedMesh>
      )}
    </group>
  );
}

function Landscape() {
  const campusWidth = GRID_COLS * SPACING_X + 40;
  const campusDepth = GRID_ROWS * SPACING_Z + 40;
  const waterWidth = campusWidth * 0.28;
  const promenadeDepth = campusDepth * 0.26;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.05, 0]}>
        <planeGeometry args={[campusWidth, campusDepth]} />
        <meshStandardMaterial color="#f6f3ed" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.045, 0]}>
        <planeGeometry args={[campusWidth * 0.78, campusDepth * 0.74]} />
        <meshStandardMaterial color="#e5e0d6" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL - 0.04, SPACING_Z * 0.14]}>
        <planeGeometry args={[campusWidth * 0.34, promenadeDepth]} />
        <meshStandardMaterial color="#d8cfc0" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-SPACING_X * 0.24, GROUND_LEVEL - 0.038, -SPACING_Z * 0.22]}>
        <planeGeometry args={[waterWidth, campusDepth * 0.24]} />
        <meshStandardMaterial color="#cde3f1" metalness={0.25} roughness={0.18} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[SPACING_X * 0.28, GROUND_LEVEL - 0.038, -SPACING_Z * 0.26]}>
        <planeGeometry args={[waterWidth * 0.72, campusDepth * 0.2]} />
        <meshStandardMaterial color="#d4ecff" metalness={0.2} roughness={0.16} />
      </mesh>
      <mesh position={[0, GROUND_LEVEL + 0.12, 0]}>
        <boxGeometry args={[12, 0.3, 12]} />
        <meshStandardMaterial color="#9db79b" roughness={0.6} metalness={0.08} />
      </mesh>
      <mesh position={[SPACING_X * 0.18, GROUND_LEVEL + 0.16, SPACING_Z * 0.14]}>
        <boxGeometry args={[campusWidth * 0.32, 0.24, 2.2]} />
        <meshStandardMaterial color="#f7ede1" roughness={0.32} metalness={0.18} />
      </mesh>
      <mesh position={[-SPACING_X * 0.22, GROUND_LEVEL + 0.16, SPACING_Z * 0.14]}>
        <boxGeometry args={[campusWidth * 0.18, 0.24, 1.6]} />
        <meshStandardMaterial color="#eadfce" roughness={0.34} metalness={0.16} />
      </mesh>
    </group>
  );
}

export default function Apt23Lux() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '640px' }}>
      <Canvas camera={{ position: [122, 64, 136], fov: 45 }}>
        <color attach="background" args={['#f8f4ee']} />
        <ambientLight intensity={0.58} />
        <directionalLight position={[130, 155, 88]} intensity={1.05} castShadow />
        <hemisphereLight intensity={0.45} groundColor="#f2ecdf" />
        <ApartmentComplex />
        <Landscape />
        <OrbitControls target={[0, 6, 3]} maxPolarAngle={Math.PI / 2.15} />
      </Canvas>
      <Leva collapsed />
    </div>
  );
}
