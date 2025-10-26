import { useEffect, useMemo, useState } from "react";
import { WheelPicker } from "./WheelPicker";
import {
  CHOSUNG,
  JUNGSUNG,
  JONGSUNG,
  composeHangulSyllable,
} from "./constant";
import {
  Container,
  Title,
  Stage,
  AxisWheelWrapper,
  AxisPicker,
  AxisLabel,
  CenterMask,
  CenterPlate,
} from "./styles";

const OPTION_ITEM_SIZE = 44;
const BANPO_SUFFIX = "포";

const AXES = [
  {
    key: "initial",
    rotation: 0,
    axisAngle: null,
    label: "초성",
  },
  {
    key: "vowel",
    rotation: -60,
    axisAngle: 30,
    label: "중성",
  },
  {
    key: "final",
    rotation: 60,
    axisAngle: 150,
    label: "종성",
  },
];

export default function MobileVariantPicker() {
  const [banpoInitial, setBanpoInitial] = useState("ㅂ");
  const [banpoVowel, setBanpoVowel] = useState("ㅏ");
  const [banpoFinal, setBanpoFinal] = useState("ㄴ");

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const { body } = document;
    const originalOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = originalOverflow;
    };
  }, []);

  const initialOptions = useMemo(
    () =>
      CHOSUNG.map((initial) => {
        const syllable = composeHangulSyllable(
          initial,
          banpoVowel,
          banpoFinal
        );
        return {
          value: initial,
          label: `${syllable}${BANPO_SUFFIX}`,
        };
      }),
    [banpoFinal, banpoVowel]
  );

  const vowelOptions = useMemo(
    () =>
      JUNGSUNG.map((vowel) => {
        const syllable = composeHangulSyllable(
          banpoInitial,
          vowel,
          banpoFinal
        );
        return {
          value: vowel,
          label: `${syllable}${BANPO_SUFFIX}`,
        };
      }),
    [banpoFinal, banpoInitial]
  );

  const finalOptions = useMemo(
    () =>
      JONGSUNG.map((finalConsonant) => {
        const syllable = composeHangulSyllable(
          banpoInitial,
          banpoVowel,
          finalConsonant
        );
        return {
          value: finalConsonant,
          label: `${syllable}${BANPO_SUFFIX}`,
        };
      }),
    [banpoInitial, banpoVowel]
  );

  const banpoWord = useMemo(
    () =>
      `${composeHangulSyllable(banpoInitial, banpoVowel, banpoFinal)}${BANPO_SUFFIX}`,
    [banpoFinal, banpoInitial, banpoVowel]
  );

  const wheelConfig = [
    {
      ...AXES[0],
      options: initialOptions,
      value: banpoInitial,
      onValueChange: setBanpoInitial,
    },
    {
      ...AXES[1],
      options: vowelOptions,
      value: banpoVowel,
      onValueChange: setBanpoVowel,
    },
    {
      ...AXES[2],
      options: finalOptions,
      value: banpoFinal,
      onValueChange: setBanpoFinal,
    },
  ];

  return (
    <Container>
      <Stage>
        {wheelConfig.map(
          ({ key, rotation, axisAngle, label, options, value, onValueChange }) => (
            <AxisWheelWrapper key={key} rotation={rotation}>
              <AxisPicker data-muted={axisAngle != null}>
                <WheelPicker
                  options={options}
                  value={value}
                  onValueChange={onValueChange}
                  infinite
                  visibleCount={20}
                  optionItemHeight={OPTION_ITEM_SIZE}
                  orientation="vertical"
                  axisAngle={axisAngle}
                  showHighlight={axisAngle == null}
                />
              </AxisPicker>
              <AxisLabel rotation={rotation}>{label}</AxisLabel>
            </AxisWheelWrapper>
          )
        )}
        <CenterMask />
        <CenterPlate>{banpoWord}</CenterPlate>
      </Stage>
      <Title>{banpoWord}</Title>
    </Container>
  );
}

export { WheelPicker };
