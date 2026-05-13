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
  const dragRef        = useRef({ active: false, startX: 0, startPx: 0, moved: 0 });

  const n          = products.length;
  const cloneCount = numVisible;

  const getItemW = useCallback(
    () => (containerRef.current?.offsetWidth ?? 0) / numVisible,
    [numVisible],
  );

  const updateWidth = useCallback(() => {
    const el = containerRef.current;
    if (el) el.style.setProperty("--row-item-w", `${el.offsetWidth / numVisible}px`);
  }, [numVisible]);

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

  const onTransitionEnd = useCallback(() => {
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

  const onPointerDown = useCallback(
    (e) => {
      if (n <= numVisible) return;
      stopAutoplay();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      dragRef.current = {
        active: true,
        startX: clientX,
        startPx: getOffsetPx(rawIdxRef.current),
        moved: 0,
      };
      const track = trackRef.current;
      if (track) track.style.transition = "none";
      if (!e.touches) e.preventDefault();
    },
    [n, numVisible, stopAutoplay, getOffsetPx],
  );

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const delta = clientX - dragRef.current.startX;
    dragRef.current.moved = delta;
    const track = trackRef.current;
    if (track) track.style.transform = `translateX(${dragRef.current.startPx + delta}px)`;
    if (e.cancelable) e.preventDefault();
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const { moved } = dragRef.current;
    if (moved < -40) slideNext();
    else if (moved > 40) slidePrev();
    else moveTo(rawIdxRef.current, true);
    pauseAndResume();
  }, [slideNext, slidePrev, moveTo, pauseAndResume]);

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
      <div ref={containerRef} className="flex">
        {products.map((product) => (
          <div
            key={product.id}
            className="shrink-0 px-2 sm:px-3"
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
      className="relative overflow-hidden select-none"
      onMouseEnter={stopAutoplay}
      onMouseLeave={startAutoplay}
    >
      <div
        ref={trackRef}
        className="flex will-change-transform"
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        draggable={false}
      >
        {allItems.map((product, i) => (
          <div
            key={`${product.id}-${i}`}
            className="shrink-0"
            style={{ width: "var(--row-item-w)" }}
            draggable={false}
          >
            <div className="px-2 sm:px-3">
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
  itemsMobile     = 2,
  itemsTablet     = 3,
  itemsDesktop    = 4,
  productsPerRow  = 8,
  autoplay        = true,
  interval        = 3000,
  speed           = 500,
}) {
  const wrapperRef = useRef(null);
  const [numVisible, setNumVisible] = useState(itemsDesktop);

  useLayoutEffect(() => {
    const update = () => {
      const w = wrapperRef.current?.offsetWidth ?? window.innerWidth;
      setNumVisible(w < 640 ? itemsMobile : w < 1024 ? itemsTablet : itemsDesktop);
    };
    update();
    const ro = new ResizeObserver(update);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [itemsMobile, itemsTablet, itemsDesktop]);

  if (products.length === 0) return null;

  const chunkSize = Math.max(1, productsPerRow | 0);
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
