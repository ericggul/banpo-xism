import styled from "styled-components";
import { FlexCenterStyle } from "../../../styles/common";

export const Container = styled.div`
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 1rem;
  color: white;
`;

export const Title = styled.div`
  text-align: center;
  font-family: Inter, system-ui, sans-serif;
  margin-bottom: 1rem;
  opacity: 0.9;
  font-size: 1.5rem;
`;

export const WheelSection = styled.div`
  flex: 2;
  min-width: 180px;
  position: relative;
  ${FlexCenterStyle};
`;

export const WheelInner = styled.div`
  position: relative;
  width: 100%;
  max-width: 180px;
  display: flex;
  justify-content: center;
`;
