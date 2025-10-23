"use client";


import { useMemo, useState } from "react";
import {WheelPicker, WheelPickerWrapper} from "./WheelPicker";

const padTwo = (value) => String(value).padStart(2, "0");
const createOptions = (count) =>
  Array.from({ length: count }, (_, index) => {
    const value = padTwo(index);
    return { value, label: value };
  });

export default function MobileTimer() {
  const [hours, setHours] = useState(padTwo(0));
  const [minutes, setMinutes] = useState(padTwo(0));
  const [seconds, setSeconds] = useState(padTwo(0));

  const hoursOptions = useMemo(() => createOptions(24), []);
  const minuteSecondOptions = useMemo(() => createOptions(60), []);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        padding: "1rem",
      }}
    >
      <div
        style={{
          textAlign: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          marginBottom: "1rem",
          opacity: 0.9,
        }}
      >
        {`${hours}:${minutes}:${seconds}`}
      </div>
      <WheelPickerWrapper>
        <div style={{ flex: 1, minWidth: 80 }}>
          <WheelPicker
            options={hoursOptions}
            value={hours}
            onValueChange={setHours}
            infinite
            visibleCount={20}
            optionItemHeight={36}
          />
        </div>
        <div style={{ flex: 1, minWidth: 80 }}>
          <WheelPicker
            options={minuteSecondOptions}
            value={minutes}
            onValueChange={setMinutes}
            infinite
            visibleCount={20}
            optionItemHeight={36}
          />
        </div>
        <div style={{ flex: 1, minWidth: 80 }}>
          <WheelPicker
            options={minuteSecondOptions}
            value={seconds}
            onValueChange={setSeconds}
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

