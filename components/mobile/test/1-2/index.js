"use client";

import styles from "./style.module.css";

import { useMemo, useState } from "react";
import { useWheelPicker } from "./useWheelPicker";

const WheelPickerWrapper = ({ className, children }) => (
  <div className={`${styles.root} ${className ?? ""}`} data-rwp-wrapper>
    {children}
  </div>
);

const WheelPicker = ({ classNames, ...wheelPickerProps }) => {
  const {
    refs: { containerRef, wheelItemsRef, highlightListRef },
    measurements: { containerHeight, itemHeight },
    highlightListStyle,
    wheelItems,
    highlightItems,
  } = useWheelPicker(wheelPickerProps);

  return (
    <div ref={containerRef} data-rwp style={{ height: containerHeight }}>
      <ul ref={wheelItemsRef} data-rwp-options>
        {wheelItems.map(({ key, dataIndex, label, style }) => (
          <li
            key={key}
            className={classNames?.optionItem}
            data-slot="option-item"
            data-rwp-option
            data-index={dataIndex}
            style={style}
          >
            {label}
          </li>
        ))}
      </ul>

      <div
        className={classNames?.highlightWrapper}
        data-rwp-highlight-wrapper
        data-slot="highlight-wrapper"
        style={{
          height: itemHeight,
          lineHeight: `${itemHeight}px`,
        }}
      >
        <ul
          ref={highlightListRef}
          data-rwp-highlight-list
          style={highlightListStyle}
        >
          {highlightItems.map(({ key, label, style }) => (
            <li
              key={key}
              className={classNames?.highlightItem}
              data-slot="highlight-item"
              data-rwp-highlight-item
              style={style}
            >
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

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

