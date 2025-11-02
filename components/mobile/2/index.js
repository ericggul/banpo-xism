import { useMemo, useState } from "react";
import { WheelPicker, WheelPickerWrapper } from "./WheelPicker";

const ROOT_CLASS = "mobile-variant-picker";
const NUMBER_LABEL_CLASS = `${ROOT_CLASS}__option-label`;
const NUMBER_LABEL_CODE_CLASS = `${NUMBER_LABEL_CLASS}-code`;
const NUMBER_LABEL_TEXT_CLASS = `${NUMBER_LABEL_CLASS}-text`;

const createOptionLabel = ({ text, code }) => (
  <span className={NUMBER_LABEL_CLASS}>
    <span className={NUMBER_LABEL_CODE_CLASS}>{code}</span>
    <span className={NUMBER_LABEL_TEXT_CLASS}>{text}</span>
  </span>
);

const formatOptionsWithCodes = (options) =>
  options.map((option, index) => {
    const code = index.toString().padStart(2, "0");
    const text = option.text ?? option.value ?? "";
    return {
      ...option,
      text,
      label: createOptionLabel({ text, code }),
      code,
    };
  });

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
    return { value: finalWord, text: finalWord };
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
      formatOptionsWithCodes(
        generateHangulOptions({
          initialConsonants: baseConsonants,
          vowel: "ㅏ",
          finalConsonant: "ㄴ",
          suffix: "포",
        })
      ),
    [baseConsonants]
  );

  const jaiOptions = useMemo(
    () =>
      formatOptionsWithCodes(
        generateHangulOptions({
          initialConsonants: baseConsonants,
          vowel: "ㅏ",
          finalConsonant: "",
          suffix: "이",
        })
      ),
    [baseConsonants]
  );

  return (
    <div
      className={ROOT_CLASS}
      style={{
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        padding: "1rem",
        color: "white",
      }}
    >
      <style>{`
        .${ROOT_CLASS} .${NUMBER_LABEL_CLASS} {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          gap: 0.25rem;
        }

        .${ROOT_CLASS} .${NUMBER_LABEL_CODE_CLASS} {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-variant-numeric: tabular-nums;
          min-width: 2ch;
        }

        .${ROOT_CLASS} [data-slot="highlight-item"] .${NUMBER_LABEL_CODE_CLASS} {
          display: none;
        }

        .${ROOT_CLASS} [data-slot="option-item"] .${NUMBER_LABEL_TEXT_CLASS} {
          display: none;
        }
      `}</style>
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
