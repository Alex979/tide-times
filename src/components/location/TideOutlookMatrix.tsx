import { buildScoreGradient, scoreToCssColor } from "#/lib/score-palette";
import {
  classifyScore,
  computeMatrixHourRange,
  daylightStatusLabel,
  formatHeightFt,
  formatMinuteOfDay,
  formatScorePoints,
  scoreToPoints,
  tierLabel,
  type CurrentCondition,
  type DayAnalysis,
  type ScoreSlot,
} from "#/lib/tide-analysis";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TideOutlookMatrixProps = {
  days: DayAnalysis[];
  selectedDateKey: string;
  onSelectDay: (dateKey: string) => void;
  currentCondition: CurrentCondition | null;
  timezoneAxisLabel: string;
};

type SlotInspection = {
  day: DayAnalysis;
  slot: ScoreSlot;
  yPercent: number;
  pinned: boolean;
};

const HOLD_SCRUB_DELAY_MS = 180;
const MOVE_SLOP_PX = 8;

function buildPolylinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points
    .map(
      (pt, idx) => `${idx === 0 ? "M" : "L"}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`,
    )
    .join(" ");
}

function findNearestSlot(
  day: DayAnalysis,
  relY: number,
  startMinute: number,
  minuteSpan: number,
): ScoreSlot | null {
  if (day.scores.length === 0) return null;
  const clampedY = Math.max(0, Math.min(1, relY));
  const targetMinute = startMinute + clampedY * minuteSpan;

  let nearest = day.scores[0];
  let bestDiff = Infinity;
  for (const slot of day.scores) {
    const diff = Math.abs(slot.minuteOfDay - targetMinute);
    if (diff < bestDiff) {
      bestDiff = diff;
      nearest = slot;
    }
  }
  return nearest;
}

