import React, {useEffect, useMemo} from 'react';
import {useTheme} from 'styled-components';
import * as S from './styles';
import {createGridSystem} from './gridSystem';

const RIVER_COLOR = 'rgba(64, 145, 255, 0.9)';
const ESTATE_COLOR = 'rgba(255, 255, 255, 0.96)';
const RIVER_THICKNESS = 4;
const DEFAULT_COLUMNS = 50; // matches 2vw cell size across 100vw
const MIN_ROWS = 30;
const ESTATE_SIZE = 2;
const ESTATE_GAP = 1;
const ESTATE_NAMES = [
  '간포',
  '난포',
  '단포',
  '란포',
  '만포',
  '반포',
  '산포',
  '안포',
  '잔포',
  '찬포',
  '칸포',
  '탄포',
  '판포',
  '한포',
];
const ESTATES_PER_ROW = ESTATE_NAMES.length;

export default function PC1() {
  const theme = useTheme();
  const windowWidth = theme?.windowWidth || 0;
  const windowHeight = theme?.windowHeight || 0;

  const columns = DEFAULT_COLUMNS;
  const rows = useMemo(() => {
    if (windowWidth <= 0 || windowHeight <= 0) {
      return Math.max(DEFAULT_COLUMNS, MIN_ROWS);
    }

    const ratio = windowHeight / windowWidth;
    const aspectRows = Math.ceil(ratio * columns);
    const minimumForFeatures = RIVER_THICKNESS + ESTATE_SIZE + 8;
    return Math.max(MIN_ROWS, aspectRows, minimumForFeatures);
  }, [windowWidth, windowHeight, columns]);

  const grid = useMemo(
    () => createGridSystem({columns, rows}),
    [columns, rows],
  );

  const {features, riverMeta, estateLabels} = useMemo(() => {
    const startRow = Math.floor(grid.rows * 0.2);
    const maxRow = Math.floor(grid.rows * 0.3);
    const endRowCandidate = startRow + RIVER_THICKNESS - 1;
    const endRow = Math.max(
      startRow,
      Math.min(maxRow, endRowCandidate, grid.rows - 1),
    );

    const riverCells = grid.rectCells(0, grid.columns - 1, startRow, endRow);

    const estateTopCandidate = endRow + 1;
    const estateTopRow = Math.min(
      estateTopCandidate,
      Math.max(0, grid.rows - ESTATE_SIZE),
    );
    let gapBetween = ESTATE_GAP;
    let widthNeeded =
      ESTATES_PER_ROW * ESTATE_SIZE + (ESTATES_PER_ROW - 1) * gapBetween;
    if (widthNeeded > grid.columns) {
      gapBetween = 0;
      widthNeeded = ESTATES_PER_ROW * ESTATE_SIZE;
    }
    const estateStartColumn = Math.max(
      0,
      Math.floor((grid.columns - widthNeeded) / 2),
    );

    const estateFeatures = [];
    const estateMeta = [];

    ESTATE_NAMES.forEach((name, index) => {
      const colStart =
        estateStartColumn + index * (ESTATE_SIZE + gapBetween);
      const rowStart = estateTopRow;
      const colEnd = colStart + ESTATE_SIZE - 1;
      const rowEnd = rowStart + ESTATE_SIZE - 1;

      if (rowEnd >= grid.rows || colEnd >= grid.columns) {
        console.warn('[PC1] Estate out of bounds skipped', {
          name,
          colStart,
          rowStart,
          colEnd,
          rowEnd,
        });
        return;
      }

      estateFeatures.push({
        id: `estate-${name}`,
        value: {
          fill: ESTATE_COLOR,
          type: 'estate',
          name,
        },
        cells: grid.rectCells(colStart, colEnd, rowStart, rowEnd),
      });

      estateMeta.push({
        name,
        colStart,
        colEnd,
        rowStart,
        rowEnd,
      });
    });

    return {
      features: [
        {
          id: 'river',
          value: {
            fill: RIVER_COLOR,
            type: 'river',
          },
          cells: riverCells,
        },
        ...estateFeatures,
      ],
      riverMeta: {
        startRow,
        endRow,
      },
      estateLabels: estateMeta,
    };
  }, [grid]);

  const cellPalette = useMemo(
    () => grid.createCellPalette(features),
    [grid, features],
  );

  useEffect(() => {
    console.log('[PC1] GRID DIMENSIONS', {
      columns: grid.columns,
      rows: grid.rows,
      total: grid.totalCells,
    });
    console.log('[PC1] RIVER META', riverMeta);
    console.log('[PC1] ESTATE LABELS', estateLabels);
    const riverSliceStart = riverMeta.startRow * grid.columns;
    const riverSliceEnd = (riverMeta.endRow + 1) * grid.columns;
    console.log('[PC1] river palette slice', cellPalette.slice(riverSliceStart, riverSliceEnd));
  }, [cellPalette, riverMeta, grid, estateLabels]);

  return (
    <S.Container>
      <S.Grid $columns={grid.columns} $rows={grid.rows}>
        {cellPalette.map((cell, index) => (
          <S.Cell
            key={index}
            $fill={Boolean(cell?.fill)}
            $featureType={cell?.type || null}
            style={cell?.fill ? {'--fill-color': cell.fill} : undefined}
          />
        ))}
        {estateLabels.map((estate) => (
          <S.EstateLabel
            key={estate.name}
            style={{
              gridColumn: `${estate.colStart + 1} / ${estate.colEnd + 2}`,
              gridRow: `${estate.rowStart + 1} / ${estate.rowEnd + 2}`,
            }}
          >
            {estate.name}
          </S.EstateLabel>
        ))}
      </S.Grid>
    </S.Container>
  );
}
