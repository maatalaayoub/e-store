"use client";

import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import ProductCard from "./ProductCard";

const MAX_ROWS = 6;

/**
 * RowCarousel
 *
 * One row = one independent horizontal carousel.
 * Shows numVisible cards at a time, slides one product at a time, infinite loop.
 * Drag/touch + optional autoplay.  No grid, no inner chunking — strictly one
 * track per row.
 */
function RowCarousel({
  products,
  numVisible,
  autoplay,
  interval,
  speed,
  cardProps,
}) {
  const containerRef   = useRef(null);
  const trackRef       = useRef(null);
  const rawIdxRef      = useRef(0);
  const isAnimRef      = useRef(false);
  const autoTimerRef   = useRef(null);
  const resumeTimerRef = useRef(null);
  const dragRef        = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startPx: 0,
    moved: 0,
    locked: false,
    horizontal: false,
  });

  const n          = products.length;
  const cloneCount = numVisible;

  const getContainerW = useCallback(
    () => containerRef.current?.getBoundingClientRect().width ?? 0,
    [],
  );

  const getItemW = useCallback(
    () => getContainerW() / numVisible,
    [getContainerW, numVisible],
  );

  const updateWidth = useCallback(() => {
    const el = containerRef.current;
    if (el) el.style.setProperty("--row-item-w", `${getContainerW() / numVisible}px`);
  }, [getContainerW, numVisible]);

  const getOffsetPx = useCallback(
    (idx) => -(cloneCount + idx) * getItemW(),
    [cloneCount, getItemW],
  );

  const moveTo = useCallback(
    (idx, animated) => {
      const track = trackRef.current;
      if (!track) return;
      updateWidth();
      track.style.transition = animated
        ? `transform ${speed}ms cubic-bezier(0.4,0,0.2,1)`
        : "none";
      track.style.transform = `translateX(${getOffsetPx(idx)}px)`;
    },
    [speed, getOffsetPx, updateWidth],
  );

  const slideNext = useCallback(() => {
    if (isAnimRef.current || n === 0) return;
    isAnimRef.current = true;
    rawIdxRef.current += 1;
    moveTo(rawIdxRef.current, true);
  }, [n, moveTo]);

  const slidePrev = useCallback(() => {
    if (isAnimRef.current || n === 0) return;
    isAnimRef.current = true;
    rawIdxRef.current -= 1;
    moveTo(rawIdxRef.current, true);
  }, [n, moveTo]);

  const onTransitionEnd = useCallback((e) => {
    // Ignore transitionend bubbling from descendants (e.g. card hover effects).
    if (e && e.target !== trackRef.current) return;
    if (e && e.propertyName && e.propertyName !== "transform") return;
    isAnimRef.current = false;
    const raw = rawIdxRef.current;
    if (raw >= n) {
      rawIdxRef.current = raw - n;
      moveTo(raw - n, false);
    } else if (raw < 0) {
      rawIdxRef.current = raw + n;
      moveTo(raw + n, false);
    }
  }, [n, moveTo]);

  const startAutoplay = useCallback(() => {
    if (!autoplay || n <= numVisible) return;
    clearInterval(autoTimerRef.current);
    autoTimerRef.current = setInterval(slideNext, interval);
  }, [autoplay, n, numVisible, interval, slideNext]);

  const stopAutoplay = useCallback(() => {
    clearInterval(autoTimerRef.current);
  }, []);

  const pauseAndResume = useCallback(() => {
    stopAutoplay();
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(startAutoplay, 1200);
  }, [stopAutoplay, startAutoplay]);

  // ── pointer (mouse / touch / pen) drag with axis lock ──────────────────────
  // Uses Pointer Events + setPointerCapture so the gesture is reliably tracked
  // even when the finger leaves the track. `touch-action: pan-y` on the track
  // tells the browser it owns vertical scrolling, while we own horizontal —
  // which prevents the page from "stealing" the gesture mid-drag and lets us
  // always snap the card back to its canonical position on release.
  const onPointerDown = useCallback(
    (e) => {
      if (n <= numVisible) return;
      // Ignore secondary buttons for mouse.
      if (e.pointerType === "mouse" && e.button !== 0) return;

      // ── Abort any in-flight CSS transition ─────────────────────────────────
      // Read the live transform BEFORE killing the transition so the drag
      // starts from the card's actual visual position (not where it was going).
      // Then force isAnimRef to false — this is the root fix for the freeze bug
      // where repeated fast swipes leave isAnimRef stuck at true permanently
      // (setting transition:none stops the animation but never fires transitionend).
      const track = trackRef.current;
      let startPx = getOffsetPx(rawIdxRef.current);
      if (track) {
        try {
          const tx = getComputedStyle(track).transform;
          if (tx && tx !== "none") startPx = new DOMMatrixReadOnly(tx).m41;
        } catch {}
        track.style.transition = "none";
        track.style.transform  = `translateX(${startPx}px)`;
      }
      isAnimRef.current = false; // always clear — never leave it stuck

      stopAutoplay();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}

      dragRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startPx,
        moved: 0,
        locked: false,
        horizontal: false,
      };
    },
    [n, numVisible, stopAutoplay, getOffsetPx],
  );

  const onPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    // Axis lock: decide direction once movement exceeds a small threshold.
    if (!d.locked) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      d.locked = true;
      d.horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (!d.horizontal) return; // vertical → let the page scroll naturally

    d.moved = dx;
    const track = trackRef.current;
    if (track) track.style.transform = `translateX(${d.startPx + dx}px)`;
  }, []);

  const finishDrag = useCallback(
    (commit) => {
      const d = dragRef.current;
      if (!d.active) return;
      d.active = false;
      if (commit && d.horizontal) {
        if (d.moved < -40) slideNext();
        else if (d.moved > 40) slidePrev();
        else moveTo(rawIdxRef.current, true);
      } else {
        // Cancelled or vertical scroll — snap to canonical position.
        moveTo(rawIdxRef.current, true);
      }
      pauseAndResume();
    },
    [slideNext, slidePrev, moveTo, pauseAndResume],
  );

  const onPointerUp     = useCallback((e) => {
    if (e.pointerId !== dragRef.current.pointerId) return;
    finishDrag(true);
  }, [finishDrag]);

  const onPointerCancel = useCallback((e) => {
    if (e.pointerId !== dragRef.current.pointerId) return;
    finishDrag(false);
  }, [finishDrag]);

  useLayoutEffect(() => {
    if (n === 0) return;
    rawIdxRef.current = 0;
    updateWidth();
    moveTo(0, false);
  }, [products, n, numVisible, updateWidth, moveTo]);

  useEffect(() => {
    if (n === 0) return;
    startAutoplay();
    const ro = new ResizeObserver(() => {
      updateWidth();
      moveTo(rawIdxRef.current, false);
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      stopAutoplay();
      clearTimeout(resumeTimerRef.current);
      ro.disconnect();
    };
  }, [products, n, numVisible, updateWidth, moveTo, startAutoplay, stopAutoplay]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("transitionend", onTransitionEnd);
    return () => track.removeEventListener("transitionend", onTransitionEnd);
  }, [onTransitionEnd]);

  if (n === 0) return null;

  // Row has ≤ numVisible products → no sliding, render statically.
  if (n <= numVisible) {
    return (
      <div ref={containerRef} className="flex items-stretch">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex h-full shrink-0 flex-col px-2 sm:px-3"
            style={{ width: `${100 / numVisible}%` }}
          >
            <ProductCard product={product} {...cardProps} />
          </div>
        ))}
      </div>
    );
  }

  const tail     = products.slice(-cloneCount);
  const head     = products.slice(0, cloneCount);
  const allItems = [...tail, ...products, ...head];

  return (
    <div
      ref={containerRef}
      className="relative overflow-x-clip select-none"
      onMouseEnter={stopAutoplay}
      onMouseLeave={startAutoplay}
    >
      <div
        ref={trackRef}
        className="flex items-stretch will-change-transform touch-pan-y cursor-grab active:cursor-grabbing"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        draggable={false}
      >
        {allItems.map((product, i) => (
          <div
            key={`${product.id}-${i}`}
            className="flex h-full shrink-0 flex-col"
            style={{ width: "var(--row-item-w)" }}
            draggable={false}
          >
            <div className="flex h-full flex-1 flex-col px-2 sm:px-3">
              <ProductCard product={product} {...cardProps} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ProductCarousel
 *
 * Chunks `products` into rows of size `productsPerRow`, then renders each
 * chunk as an independent `RowCarousel` stacked vertically.  Each row shows
 * `visibleCardsPerRow` cards at a time (responsive via itemsMobile/Tablet/
 * Desktop) and slides one product at a time inside its own track.  Products
 * never move between rows.
 */
export default function ProductCarousel({
  products = [],
  onItemAdded,
  buttonStyle,
  filledBg,
  filledText,
  outlineBorder,
  outlineText,
  outlineIcon,
  outlineBg,
  buttonFontSize,
  layout,
  showShortDescription,
  itemsMobile     = 2,
  itemsTablet     = 3,
  itemsDesktop    = 4,
  productsPerRow  = 8,
  autoplay        = true,
  interval        = 3000,
  speed           = 500,
}) {
  const wrapperRef = useRef(null);
  const chunkSize = Math.max(1, productsPerRow | 0);
  const [numVisible, setNumVisible] = useState(() => Math.max(1, Math.min(itemsDesktop | 0, chunkSize)));

  useLayoutEffect(() => {
    const update = () => {
      const w = wrapperRef.current?.offsetWidth ?? window.innerWidth;
      const responsiveVisible = w < 640 ? itemsMobile : w < 1024 ? itemsTablet : itemsDesktop;
      setNumVisible(Math.max(1, Math.min(responsiveVisible | 0, chunkSize)));
    };
    update();
    const ro = new ResizeObserver(update);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [itemsMobile, itemsTablet, itemsDesktop, chunkSize]);

  if (products.length === 0) return null;

  const rows = [];
  for (let i = 0; i < products.length && rows.length < MAX_ROWS; i += chunkSize) {
    rows.push(products.slice(i, i + chunkSize));
  }

  const cardProps = {
    onItemAdded,
    buttonStyle,
    filledBg,
    filledText,
    outlineBorder,
    outlineText,
    outlineIcon,
    outlineBg,
    buttonFontSize,
    layout,
    showShortDescription,
  };

  return (
    <div ref={wrapperRef} className="flex flex-col gap-8">
      {rows.map((rowProducts, i) => (
        <RowCarousel
          key={i}
          products={rowProducts}
          numVisible={numVisible}
          autoplay={autoplay}
          interval={interval}
          speed={speed}
          cardProps={cardProps}
        />
      ))}
    </div>
  );
}
