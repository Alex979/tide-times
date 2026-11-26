import {
  formatMinuteOfDay,
  type PoolingWindow,
  type QualityTier,
  type ScoreSlot,
} from "#/lib/tide-analysis";

export type ScrubState = {
  slot: ScoreSlot;
  pinned: boolean;
};

export type ChartLayout = {
  isCompact: boolean;
  vbW: number;
  vbH: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  plotW: number;
  plotH: number;
};

export type CurvePoint = {
  x: number;
  y: number;
  slot: ScoreSlot;
};

export type PoolingSegment = {
  line: string;
  tier: Exclude<QualityTier, "poor">;
};

export type XAxisTick = {
  key: string;
  label: string;
  pct: number;
  align: "left" | "center" | "right";
};

const TARGET_TICK_HOURS = [0, 6, 12, 18] as const;

export function computeChartLayout(chartWidth: number): ChartLayout {
  const isCompact = chartWidth < 480;
  const vbW = chartWidth;
  const vbH = isCompact ? 228 : 238;
  const padL = isCompact ? 38 : 42;
  const padR = isCompact ? 12 : 16;
  const padT = 36;
  const padB = 10;
  const plotW = Math.max(120, vbW - padL - padR);
  const plotH = vbH - padT - padB;

  return { isCompact, vbW, vbH, padL, padR, padT, padB, plotW, plotH };
}

export function computeYAxisBounds(
  globalMinHeight: number,
  globalMaxHeight: number,
): { minFt: number; maxFt: number; yTicks: number[] } {
  const lowBound = Math.floor(Math.min(globalMinHeight, -0.5) - 0.6);
  const highBound = Math.ceil(Math.max(globalMaxHeight, 4.5) + 0.8);
  const span = highBound - lowBound;
  const step = span > 8 ? 2 : 1;

  const ticks: number[] = [];
  const firstTick = Math.ceil(lowBound / step) * step;
  for (let v = firstTick; v <= highBound; v += step) {
    ticks.push(v);
  }
  if (!ticks.includes(0) && lowBound < 0 && highBound > 0) {
    ticks.push(0);
    ticks.sort((a, b) => a - b);
  }

  return { minFt: lowBound, maxFt: highBound, yTicks: ticks };
}

/**
 * Derives highlighted curve segments directly from `day.windows` so the curve
 * highlight boundaries align cleanly with shaded window bands (`startElapsed`
 * through `endElapsed`) without duplicating threshold scanning.
 */
export function buildPoolingSegments(
  pts: CurvePoint[],
  windows: PoolingWindow[],
): PoolingSegment[] {
  if (pts.length === 0 || windows.length === 0) return [];

  const segments: PoolingSegment[] = [];

  for (const win of windows) {
    const segPts: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const elapsed = curr.slot.elapsedMinutes;

      if (elapsed >= win.startElapsed && elapsed <= win.endElapsed) {
        if (segPts.length === 0 && i > 0) {
          const prev = pts[i - 1];
          if (
            prev.slot.elapsedMinutes < win.startElapsed &&
            elapsed > win.startElapsed
          ) {
            const t =
              (win.startElapsed - prev.slot.elapsedMinutes) /
              (elapsed - prev.slot.elapsedMinutes);
            segPts.push({
              x: prev.x + t * (curr.x - prev.x),
              y: prev.y + t * (curr.y - prev.y),
            });
          }
        }
        segPts.push({ x: curr.x, y: curr.y });
      } else if (elapsed > win.endElapsed) {
        if (segPts.length > 0 && i > 0) {
          const prev = pts[i - 1];
          if (prev.slot.elapsedMinutes < win.endElapsed) {
            const t =
              (win.endElapsed - prev.slot.elapsedMinutes) /
              (elapsed - prev.slot.elapsedMinutes);
            segPts.push({
              x: prev.x + t * (curr.x - prev.x),
              y: prev.y + t * (curr.y - prev.y),
            });
          }
        }
        break;
      }
    }

    if (segPts.length >= 2) {
      const line = segPts
        .map(
          (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
        )
        .join(" ");
      segments.push({ line, tier: win.tier });
    }
  }

  return segments;
}

/**
 * Computes wall-clock x-axis ticks positioned by actual elapsed-minute
 * percentage so 23h Spring Forward and 25h Fall Back DST days align accurately.
 */
export function buildXAxisTicks(
  scores: ScoreSlot[],
  dayDuration: number,
): XAxisTick[] {
  const safeDuration = Math.max(1, dayDuration);

  const ticks: XAxisTick[] = TARGET_TICK_HOURS.map((hour) => {
    const targetMinute = hour * 60;
    const matchedSlot = scores.find((s) => s.minuteOfDay === targetMinute);
    const elapsed =
      hour === 0
        ? (matchedSlot?.elapsedMinutes ?? 0)
        : (matchedSlot?.elapsedMinutes ?? targetMinute);
    const pct = Math.max(0, Math.min(100, (elapsed / safeDuration) * 100));

    return {
      key: `h-${hour}`,
      label:
        hour === 0 ? "12a" : formatMinuteOfDay(targetMinute, { compact: true }),
      pct,
      align: hour === 0 ? "left" : "center",
    };
  });

  ticks.push({
    key: "h-24",
    label: "12a",
    pct: 100,
    align: "right",
  });

  return ticks;
}
