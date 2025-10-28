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

export const WheelSection = styled.div`
  min-width: 216px;
  position: relative;
  ${FlexCenterStyle};
  width: 100%;
  max-width: 480px;
`;

export const WheelInner = styled.div`
  position: relative;
  width: 100%;
  max-width: 480px;
  display: flex;
  justify-content: center;
`;

export const PickerWrapper = styled(WheelPickerWrapperBase)`
  font-size: 1.05rem;

  [data-rwp-highlight-wrapper] {
    font-size: 1.2rem;
  }

  [data-rwp-option],
  [data-rwp-highlight-item] {
    font-size: inherit;
  }
`;
