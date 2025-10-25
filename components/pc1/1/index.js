import React, {useEffect, useMemo} from 'react';
import {useTheme} from 'styled-components';
import * as S from './styles';
import {createGridSystem} from './gridSystem';

const RIVER_COLOR = 'rgba(64, 145, 255, 0.9)';
const RIVER_THICKNESS = 4;
const DEFAULT_COLUMNS = 50; // matches 2vw cell size across 100vw

export default function PC1() {
  const theme = useTheme();
  const windowWidth = theme?.windowWidth || 0;
  const windowHeight = theme?.windowHeight || 0;

  const columns = DEFAULT_COLUMNS;
  const rows = useMemo(() => {
    if (windowWidth <= 0 || windowHeight <= 0) {
      return DEFAULT_COLUMNS;
    }

    const ratio = windowHeight / windowWidth;
    return Math.max(RIVER_THICKNESS, Math.ceil(ratio * columns));
  }, [windowWidth, windowHeight, columns]);

  const grid = useMemo(
    () => createGridSystem({columns, rows}),
    [columns, rows],
  );

  const {features, riverMeta} = useMemo(() => {
    const startRow = Math.floor(grid.rows * 0.2);
    const maxRow = Math.floor(grid.rows * 0.3);
    const endRowCandidate = startRow + RIVER_THICKNESS - 1;
    const endRow = Math.max(
      startRow,
      Math.min(maxRow, endRowCandidate, grid.rows - 1),
    );

    const riverCells = grid.rectCells(0, grid.columns - 1, startRow, endRow);

    return {
      features: [
        {
          id: 'river',
          value: RIVER_COLOR,
          cells: riverCells,
        },
      ],
      riverMeta: {
        startRow,
        endRow,
      },
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
    const riverSliceStart = riverMeta.startRow * grid.columns;
    const riverSliceEnd = (riverMeta.endRow + 1) * grid.columns;
    console.log('[PC1] river palette slice', cellPalette.slice(riverSliceStart, riverSliceEnd));
  }, [cellPalette, riverMeta, grid]);

  return (
    <S.Container>
      <S.Grid $columns={grid.columns} $rows={grid.rows}>
        {cellPalette.map((color, index) => (
          <S.Cell
            key={index}
            $fill={Boolean(color)}
            style={
              color ? {backgroundColor: color, '--fill-color': color} : undefined
            }
          />
        ))}
      </S.Grid>
    </S.Container>
  );
}
