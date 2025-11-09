import 'server-only';

let sharpModulePromise = null;
let fsModulePromise = null;
let tesseractModulePromise = null;

const DEFAULT_OPTIONS = {
  minRegionPixels: 1500,
  ocrWhitelist: '0123456789',
};

const COLOR_PROFILES = {
  living: [
    [206, 143, 82],
    [195, 131, 70],
    [220, 160, 98],
  ],
  bedroom: [
    [234, 211, 170],
    [224, 198, 150],
    [235, 203, 145],
  ],
  balcony: [
    [241, 233, 207],
    [230, 222, 195],
    [217, 212, 188],
  ],
  other: [
    [193, 207, 220],
    [170, 182, 194],
    [158, 158, 158],
    [208, 208, 208],
  ],
};

const IGNORED_TYPES = new Set(['ignore']);
const COLOR_KEYS = Object.keys(COLOR_PROFILES);

const loadSharp = async () => {
  if (!sharpModulePromise) {
    sharpModulePromise = import('sharp').then((mod) => mod.default);
  }
  return sharpModulePromise;
};

const loadFs = async () => {
  if (!fsModulePromise) {
    fsModulePromise = import('fs/promises');
  }
  return fsModulePromise;
};

const loadTesseract = async () => {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import('tesseract.js');
  }
  return tesseractModulePromise;
};

const makeSquared = (value) => value * value;

function colorDistance([r1, g1, b1], [r2, g2, b2]) {
  return Math.sqrt(
    makeSquared(r1 - r2) + makeSquared(g1 - g2) + makeSquared(b1 - b2),
  );
}

function classifyColor(r, g, b) {
  const brightness = (r + g + b) / 3;
  if (brightness > 245) return 'ignore';
  if (brightness < 25) return 'ignore';
  if (r < 45 && g < 45 && b < 45) return 'ignore';

  let bestType = 'other';
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const type of COLOR_KEYS) {
    const samples = COLOR_PROFILES[type];
    for (const sample of samples) {
      const d = colorDistance([r, g, b], sample);
      if (d < bestDistance) {
        bestDistance = d;
        bestType = type;
      }
    }
  }

  if (bestDistance > 90 && bestType !== 'other') {
    return 'other';
  }

  return bestType;
}

function getPixelIndex(x, y, width) {
  return (y * width + x);
}

function computeLayoutBounds(pixelTypes, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const type = pixelTypes[getPixelIndex(x, y, width)];
      if (IGNORED_TYPES.has(type)) continue;
      if (type === 'other') continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (minX === width || minY === height) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function recogniseDimensions(buffer, { ocrWhitelist }, createWorkerFn) {
  const { createWorker, PSM } = createWorkerFn;
  const worker = await createWorker();

  try {
    await worker.load();
    await worker.reinitialize('eng');
    await worker.setParameters({
      tessedit_char_whitelist: ocrWhitelist,
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });

    const { data } = await worker.recognize(buffer);

    const dimensionWords = [];
    if (data.words) {
      for (const word of data.words) {
        const cleaned = word.text.replace(/[^0-9]/g, '');
        if (!cleaned) continue;
        const numeric = parseInt(cleaned, 10);
        if (Number.isNaN(numeric) || numeric <= 0) continue;
        const { x0, x1, y0, y1 } = word.bbox;
        dimensionWords.push({
          value: numeric,
          bbox: { x0, x1, y0, y1 },
          centerX: (x0 + x1) / 2,
          centerY: (y0 + y1) / 2,
        });
      }
    }

    return dimensionWords;
  } finally {
    await worker.terminate();
  }
}

function deriveScale(dimensionWords, width, height) {
  const horizontalValues = [];
  const verticalValues = [];

  for (const entry of dimensionWords) {
    const { value, centerX, centerY } = entry;
    if (centerY < height * 0.22 || centerY > height * 0.78) {
      horizontalValues.push(value);
    } else if (centerX < width * 0.22 || centerX > width * 0.78) {
      verticalValues.push(value);
    }
  }

  const widthMm = horizontalValues.length
    ? Math.max(...horizontalValues)
    : null;
  const heightMm = verticalValues.length
    ? Math.max(...verticalValues)
    : null;

  const fallbackWidth = horizontalValues.reduce((acc, val) => acc + val, 0);
  const fallbackHeight = verticalValues.reduce((acc, val) => acc + val, 0);

  return {
    widthMm: widthMm && widthMm > 0 ? widthMm : fallbackWidth || null,
    heightMm: heightMm && heightMm > 0 ? heightMm : fallbackHeight || null,
  };
}

function extractRegions(pixelTypes, width, height, minRegionPixels) {
  const visited = new Int32Array(width * height).fill(-1);
  const regions = [];
  let regionId = 0;

  const queue = new Int32Array(width * height);
  const offsets = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startIdx = getPixelIndex(x, y, width);
      if (visited[startIdx] !== -1) continue;
      const baseType = pixelTypes[startIdx];
      if (IGNORED_TYPES.has(baseType)) continue;

      let queueSize = 0;
      queue[queueSize++] = startIdx;
      visited[startIdx] = regionId;

      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (queueSize > 0) {
        const idx = queue[--queueSize];
        const currentY = Math.floor(idx / width);
        const currentX = idx - currentY * width;
        area += 1;

        if (currentX < minX) minX = currentX;
        if (currentX > maxX) maxX = currentX;
        if (currentY < minY) minY = currentY;
        if (currentY > maxY) maxY = currentY;

        for (const { dx, dy } of offsets) {
          const nx = currentX + dx;
          const ny = currentY + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbourIdx = getPixelIndex(nx, ny, width);
          if (visited[neighbourIdx] !== -1) continue;
          if (pixelTypes[neighbourIdx] !== baseType) continue;

          visited[neighbourIdx] = regionId;
          queue[queueSize++] = neighbourIdx;
        }
      }

      if (area < minRegionPixels) {
        regionId += 1;
        continue;
      }

      regions.push({
        id: regionId,
        type: baseType,
        bounds: { minX, minY, maxX, maxY },
        areaPixels: area,
      });
      regionId += 1;
    }
  }

  return regions;
}

