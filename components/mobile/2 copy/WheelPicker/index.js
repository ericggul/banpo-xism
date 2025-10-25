import { useWheelPicker } from "./useWheelPicker";
import { WheelPickerRoot } from "./styles";

const WheelPickerWrapper = ({ className, children }) => (
  <WheelPickerRoot className={className} data-rwp-wrapper>
    {children}
  </WheelPickerRoot>
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

export { WheelPicker, WheelPickerWrapper };
