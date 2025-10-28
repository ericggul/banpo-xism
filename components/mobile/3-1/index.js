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

const NO_FINAL_CONSONANT = "";

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

export default function MobileVariantPicker() {
  const [banInitial, setBanInitial] = useState("ㅂ");
  const [banVowel, setBanVowel] = useState("ㅏ");
  const [banFinal, setBanFinal] = useState("ㄴ");
  const [poInitial, setPoInitial] = useState("ㅍ");
  const [poVowel, setPoVowel] = useState("ㅗ");

  const baseConsonants = useMemo(
    () => ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"],
    []
  );

  const baseVowels = useMemo(() => JUNGSUNG.slice(), []);
  const baseFinals = useMemo(() => JONGSUNG.slice(), []);

  const banSyllable = useMemo(
    () => composeHangulSyllable(banInitial, banVowel, banFinal),
    [banFinal, banInitial, banVowel]
  );

  const poSyllable = useMemo(
    () => composeHangulSyllable(poInitial, poVowel, NO_FINAL_CONSONANT),
    [poInitial, poVowel]
  );

  const banpoWord = useMemo(
    () => `${banSyllable}${poSyllable}`,
    [banSyllable, poSyllable]
  );

  const banpoInitialOptions = useMemo(
    () =>
      baseConsonants.map((consonant) => {
        const syllable = composeHangulSyllable(
          consonant,
          banVowel,
          banFinal
        );
        return { value: consonant, label: `${syllable}${poSyllable}` };
      }),
    [baseConsonants, banFinal, banVowel, poSyllable]
  );

  const banpoVowelOptions = useMemo(
    () =>
      baseVowels.map((vowel) => {
        const syllable = composeHangulSyllable(
          banInitial,
          vowel,
          banFinal
        );
        return { value: vowel, label: `${syllable}${poSyllable}` };
      }),
    [banFinal, banInitial, baseVowels, poSyllable]
  );

  const banpoFinalOptions = useMemo(
    () =>
      baseFinals.map((finalConsonant) => {
        const syllable = composeHangulSyllable(
          banInitial,
          banVowel,
          finalConsonant
        );
        return {
          value: finalConsonant,
          label: `${syllable}${poSyllable}`,
        };
      }),
    [banInitial, banVowel, baseFinals, poSyllable]
  );

  const poInitialOptions = useMemo(
    () =>
      baseConsonants.map((consonant) => {
        const syllable = composeHangulSyllable(
          consonant,
          poVowel,
          NO_FINAL_CONSONANT
        );
        return { value: consonant, label: `${banSyllable}${syllable}` };
      }),
    [banSyllable, baseConsonants, poVowel]
  );

  const poVowelOptions = useMemo(
    () =>
      baseVowels.map((vowel) => {
        const syllable = composeHangulSyllable(
          poInitial,
          vowel,
          NO_FINAL_CONSONANT
        );
        return { value: vowel, label: `${banSyllable}${syllable}` };
      }),
    [banSyllable, baseVowels, poInitial]
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
        {banpoWord}
      </div>
      <WheelPickerWrapper>
        <div style={{ flex: 1, minWidth: 64 }}>
          <WheelPicker
            options={banpoInitialOptions}
            value={banInitial}
            onValueChange={setBanInitial}
            infinite
            visibleCount={20}
            optionItemHeight={36}
          />
        </div>
        <div style={{ flex: 1, minWidth: 64 }}>
          <WheelPicker
            options={banpoVowelOptions}
            value={banVowel}
            onValueChange={setBanVowel}
            infinite
            visibleCount={20}
            optionItemHeight={36}
          />
        </div>
        <div style={{ flex: 1, minWidth: 64 }}>
          <WheelPicker
            options={banpoFinalOptions}
            value={banFinal}
            onValueChange={setBanFinal}
            infinite
            visibleCount={20}
            optionItemHeight={36}
          />
        </div>
        <div style={{ flex: 1, minWidth: 64 }}>
          <WheelPicker
            options={poInitialOptions}
            value={poInitial}
            onValueChange={setPoInitial}
            infinite
            visibleCount={20}
            optionItemHeight={36}
          />
        </div>
        <div style={{ flex: 1, minWidth: 64 }}>
          <WheelPicker
            options={poVowelOptions}
            value={poVowel}
            onValueChange={setPoVowel}
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
