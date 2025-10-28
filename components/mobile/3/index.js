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
  const [jaInitial, setJaInitial] = useState("ㅈ");
  const [jaVowel, setJaVowel] = useState("ㅏ");
  const [iInitial, setIInitial] = useState("ㅇ");
  const [iVowel, setIVowel] = useState("ㅣ");

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

  const jaSyllable = useMemo(
    () => composeHangulSyllable(jaInitial, jaVowel, NO_FINAL_CONSONANT),
    [jaInitial, jaVowel]
  );

  const iSyllable = useMemo(
    () => composeHangulSyllable(iInitial, iVowel, NO_FINAL_CONSONANT),
    [iInitial, iVowel]
  );

  const banpoWord = useMemo(
    () => `${banSyllable}${poSyllable}`,
    [banSyllable, poSyllable]
  );

  const jaiWord = useMemo(
    () => `${jaSyllable}${iSyllable}`,
    [jaSyllable, iSyllable]
  );

  const banpoJaiWord = useMemo(
    () => `${banpoWord} ${jaiWord}`,
    [banpoWord, jaiWord]
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

  const jaInitialOptions = useMemo(
    () =>
      baseConsonants.map((consonant) => {
        const syllable = composeHangulSyllable(
          consonant,
          jaVowel,
          NO_FINAL_CONSONANT
        );
        return { value: consonant, label: `${syllable}${iSyllable}` };
      }),
    [baseConsonants, iSyllable, jaVowel]
  );

  const jaVowelOptions = useMemo(
    () =>
      baseVowels.map((vowel) => {
        const syllable = composeHangulSyllable(
          jaInitial,
          vowel,
          NO_FINAL_CONSONANT
        );
        return { value: vowel, label: `${syllable}${iSyllable}` };
      }),
    [baseVowels, iSyllable, jaInitial]
  );

  const iInitialOptions = useMemo(
    () =>
      baseConsonants.map((consonant) => {
        const syllable = composeHangulSyllable(
          consonant,
          iVowel,
          NO_FINAL_CONSONANT
        );
        return { value: consonant, label: `${jaSyllable}${syllable}` };
      }),
    [baseConsonants, iVowel, jaSyllable]
  );

  const iVowelOptions = useMemo(
    () =>
      baseVowels.map((vowel) => {
        const syllable = composeHangulSyllable(
          iInitial,
          vowel,
          NO_FINAL_CONSONANT
        );
        return { value: vowel, label: `${jaSyllable}${syllable}` };
      }),
    [baseVowels, iInitial, jaSyllable]
  );

  const columnStyle = useMemo(
    () => ({ flex: "1 1 0", minWidth: 0, maxWidth: 64 }),
    []
  );

  const leftGroupStyle = useMemo(
    () => ({
      display: "flex",
      gap: "0.25rem",
      flex: "5 1 0",
      minWidth: 0,
      justifyContent: "center",
    }),
    []
  );

  const rightGroupStyle = useMemo(
    () => ({
      display: "flex",
      gap: "0.25rem",
      flex: "4 1 0",
      minWidth: 0,
      justifyContent: "center",
    }),
    []
  );

  const banpoColumns = useMemo(
    () => [
      {
        key: "ban-initial",
        options: banpoInitialOptions,
        value: banInitial,
        onChange: setBanInitial,
      },
      {
        key: "ban-vowel",
        options: banpoVowelOptions,
        value: banVowel,
        onChange: setBanVowel,
      },
      {
        key: "ban-final",
        options: banpoFinalOptions,
        value: banFinal,
        onChange: setBanFinal,
      },
      {
        key: "po-initial",
        options: poInitialOptions,
        value: poInitial,
        onChange: setPoInitial,
      },
      {
        key: "po-vowel",
        options: poVowelOptions,
        value: poVowel,
        onChange: setPoVowel,
      },
    ],
    [
      banFinal,
      banInitial,
      banVowel,
      banpoFinalOptions,
      banpoInitialOptions,
      banpoVowelOptions,
      poInitial,
      poInitialOptions,
      poVowel,
      poVowelOptions,
    ]
  );

  const jaiColumns = useMemo(
    () => [
      {
        key: "ja-initial",
        options: jaInitialOptions,
        value: jaInitial,
        onChange: setJaInitial,
      },
      {
        key: "ja-vowel",
        options: jaVowelOptions,
        value: jaVowel,
        onChange: setJaVowel,
      },
      {
        key: "i-initial",
        options: iInitialOptions,
        value: iInitial,
        onChange: setIInitial,
      },
      {
        key: "i-vowel",
        options: iVowelOptions,
        value: iVowel,
        onChange: setIVowel,
      },
    ],
    [
      iInitial,
      iInitialOptions,
      iVowel,
      iVowelOptions,
      jaInitial,
      jaInitialOptions,
      jaVowel,
      jaVowelOptions,
    ]
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
        {banpoJaiWord}
      </div>
      <WheelPickerWrapper>
        <div style={leftGroupStyle}>
          {banpoColumns.map(({ key, options, value, onChange }) => (
            <div key={key} style={columnStyle}>
              <WheelPicker
                options={options}
                value={value}
                onValueChange={onChange}
                infinite
                visibleCount={20}
                optionItemHeight={36}
              />
            </div>
          ))}
        </div>
        <div style={rightGroupStyle}>
          {jaiColumns.map(({ key, options, value, onChange }) => (
            <div key={key} style={columnStyle}>
              <WheelPicker
                options={options}
                value={value}
                onValueChange={onChange}
                infinite
                visibleCount={20}
                optionItemHeight={36}
              />
            </div>
          ))}
        </div>
      </WheelPickerWrapper>
    </div>
  );
}

export { WheelPicker, WheelPickerWrapper };
