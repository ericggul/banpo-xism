import { useMemo, useState } from "react";
import { WheelPicker, WheelPickerWrapper } from "./WheelPicker";

const HANGUL_START = 44032; // "가"
const CHOSUNG_INTERVAL = 588;
const JUNGSUNG_INTERVAL = 28;

const CHOSUNG = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

const JUNGSUNG = [
  "ㅏ",
  "ㅐ",
  "ㅑ",
  "ㅒ",
  "ㅓ",
  "ㅔ",
  "ㅕ",
  "ㅖ",
  "ㅗ",
  "ㅘ",
  "ㅙ",
  "ㅚ",
  "ㅛ",
  "ㅜ",
  "ㅝ",
  "ㅞ",
  "ㅟ",
  "ㅠ",
  "ㅡ",
  "ㅢ",
  "ㅣ",
];

const JONGSUNG = [
  "",
  "ㄱ",
  "ㄲ",
  "ㄳ",
  "ㄴ",
  "ㄵ",
  "ㄶ",
  "ㄷ",
  "ㄹ",
  "ㄺ",
  "ㄻ",
  "ㄼ",
  "ㄽ",
  "ㄾ",
  "ㄿ",
  "ㅀ",
  "ㅁ",
  "ㅂ",
  "ㅄ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

const composeHangulSyllable = (initial, vowel, finalConsonant) => {
  const chosungIndex = CHOSUNG.indexOf(initial);
  const jungsungIndex = JUNGSUNG.indexOf(vowel);
  const jongsungIndex = JONGSUNG.indexOf(finalConsonant);

  if (chosungIndex === -1 || jungsungIndex === -1 || jongsungIndex === -1) {
    throw new Error("Invalid Hangul character combination.");
  }

  const charCode =
    HANGUL_START +
    chosungIndex * CHOSUNG_INTERVAL +
    jungsungIndex * JUNGSUNG_INTERVAL +
    jongsungIndex;

  return String.fromCharCode(charCode);
};

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
        {`${banpoWord} ${jaiVariant}`}
      </div>
      <WheelPickerWrapper>
        <div style={{ flex: 1, minWidth: 80 }}>
          <WheelPicker
            options={banpoInitialOptions}
            value={banpoInitial}
            onValueChange={setBanpoInitial}
            infinite
            visibleCount={20}
            optionItemHeight={36}
          />
        </div>
        <div style={{ flex: 1, minWidth: 80 }}>
          <WheelPicker
            options={banpoVowelOptions}
            value={banpoVowel}
            onValueChange={setBanpoVowel}
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
