import { useCallback, useEffect, useMemo, useRef } from "react";
import { useControllableState } from "./use-controllable-state";

const RESISTANCE = 0.3;
const MAX_VELOCITY = 30;
const SNAP_BACK_DECELERATION = 10;

const easeOutCubic = (p) => Math.pow(p - 1, 3) + 1;

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const normalizeIndex = (scroll, length) => {
  if (length === 0) return 0;
  return ((scroll % length) + length) % length;
};

export const useWheelPicker = ({
  defaultValue,
  value: valueProp,
  onValueChange,
  options: optionsProp,
  infinite: infiniteProp = false,
  visibleCount: visibleCountProp = 20,
  dragSensitivity: dragSensitivityProp = 3,
  scrollSensitivity: scrollSensitivityProp = 5,
  optionItemHeight: optionItemHeightProp = 30,
}) => {
  const [value = optionsProp[0]?.value ?? "", setValue] = useControllableState({
    defaultProp: defaultValue,
    prop: valueProp,
    onChange: onValueChange,
  });

  const options = useMemo(() => {
    if (!infiniteProp) return optionsProp;

    const result = [];
    const halfCount = Math.ceil(visibleCountProp / 2);

    if (optionsProp.length === 0) {
      return result;
    }

    while (result.length < halfCount) {
      result.push(...optionsProp);
    }

    return result;
  }, [infiniteProp, optionsProp, visibleCountProp]);

  const itemHeight = optionItemHeightProp;
  const halfItemHeight = itemHeight * 0.5;
  const itemAngle = 360 / visibleCountProp;
  const radius = itemHeight / Math.tan((itemAngle * Math.PI) / 180);
  const containerHeight = Math.round(radius * 2 + itemHeight * 0.25);
  const quarterCount = visibleCountProp >> 2;
  const baseDeceleration = dragSensitivityProp * 10;

  const containerRef = useRef(null);
  const wheelItemsRef = useRef(null);
  const highlightListRef = useRef(null);

  const scrollRef = useRef(0);
  const moveIdRef = useRef(0);
  const draggingRef = useRef(false);
  const lastWheelTimeRef = useRef(0);
  const dragControllerRef = useRef(null);

  const touchDataRef = useRef({
    startY: 0,
    yList: [],
    touchScroll: 0,
    isClick: true,
  });

  const wheelSegmentPositions = useMemo(() => {
    if (!visibleCountProp) return [];

    let positionAlongWheel = 0;
    const degToRad = Math.PI / 180;
    const segmentRanges = [];

    for (let i = quarterCount - 1; i >= -quarterCount + 1; --i) {
      const angle = i * itemAngle;
      const segmentLength = itemHeight * Math.cos(angle * degToRad);
      const start = positionAlongWheel;
      positionAlongWheel += segmentLength;
      segmentRanges.push([start, positionAlongWheel]);
    }

    return segmentRanges;
  }, [itemAngle, itemHeight, quarterCount, visibleCountProp]);

  const cancelAnimation = useCallback(() => {
    cancelAnimationFrame(moveIdRef.current);
  }, []);

  const scrollTo = useCallback(
    (rawScroll) => {
      const length = options.length;
      if (length === 0) return 0;

      const normalizedScroll = infiniteProp
        ? normalizeIndex(rawScroll, length)
        : rawScroll;

      if (wheelItemsRef.current) {
        const transform = `translateZ(${-radius}px) rotateX(${
          itemAngle * normalizedScroll
        }deg)`;
        wheelItemsRef.current.style.transform = transform;

        wheelItemsRef.current.childNodes.forEach((node) => {
          const li = node;
          const distance = Math.abs(
            Number(li.dataset.index) - normalizedScroll
          );
          li.style.visibility = distance > quarterCount ? "hidden" : "visible";
        });
      }

      if (highlightListRef.current) {
        highlightListRef.current.style.transform = `translateY(${
          -normalizedScroll * itemHeight
        }px)`;
      }

      return normalizedScroll;
    },
    [infiniteProp, itemAngle, itemHeight, options.length, quarterCount, radius]
  );

  const animateScroll = useCallback(
    (startScroll, endScroll, duration, onComplete) => {
      if (startScroll === endScroll || duration === 0) {
        scrollTo(startScroll);
        return;
      }

      const startTime = performance.now();
      const totalDistance = endScroll - startScroll;

      const tick = (currentTime) => {
        const elapsed = (currentTime - startTime) / 1000;

        if (elapsed < duration) {
          const progress = easeOutCubic(elapsed / duration);
          scrollRef.current = scrollTo(startScroll + progress * totalDistance);
          moveIdRef.current = requestAnimationFrame(tick);
        } else {
          cancelAnimation();
          scrollRef.current = scrollTo(endScroll);
          onComplete?.();
        }
      };

      requestAnimationFrame(tick);
    },
    [cancelAnimation, scrollTo]
  );

  const selectByScroll = useCallback(
    (scroll) => {
      const normalizedIndex = normalizeIndex(scroll, options.length) | 0;

      const boundedScroll = infiniteProp
        ? normalizedIndex
        : clamp(normalizedIndex, 0, options.length - 1);

      if (!infiniteProp && boundedScroll !== scroll) return;

      scrollRef.current = scrollTo(boundedScroll);
      const selected = options[scrollRef.current];
      if (selected) {
        setValue(selected.value);
      }
    },
    [infiniteProp, options, scrollTo, setValue]
  );

  const selectByValue = useCallback(
    (selectedValue) => {
      const index = options.findIndex((opt) => opt.value === selectedValue);

      if (index === -1) {
        console.error("Invalid value selected:", selectedValue);
        return;
      }

      cancelAnimation();
      selectByScroll(index);
    },
    [cancelAnimation, options, selectByScroll]
  );

  const scrollByStep = useCallback(
    (step) => {
      const startScroll = scrollRef.current;
      let endScroll = startScroll + step;

      if (infiniteProp) {
        endScroll = Math.round(endScroll);
      } else {
        endScroll = clamp(
          Math.round(endScroll),
          0,
          Math.max(options.length - 1, 0)
        );
      }

      const distance = Math.abs(endScroll - startScroll);
      if (distance === 0) return;

      const duration = Math.sqrt(distance / scrollSensitivityProp);

      cancelAnimation();
      animateScroll(startScroll, endScroll, duration, () => {
        selectByScroll(scrollRef.current);
      });
    },
    [
      animateScroll,
      cancelAnimation,
      infiniteProp,
      options.length,
      scrollSensitivityProp,
      selectByScroll,
    ]
  );

  const handleWheelItemClick = useCallback(
    (clientY) => {
      const container = containerRef.current;
      if (!container) {
        console.error("Container reference is not set.");
        return;
      }

      const { top } = container.getBoundingClientRect();
      const clickOffsetY = clientY - top;

      const clickedSegmentIndex = wheelSegmentPositions.findIndex(
        ([start, end]) => clickOffsetY >= start && clickOffsetY <= end
      );

      if (clickedSegmentIndex === -1) {
        console.error("No item found for click position:", clickOffsetY);
        return;
      }

      const stepsToScroll = (quarterCount - clickedSegmentIndex - 1) * -1;
      scrollByStep(stepsToScroll);
    },
    [quarterCount, scrollByStep, wheelSegmentPositions]
  );

  const updateScrollDuringDrag = useCallback(
    (event) => {
      try {
        const currentY =
          (event instanceof MouseEvent
            ? event.clientY
            : event.touches?.[0]?.clientY) || 0;

        const touchData = touchDataRef.current;

        if (touchData.isClick) {
          const dragThreshold = 5;
          if (Math.abs(currentY - touchData.startY) > dragThreshold) {
            touchData.isClick = false;
          }
        }

        touchData.yList.push([currentY, Date.now()]);
        if (touchData.yList.length > 5) {
          touchData.yList.shift();
        }

        const dragDelta = (touchData.startY - currentY) / itemHeight;
        let nextScroll = scrollRef.current + dragDelta;

        if (infiniteProp) {
          nextScroll = normalizeIndex(nextScroll, options.length);
        } else {
          const maxIndex = options.length;
          if (nextScroll < 0) {
            nextScroll *= RESISTANCE;
          } else if (nextScroll > maxIndex) {
            nextScroll =
              maxIndex + (nextScroll - maxIndex) * RESISTANCE;
          }
        }

        touchData.touchScroll = scrollTo(nextScroll);
      } catch (error) {
        console.error("Error in updateScrollDuringDrag:", error);
      }
    },
    [infiniteProp, itemHeight, options.length, scrollTo]
  );

  const handleDragMoveEvent = useCallback(
    (event) => {
      if (
        !draggingRef.current &&
        !containerRef.current?.contains(event.target) &&
        event.target !== containerRef.current
      ) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      if (options.length) {
        updateScrollDuringDrag(event);
      }
    },
    [options.length, updateScrollDuringDrag]
  );

  const initiateDragGesture = useCallback(
    (event) => {
      try {
        draggingRef.current = true;

        const controller = new AbortController();
        const { signal } = controller;

        dragControllerRef.current = controller;

        const passiveOpts = { signal, passive: false };
        containerRef.current?.addEventListener(
          "touchmove",
          handleDragMoveEvent,
          passiveOpts
        );
        document.addEventListener("mousemove", handleDragMoveEvent, passiveOpts);

        const startY =
          (event instanceof MouseEvent
            ? event.clientY
            : event.touches?.[0]?.clientY) || 0;

        const touchData = touchDataRef.current;
        touchData.startY = startY;
        touchData.yList = [[startY, Date.now()]];
        touchData.touchScroll = scrollRef.current;
        touchData.isClick = true;

        cancelAnimation();
      } catch (error) {
        console.error("Error in initiateDragGesture:", error);
      }
    },
    [cancelAnimation, handleDragMoveEvent]
  );

  const handleDragStartEvent = useCallback(
    (event) => {
      const isDragging = draggingRef.current;
      const isTargetValid =
        !!containerRef.current?.contains(event.target) ||
        event.target === containerRef.current;

      if ((isDragging || isTargetValid) && event.cancelable) {
        event.preventDefault();
        if (options.length) {
          initiateDragGesture(event);
        }
      }
    },
    [initiateDragGesture, options.length]
  );

  const decelerateAndAnimateScroll = useCallback(
    (initialVelocityParam) => {
      let initialVelocity = initialVelocityParam;
      const currentScroll = scrollRef.current;
      let targetScroll = currentScroll;
      let deceleration =
        initialVelocity > 0 ? -baseDeceleration : baseDeceleration;
      let duration = 0;

      if (infiniteProp) {
        duration = Math.abs(initialVelocity / deceleration);
        const scrollDistance =
          initialVelocity * duration +
          0.5 * deceleration * duration * duration;
        targetScroll = Math.round(currentScroll + scrollDistance);
      } else if (currentScroll < 0 || currentScroll > options.length - 1) {
        const target = clamp(currentScroll, 0, options.length - 1);
        const scrollDistance = currentScroll - target;
        deceleration = SNAP_BACK_DECELERATION;
        duration = Math.sqrt(Math.abs(scrollDistance / deceleration));
        initialVelocity = deceleration * duration;
        initialVelocity = currentScroll > 0 ? -initialVelocity : initialVelocity;
        targetScroll = target;
      } else {
        duration = Math.abs(initialVelocity / deceleration);
        const scrollDistance =
          initialVelocity * duration +
          0.5 * deceleration * duration * duration;
        targetScroll = Math.round(currentScroll + scrollDistance);
        targetScroll = clamp(targetScroll, 0, options.length - 1);

        const adjustedDistance = targetScroll - currentScroll;
        duration = Math.sqrt(Math.abs(adjustedDistance / deceleration));
      }

      animateScroll(currentScroll, targetScroll, duration, () => {
        selectByScroll(scrollRef.current);
      });

      selectByScroll(scrollRef.current);
    },
    [
      animateScroll,
      baseDeceleration,
      infiniteProp,
      options.length,
      selectByScroll,
    ]
  );

  const finalizeDragAndStartInertiaScroll = useCallback(() => {
    try {
      dragControllerRef.current?.abort();
      dragControllerRef.current = null;

      const touchData = touchDataRef.current;

      if (touchData.isClick) {
        handleWheelItemClick(touchData.startY);
        return;
      }

      const yList = touchData.yList;
      let velocity = 0;

      if (yList.length > 1) {
        const len = yList.length;
        const [startY, startTime] = yList[len - 2] ?? [0, 0];
        const [endY, endTime] = yList[len - 1] ?? [0, 0];

        const timeDiff = endTime - startTime;

        if (timeDiff > 0) {
          const distance = startY - endY;
          const velocityPerSecond =
            ((distance / itemHeight) * 1000) / timeDiff;

          const direction = velocityPerSecond > 0 ? 1 : -1;
          const absVelocity = Math.min(
            Math.abs(velocityPerSecond),
            MAX_VELOCITY
          );
          velocity = absVelocity * direction;
        }
      }

      scrollRef.current = touchData.touchScroll ?? scrollRef.current;
      decelerateAndAnimateScroll(velocity);
    } catch (error) {
      console.error("Error in finalizeDragAndStartInertiaScroll:", error);
    } finally {
      draggingRef.current = false;
    }
  }, [decelerateAndAnimateScroll, handleWheelItemClick, itemHeight]);

  const handleDragEndEvent = useCallback(
    (event) => {
      if (!options.length) return;

      if (
        draggingRef.current ||
        containerRef.current?.contains(event.target) ||
        event.target === containerRef.current
      ) {
        if (event.cancelable) {
          event.preventDefault();
        }

        finalizeDragAndStartInertiaScroll();
      }
    },
    [finalizeDragAndStartInertiaScroll, options.length]
  );

  const scrollByWheel = useCallback(
    (event) => {
      event.preventDefault();
      const now = Date.now();
      const delta = event.deltaY;

      if (Math.sign(lastWheelTimeRef.current - now) === 1) return;

      lastWheelTimeRef.current = now + 80;

      const steps = delta / (itemHeight * 3);
      scrollByStep(steps);
    },
    [itemHeight, scrollByStep]
  );

  const handleWheelEvent = useCallback(
    (event) => {
      if (!options.length || !containerRef.current) return;

      if (
        (draggingRef.current ||
          containerRef.current.contains(event.target) ||
          event.target === containerRef.current) &&
        event.cancelable
      ) {
        event.preventDefault();
        scrollByWheel(event);
      }
    },
    [options.length, scrollByWheel]
  );

  const wheelItems = useMemo(() => {
    if (!options.length) return [];

    const makeItem = (option, index, angle) => ({
      key: index,
      dataIndex: index,
      label: option.label,
      style: {
        top: -halfItemHeight,
        height: itemHeight,
        lineHeight: `${itemHeight}px`,
        transform: `rotateX(${angle}deg) translateZ(${radius}px)`,
        visibility: "hidden",
      },
    });

    const items = options.map((option, index) =>
      makeItem(option, index, -itemAngle * index)
    );

    if (infiniteProp && options.length) {
      for (let i = 0; i < quarterCount; ++i) {
        const prependIndex = -i - 1;
        const appendIndex = i + options.length;

        items.unshift(
          makeItem(
            options[options.length - i - 1],
            prependIndex,
            itemAngle * (i + 1)
          )
        );
        items.push(
          makeItem(
            options[i],
            appendIndex,
            -itemAngle * appendIndex
          )
        );
      }
    }

    return items;
  }, [
    halfItemHeight,
    infiniteProp,
    itemAngle,
    itemHeight,
    options,
    quarterCount,
    radius,
  ]);

  const highlightItems = useMemo(() => {
    const makeItem = (option, key) => ({
      key,
      label: option.label,
      style: { height: itemHeight },
    });

    const items = options.map((option, index) => makeItem(option, index));

    if (infiniteProp && options.length) {
      const firstItem = options[0];
      const lastItem = options[options.length - 1];

      items.unshift(makeItem(lastItem, "infinite-start"));
      items.push(makeItem(firstItem, "infinite-end"));
    }

    return items;
  }, [infiniteProp, itemHeight, options]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const opts = { passive: false };

    container.addEventListener("touchstart", handleDragStartEvent, opts);
    container.addEventListener("touchend", handleDragEndEvent, opts);
    container.addEventListener("wheel", handleWheelEvent, opts);
    document.addEventListener("mousedown", handleDragStartEvent, opts);
    document.addEventListener("mouseup", handleDragEndEvent, opts);

    return () => {
      container.removeEventListener("touchstart", handleDragStartEvent);
      container.removeEventListener("touchend", handleDragEndEvent);
      container.removeEventListener("wheel", handleWheelEvent);
      document.removeEventListener("mousedown", handleDragStartEvent);
      document.removeEventListener("mouseup", handleDragEndEvent);
    };
  }, [
    handleDragEndEvent,
    handleDragStartEvent,
    handleWheelEvent,
    options.length,
  ]);

  useEffect(() => {
    selectByValue(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, valueProp, options]);

  return {
    refs: {
      containerRef,
      wheelItemsRef,
      highlightListRef,
    },
    measurements: {
      containerHeight,
      itemHeight,
    },
    highlightListStyle: {
      top: infiniteProp ? -itemHeight : undefined,
    },
    wheelItems,
    highlightItems,
  };
};
