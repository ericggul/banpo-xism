import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// iOS-like Wheel Column with inertia and infinite looping
function WheelColumn({
  options,
  value,
  onChange,
  label,
  itemHeightRem = 2.8,
  visibleCount = 7,
  fontSizeRem = 1.1,
}) {
  const len = options.length;
  const half = Math.floor(visibleCount / 2);
  const initialIndex = useMemo(() => {
    if (value == null) return 0;
    const idx = options.findIndex((o) => String(o) === String(value));
    return idx >= 0 ? idx : 0;
  }, [options, value]);

  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [offsetItems, setOffsetItems] = useState(0); // fractional offset in units of items (-0.5..0.5 typical)
  const offsetRef = useRef(0);
  const positionRef = useRef(initialIndex); // continuous position (float, can exceed bounds)
  const isAnimatingRef = useRef(false);
  const rafRef = useRef(0);
  const rootFontSizeRef = useRef(16);

  // helper: modulo positive
  const mod = useCallback((n, m) => {
    return ((n % m) + m) % m;
  }, []);

  const itemHeightPxRef = useRef(0);
  const centerLaneRef = useRef(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateMeasurement = () => {
      if (typeof window === "undefined") return;
      const rootFontSizePx =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      rootFontSizeRef.current = rootFontSizePx;
      if (centerLaneRef.current) {
        const { height } = centerLaneRef.current.getBoundingClientRect();
        itemHeightPxRef.current = height || itemHeightRem * rootFontSizePx;
      } else {
        itemHeightPxRef.current = itemHeightRem * rootFontSizePx;
      }
    };
    updateMeasurement();
    window.addEventListener("resize", updateMeasurement);
    return () => {
      window.removeEventListener("resize", updateMeasurement);
    };
  }, [itemHeightRem]);

  // convert px delta to items delta using measured px height
  const pxToItems = useCallback(
    (deltaPx) => {
      const measured = itemHeightPxRef.current;
      if (measured && measured > 0) {
        return deltaPx / measured;
      }
      const rootFontSizePx = rootFontSizeRef.current || 16;
      return deltaPx / (itemHeightRem * rootFontSizePx);
    },
    [itemHeightRem]
  );

  // notify parent when selectedIndex changes
  useEffect(() => {
    onChange && onChange(options[selectedIndex]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  // pointer handling
  const pointer = useRef({
    active: false,
    lastY: 0,
    lastT: 0,
    velocitySamples: [], // [{vItemsPerMs, t}]
  });
  const wheelIdleTimeoutRef = useRef(null);

  const commitPosition = useCallback(
    (nextPosition) => {
      if (!len) return;
      positionRef.current = nextPosition;
      const nearest = Math.round(nextPosition);
      let offset = nextPosition - nearest;
      if (Math.abs(offset) < 0.0001) {
        offset = 0;
      }
      offsetRef.current = offset;
      setOffsetItems(offset);
      setSelectedIndex((current) => {
        const normalized = mod(nearest, len);
        return current === normalized ? current : normalized;
      });
    },
    [len, mod]
  );

  const applyDeltaItems = useCallback(
    (deltaItems) => {
      if (!len) return;
      const next = positionRef.current + deltaItems;
      commitPosition(next);
    },
    [commitPosition, len]
  );

  const stopAnimation = useCallback(() => {
    isAnimatingRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const easeOutCubic = useCallback((t) => 1 - Math.pow(1 - t, 3), []);

  const animateToPosition = useCallback(
    (targetPosition, durationMs = 360, easing = easeOutCubic) => {
      const startPosition = positionRef.current;
      const distance = targetPosition - startPosition;
      if (Math.abs(distance) < 0.0001 || durationMs <= 0) {
        stopAnimation();
        commitPosition(targetPosition);
        return;
      }

      stopAnimation();
      isAnimatingRef.current = true;
      const start = performance.now();

      const tick = () => {
        if (!isAnimatingRef.current) return;
        const now = performance.now();
        const progress = Math.min(1, (now - start) / durationMs);
        const eased = easing(progress);
        const next = startPosition + distance * eased;
        commitPosition(next);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          isAnimatingRef.current = false;
          commitPosition(targetPosition);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [commitPosition, easeOutCubic, stopAnimation]
  );

  useEffect(() => {
    const idx = options.findIndex((o) => String(o) === String(value));
    if (idx < 0) return;
    stopAnimation();
    positionRef.current = idx;
    offsetRef.current = 0;
    commitPosition(idx);
  }, [commitPosition, options, stopAnimation, value]);

  useEffect(() => {
    positionRef.current = initialIndex;
    offsetRef.current = 0;
    commitPosition(initialIndex);
  }, [commitPosition, initialIndex]);

  const snapToCenter = useCallback(() => {
    if (!len) return;
    const target = Math.round(positionRef.current);
    const distance = Math.abs(target - positionRef.current);
    if (distance < 0.0001) {
      commitPosition(target);
      return;
    }
    const durationMs = Math.min(320, Math.max(100, distance * 520));
    animateToPosition(target, durationMs);
  }, [animateToPosition, commitPosition, len]);

  const animateMomentum = useCallback(
    (initialVelocity) => {
      if (!len) {
        snapToCenter();
        return;
      }
      const minVelocity = 0.00002; // items per ms
      if (Math.abs(initialVelocity) <= minVelocity) {
        snapToCenter();
        return;
      }
      const deceleration = 0.0026; // items per ms^2
      const direction = initialVelocity > 0 ? 1 : -1;
      const predictedTravel = (initialVelocity * initialVelocity) / (2 * deceleration);
      const maxTravelItems = Math.max(12, len * 1.5);
      const travel = Math.min(predictedTravel, maxTravelItems);
      let target = positionRef.current + direction * travel;
      if (!Number.isFinite(target)) {
        snapToCenter();
        return;
      }
      let rounded = Math.round(target);
      const currentRounded = Math.round(positionRef.current);
      if (rounded === currentRounded) {
        rounded += direction;
      }
      const distance = Math.abs(rounded - positionRef.current);
      const duration = Math.min(1300, Math.max(260, distance * 520));
      animateToPosition(rounded, duration, easeOutCubic);
    },
    [animateToPosition, easeOutCubic, len, snapToCenter]
  );

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
    stopAnimation();
    pointer.current.active = true;
    pointer.current.lastY = e.clientY;
    pointer.current.lastT = performance.now();
    pointer.current.velocitySamples = [];
  }, [stopAnimation]);

  const onPointerMove = useCallback(
    (e) => {
      if (!pointer.current.active) return;
      const now = performance.now();
      const dyPx = e.clientY - pointer.current.lastY;
      const dt = now - pointer.current.lastT || 1;
      pointer.current.lastY = e.clientY;
      pointer.current.lastT = now;
      const dyItems = pxToItems(dyPx);
      applyDeltaItems(dyItems);
      const vItemsPerMs = dyItems / dt;
      pointer.current.velocitySamples.push({ v: vItemsPerMs, t: now });
      if (pointer.current.velocitySamples.length > 5) {
        pointer.current.velocitySamples.shift();
      }
    },
    [applyDeltaItems, pxToItems]
  );

  const onPointerUp = useCallback(() => {
    if (!pointer.current.active) return;
    pointer.current.active = false;
    // compute velocity using the latest samples
    const samples = pointer.current.velocitySamples;
    let v = 0;
    if (samples.length > 0) {
      // weighted average towards the latest sample
      let sum = 0;
      let weightSum = 0;
      samples.forEach((s, i) => {
        const w = i + 1; // 1..N
        sum += s.v * w;
        weightSum += w;
      });
      v = sum / weightSum;
    }
    const absV = Math.abs(v);
    const clickThreshold = 0.00004;
    if (absV < clickThreshold) {
      // slow drag: just snap to center
      snapToCenter();
      return;
    }
    const maxBoostVelocity = 0.0025;
    const boostedVelocity = Math.max(
      -maxBoostVelocity,
      Math.min(maxBoostVelocity, v * 1.05)
    );
    animateMomentum(boostedVelocity);
    pointer.current.velocitySamples = [];
    pointer.current.lastY = 0;
    pointer.current.lastT = 0;
  }, [animateMomentum, snapToCenter]);

  useEffect(() => {
    return () => {
      stopAnimation();
    };
  }, [stopAnimation]);

  useEffect(() => {
    return () => {
      if (wheelIdleTimeoutRef.current) {
        clearTimeout(wheelIdleTimeoutRef.current);
      }
    };
  }, []);

  const onWheel = useCallback(
    (e) => {
      if (typeof window === "undefined") return;
      e.preventDefault();
      stopAnimation();
      const deltaItems = pxToItems(e.deltaY);
      if (deltaItems === 0) return;
      applyDeltaItems(deltaItems);
      if (wheelIdleTimeoutRef.current) {
        clearTimeout(wheelIdleTimeoutRef.current);
      }
      wheelIdleTimeoutRef.current = setTimeout(() => {
        wheelIdleTimeoutRef.current = null;
        snapToCenter();
      }, 80);
    },
    [applyDeltaItems, pxToItems, snapToCenter, stopAnimation]
  );

  const renderItems = () => {
    if (!len) return null;
    const items = [];
    const rootFontSizePx = rootFontSizeRef.current || 16;
    const itemHeightPx =
      itemHeightPxRef.current ||
      Math.max(itemHeightRem * rootFontSizePx, 1);
    for (let rel = -half; rel <= half; rel++) {
      const idx = mod(selectedIndex + rel, len);
      const val = options[idx];
      const distance = Math.abs(rel + offsetItems);
      const clamped = Math.min(1, distance / (half + 0.0001));
      const scale = 1 - 0.12 * clamped; // subtle scale diff
      const opacity = 1 - 0.7 * clamped; // fade towards edges
      const translateYPx = (rel + offsetItems) * itemHeightPx;
      const isCenter = distance <= 0.001;
      items.push(
        <div
          key={`${idx}-${rel}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `translate3d(0, ${translateYPx}px, 0) scale(${scale})`,
            transformOrigin: "50% 50%",
            height: `${itemHeightRem}rem`,
            opacity,
            willChange: "transform, opacity",
            fontSize: `${fontSizeRem}rem`,
            fontWeight: isCenter ? 600 : 500,
            fontVariantNumeric: "tabular-nums",
            lineHeight: `${itemHeightRem}rem`,
          }}
          role="option"
          aria-selected={isCenter}
          aria-hidden={distance > 0.01}
        >
          {String(val).padStart(2, "0")}
        </div>
      );
    }
    return items;
  };

  return (
    <div
      style={{
        position: "relative",
        height: `${itemHeightRem * visibleCount}rem`,
        width: "100%",
        overflow: "hidden",
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      role="listbox"
      aria-label={label}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          display: "flex",
          alignItems: "center",
          transform: "translateY(-50%)",
          height: `${itemHeightRem}rem`,
          pointerEvents: "none",
          // highlighted center row background
          background: "rgba(255,255,255,0.06)",
          borderTop: "0.08rem solid rgba(125,125,125,0.35)",
          borderBottom: "0.08rem solid rgba(125,125,125,0.35)",
          zIndex: 2,
        }}
        ref={centerLaneRef}
        aria-hidden
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          background: `linear-gradient(to bottom, rgba(0,0,0,0.22), rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.22))`,
          pointerEvents: "none",
          zIndex: 1,
        }}
        aria-hidden
      />

      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 0 }}>
        {renderItems()}
      </div>

      {label ? (
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: "0.6rem",
            transform: "translateY(-50%)",
            fontSize: `${Math.max(0.85, fontSizeRem * 0.9)}rem`,
            opacity: 0.6,
            pointerEvents: "none",
          }}
          aria-hidden
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}

function TimerPicker({
  initial = { hours: 0, minutes: 0, seconds: 0 },
  onChange,
}) {
  const [hours, setHours] = useState(initial.hours || 0);
  const [minutes, setMinutes] = useState(initial.minutes || 0);
  const [seconds, setSeconds] = useState(initial.seconds || 0);

  useEffect(() => {
    onChange && onChange({ hours, minutes, seconds });
  }, [hours, minutes, seconds, onChange]);

  const hoursOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minuteSecondOptions = useMemo(
    () => Array.from({ length: 60 }, (_, i) => i),
    []
  );

  const itemHeightRem = 2.8;
  const fontSizeRem = 1.2;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1.2rem",
        width: "100%",
      }}
    >
      <div style={{ flex: 1, minWidth: "6.5rem" }}>
        <WheelColumn
          options={hoursOptions}
          value={hours}
          onChange={(v) => setHours(Number(v))}
          label="hours"
          itemHeightRem={itemHeightRem}
          fontSizeRem={fontSizeRem}
        />
      </div>
      <div style={{ flex: 1, minWidth: "5.8rem" }}>
        <WheelColumn
          options={minuteSecondOptions}
          value={minutes}
          onChange={(v) => setMinutes(Number(v))}
          label="min"
          itemHeightRem={itemHeightRem}
          fontSizeRem={fontSizeRem}
        />
      </div>
      <div style={{ flex: 1, minWidth: "5.8rem" }}>
        <WheelColumn
          options={minuteSecondOptions}
          value={seconds}
          onChange={(v) => setSeconds(Number(v))}
          label="sec"
          itemHeightRem={itemHeightRem}
          fontSizeRem={fontSizeRem}
        />
      </div>
    </div>
  );
}

export default function MobileTimer() {
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "28rem" }}>
        <TimerPicker initial={time} onChange={setTime} />
      </div>
    </div>
  );
}
