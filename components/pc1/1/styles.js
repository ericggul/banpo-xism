import styled, {css} from 'styled-components';
import {FlexCenterStyle} from '@/styles/common';

const CELL_SIZE_VW = 2;

export const Container = styled.div`
  ${FlexCenterStyle}
  width: 100vw;
  height: 100vh;
  background: #000;
`;

export const Grid = styled.div`
  display: grid;
  position: relative;
  grid-template-columns: repeat(${({$columns}) => $columns}, ${CELL_SIZE_VW}vw);
  grid-template-rows: repeat(${({$rows}) => $rows}, ${CELL_SIZE_VW}vw);
  width: ${({$columns}) => `calc(${CELL_SIZE_VW}vw * ${$columns})`};
  height: ${({$rows}) => `calc(${CELL_SIZE_VW}vw * ${$rows})`};
  background-color: rgba(255, 255, 255, 0.03);
  background-image:
    linear-gradient(
      to right,
      rgba(255, 255, 255, 0.18) 0,
      rgba(255, 255, 255, 0.18) 0.045vw,
      transparent 0.045vw
    ),
    linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.18) 0,
      rgba(255, 255, 255, 0.18) 0.045vw,
      transparent 0.045vw
    );
  background-size: ${CELL_SIZE_VW}vw ${CELL_SIZE_VW}vw;
  border: 0.12vw solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 0 2vw rgba(0, 0, 0, 0.45);
  gap: 0;
`;

export const Cell = styled.div`
  width: ${CELL_SIZE_VW}vw;
  height: ${CELL_SIZE_VW}vw;
  border: none;
  background: ${({$fill}) => ($fill ? 'var(--fill-color, rgba(64, 145, 255, 0.9))' : 'transparent')};
  box-sizing: border-box;
  transition: background 0.25s ease, box-shadow 0.25s ease, opacity 0.25s ease;

  ${({$fill}) =>
    $fill &&
    css`
      box-shadow: none;
    `}
`;