export function TideOutlookMatrix({
  days,
  selectedDateKey,
  onSelectDay,
  currentCondition,
  timezoneAxisLabel,
}: TideOutlookMatrixProps) {
  const [inspection, setInspection] = useState<SlotInspection | null>(null);
  const [isTouchScrubbing, setIsTouchScrubbing] = useState(false);

  const headerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const barRefs = useRef<Array<HTMLDivElement | null>>([]);
  const barsAreaRef = useRef<HTMLDivElement | null>(null);
  const lastTouchTimeRef = useRef<number>(0);

  const { startHour, endHour } = useMemo(
    () => computeMatrixHourRange(days),
    [days],
  );
  const startMinute = startHour * 60;
  const endMinute = endHour * 60;
  const minuteSpan = endMinute - startMinute;

  const hourTicks = useMemo(() => {
    const standard = [3, 6, 9, 12, 15, 18, 21];
    return standard
      .filter((h) => h > startHour && h < endHour)
      .map((hour) => ({
        hour,
        label: formatMinuteOfDay(hour * 60, { compact: true }),
        pct: ((hour * 60 - startMinute) / minuteSpan) * 100,
      }));
  }, [startHour, endHour, startMinute, minuteSpan]);

  const dateRangeLabel = useMemo(() => {
    if (days.length === 0) return "";
    const first = days[0];
    const last = days[days.length - 1];
    if (first.monthShort === last.monthShort) {
      return `${first.monthShort} ${first.dayNumber}–${last.dayNumber}`;
    }
    return `${first.monthShort} ${first.dayNumber} – ${last.monthShort} ${last.dayNumber}`;
  }, [days]);

  const horizonCurves = useMemo(() => {
    const count = days.length;
    if (count === 0) return { sunrisePath: "", sunsetPath: "" };

    const sunrisePts: Array<{ x: number; y: number }> = [];
    const sunsetPts: Array<{ x: number; y: number }> = [];

    days.forEach((day, idx) => {
      const x = ((idx + 0.5) / count) * 100;
      if (day.sunriseMinute !== null) {
        const y = Math.max(
          0,
          Math.min(100, ((day.sunriseMinute - startMinute) / minuteSpan) * 100),
        );
        sunrisePts.push({ x, y });
      }
      if (day.sunsetMinute !== null) {
        const y = Math.max(
          0,
          Math.min(100, ((day.sunsetMinute - startMinute) / minuteSpan) * 100),
        );
        sunsetPts.push({ x, y });
      }
    });

    if (sunrisePts.length >= 2) {
      sunrisePts.unshift({ x: 0, y: sunrisePts[0].y });
      sunrisePts.push({ x: 100, y: sunrisePts[sunrisePts.length - 1].y });
    }
    if (sunsetPts.length >= 2) {
      sunsetPts.unshift({ x: 0, y: sunsetPts[0].y });
      sunsetPts.push({ x: 100, y: sunsetPts[sunsetPts.length - 1].y });
    }

    return {
      sunrisePath: buildPolylinePath(sunrisePts),
      sunsetPath: buildPolylinePath(sunsetPts),
    };
  }, [days, startMinute, minuteSpan]);

  // Maps any viewport (clientX, clientY) across the 14 bars to the exact day + 15-min slot
  const inspectAtPoint = useCallback(
    (clientX: number, clientY: number, pinned: boolean): DayAnalysis | null => {
      if (days.length === 0) return null;

      let matchedIdx = -1;
      let nearestIdx = 0;
      let nearestDist = Infinity;

      for (let i = 0; i < days.length; i++) {
        const el = barRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          matchedIdx = i;
          break;
        }
        const dist =
          clientX < rect.left ? rect.left - clientX : clientX - rect.right;
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }

      const idx = matchedIdx >= 0 ? matchedIdx : nearestIdx;
      const barEl = barRefs.current[idx];
      const day = days[idx];
      if (!barEl || !day) return null;

      const rect = barEl.getBoundingClientRect();
      if (rect.height <= 0) return null;

      const relY = Math.max(
        0,
        Math.min(1, (clientY - rect.top) / rect.height),
      );
      const slot = findNearestSlot(day, relY, startMinute, minuteSpan);
      if (!slot) return null;

      setInspection({
        day,
        slot,
        yPercent: relY * 100,
        pinned,
      });
      return day;
    },
    [days, startMinute, minuteSpan],
  );

  // Keep latest callbacks/state in refs so touch listeners subscribe once and never
  // tear down mid-gesture during 60s `now` updates or day selection changes.
  const inspectAtPointRef = useRef(inspectAtPoint);
  const onSelectDayRef = useRef(onSelectDay);
  const selectedDateKeyRef = useRef(selectedDateKey);
  inspectAtPointRef.current = inspectAtPoint;
  onSelectDayRef.current = onSelectDay;
  selectedDateKeyRef.current = selectedDateKey;

  // Mobile touch gesture controller:
  // - Hold (~180ms) anywhere on ANY bar -> scrub freely across all days & times
  // - Vertical drag immediately on the already-selected bar -> instant scrub
  // - Quick horizontal swipe or vertical scroll on unselected bars -> native scroll
  // - Quick or unhurried tap without moving -> selects that day
  useEffect(() => {
    const area = barsAreaRef.current;
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
        e.preventDefault();
        inspectAtPointRef.current(touch.clientX, touch.clientY, true);
        return;
      }

      if (mode !== "pending") return;
      if (!moved) return;

      clearHoldTimer();

      if (startedOnSelected && dy > dx * 1.15) {
        mode = "scrubbing";
        setIsTouchScrubbing(true);
        e.preventDefault();
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
  }, []);

  const handleMousePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    inspectAtPoint(e.clientX, e.clientY, false);
  };

  const handleMouseClick = (
    e: React.MouseEvent<HTMLDivElement>,
    day: DayAnalysis,
  ) => {
    // Ignore synthetic click synthesized right after touch events
    if (Date.now() - lastTouchTimeRef.current < 450) return;
    onSelectDay(day.dateKey);
    inspectAtPoint(e.clientX, e.clientY, false);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIdx = Math.min(days.length - 1, index + 1);
      onSelectDay(days[nextIdx].dateKey);
      headerRefs.current[nextIdx]?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIdx = Math.max(0, index - 1);
      onSelectDay(days[prevIdx].dateKey);
      headerRefs.current[prevIdx]?.focus();
    }
  };

  return (
    <section
      aria-labelledby="outlook-heading"
      className="instrument-reveal rounded-2xl border border-line bg-paper"
    >
      {/* Clean Instrument Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line-subtle px-4 py-3.5 sm:px-6">
        <h2
          id="outlook-heading"
          className="font-display text-lg font-semibold tracking-tight text-ink sm:text-xl"
        >
          Two-week outlook
        </h2>
        <span className="tabular-nums text-sm text-ink-muted">
          {dateRangeLabel}
        </span>
      </div>

      {/* Fixed-height Unified Legend / Live Readout Strip (zero layout shift while scrubbing) */}
      <div className="flex h-[54px] items-center justify-between gap-2 overflow-hidden border-b border-line-subtle bg-mist/45 px-4 text-xs sm:h-[42px] sm:px-6">
        {inspection ? (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col justify-center gap-0.5 sm:flex-row sm:items-center sm:gap-3.5">
              <div className="flex items-center gap-2.5 whitespace-nowrap text-ink sm:gap-3.5">
                <span className="font-semibold">
                  {inspection.day.shortDateLabel}
                </span>
                <span className="tabular-nums font-medium">
                  {formatMinuteOfDay(inspection.slot.minuteOfDay)}
                  <span className="hidden sm:inline">
                    {" "}
                    {inspection.day.timezoneShort}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2.5 whitespace-nowrap sm:gap-3.5">
                <span className="inline-flex items-center gap-1.5 font-semibold text-teal-deep">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-ink/15"
                    style={{
                      backgroundColor: scoreToCssColor(inspection.slot.score),
                    }}
                  />
                  <span className="tabular-nums">
                    Score {scoreToPoints(inspection.slot.score)}
                  </span>
                  <span className="font-medium text-ink-secondary">
                    ({tierLabel(classifyScore(inspection.slot.score))})
                  </span>
                </span>
                <span className="tabular-nums text-ink-secondary">
                  {formatHeightFt(inspection.slot.heightFt)}
                </span>
                <span className="truncate text-ink-muted">
                  {daylightStatusLabel(inspection.slot.sunScore)}
                </span>
              </div>
            </div>

            {inspection.pinned && (
              <button
                type="button"
                onClick={() => setInspection(null)}
                aria-label="Clear inspected time"
                className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-mist-deep hover:text-ink"
              >
                <svg
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col justify-center gap-1 text-ink-secondary sm:flex-row sm:items-center sm:gap-5">
            <div className="flex items-center gap-4 whitespace-nowrap sm:gap-5">
              <div className="flex items-center gap-2">
                <span className="text-ink-muted">Poor</span>
                <span
                  aria-hidden="true"
                  className="h-2.5 w-20 rounded-full ring-1 ring-inset ring-ink/10 sm:w-24"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right in oklab, var(--color-score-low) 0%, var(--color-score-fair) 30%, var(--color-score-good) 65%, var(--color-score-high) 100%)",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <span className="font-medium text-teal-deep">Prime</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block w-4 border-t-[1.5px] border-dashed border-sun"
                />
                <span className="text-ink-muted">Sunrise &amp; sunset</span>
              </div>
            </div>

            <div className="flex items-center gap-4 whitespace-nowrap sm:gap-5">
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-teal-solid ring-1 ring-ink/15 dark:border-[#e6eeed]"
                />
                <span className="text-ink-muted">Peak</span>
              </div>

              {currentCondition && (
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block h-[2px] w-3.5 bg-sun"
                  />
                  <span className="text-ink-muted">Now</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable 14-Day Matrix (full width on lg+, sticky left time axis on mobile) */}
      <div className="relative px-2 pt-3 pb-3 sm:px-5 sm:pt-4 sm:pb-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-3 right-2 bottom-4 z-30 w-6 bg-gradient-to-l from-paper to-transparent lg:hidden"
        />
        <div
          className={`tide-scroll pb-1 ${
            isTouchScrubbing ? "overflow-x-hidden" : "overflow-x-auto"
          }`}
        >
          <div className="flex min-w-[688px] lg:min-w-0">
            {/* Sticky Left Time Axis */}
            <div className="sticky left-0 z-20 flex w-11 shrink-0 flex-col bg-paper pr-2 sm:w-12">
              <div className="flex h-12 items-end justify-end pb-1.5">
                <span className="text-[11px] font-medium text-ink-muted">
                  {timezoneAxisLabel}
                </span>
              </div>

              <div className="relative my-1.5 h-[244px] sm:h-[268px]">
                {hourTicks.map((tick) => (
                  <span
                    key={tick.hour}
                    style={{ top: `${tick.pct}%` }}
                    className="tabular-nums absolute right-0 -translate-y-1/2 text-[11px] font-medium text-ink-muted"
                  >
                    {tick.label}
                  </span>
                ))}
              </div>

              <div className="flex h-9 items-center justify-end">
                <span
                  title="Peak tide pooling score of the day (0–100)"
                  className="text-[11px] font-medium text-ink-muted"
                >
                  Peak
                </span>
              </div>
            </div>

            {/* 14-Column Grid */}
            <div className="relative flex-1 pr-2 pl-1.5 lg:pr-1">
              {/* Top Day Headers */}
              <div
                className="grid gap-1.5 sm:gap-2"
                style={{
                  gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                }}
              >
                {days.map((day, idx) => {
                  const isSelected = day.dateKey === selectedDateKey;
                  const isToday = currentCondition?.dateKey === day.dateKey;
                  const peakPts = scoreToPoints(day.peakScore);

                  return (
                    <button
                      key={day.dateKey}
                      ref={(el) => {
                        headerRefs.current[idx] = el;
                      }}
                      type="button"
                      onClick={() => {
                        onSelectDay(day.dateKey);
                        if (inspection?.day.dateKey !== day.dateKey) {
                          setInspection(null);
                        }
                      }}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      aria-pressed={isSelected}
                      aria-label={`${day.fullDateLabel}, peak score ${peakPts} out of 100 (${tierLabel(day.tier)})${
                        day.bestWindow
                          ? `, best window ${formatMinuteOfDay(day.bestWindow.startMinute)} to ${formatMinuteOfDay(day.bestWindow.endMinute)}`
                          : ""
                      }`}
                      className={`group flex h-12 cursor-pointer flex-col items-center justify-center rounded-lg px-0.5 transition-colors ${
                        isSelected
                          ? "bg-teal-solid text-white"
                          : day.isWeekend
                            ? "bg-mist text-ink hover:bg-mist-deep"
                            : "text-ink hover:bg-mist"
                      }`}
                    >
                      <span
                        className={`text-[11px] leading-none font-medium ${
                          isSelected
                            ? "text-white/80"
                            : day.isWeekend
                              ? "text-teal-deep"
                              : "text-ink-muted"
                        }`}
                      >
                        {day.weekdayShort}
                      </span>
                      <span className="tabular-nums mt-1 text-sm leading-none font-semibold">
                        {day.dayNumber}
                      </span>
                      {isToday && (
                        <span
                          aria-label="Today"
                          className={`mt-1 h-1 w-1 rounded-full ${
                            isSelected ? "bg-amber-300" : "bg-sun"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Vertical Score Bars + Shared Guide & Daylight Curve Overlay */}
              <div
                ref={barsAreaRef}
                className={`relative mt-1.5 h-[244px] select-none sm:h-[268px] ${
                  isTouchScrubbing ? "touch-none" : ""
                }`}
                onPointerMove={handleMousePointerMove}
                onPointerLeave={(e) => {
                  if (e.pointerType === "mouse") {
                    setInspection((prev) => (prev?.pinned ? prev : null));
                  }
                }}
              >
                {/* Horizontal Clock Gridlines */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-10"
                >
                  {hourTicks.map((tick) => (
                    <div
                      key={tick.hour}
                      style={{ top: `${tick.pct}%` }}
                      className="absolute right-0 left-0 border-t border-ink/[0.07] dark:border-ink/[0.11]"
                    />
                  ))}
                </div>

                {/* 14 Vertical Score Columns */}
                <div
                  className="grid h-full gap-1.5 sm:gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                  }}
                >
                  {days.map((day, idx) => {
                    const isSelected = day.dateKey === selectedDateKey;
                    const background = buildScoreGradient(
                      day.scores,
                      startMinute,
                      endMinute,
                      "to bottom",
                      false,
                    );

                    const sunrisePct =
                      day.sunriseMinute !== null
                        ? Math.max(
                            0,
                            Math.min(
                              100,
                              ((day.sunriseMinute - startMinute) / minuteSpan) *
                                100,
                            ),
                          )
                        : null;
                    const sunsetPct =
                      day.sunsetMinute !== null
                        ? Math.max(
                            0,
                            Math.min(
                              100,
                              ((day.sunsetMinute - startMinute) / minuteSpan) *
                                100,
                            ),
                          )
                        : null;

                    const peakPct =
                      day.bestWindow !== null
                        ? ((day.bestWindow.peakMinute - startMinute) /
                            minuteSpan) *
                          100
                        : null;

                    const showNowLine =
                      currentCondition?.dateKey === day.dateKey &&
                      currentCondition.minuteOfDay >= startMinute &&
                      currentCondition.minuteOfDay <= endMinute;
                    const nowPct = showNowLine
                      ? ((currentCondition.minuteOfDay - startMinute) /
                          minuteSpan) *
                        100
                      : null;

                    const isInspectedColumn =
                      inspection?.day.dateKey === day.dateKey;

                    return (
                      <div
                        key={day.dateKey}
                        ref={(el) => {
                          barRefs.current[idx] = el;
                        }}
                        data-day-key={day.dateKey}
                        role="button"
                        tabIndex={-1}
                        aria-label={`Inspect ${day.fullDateLabel}`}
                        onClick={(e) => handleMouseClick(e, day)}
                        className={`relative h-full cursor-pointer overflow-hidden rounded-xl ${
                          isSelected
                            ? "ring-2 ring-teal-deep ring-offset-2 ring-offset-paper dark:ring-teal-deep/75"
                            : "ring-1 ring-ink/[0.06] hover:ring-ink/25 dark:ring-ink/[0.08] dark:hover:ring-ink/30"
                        }`}
                        style={{ background }}
                      >
                        {/* Pre-sunrise dusk shade */}
                        {sunrisePct !== null && sunrisePct > 0 && (
                          <div
                            aria-hidden="true"
                            style={{ height: `${sunrisePct}%` }}
                            className="pointer-events-none absolute top-0 right-0 left-0 bg-dusk-shade"
                          />
                        )}

                        {/* Post-sunset dusk shade */}
                        {sunsetPct !== null && sunsetPct < 100 && (
                          <div
                            aria-hidden="true"
                            style={{ top: `${sunsetPct}%` }}
                            className="pointer-events-none absolute right-0 bottom-0 left-0 bg-dusk-shade"
                          />
                        )}

                        {/* Peak score marker */}
                        {peakPct !== null && peakPct >= 2 && peakPct <= 98 && (
                          <div
                            aria-hidden="true"
                            style={{ top: `${peakPct}%` }}
                            className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                          >
                            <span
                              className={`block rounded-full border-[1.5px] border-white shadow-[0_1px_2px_rgba(13,32,38,0.35)] dark:border-[#e6eeed] dark:shadow-[0_1px_3px_rgba(0,0,0,0.55)] ${
                                day.bestWindow?.tier === "prime"
                                  ? "h-2.5 w-2.5 bg-teal-solid"
                                  : "h-2 w-2 bg-teal-mid"
                              }`}
                            />
                          </div>
                        )}

                        {/* Live "Now" reference line */}
                        {nowPct !== null && (
                          <div
                            aria-hidden="true"
                            style={{ top: `${nowPct}%` }}
                            className="pointer-events-none absolute right-0 left-0 z-20 flex items-center"
                          >
                            <span className="h-[2px] w-full bg-sun" />
                          </div>
                        )}

                        {/* Clean horizontal hairline cursor on inspect */}
                        {isInspectedColumn && inspection && (
                          <div
                            aria-hidden="true"
                            style={{ top: `${inspection.yPercent}%` }}
                            className="pointer-events-none absolute right-0 left-0 z-30 border-t-[1.5px] border-ink/75"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Continuous Sunrise & Sunset Horizon Curves */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
                >
                  {horizonCurves.sunrisePath && (
                    <path
                      d={horizonCurves.sunrisePath}
                      fill="none"
                      stroke="var(--color-sun)"
                      strokeOpacity="0.7"
                      strokeWidth="1.25"
                      strokeDasharray="3 3"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {horizonCurves.sunsetPath && (
                    <path
                      d={horizonCurves.sunsetPath}
                      fill="none"
                      stroke="var(--color-sun)"
                      strokeOpacity="0.7"
                      strokeWidth="1.25"
                      strokeDasharray="3 3"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>
              </div>

              {/* Bottom Peak Score Circles colored directly by the Poor -> Prime gradient */}
              <div
                className="mt-1.5 grid gap-1.5 sm:gap-2"
                style={{
                  gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                }}
              >
                {days.map((day) => {
                  const scorePts = scoreToPoints(day.peakScore);
                  const scoreLabel = formatScorePoints(day.peakScore);
                  const circleBg = scoreToCssColor(day.peakScore);

                  return (
                    <div
                      key={day.dateKey}
                      className="flex h-9 items-center justify-center"
                    >
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => onSelectDay(day.dateKey)}
                        title={`${day.shortDateLabel}: peak score ${scorePts} (${tierLabel(day.tier)})`}
                        style={{ backgroundColor: circleBg }}
                        className={`tabular-nums flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-xs ring-1 ring-inset ring-ink/[0.08] transition-transform hover:scale-105 ${
                          day.peakScore >= 0.76
                            ? "font-semibold text-white dark:text-[#081515]"
                            : day.peakScore >= 0.45
                              ? "font-semibold text-white"
                              : scorePts >= 20
                                ? "font-semibold text-ink"
                                : scorePts > 0
                                  ? "font-medium text-ink-secondary"
                                  : "font-normal text-ink-muted"
                        }`}
                      >
                        {scoreLabel}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
