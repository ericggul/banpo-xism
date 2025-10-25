import { useWheelPicker } from "./useWheelPicker";
import { WheelPickerRoot } from "./styles";

const WheelPickerWrapper = ({ className, children }) => (
  <WheelPickerRoot className={className} data-rwp-wrapper>
    {children}
  </WheelPickerRoot>
);

const WheelPicker = ({
  classNames,
  orientation = "vertical",
  containerStyle,
  children,
  ...wheelPickerProps
}) => {
  const {
    refs: { containerRef, wheelItemsRef, highlightListRef },
    measurements: { containerStyle: internalContainerStyle, itemSize },
    highlightListStyle,
    wheelItems,
    highlightItems,
  } = useWheelPicker({ orientation, ...wheelPickerProps });

  const mergedContainerStyle = {
    ...internalContainerStyle,
    ...containerStyle,
  };

  const highlightWrapperStyle =
    orientation === "vertical"
      ? { height: itemSize, lineHeight: `${itemSize}px` }
      : { width: itemSize, height: "100%" };

  return (
    <div
      ref={containerRef}
      data-rwp
      data-orientation={orientation}
      style={mergedContainerStyle}
    >
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
        style={highlightWrapperStyle}
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
      {children}
    </div>
  );
};

export { WheelPicker, WheelPickerWrapper };
