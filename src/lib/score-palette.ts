import { createCssColorScale } from "#/lib/color-scale";
import type { ScoreSlot } from "#/lib/tide-analysis";

export const scoreToCssColor = createCssColorScale([
  [0, "var(--color-score-low)"],
  [0.24, "var(--color-score-fair)"],
  [0.54, "var(--color-score-good)"],
  [0.86, "var(--color-score-high)"],
]);

/**
 * Builds an oklab CSS linear-gradient representing tide-pooling scores across
 * `[startMinute, endMinute]`, collapsing interior flat spans to keep CSS light.
 * When `useElapsed` is false (wall-clock mode), duplicate minutes on Fall Back
 * DST days are deduplicated by max score so stops stay strictly ordered.
 */
export function buildScoreGradient(
  scores: ScoreSlot[],
  startMinute: number,
  endMinute: number,
  direction: "to bottom" | "to right",
  useElapsed = false,
): string {
  const span = endMinute - startMinute;
  if (scores.length === 0 || span <= 0) {
    return "var(--color-score-low)";
  }

  const getPos = (slot: ScoreSlot) =>
    useElapsed ? slot.elapsedMinutes : slot.minuteOfDay;

  let ordered: ScoreSlot[];
  if (useElapsed) {
    ordered = scores.filter(
      (s) => getPos(s) >= startMinute - 15 && getPos(s) <= endMinute + 15,
    );
  } else {
    const deduped = new Map<number, ScoreSlot>();
    for (const s of scores) {
      const pos = s.minuteOfDay;
      if (pos < startMinute - 15 || pos > endMinute + 15) continue;
      const existing = deduped.get(pos);
      if (!existing || s.score > existing.score) {
        deduped.set(pos, s);
      }
    }
    ordered = [...deduped.values()].sort(
      (a, b) => a.minuteOfDay - b.minuteOfDay,
    );
  }

  if (ordered.length === 0) {
    return "var(--color-score-low)";
  }

  const rawStops = ordered.map((slot) => {
    const pct = Math.max(
      0,
      Math.min(100, ((getPos(slot) - startMinute) / span) * 100),
    );
    return {
      color: scoreToCssColor(slot.score),
      percent: pct.toFixed(2),
    };
  });

  if (rawStops.every((stop) => stop.color === rawStops[0].color)) {
    return rawStops[0].color;
  }

  const collapsed = rawStops.filter(
    (stop, i) =>
      i === 0 ||
      i === rawStops.length - 1 ||
      rawStops[i - 1].color !== stop.color ||
      rawStops[i + 1].color !== stop.color,
  );

  const cssStops = collapsed.map((stop) => `${stop.color} ${stop.percent}%`);
  return `linear-gradient(${direction} in oklab, ${cssStops.join(", ")})`;
}
