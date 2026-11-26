import {
  buildPoolingSegments,
  buildXAxisTicks,
  computeChartLayout,
  computeYAxisBounds,
  type ScrubState,
} from "#/components/location/dayChartUtils";
import { buildScoreGradient, scoreToCssColor } from "#/lib/score-palette";
import {
  classifyScore,
  daylightStatusLabel,
  formatHeightFt,
  formatMinuteOfDay,
  scoreToPoints,
  tierLabel,
  type CurrentCondition,
  type DayAnalysis,
  type ScoreSlot,
} from "#/lib/tide-analysis";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type TideCurvePlotProps = {
  day: DayAnalysis;
  globalMinHeight: number;
  globalMaxHeight: number;
  currentCondition: CurrentCondition | null;
  isToday: boolean;
  scrub: ScrubState | null;
  onScrub: (slot: ScoreSlot, pinned: boolean) => void;
  onClearScrub: () => void;
  onMouseLeavePlot: () => void;
};

export function TideCurvePlot({
  day,
  globalMinHeight,
  globalMaxHeight,
  currentCondition,
  isToday,
  scrub,
  onScrub,
  onClearScrub,
  onMouseLeavePlot,
}: TideCurvePlotProps) {
  const [chartWidth, setChartWidth] = useState<number>(600);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const waterFillId = useId();

  // Measure actual CSS pixel width so SVG text renders at true 1:1 CSS pixels on mobile & desktop
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;

    const update = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 100) setChartWidth(w);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { vbW, vbH, padL, padR, padT, plotW, plotH } =
    computeChartLayout(chartWidth);
  const dayDuration = Math.max(1, day.dayDurationMinutes);

  const { minFt, maxFt, yTicks } = useMemo(
    () => computeYAxisBounds(globalMinHeight, globalMaxHeight),
    [globalMinHeight, globalMaxHeight],
  );

  // Monotonic elapsed-minute mapping keeps curves strictly left-to-right even on 25h Fall Back DST days
  const xForElapsed = (elapsed: number) =>
    padL + (Math.max(0, Math.min(dayDuration, elapsed)) / dayDuration) * plotW;

  const yForHeight = (ft: number) =>
    padT + ((maxFt - ft) / (maxFt - minFt)) * plotH;

  const { curvePath, areaPath, poolingSegments } = useMemo(() => {
    if (day.scores.length === 0) {
      return { curvePath: "", areaPath: "", poolingSegments: [] };
    }

    const pts = day.scores.map((s) => ({
      x:
        padL +
        (Math.max(0, Math.min(dayDuration, s.elapsedMinutes)) / dayDuration) *
          plotW,
      y: padT + ((maxFt - s.heightFt) / (maxFt - minFt)) * plotH,
      slot: s,
    }));

    const line = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");

    const bottomY = padT + plotH;
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${bottomY} L${pts[0].x.toFixed(1)},${bottomY} Z`;
    const segments = buildPoolingSegments(pts, day.windows);

    return { curvePath: line, areaPath: area, poolingSegments: segments };
  }, [
    day.scores,
    day.windows,
    dayDuration,
    minFt,
    maxFt,
    padL,
    plotW,
    padT,
    plotH,
  ]);

  const horizontalScoreBg = useMemo(
    () => buildScoreGradient(day.scores, 0, dayDuration, "to right", true),
    [day.scores, dayDuration],
  );

  const xTicks = useMemo(
    () => buildXAxisTicks(day.scores, dayDuration),
    [day.scores, dayDuration],
  );

  const inspectAtElapsedRatio = (relX: number, pinned: boolean) => {
    if (day.scores.length === 0) return;
    const targetElapsed = Math.max(0, Math.min(1, relX)) * dayDuration;

    let nearest = day.scores[0];
    let bestDiff = Infinity;
    for (const slot of day.scores) {
      const diff = Math.abs(slot.elapsedMinutes - targetElapsed);
      if (diff < bestDiff) {
        bestDiff = diff;
        nearest = slot;
      }
    }
    onScrub(nearest, pinned);
  };

  const handleSvgPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return;
    const viewX = ((e.clientX - rect.left) / rect.width) * vbW;
    inspectAtElapsedRatio((viewX - padL) / plotW, e.pointerType !== "mouse");
  };

  const handleScoreBarPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    inspectAtElapsedRatio(
      (e.clientX - rect.left) / rect.width,
      e.pointerType !== "mouse",
    );
  };

  const scrubSlot = scrub?.slot ?? null;
  const nowX =
    isToday && currentCondition
      ? xForElapsed(currentCondition.elapsedMinutes)
      : null;
  const nowY =
    isToday && currentCondition ? yForHeight(currentCondition.heightFt) : null;
  const nowPct =
    isToday && currentCondition
      ? Math.max(
          0,
          Math.min(100, (currentCondition.elapsedMinutes / dayDuration) * 100),
        )
      : null;

  const dawnX =
    day.civilDawnElapsed !== null ? xForElapsed(day.civilDawnElapsed) : null;
  const sunriseX =
    day.sunriseElapsed !== null ? xForElapsed(day.sunriseElapsed) : null;
  const sunsetX =
    day.sunsetElapsed !== null ? xForElapsed(day.sunsetElapsed) : null;
  const duskX =
    day.civilDuskElapsed !== null ? xForElapsed(day.civilDuskElapsed) : null;

  const scrubPct = scrubSlot
    ? Math.max(0, Math.min(100, (scrubSlot.elapsedMinutes / dayDuration) * 100))
    : null;

  return (
    <>
      {/* Fixed-height Chart Key / Live Scrub Readout Strip (zero layout shift while scrubbing) */}
      <div className="flex h-10 items-center justify-between gap-2 overflow-hidden bg-mist/45 px-4 text-xs sm:px-6">
        {scrubSlot ? (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 whitespace-nowrap sm:gap-3.5">
              <span className="tabular-nums font-semibold text-ink">
                {formatMinuteOfDay(scrubSlot.minuteOfDay)}
                <span className="hidden sm:inline"> {day.timezoneShort}</span>
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-teal-deep sm:gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-ink/15"
                  style={{ backgroundColor: scoreToCssColor(scrubSlot.score) }}
                />
                <span className="tabular-nums">
                  <span className="hidden sm:inline">Score </span>
                  {scoreToPoints(scrubSlot.score)}
                </span>
                <span className="font-medium text-ink-secondary">
                  ({tierLabel(classifyScore(scrubSlot.score))})
                </span>
              </span>
              <span className="tabular-nums text-ink-secondary">
                {formatHeightFt(scrubSlot.heightFt)}
              </span>
              <span className="truncate text-ink-muted">
                {daylightStatusLabel(scrubSlot.sunScore)}
              </span>
            </div>

            {scrub?.pinned && (
              <button
                type="button"
                onClick={onClearScrub}
                aria-label="Reset inspected time"
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
          <div className="flex items-center gap-4 whitespace-nowrap text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs border border-line bg-chart-day" />
              Daylight
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-sun-soft ring-1 ring-sun/30" />
              Twilight
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-chart-night ring-1 ring-inset ring-ink/15" />
              Night
            </span>
          </div>
        )}
      </div>

      {/* Interactive 24-Hour Tide Curve + Shaded Score Bands + Synced Score Bar */}
      <div
        className="px-3 pt-2.5 pb-3 sm:px-5"
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") {
            onMouseLeavePlot();
          }
        }}
      >
        <div ref={chartContainerRef} className="w-full">
          <svg
            ref={svgRef}
            width="100%"
            height={vbH}
            viewBox={`0 0 ${vbW} ${vbH}`}
            role="img"
            aria-label={`24-hour tide height and pooling score chart for ${day.fullDateLabel}`}
            onPointerMove={handleSvgPointer}
            onPointerDown={handleSvgPointer}
            className="block w-full select-none touch-pan-y cursor-crosshair overflow-visible"
          >
            <defs>
              <linearGradient id={waterFillId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-chart-curve)"
                  stopOpacity="0.14"
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-chart-curve)"
                  stopOpacity="0.01"
                />
              </linearGradient>
            </defs>

            {/* Daylight base + Night & Twilight Shading Bands */}
            <rect
              x={padL}
              y={padT}
              width={plotW}
              height={plotH}
              fill="var(--color-chart-day)"
            />
            {dawnX !== null && (
              <rect
                x={padL}
                y={padT}
                width={Math.max(0, dawnX - padL)}
                height={plotH}
                fill="var(--color-chart-night)"
                fillOpacity="0.88"
              />
            )}
            {dawnX !== null && sunriseX !== null && sunriseX > dawnX && (
              <rect
                x={dawnX}
                y={padT}
                width={sunriseX - dawnX}
                height={plotH}
                fill="var(--color-sun-soft)"
                fillOpacity="0.85"
              />
            )}
            {sunsetX !== null && duskX !== null && duskX > sunsetX && (
              <rect
                x={sunsetX}
                y={padT}
                width={duskX - sunsetX}
                height={plotH}
                fill="var(--color-sun-soft)"
                fillOpacity="0.85"
              />
            )}
            {duskX !== null && (
              <rect
                x={duskX}
                y={padT}
                width={Math.max(0, padL + plotW - duskX)}
                height={plotH}
                fill="var(--color-chart-night)"
                fillOpacity="0.88"
              />
            )}

            {/* Shaded Pooling Window Columns + Top Bracket Pills */}
            {day.windows.map((win, idx) => {
              const x1 = xForElapsed(win.startElapsed);
              const x2 = xForElapsed(win.endElapsed);
              const bandW = Math.max(4, x2 - x1);
              const midX = x1 + bandW / 2;
              const isPrime = win.tier === "prime";
              const isGood = win.tier === "good";

              const bandColor = isPrime
                ? "var(--color-score-high)"
                : isGood
                  ? "var(--color-score-good)"
                  : "var(--color-teal-fair)";
              const fillOpacity = isPrime ? 0.14 : isGood ? 0.12 : 0.14;

              const labelText = `${tierLabel(win.tier)} ${scoreToPoints(win.peakScore)}`;
              const pillW = Math.max(66, labelText.length * 6.8 + 14);
              const pillH = 20;
              const pillX = Math.max(
                padL,
                Math.min(padL + plotW - pillW, midX - pillW / 2),
              );
              const pillY = 6;

              return (
                <g key={`win-${idx}`}>
                  <rect
                    x={x1}
                    y={padT}
                    width={bandW}
                    height={plotH}
                    fill={bandColor}
                    fillOpacity={fillOpacity}
                  />
                  <line
                    x1={x1}
                    x2={x1}
                    y1={padT}
                    y2={padT + plotH}
                    stroke={bandColor}
                    strokeOpacity={0.5}
                    strokeWidth={1}
                    strokeDasharray="3 2"
                  />
                  <line
                    x1={x2}
                    x2={x2}
                    y1={padT}
                    y2={padT + plotH}
                    stroke={bandColor}
                    strokeOpacity={0.5}
                    strokeWidth={1}
                    strokeDasharray="3 2"
                  />
                  <rect
                    x={x1}
                    y={padT - 3}
                    width={bandW}
                    height={3.5}
                    rx={1.5}
                    fill={bandColor}
                  />
                  <rect
                    x={pillX}
                    y={pillY}
                    width={pillW}
                    height={pillH}
                    rx={10}
                    fill={
                      isPrime
                        ? "var(--color-teal-solid)"
                        : isGood
                          ? "var(--color-teal-soft)"
                          : "var(--color-mist-deep)"
                    }
                    stroke={isPrime ? "none" : bandColor}
                    strokeOpacity={0.35}
                    strokeWidth={1}
                  />
                  <text
                    x={pillX + pillW / 2}
                    y={pillY + 13.5}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    className="tabular-nums"
                    fill={isPrime ? "#ffffff" : "var(--color-teal-deep)"}
                  >
                    {labelText}
                  </text>
                </g>
              );
            })}

            {/* Horizontal Elevation Gridlines */}
            {yTicks.map((ft) => {
              const y = yForHeight(ft);
              const isZero = ft === 0;
              return (
                <g key={ft}>
                  <line
                    x1={padL}
                    x2={padL + plotW}
                    y1={y}
                    y2={y}
                    stroke={
                      isZero ? "var(--color-teal-deep)" : "var(--color-line)"
                    }
                    strokeOpacity={isZero ? 0.45 : 0.7}
                    strokeWidth={isZero ? 1.1 : 0.85}
                    strokeDasharray={isZero ? "4 3" : undefined}
                  />
                  <text
                    x={padL - 7}
                    y={y + 4}
                    textAnchor="end"
                    fontSize={11.5}
                    fontWeight={isZero ? 600 : 500}
                    className="tabular-nums"
                    fill={
                      isZero
                        ? "var(--color-teal-deep)"
                        : "var(--color-ink-muted)"
                    }
                  >
                    {ft === 0 ? "0'" : `${ft}'`}
                  </text>
                </g>
              );
            })}

            {/* Sunrise & Sunset Vertical Hairlines */}
            {sunriseX !== null && (
              <line
                x1={sunriseX}
                x2={sunriseX}
                y1={padT}
                y2={padT + plotH}
                stroke="var(--color-sun)"
                strokeOpacity="0.5"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
            )}
            {sunsetX !== null && (
              <line
                x1={sunsetX}
                x2={sunsetX}
                y1={padT}
                y2={padT + plotH}
                stroke="var(--color-sun)"
                strokeOpacity="0.5"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
            )}

            {/* Base Water Area & Tide Curve */}
            {areaPath && <path d={areaPath} fill={`url(#${waterFillId})`} />}
            {curvePath && (
              <path
                d={curvePath}
                fill="none"
                stroke="var(--color-chart-curve)"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {poolingSegments.map((seg, idx) => (
              <path
                key={`line-${idx}`}
                d={seg.line}
                fill="none"
                stroke={
                  seg.tier === "prime"
                    ? "var(--color-score-high)"
                    : seg.tier === "good"
                      ? "var(--color-score-good)"
                      : "var(--color-teal-fair)"
                }
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* High & Low Tide Extrema Labels */}
            {day.extrema.map((ext, idx) => {
              const cx = xForElapsed(ext.elapsedMinutes);
              const cy = yForHeight(ext.heightFt);
              const isLow = ext.type === "low";

              const anchor =
                cx < padL + 36
                  ? "start"
                  : cx > padL + plotW - 36
                    ? "end"
                    : "middle";
              const labelY = isLow
                ? Math.min(padT + plotH - 5, cy + 17)
                : Math.max(padT + 14, cy - 10);

              return (
                <g key={`${ext.type}-${idx}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={3.2}
                    fill="var(--color-paper)"
                    stroke="var(--color-chart-curve)"
                    strokeWidth={1.75}
                  />
                  <text
                    x={cx}
                    y={labelY}
                    textAnchor={anchor}
                    fontSize={11.5}
                    fontWeight={600}
                    className="tabular-nums"
                    fill="var(--color-ink-secondary)"
                    stroke={
                      ext.isDaylight
                        ? "var(--color-chart-day)"
                        : "var(--color-chart-night)"
                    }
                    strokeWidth={3.5}
                    strokeLinejoin="round"
                    style={{ paintOrder: "stroke" }}
                  >
                    {formatHeightFt(ext.heightFt, true)}
                  </text>
                </g>
              );
            })}

            {/* Peak Score Marker(s) on Curve */}
            {day.windows.map((win, idx) => {
              const px = xForElapsed(win.peakElapsed);
              const py = yForHeight(win.peakHeightFt);
              return (
                <g key={`peak-${idx}`}>
                  <circle
                    cx={px}
                    cy={py}
                    r={6.5}
                    fill="var(--color-score-high)"
                    fillOpacity={0.22}
                  />
                  <circle
                    cx={px}
                    cy={py}
                    r={4.2}
                    fill={
                      win.tier === "prime"
                        ? "var(--color-score-high)"
                        : "var(--color-score-good)"
                    }
                    stroke="var(--color-paper)"
                    strokeWidth={1.75}
                  />
                </g>
              );
            })}

            {/* Live "Now" Marker */}
            {nowX !== null && nowY !== null && (
              <g>
                <line
                  x1={nowX}
                  x2={nowX}
                  y1={padT}
                  y2={padT + plotH}
                  stroke="var(--color-sun)"
                  strokeWidth="1.5"
                />
                <circle
                  cx={nowX}
                  cy={nowY}
                  r={4.2}
                  fill="var(--color-sun)"
                  stroke="var(--color-paper)"
                  strokeWidth="1.75"
                />
              </g>
            )}

            {/* Active Pointer Scrub Crosshair */}
            {scrubSlot && (
              <g>
                <line
                  x1={xForElapsed(scrubSlot.elapsedMinutes)}
                  x2={xForElapsed(scrubSlot.elapsedMinutes)}
                  y1={padT}
                  y2={padT + plotH}
                  stroke="var(--color-ink)"
                  strokeOpacity="0.55"
                  strokeWidth="1.25"
                  strokeDasharray="3 2"
                />
                <circle
                  cx={xForElapsed(scrubSlot.elapsedMinutes)}
                  cy={yForHeight(scrubSlot.heightFt)}
                  r={5.2}
                  fill="var(--color-teal-deep)"
                  stroke="var(--color-paper)"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* Plot baseline */}
            <line
              x1={padL}
              x2={padL + plotW}
              y1={padT + plotH}
              y2={padT + plotH}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
          </svg>

          {/* Synced Horizontal Score Gradient Bar */}
          <div className="mt-1.5 flex items-center">
            <div
              style={{ width: `${padL}px` }}
              className="shrink-0 pr-2 text-right text-[11px] font-medium text-ink-muted"
            >
              Score
            </div>
            <div
              style={{ marginRight: `${padR}px` }}
              onPointerMove={handleScoreBarPointer}
              onPointerDown={handleScoreBarPointer}
              className="relative h-4 flex-1 cursor-crosshair overflow-hidden rounded-full ring-1 ring-ink/10 touch-pan-y"
              aria-label="Hourly tide pooling score bar"
            >
              <div
                className="h-full w-full"
                style={{ background: horizontalScoreBg }}
              />

              {day.bestWindow && (
                <span
                  aria-hidden="true"
                  style={{
                    left: `${(day.bestWindow.peakElapsed / dayDuration) * 100}%`,
                  }}
                  className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-white bg-teal-solid shadow-xs dark:border-[#e6eeed]"
                />
              )}

              {nowPct !== null && (
                <span
                  aria-hidden="true"
                  style={{ left: `${nowPct}%` }}
                  className="pointer-events-none absolute top-0 bottom-0 w-[2px] -translate-x-1/2 bg-sun"
                />
              )}

              {scrubPct !== null && (
                <span
                  aria-hidden="true"
                  style={{ left: `${scrubPct}%` }}
                  className="pointer-events-none absolute top-0 bottom-0 w-[2px] -translate-x-1/2 bg-ink"
                />
              )}
            </div>
          </div>

          {/* Shared Time-of-Day X-Axis Labels (DST-accurate elapsed-minute positioning) */}
          <div
            style={{ marginLeft: `${padL}px`, marginRight: `${padR}px` }}
            className="relative mt-1.5 h-4 text-[11.5px] leading-4 font-medium text-ink-muted tabular-nums"
          >
            {xTicks.map((tick) => (
              <span
                key={tick.key}
                style={
                  tick.align === "right" ? { right: 0 } : { left: `${tick.pct}%` }
                }
                className={
                  tick.align === "center"
                    ? "absolute top-0 -translate-x-1/2"
                    : "absolute top-0"
                }
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
