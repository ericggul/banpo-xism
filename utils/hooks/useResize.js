import { useState, useEffect, useCallback, useRef } from "react";

export default function useResize() {
  const [windowWidth, setWindowWidth] = useState(0);
  const [windowHeight, setWindowHeight] = useState(0);
  const [fixedHeight, setFixedHeight] = useState(0);
  const originalStylesRef = useRef(null);
  const lastViewportRef = useRef({ width: 0, height: 0 });

  const onResize = useCallback(() => {
    const { documentElement } = document;
    const documentClientHeight = documentElement.clientHeight;
    const documentClientWidth = documentElement.clientWidth;
    const visualViewport = window.visualViewport;
    const viewportWidth =
      typeof visualViewport?.width === "number"
        ? visualViewport.width
        : window.innerWidth;
    const viewportHeightRaw =
      typeof visualViewport?.height === "number"
        ? visualViewport.height
        : window.innerHeight;
    const roundedViewportWidth = Math.round(viewportWidth);
    const roundedViewportHeight = Math.round(viewportHeightRaw);
    const resolvedViewportHeight =
      documentClientWidth > 768 ? documentClientHeight : roundedViewportHeight;

    documentElement.style.setProperty("--app-width", `${roundedViewportWidth}px`);
    documentElement.style.setProperty("--app-height", `${resolvedViewportHeight}px`);
    documentElement.style.height = `${resolvedViewportHeight}px`;

    const { body } = document;
    body.style.height = `${resolvedViewportHeight}px`;
    body.style.overflow = "hidden";

    if (process.env.NODE_ENV !== "production") {
      const { width: lastWidth, height: lastHeight } = lastViewportRef.current;
      if (lastWidth !== roundedViewportWidth || lastHeight !== resolvedViewportHeight) {
        lastViewportRef.current = {
          width: roundedViewportWidth,
          height: resolvedViewportHeight,
        };
        // eslint-disable-next-line no-console
        console.debug("[useResize] viewport", {
          width: roundedViewportWidth,
          height: resolvedViewportHeight,
          documentClientWidth,
          documentClientHeight,
          visualViewportHeight: visualViewport?.height ?? null,
        });
      }
    }

    setWindowHeight(resolvedViewportHeight);
    setWindowWidth(roundedViewportWidth);
    setFixedHeight(documentClientHeight);
  }, []);

  useEffect(() => {
    const { documentElement } = document;
    const { body } = document;

    if (!originalStylesRef.current) {
      originalStylesRef.current = {
        rootHeight: documentElement.style.height,
        bodyHeight: body.style.height,
        bodyOverflow: body.style.overflow,
      };
    }

    onResize();
    window.addEventListener("resize", onResize);
    const visualViewport = window.visualViewport;

    if (visualViewport) {
      visualViewport.addEventListener("resize", onResize);
      visualViewport.addEventListener("scroll", onResize);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      if (visualViewport) {
        visualViewport.removeEventListener("resize", onResize);
        visualViewport.removeEventListener("scroll", onResize);
      }
      const originalStyles = originalStylesRef.current;
      if (originalStyles) {
        documentElement.style.height = originalStyles.rootHeight;
        documentElement.style.removeProperty("--app-width");
        documentElement.style.removeProperty("--app-height");
        body.style.height = originalStyles.bodyHeight;
        body.style.overflow = originalStyles.bodyOverflow;
      }
    };
  }, [onResize]);

  return [windowWidth, windowHeight, fixedHeight];
}
