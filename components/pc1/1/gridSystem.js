export const createGridSystem = ({columns, rows}) => {
  const safeColumns = Math.max(1, Math.floor(columns));
  const safeRows = Math.max(1, Math.floor(rows));
  const totalCells = safeColumns * safeRows;

  const coordToIndex = ({x, y}) => {
    if (x < 0 || x >= safeColumns || y < 0 || y >= safeRows) {
      throw new Error(`Coordinate out of bounds: (${x}, ${y}) within ${safeColumns}x${safeRows}`);
    }
    return y * safeColumns + x;
  };

  const indexToCoord = (index) => {
    if (index < 0 || index >= totalCells) {
      throw new Error(`Index out of bounds: ${index} within total ${totalCells}`);
    }
    const y = Math.floor(index / safeColumns);
    const x = index % safeColumns;
    return {x, y};
  };

  const rectCells = (xStart, xEnd, yStart, yEnd) => {
    const xMin = Math.max(0, Math.min(xStart, xEnd));
    const xMax = Math.min(safeColumns - 1, Math.max(xStart, xEnd));
    const yMin = Math.max(0, Math.min(yStart, yEnd));
    const yMax = Math.min(safeRows - 1, Math.max(yStart, yEnd));

    const cells = [];
    for (let y = yMin; y <= yMax; y += 1) {
      for (let x = xMin; x <= xMax; x += 1) {
        cells.push({x, y});
      }
    }
    return cells;
  };

  const createCellPalette = (features) => {
    const palette = Array.from({length: totalCells}, () => null);

    features.forEach(({cells, value}) => {
      cells.forEach((cell) => {
        try {
          const index = coordToIndex(cell);
          palette[index] = value;
        } catch (error) {
          console.warn('[gridSystem] Attempted to paint out-of-bounds cell', cell, error);
        }
      });
    });

    return palette;
  };

  return {
    columns: safeColumns,
    rows: safeRows,
    totalCells,
    coordToIndex,
    indexToCoord,
    rectCells,
    createCellPalette,
  };
};
