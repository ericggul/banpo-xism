import { useMemo, useState } from "react";
import { WheelPicker, WheelPickerWrapper } from "./WheelPicker";

const generateHangulOptions = ({
  initialConsonants,
  vowel,
  finalConsonant,
  suffix,
}) => {
  const HANGUL_START = 44032; // "가"
  const CHOSUNG_INTERVAL = 588;
  const JUNGSUNG_INTERVAL = 28;

  const CHOSUNG = [
    "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
  ];
  const JUNGSUNG = [
    "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ",
  ];
  const JONGSUNG = [
    "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
  ];

  const jungsungIndex = JUNGSUNG.indexOf(vowel);
  const jongsungIndex = JONGSUNG.indexOf(finalConsonant);

  return initialConsonants.map((consonant) => {
    const chosungIndex = CHOSUNG.indexOf(consonant);
    const charCode =
      HANGUL_START +
      chosungIndex * CHOSUNG_INTERVAL +
      jungsungIndex * JUNGSUNG_INTERVAL +
      jongsungIndex;
    const syllable = String.fromCharCode(charCode);
    const finalWord = `${syllable}${suffix}`;
    return { value: finalWord, label: finalWord };
  });
};

export default function MobileVariantPicker() {
  const [banpoVariant, setBanpoVariant] = useState("반포");
  const [jaiVariant, setJaiVariant] = useState("자이");

  const baseConsonants = useMemo(
    () => ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"],
    []
  );

  const banpoOptions = useMemo(
    () =>
      generateHangulOptions({
        initialConsonants: baseConsonants,
        vowel: "ㅏ",
        finalConsonant: "ㄴ",
        suffix: "포",
      }),
    [baseConsonants]
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
    <div
      style={{
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        padding: "1rem",
        color: "white",
      }}
    >
      <div
        style={{
          textAlign: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          marginBottom: "1rem",
          opacity: 0.9,
          fontSize: "1.5rem",
        }}
      >
        {`${banpoVariant} ${jaiVariant}`}
      </div>
      <WheelPickerWrapper>
        <div style={{ flex: 1, minWidth: 80 }}>
          <WheelPicker
            options={banpoOptions}
            value={banpoVariant}
            onValueChange={setBanpoVariant}
            infinite
            visibleCount={20}
            optionItemHeight={36}
          />
        </div>
        <div style={{ flex: 1, minWidth: 80 }}>
          <WheelPicker
            options={jaiOptions}
            value={jaiVariant}
            onValueChange={setJaiVariant}
            infinite
            visibleCount={20}
            optionItemHeight={36}
          />
        </div>
      </WheelPickerWrapper>
    </div>
  );
}

export { WheelPicker, WheelPickerWrapper };

