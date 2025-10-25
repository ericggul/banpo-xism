import { useMemo, useState } from "react";
import { WheelPicker, WheelPickerWrapper } from "./WheelPicker";
import { CHOSUNG, JUNGSUNG, JONGSUNG, composeHangulSyllable } from "./constant";
import { Container, Title, WheelSection, WheelInner } from "./styles";

const generateHangulOptions = ({
  initialConsonants,
  vowel,
  finalConsonant,
  suffix,
}) =>
  initialConsonants.map((consonant) => {
    const syllable = composeHangulSyllable(consonant, vowel, finalConsonant);
    const finalWord = `${syllable}${suffix}`;
    return { value: finalWord, label: finalWord };
  });

const HORIZONTAL_WHEEL_CONTAINER_STYLE = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "100%",
  maxWidth: 400,
  pointerEvents: "auto",
  zIndex: 1,
};

export default function MobileVariantPicker() {
  const BANPO_FINAL_CONSONANT = "ㄴ";
  const BANPO_SUFFIX = "포";

  const [banpoInitial, setBanpoInitial] = useState("ㅂ");
  const [banpoVowel, setBanpoVowel] = useState("ㅏ");
  const [jaiVariant, setJaiVariant] = useState("자이");

  const baseConsonants = useMemo(
    () => ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"],
    []
  );

  const baseVowels = useMemo(() => JUNGSUNG.slice(), []);

  const banpoWord = useMemo(
    () =>
      `${composeHangulSyllable(
        banpoInitial,
        banpoVowel,
        BANPO_FINAL_CONSONANT
      )}${BANPO_SUFFIX}`,
    [banpoInitial, banpoVowel]
  );

  const banpoInitialOptions = useMemo(
    () =>
      baseConsonants.map((consonant) => {
        const syllable = composeHangulSyllable(
          consonant,
          banpoVowel,
          BANPO_FINAL_CONSONANT
        );
        return { value: consonant, label: `${syllable}${BANPO_SUFFIX}` };
      }),
    [BANPO_FINAL_CONSONANT, BANPO_SUFFIX, baseConsonants, banpoVowel]
  );

  const banpoVowelOptions = useMemo(
    () =>
      baseVowels.map((vowel) => {
        const syllable = composeHangulSyllable(
          banpoInitial,
          vowel,
          BANPO_FINAL_CONSONANT
        );
        return { value: vowel, label: `${syllable}${BANPO_SUFFIX}` };
      }),
    [BANPO_FINAL_CONSONANT, BANPO_SUFFIX, banpoInitial, baseVowels]
  );

  const jaiOptions = useMemo(
    () =>
      generateHangulOptions({
        initialConsonants: baseConsonants,
        vowel: "ㅏ",
        finalConsonant: "",
        suffix: "이",
      }),
    [baseConsonants]
  );

  return (
    <Container>
      <Title>{`${banpoWord} ${jaiVariant}`}</Title>
      <WheelPickerWrapper>
        <WheelSection>
          <WheelInner>
            <WheelPicker
              options={banpoInitialOptions}
              value={banpoInitial}
              onValueChange={setBanpoInitial}
              infinite
              visibleCount={20}
              optionItemHeight={36}
              orientation="vertical"
            />
            <WheelPicker
              options={banpoVowelOptions}
              value={banpoVowel}
              onValueChange={setBanpoVowel}
              infinite
              visibleCount={20}
              optionItemHeight={36}
              orientation="horizontal"
              containerStyle={HORIZONTAL_WHEEL_CONTAINER_STYLE}
            />
          </WheelInner>
        </WheelSection>
      </WheelPickerWrapper>
    </Container>
  );
}