function createPolygonFromBounds(bounds, mmPerPxX, mmPerPxY, layoutBounds) {
  const { minX, minY, maxX, maxY } = bounds;

  const originX = layoutBounds ? layoutBounds.minX : 0;
  const originY = layoutBounds ? layoutBounds.minY : 0;

  const startX = (minX - originX) * mmPerPxX;
  const endX = (maxX - originX + 1) * mmPerPxX;
  const startY = (minY - originY) * mmPerPxY;
  const endY = (maxY - originY + 1) * mmPerPxY;

  return [
    [startX, startY],
    [endX, startY],
    [endX, endY],
    [startX, endY],
  ];
}

export async function picToJson(input, options = {}) {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const fs = await loadFs();
  const sharp = await loadSharp();
  const tesseractModule = await loadTesseract();

  const sourceBuffer = Buffer.isBuffer(input) ? input : await fs.readFile(input);

  const { data, info } = await sharp(sourceBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 3) {
    throw new Error(`Expected 3 channels, received ${channels}`);
  }

  const pixelTypes = new Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = getPixelIndex(x, y, width) * 3;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      pixelTypes[getPixelIndex(x, y, width)] = classifyColor(r, g, b);
    }
  }

  const layoutBounds = computeLayoutBounds(pixelTypes, width, height);
  if (!layoutBounds) {
    throw new Error('Unable to locate floor plan footprint.');
  }

  const dimensionWords = await recogniseDimensions(
    sourceBuffer,
    resolvedOptions,
    tesseractModule,
  );
  const { widthMm, heightMm } = deriveScale(dimensionWords, width, height);

  const mmPerPixelX = widthMm
    ? widthMm / layoutBounds.width
    : null;
  const mmPerPixelY = heightMm
    ? heightMm / layoutBounds.height
    : mmPerPixelX;

  const regions = extractRegions(
    pixelTypes,
    width,
    height,
    resolvedOptions.minRegionPixels,
  );

  const roomItems = regions.map((region) => {
    const polygon = createPolygonFromBounds(
      region.bounds,
      mmPerPixelX || 1,
      mmPerPixelY || 1,
      layoutBounds,
    );

    const [widthMmPolygon, heightMmPolygon] = [
      (region.bounds.maxX - region.bounds.minX + 1) * (mmPerPixelX || 1),
      (region.bounds.maxY - region.bounds.minY + 1) * (mmPerPixelY || 1),
    ];

    return {
      id: region.id,
      type: region.type,
      polygon,
      startCoordinate: polygon[0],
      endCoordinate: polygon[2],
      areaMm2: widthMmPolygon * heightMmPolygon,
    };
  });

  return {
    meta: {
      source: {
        widthPixels: width,
        heightPixels: height,
      },
      layoutBounds,
      widthMm: widthMm || null,
      heightMm: heightMm || null,
      mmPerPixelX: mmPerPixelX || null,
      mmPerPixelY: mmPerPixelY || null,
      ocrValues: dimensionWords,
    },
    rooms: roomItems,
  };
}

export default picToJson;
