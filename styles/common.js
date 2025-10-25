import styled, { css, keyframes } from "styled-components";

export const FlexCenterStyle = css`
  display: flex;
  justify-content: center;
  align-items: center;
`;

export const WholeContainer = css`
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  width: ${({ theme }) =>
    `var(--app-width, ${
      theme?.windowWidth ? `${theme.windowWidth}px` : "100dvw"
    })`};
  height: ${({ theme }) =>
    `var(--app-height, ${
      theme?.windowHeight ? `${theme.windowHeight}px` : "100dvh"
    })`};
`;
