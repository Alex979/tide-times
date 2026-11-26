import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildScoreGradient, scoreToCssColor } from "#/lib/score-palette";
import type { ScoreSlot } from "#/lib/tide-analysis";

function makeSlot(
  minuteOfDay: number,
  score: number,
  elapsedMinutes = minuteOfDay,
): ScoreSlot {
  return {
    timestamp: new Date(Date.parse("2026-06-15T07:00:00.000Z") + elapsedMinutes * 60_000),
    heightFt: 1.0,
    tideScore: score,
    sunDeg: 20,
    sunScore: 1,
    score,
    minuteOfDay,
    elapsedMinutes,
  };
}

describe("scoreToCssColor", () => {
  test("maps boundary, clamped, and intermediate scores to theme-aware CSS custom property tokens", () => {
    assert.equal(scoreToCssColor(0), "var(--color-score-low)");
    assert.equal(scoreToCssColor(-0.5), "var(--color-score-low)");
    assert.equal(scoreToCssColor(Number.NaN), "var(--color-score-low)");
    assert.equal(scoreToCssColor(0.24), "var(--color-score-fair)");
    assert.equal(scoreToCssColor(0.54), "var(--color-score-good)");
    assert.equal(scoreToCssColor(0.86), "var(--color-score-high)");
    assert.equal(scoreToCssColor(1), "var(--color-score-high)");
    assert.equal(scoreToCssColor(1.5), "var(--color-score-high)");

    // Midpoint between 0 and 0.24 uses oklab color-mix with theme tokens (adapting cleanly to light/dark CSS variables)
    assert.equal(
      scoreToCssColor(0.12),
      "color-mix(in oklab, var(--color-score-fair) 50.00%, var(--color-score-low))",
    );
    // Midpoint between 0.54 and 0.86 (0.70)
    assert.equal(
      scoreToCssColor(0.7),
      "color-mix(in oklab, var(--color-score-high) 50.00%, var(--color-score-good))",
    );
  });
});

