import styled from "styled-components";
import { FlexCenterStyle, WholeContainer } from "../../../styles/common";
import { WheelPickerWrapper as WheelPickerWrapperBase } from "./WheelPicker";

export const Container = styled.div`
  ${WholeContainer};
  ${FlexCenterStyle};
  position: fixed;

  color: white;
  overflow: hidden;
`;

export const Title = styled.div`
  position: absolute;
  bottom: 2rem;
  right: 0;
  left: 0;
  text-align: center;
  font-family: Inter, system-ui, sans-serif;
  margin-top: 5rem;
  opacity: 0.9;
  font-size: 1.2rem;
`;

export const Stage = styled.div`
  position: relative;
  width: min(520px, 90vw);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  pointer-events: none;
  perspective: 1800px;
  transform-style: preserve-3d;
`;

export const AxisWheelWrapper = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(140px, 35%, 200px);
  height: clamp(240px, 66%, 320px);
  transform-origin: center;
  transform: translate(-50%, -50%) rotate(${({ rotation }) => rotation}deg);
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
`;

export const AxisPicker = styled(WheelPickerWrapperBase)`
  pointer-events: auto;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;

  [data-rwp] {
    pointer-events: auto;
    touch-action: none;
  }

  [data-rwp-highlight-wrapper] {
    font-size: 1.15rem;
    pointer-events: none;
  }

  &[data-muted="true"] [data-rwp-highlight-wrapper] {
    opacity: 0;
    visibility: hidden;
    display: none;
  }

  &[data-muted="true"] [data-rwp] {
    mask-image: radial-gradient(circle at center, transparent 0 38%, black 46%);
    -webkit-mask-image: radial-gradient(
      circle at center,
      transparent 0 38%,
      black 46%
    );
  }

  &[data-muted="true"] [data-rwp-option] {
    opacity: 0;
  }
`;

export const AxisLabel = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center;
  transform: translate(-50%, -50%) rotate(${({ rotation }) => rotation}deg)
    translateY(-52%);
  font-family: "Inter", system-ui, sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.6;
  pointer-events: none;
`;

export const CenterMask = styled.div`
  position: absolute;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.8);
  pointer-events: none;
  z-index: 4;
  transform: translateZ(210px);
`;

export const CenterPlate = styled.div`
  position: absolute;
  width: 6.5rem;
  height: 6.5rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Inter", system-ui, sans-serif;
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.85;
  pointer-events: none;
  z-index: 5;
  transform: translateZ(220px);
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.5);
`;
