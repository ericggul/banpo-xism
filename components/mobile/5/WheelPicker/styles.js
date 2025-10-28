import styled from "styled-components";

export const WheelPickerRoot = styled.div`
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  width: 100%;
  align-items: stretch;
  justify-content: space-between;
  perspective: 2000px;
  user-select: none;
  color: inherit;

  &[data-rwp-wrapper] ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &[data-rwp-wrapper] li {
    margin: 0;
    padding: 0;
  }

  [data-rwp] {
    position: relative;
    overflow: hidden;
    flex: 1;
    cursor: default;
    mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      black 20%,
      black 80%,
      transparent 100%
    );
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      black 20%,
      black 80%,
      transparent 100%
    );
  }

  [data-rwp][data-orientation="horizontal"] {
    mask-image: linear-gradient(
      to right,
      transparent 0%,
      black 20%,
      black 80%,
      transparent 100%
    );
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0%,
      black 20%,
      black 80%,
      transparent 100%
    );
  }

  [data-rwp-highlight-wrapper] {
    position: absolute;
    overflow: hidden;
    top: 50%;
    width: 100%;
    transform: translateY(-50%);
    font-size: 1rem;
    font-weight: 500;
    pointer-events: none;
    z-index: 2;
  }

  [data-rwp][data-orientation="horizontal"] [data-rwp-highlight-wrapper] {
    top: 0;
    left: 50%;
    width: auto;
    height: 100%;
    transform: translateX(-50%);
    z-index: 1;
  }

  [data-rwp][data-orientation="vertical"] [data-rwp-highlight-wrapper] {
    z-index: 3;
  }

  [data-rwp-highlight-list] {
    position: absolute;
    width: 100%;
  }

  [data-rwp][data-orientation="horizontal"] [data-rwp-highlight-list] {
    width: auto;
    height: 100%;
    display: flex;
  }

  [data-rwp-options] {
    position: absolute;
    top: 50%;
    left: 0;
    display: block;
    width: 100%;
    height: 0;
    margin: 0 auto;
    -webkit-font-smoothing: subpixel-antialiased;
    will-change: transform;
    backface-visibility: hidden;
    transform-style: preserve-3d;
  }

  [data-rwp][data-orientation="horizontal"] [data-rwp-options] {
    top: 0;
    left: 50%;
    width: 0;
    height: 100%;
  }

  [data-rwp-option] {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    -webkit-font-smoothing: subpixel-antialiased;
    will-change: visibility;
    font-size: 0.875rem;
  }

  [data-rwp][data-orientation="horizontal"] [data-rwp-option] {
    width: auto;
    height: 100%;
    display: flex;
  }

  [data-rwp][data-orientation="horizontal"] [data-rwp-highlight-item] {
    width: auto;
    height: 100%;
  }

  [data-rwp-option],
  [data-rwp-highlight-item] {
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;
