import type { DayAnalysis } from "#/lib/tide-analysis";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const HOLD_SCRUB_DELAY_MS = 180;
const MOVE_SLOP_PX = 8;
const SYNTHETIC_CLICK_GUARD_MS = 450;

type UseMatrixTouchScrubOptions = {
  areaRef: RefObject<HTMLDivElement | null>;
  selectedDateKey: string;
  inspectAtPoint: (
    clientX: number,
    clientY: number,
    pinned: boolean,
  ) => DayAnalysis | null;
  onSelectDay: (dateKey: string) => void;
};

type UseMatrixTouchScrubResult = {
  isTouchScrubbing: boolean;
  isRecentTouch: () => boolean;
};

/**
 * Mobile touch gesture controller for the 14-day tide outlook matrix:
 * - Hold (~180ms) anywhere on any bar -> scrub freely across all days & times
 * - Vertical drag immediately on the already-selected bar -> instant scrub
 * - Quick horizontal swipe or vertical scroll on unselected bars -> native scroll
 * - Quick or unhurried tap without moving -> selects that day
 */
export function useMatrixTouchScrub({
  areaRef,
  selectedDateKey,
  inspectAtPoint,
  onSelectDay,
}: UseMatrixTouchScrubOptions): UseMatrixTouchScrubResult {
  const [isTouchScrubbing, setIsTouchScrubbing] = useState(false);
  const lastTouchTimeRef = useRef<number>(0);

  // Keep latest callbacks/state in refs so touch listeners subscribe once and never
  // tear down mid-gesture during 60s `now` updates or day selection changes.
  const inspectAtPointRef = useRef(inspectAtPoint);
  const onSelectDayRef = useRef(onSelectDay);
  const selectedDateKeyRef = useRef(selectedDateKey);
  inspectAtPointRef.current = inspectAtPoint;
  onSelectDayRef.current = onSelectDay;
  selectedDateKeyRef.current = selectedDateKey;

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;

    let mode: "idle" | "pending" | "scrubbing" | "scrolling" = "idle";
    let startX = 0;
    let startY = 0;
    let moved = false;
    let startedOnSelected = false;
    let holdTimer: number | null = null;

    const clearHoldTimer = () => {
      if (holdTimer !== null) {
        window.clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        clearHoldTimer();
        mode = "idle";
        setIsTouchScrubbing(false);
        return;
      }

      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      moved = false;
      mode = "pending";

      const target = e.target as HTMLElement | null;
      const colEl = target?.closest<HTMLElement>("[data-day-key]");
      startedOnSelected = colEl?.dataset.dayKey === selectedDateKeyRef.current;

      clearHoldTimer();
      holdTimer = window.setTimeout(() => {
        if (mode === "pending") {
          mode = "scrubbing";
          setIsTouchScrubbing(true);
          inspectAtPointRef.current(startX, startY, true);
        }
      }, HOLD_SCRUB_DELAY_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startX);
      const dy = Math.abs(touch.clientY - startY);

      if (dx >= MOVE_SLOP_PX || dy >= MOVE_SLOP_PX) {
        moved = true;
      }

      if (mode === "scrubbing") {
        if (e.cancelable) e.preventDefault();
        inspectAtPointRef.current(touch.clientX, touch.clientY, true);
        return;
      }

      if (mode !== "pending") return;
      if (!moved) return;

      clearHoldTimer();

      if (startedOnSelected && dy > dx * 1.15) {
        mode = "scrubbing";
        setIsTouchScrubbing(true);
        if (e.cancelable) e.preventDefault();
        inspectAtPointRef.current(touch.clientX, touch.clientY, true);
      } else {
        mode = "scrolling";
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      clearHoldTimer();
      lastTouchTimeRef.current = Date.now();
      // Treat both fast taps (mode === "pending") and unhurried taps that crossed
      // the hold threshold without dragging (mode === "scrubbing" && !moved) as day selection.
      if (mode === "pending" || (mode === "scrubbing" && !moved)) {
        const touch = e.changedTouches[0];
        if (touch) {
          const tappedDay = inspectAtPointRef.current(
            touch.clientX,
            touch.clientY,
            true,
          );
          if (tappedDay) {
            onSelectDayRef.current(tappedDay.dateKey);
          }
        }
      }
      mode = "idle";
      setIsTouchScrubbing(false);
    };

    const onTouchCancel = () => {
      clearHoldTimer();
      mode = "idle";
      setIsTouchScrubbing(false);
    };

    area.addEventListener("touchstart", onTouchStart, { passive: true });
    area.addEventListener("touchmove", onTouchMove, { passive: false });
    area.addEventListener("touchend", onTouchEnd, { passive: true });
    area.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      clearHoldTimer();
      area.removeEventListener("touchstart", onTouchStart);
      area.removeEventListener("touchmove", onTouchMove);
      area.removeEventListener("touchend", onTouchEnd);
      area.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [areaRef]);

  const isRecentTouch = useCallback(
    () => Date.now() - lastTouchTimeRef.current < SYNTHETIC_CLICK_GUARD_MS,
    [],
  );

  return { isTouchScrubbing, isRecentTouch };
}