describe("buildScoreGradient", () => {
  test("returns fallback token for empty scores, non-positive span, or out-of-range slices", () => {
    assert.equal(buildScoreGradient([], 0, 1440, "to bottom"), "var(--color-score-low)");

    const slots = [makeSlot(360, 0.8), makeSlot(720, 0.9)];
    assert.equal(buildScoreGradient(slots, 360, 360, "to bottom"), "var(--color-score-low)");
    assert.equal(buildScoreGradient(slots, 720, 360, "to right"), "var(--color-score-low)");

    // All slots outside [startMinute - 15, endMinute + 15]
    assert.equal(buildScoreGradient(slots, 100, 300, "to bottom"), "var(--color-score-low)");
  });

  test("returns a single CSS color token (no linear-gradient) for single-slot or uniform-color slices", () => {
    const single = [makeSlot(360, 0.86)];
    assert.equal(
      buildScoreGradient(single, 300, 420, "to bottom"),
      "var(--color-score-high)",
    );

    // Multiple slots all clamped to high score (>= 0.86) collapse to a single color token
    const allHigh = [
      makeSlot(300, 0.86),
      makeSlot(315, 0.92),
      makeSlot(330, 1.0),
    ];
    assert.equal(
      buildScoreGradient(allHigh, 300, 360, "to right"),
      "var(--color-score-high)",
    );
  });

  test("collapses interior flat spans while preserving transition edge stops and direction", () => {
    const slots = [
      makeSlot(0, 0.0),   // 0.00% low (keep: first)
      makeSlot(15, 0.0),  // 12.50% low (drop: interior flat)
      makeSlot(30, 0.0),  // 25.00% low (drop: interior flat)
      makeSlot(45, 0.0),  // 37.50% low (keep: right neighbor differs)
      makeSlot(60, 0.86), // 50.00% high (keep: left neighbor differs)
      makeSlot(75, 0.86), // 62.50% high (drop: interior flat)
      makeSlot(90, 0.86), // 75.00% high (keep: right neighbor differs)
      makeSlot(105, 0.0), // 87.50% low (keep: left neighbor differs)
      makeSlot(120, 0.0), // 100.00% low (keep: last)
    ];

    const vertical = buildScoreGradient(slots, 0, 120, "to bottom");
    assert.equal(
      vertical,
      [
        "linear-gradient(to bottom in oklab, ",
        "var(--color-score-low) 0.00%, ",
        "var(--color-score-low) 37.50%, ",
        "var(--color-score-high) 50.00%, ",
        "var(--color-score-high) 75.00%, ",
        "var(--color-score-low) 87.50%, ",
        "var(--color-score-low) 100.00%)",
      ].join(""),
    );

    const horizontal = buildScoreGradient(slots, 0, 120, "to right");
    assert.ok(horizontal.startsWith("linear-gradient(to right in oklab, "));
    assert.equal(
      horizontal.replace("to right", "to bottom"),
      vertical,
    );
  });

  test("uses CSS theme variables exclusively so light and dark modes resolve dynamically", () => {
    const slots = [
      makeSlot(0, 0.0),
      makeSlot(60, 0.24),
      makeSlot(120, 0.54),
      makeSlot(180, 0.86),
    ];
    const gradient = buildScoreGradient(slots, 0, 180, "to right");

    // Must rely on theme CSS custom properties (switched by .dark in styles.css) rather than hardcoded hex/rgb values
    assert.ok(gradient.includes("var(--color-score-low)"));
    assert.ok(gradient.includes("var(--color-score-fair)"));
    assert.ok(gradient.includes("var(--color-score-good)"));
    assert.ok(gradient.includes("var(--color-score-high)"));
    assert.equal(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(gradient), false);
  });

  test("clamps boundary buffer slots within ±15m to 0.00% and 100.00% and excludes slots outside buffer", () => {
    const slots = [
      makeSlot(270, 0.86), // 30m before start (300) -> excluded
      makeSlot(285, 0.24), // 15m before start -> included and clamped to 0.00%
      makeSlot(360, 0.54), // midpoint of [300, 420] -> 50.00%
      makeSlot(435, 0.86), // 15m after end (420) -> included and clamped to 100.00%
      makeSlot(450, 0.0),  // 30m after end -> excluded
    ];

    const gradient = buildScoreGradient(slots, 300, 420, "to bottom");
    assert.equal(
      gradient,
      "linear-gradient(to bottom in oklab, var(--color-score-fair) 0.00%, var(--color-score-good) 50.00%, var(--color-score-high) 100.00%)",
    );
  });

  test("deduplicates repeated Fall Back DST wall-clock minutes by max score when useElapsed=false, and preserves both when useElapsed=true", () => {
    // Fall Back repeated 01:00 (minuteOfDay=60): first pass low (0.0), second pass high (0.86)
    const slots = [
      makeSlot(0, 0.0, 0),
      makeSlot(60, 0.0, 60),    // 01:00 PDT
      makeSlot(60, 0.86, 120),  // 01:00 PST (same minuteOfDay, higher score)
      makeSlot(120, 0.0, 180),  // 02:00 PST
    ];

    // Wall-clock mode (useElapsed=false) over [0, 120]: deduplicates minuteOfDay=60 keeping max score (0.86)
    const wallClock = buildScoreGradient(slots, 0, 120, "to bottom", false);
    assert.equal(
      wallClock,
      "linear-gradient(to bottom in oklab, var(--color-score-low) 0.00%, var(--color-score-high) 50.00%, var(--color-score-low) 100.00%)",
    );

    // Elapsed mode (useElapsed=true) over [0, 180]: preserves both 01:00 slots at 33.33% (low) and 66.67% (high)
    const elapsed = buildScoreGradient(slots, 0, 180, "to right", true);
    assert.equal(
      elapsed,
      "linear-gradient(to right in oklab, var(--color-score-low) 0.00%, var(--color-score-low) 33.33%, var(--color-score-high) 66.67%, var(--color-score-low) 100.00%)",
    );
  });
});
