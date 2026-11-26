import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  analyzeTideDays,
  classifyScore,
  findDayExtrema,
  findPoolingWindows,
  formatScorePoints,
  getCurrentCondition,
  getNextGoodWindow,
  getRangeTimezoneDisplay,
  getRankedWindows,
  scoreToPoints,
  type ScoreSlot,
} from "#/lib/tide-analysis";
import type { LocationTideScores } from "#/lib/tide-scores.server";

type RawScore = LocationTideScores["scores"][number];

const LA_TZ = "America/Los_Angeles";

function makeSlot(
  elapsedMinutes: number,
  overrides: Partial<ScoreSlot> = {},
  baseIso = "2026-06-15T07:00:00.000Z",
): ScoreSlot {
  const baseMs = Date.parse(baseIso);
  return {
    timestamp: new Date(baseMs + elapsedMinutes * 60_000),
    heightFt: 2.0,
    tideScore: 0.5,
    sunDeg: 25,
    sunScore: 1,
    score: 0.5,
    minuteOfDay: elapsedMinutes % 1440,
    elapsedMinutes,
    ...overrides,
  };
}

function buildSyntheticRange(
  startIsoUtc: string,
  endIsoUtc: string,
  generator?: (timestamp: Date, index: number) => Partial<RawScore>,
): RawScore[] {
  const startMs = Date.parse(startIsoUtc);
  const endMs = Date.parse(endIsoUtc);
  const scores: RawScore[] = [];

  for (let ms = startMs, i = 0; ms < endMs; ms += 15 * 60_000, i++) {
    const timestamp = new Date(ms);
    const hoursFromStart = (ms - startMs) / 3_600_000;
    const localHourApprox = hoursFromStart % 24;
    // Simple smooth daylight curve crossing 0 deg around 06:00 and 18:00, -6 deg around 05:30 and 18:30
    const sunDeg = Math.sin(((localHourApprox - 6) / 12) * Math.PI) * 50;
    const sunScore =
      sunDeg <= -6 ? 0 : sunDeg >= 0 ? 1 : (sunDeg + 6) / 6;
    // Semidiurnal tide with lows around ~06:00 and ~18:30, highs around ~00:00 and ~12:15
    const heightFt = Number(
      (2.5 + 2.8 * Math.cos((hoursFromStart / 12.4) * 2 * Math.PI)).toFixed(2),
    );
    const tideScore = Math.max(0, Math.min(1, (1.5 - heightFt) / 3.5));
    const score = tideScore * sunScore;

    scores.push({
      timestamp,
      heightFt,
      tideScore,
      sunDeg,
      sunScore,
      score,
      ...generator?.(timestamp, i),
    });
  }

  return scores;
}

describe("classifyScore and scoreToPoints boundary agreement", () => {
  test("matches integer point thresholds at all boundary values", () => {
    const cases: Array<{
      score: number;
      expectedPoints: number;
      expectedTier: ReturnType<typeof classifyScore>;
    }> = [
      { score: 0, expectedPoints: 0, expectedTier: "poor" },
      { score: -0.1, expectedPoints: 0, expectedTier: "poor" },
      { score: 0.274, expectedPoints: 27, expectedTier: "poor" },
      { score: 0.275, expectedPoints: 28, expectedTier: "fair" },
      { score: 0.28, expectedPoints: 28, expectedTier: "fair" },
      { score: 0.474, expectedPoints: 47, expectedTier: "fair" },
      { score: 0.475, expectedPoints: 48, expectedTier: "good" },
      { score: 0.48, expectedPoints: 48, expectedTier: "good" },
      { score: 0.714, expectedPoints: 71, expectedTier: "good" },
      { score: 0.715, expectedPoints: 72, expectedTier: "prime" },
      { score: 0.719, expectedPoints: 72, expectedTier: "prime" },
      { score: 0.72, expectedPoints: 72, expectedTier: "prime" },
      { score: 1, expectedPoints: 100, expectedTier: "prime" },
      { score: 1.25, expectedPoints: 100, expectedTier: "prime" },
    ];

    for (const { score, expectedPoints, expectedTier } of cases) {
      assert.equal(scoreToPoints(score), expectedPoints);
      assert.equal(classifyScore(score), expectedTier);
    }

    assert.equal(formatScorePoints(0), "—");
    assert.equal(formatScorePoints(0.715), "72");
    assert.equal(formatScorePoints(1), "100");
  });

  test("classifyScore never disagrees with scoreToPoints across [0, 1]", () => {
    for (let i = 0; i <= 1000; i++) {
      const score = i / 1000;
      const pts = scoreToPoints(score);
      const tier = classifyScore(score);

      if (pts >= 72) assert.equal(tier, "prime");
      else if (pts >= 48) assert.equal(tier, "good");
      else if (pts >= 28) assert.equal(tier, "fair");
      else assert.equal(tier, "poor");
    }
  });
});

describe("findDayExtrema", () => {
  test("does not emit false extrema on strictly rising or falling plateaus", () => {
    const rising = [1.1, 1.15, 1.15, 1.2].map((h, i) =>
      makeSlot(i * 15, { heightFt: h }),
    );
    assert.deepEqual(findDayExtrema(rising, null, null), []);

    const risingLong = [1.0, 1.15, 1.15, 1.15, 1.3].map((h, i) =>
      makeSlot(i * 15, { heightFt: h }),
    );
    assert.deepEqual(findDayExtrema(risingLong, null, null), []);

    const falling = [1.2, 1.15, 1.15, 1.1].map((h, i) =>
      makeSlot(i * 15, { heightFt: h }),
    );
    assert.deepEqual(findDayExtrema(falling, null, null), []);

    const fallingLong = [1.3, 1.15, 1.15, 1.15, 1.0].map((h, i) =>
      makeSlot(i * 15, { heightFt: h }),
    );
    assert.deepEqual(findDayExtrema(fallingLong, null, null), []);
  });

  test("emits a single extremum at the midpoint for true flat-bottom and flat-top plateaus", () => {
    // Odd-length flat-bottom plateau: indices 1..3 -> midpoint index 2 (elapsed 30)
    const flatBottomOdd = [2.0, 0.5, 0.5, 0.5, 2.0].map((h, i) =>
      makeSlot(i * 15, { heightFt: h, sunScore: 0.9 }),
    );
    const lowsOdd = findDayExtrema(flatBottomOdd, null, null);
    assert.equal(lowsOdd.length, 1);
    assert.equal(lowsOdd[0].type, "low");
    assert.equal(lowsOdd[0].heightFt, 0.5);
    assert.equal(lowsOdd[0].elapsedMinutes, 30);
    assert.equal(lowsOdd[0].isDaylight, true);

    // Even-length flat-bottom plateau: indices 1..2 -> midpoint index 1 (elapsed 15)
    const flatBottomEven = [2.0, 0.5, 0.5, 2.0].map((h, i) =>
      makeSlot(i * 15, { heightFt: h, sunScore: 0.05 }),
    );
    const lowsEven = findDayExtrema(flatBottomEven, null, null);
    assert.equal(lowsEven.length, 1);
    assert.equal(lowsEven[0].type, "low");
    assert.equal(lowsEven[0].elapsedMinutes, 15);
    assert.equal(lowsEven[0].isDaylight, false);

    // Odd-length flat-top plateau: indices 1..3 -> midpoint index 2 (elapsed 30)
    const flatTopOdd = [1.0, 5.2, 5.2, 5.2, 1.0].map((h, i) =>
      makeSlot(i * 15, { heightFt: h }),
    );
    const highsOdd = findDayExtrema(flatTopOdd, null, null);
    assert.equal(highsOdd.length, 1);
    assert.equal(highsOdd[0].type, "high");
    assert.equal(highsOdd[0].heightFt, 5.2);
    assert.equal(highsOdd[0].elapsedMinutes, 30);

    // Even-length flat-top plateau: indices 1..2 -> midpoint index 1 (elapsed 15)
    const flatTopEven = [1.0, 5.2, 5.2, 1.0].map((h, i) =>
      makeSlot(i * 15, { heightFt: h }),
    );
    const highsEven = findDayExtrema(flatTopEven, null, null);
    assert.equal(highsEven.length, 1);
    assert.equal(highsEven[0].type, "high");
    assert.equal(highsEven[0].elapsedMinutes, 15);
  });

  test("handles midnight and day-end boundary checks with prevLast and nextFirst", () => {
    const prevLast = makeSlot(-15, { heightFt: 1.5, minuteOfDay: 1425 });
    const slots = [
      makeSlot(0, { heightFt: 0.8 }),
      makeSlot(180, { heightFt: 2.0 }),
      makeSlot(360, { heightFt: 4.5 }),
      makeSlot(540, { heightFt: 2.2 }),
      makeSlot(1425, { heightFt: 0.4 }),
    ];
    const nextFirst = makeSlot(1440, { heightFt: 1.2, minuteOfDay: 0 });

    // Without boundary neighbors, first and last slots cannot be classified
    const withoutBounds = findDayExtrema(slots, null, null);
    assert.deepEqual(
      withoutBounds.map((e) => [e.type, e.elapsedMinutes]),
      [["high", 360]],
    );

    // With prevLast and nextFirst, midnight low and end-of-day low are detected
    const withBounds = findDayExtrema(slots, prevLast, nextFirst);
    assert.deepEqual(
      withBounds.map((e) => [e.type, e.elapsedMinutes, e.heightFt]),
      [
        ["low", 0, 0.8],
        ["high", 360, 4.5],
        ["low", 1425, 0.4],
      ],
    );

    // Boundary plateau matching prevLast height does not emit a false extremum
    const matchingPrev = makeSlot(-15, { heightFt: 0.8, minuteOfDay: 1425 });
    const boundaryFlat = findDayExtrema(slots, matchingPrev, null);
    assert.deepEqual(
      boundaryFlat.map((e) => [e.type, e.elapsedMinutes]),
      [["high", 360]],
    );
  });

  test("filters sub-90-minute micro-oscillations while preserving well-separated extrema", () => {
    // Noisy trough: low at 0.50 (t=15), tiny high 0.55 (t=30), deeper low 0.35 (t=45)
    const noisyTrough = [2.0, 0.5, 0.55, 0.35, 2.0].map((h, i) =>
      makeSlot(i * 15, { heightFt: h }),
    );
    const filteredTrough = findDayExtrema(noisyTrough, null, null);
    assert.equal(filteredTrough.length, 1);
    assert.equal(filteredTrough[0].type, "low");
    assert.equal(filteredTrough[0].heightFt, 0.35);
    assert.equal(filteredTrough[0].elapsedMinutes, 45);

    // Noisy trough where first dip is deeper: keeps the first deeper low
    const noisyTroughFirstDeeper = [2.0, 0.3, 0.55, 0.45, 2.0].map((h, i) =>
      makeSlot(i * 15, { heightFt: h }),
    );
    const filteredFirst = findDayExtrema(noisyTroughFirstDeeper, null, null);
    assert.equal(filteredFirst.length, 1);
    assert.equal(filteredFirst[0].type, "low");
    assert.equal(filteredFirst[0].heightFt, 0.3);
    assert.equal(filteredFirst[0].elapsedMinutes, 15);

    // Noisy peak: high at 5.0 (t=15), tiny dip 4.95 (t=30), taller high 5.15 (t=45)
    const noisyPeak = [1.0, 5.0, 4.95, 5.15, 1.0].map((h, i) =>
      makeSlot(i * 15, { heightFt: h }),
    );
    const filteredPeak = findDayExtrema(noisyPeak, null, null);
    assert.equal(filteredPeak.length, 1);
    assert.equal(filteredPeak[0].type, "high");
    assert.equal(filteredPeak[0].heightFt, 5.15);
    assert.equal(filteredPeak[0].elapsedMinutes, 45);

    // Extrema separated by >= 90 minutes are all kept
    const wellSeparated = [
      makeSlot(0, { heightFt: 2.5 }),
      makeSlot(60, { heightFt: 0.4 }),
      makeSlot(120, { heightFt: 3.8 }),
      makeSlot(180, { heightFt: 0.6 }),
      makeSlot(240, { heightFt: 3.2 }),
    ];
    const kept = findDayExtrema(wellSeparated, null, null);
    assert.deepEqual(
      kept.map((e) => [e.type, e.elapsedMinutes, e.heightFt]),
      [
        ["low", 60, 0.4],
        ["high", 120, 3.8],
        ["low", 180, 0.6],
      ],
    );
  });
});

describe("findPoolingWindows", () => {
  test("computes exact [first.elapsedMinutes, last.elapsedMinutes + 15] bounds and multiple windows", () => {
    const slots: ScoreSlot[] = [
      makeSlot(300, { score: 0.1, heightFt: 2.5 }),
      makeSlot(315, { score: 0.35, heightFt: 0.9 }),
      makeSlot(330, { score: 0.78, heightFt: -0.4 }),
      makeSlot(345, { score: 0.52, heightFt: 0.1 }),
      makeSlot(360, { score: 0.274, heightFt: 1.6 }), // rounds to 27 -> poor, ends first window
      makeSlot(600, { score: 0.275, heightFt: 1.1 }), // rounds to 28 -> fair, starts second window
      makeSlot(615, { score: 0.5, heightFt: 0.4 }),
      makeSlot(630, { score: 0.1, heightFt: 2.0 }),
    ];

    const windows = findPoolingWindows("2026-06-15", slots, 1440);
    assert.equal(windows.length, 2);

    assert.equal(windows[0].startElapsed, 315);
    assert.equal(windows[0].endElapsed, 360);
    assert.equal(windows[0].startMinute, 315);
    assert.equal(windows[0].endMinute, 360);
    assert.equal(windows[0].durationMinutes, 45);
    assert.equal(windows[0].peakElapsed, 330);
    assert.equal(windows[0].peakScore, 0.78);
    assert.equal(windows[0].minHeightFt, -0.4);
    assert.equal(windows[0].tier, "prime");

    assert.equal(windows[1].startElapsed, 600);
    assert.equal(windows[1].endElapsed, 630);
    assert.equal(windows[1].durationMinutes, 30);
    assert.equal(windows[1].peakScore, 0.5);
    assert.equal(windows[1].tier, "good");
  });

  test("handles single-slot edge windows at day start and day end across DST durations", () => {
    // Start-of-day single slot and end-of-day single slot on 24h day
    const slots24h = [
      makeSlot(0, { score: 0.4, heightFt: 0.6 }),
      makeSlot(15, { score: 0.1, heightFt: 2.0 }),
      makeSlot(1425, { score: 0.6, heightFt: 0.2 }),
    ];
    const win24h = findPoolingWindows("2026-06-15", slots24h, 1440);
    assert.equal(win24h.length, 2);
    assert.equal(win24h[0].startElapsed, 0);
    assert.equal(win24h[0].endElapsed, 15);
    assert.equal(win24h[0].durationMinutes, 15);
    assert.equal(win24h[1].startElapsed, 1425);
    assert.equal(win24h[1].endElapsed, 1440);
    assert.equal(win24h[1].endMinute, 1440);
    assert.equal(win24h[1].durationMinutes, 15);

    // End-of-day slot on 23h Spring Forward day (1380 min)
    const slots23h = [
      makeSlot(1350, { minuteOfDay: 1410, score: 0.55 }),
      makeSlot(1365, { minuteOfDay: 1425, score: 0.75 }),
    ];
    const win23h = findPoolingWindows("2026-03-08", slots23h, 1380);
    assert.equal(win23h.length, 1);
    assert.equal(win23h[0].startElapsed, 1350);
    assert.equal(win23h[0].endElapsed, 1380);
    assert.equal(win23h[0].durationMinutes, 30);

    // End-of-day slot on 25h Fall Back day (1500 min)
    const slots25h = [
      makeSlot(1470, { minuteOfDay: 1410, score: 0.4 }),
      makeSlot(1485, { minuteOfDay: 1425, score: 0.45 }),
    ];
    const win25h = findPoolingWindows("2026-11-01", slots25h, 1500);
    assert.equal(win25h.length, 1);
    assert.equal(win25h[0].startElapsed, 1470);
    assert.equal(win25h[0].endElapsed, 1500);
    assert.equal(win25h[0].durationMinutes, 30);
  });
});

describe("analyzeTideDays across normal, Spring Forward (23h), and Fall Back (25h) DST days", () => {
  test("analyzes a normal 24-hour day accurately", () => {
    const scores = buildSyntheticRange(
      "2026-06-15T07:00:00.000Z", // 2026-06-15 00:00 PDT
      "2026-06-16T07:00:00.000Z", // 2026-06-16 00:00 PDT
    );

    const days = analyzeTideDays(scores, LA_TZ);
    assert.equal(days.length, 1);

    const day = days[0];
    assert.equal(day.dateKey, "2026-06-15");
    assert.equal(day.dayDurationMinutes, 1440);
    assert.equal(day.scores.length, 96);
    assert.equal(day.scores[0].elapsedMinutes, 0);
    assert.equal(day.scores[0].minuteOfDay, 0);
    assert.equal(day.scores[95].elapsedMinutes, 1425);
    assert.equal(day.scores[95].minuteOfDay, 1425);
    assert.equal(day.timezoneShort, "PDT");
    assert.equal(day.isWeekend, false);
    assert.ok(day.sunriseMinute !== null && day.sunsetMinute !== null);
    assert.ok(day.civilDawnMinute !== null && day.civilDuskMinute !== null);
    assert.ok(day.extrema.length >= 2);
    assert.ok(day.windows.length >= 1);
    assert.ok(day.bestWindow !== null);
    assert.equal(day.peakScore, day.bestWindow.peakScore);
    assert.equal(day.tier, classifyScore(day.peakScore));
  });

  test("handles 23-hour Spring Forward DST day (2026-03-08 America/Los_Angeles)", () => {
    // 2026-03-07 00:00 PST (08:00Z) through 2026-03-10 00:00 PDT (07:00Z)
    const scores = buildSyntheticRange(
      "2026-03-07T08:00:00.000Z",
      "2026-03-10T07:00:00.000Z",
    );

    const days = analyzeTideDays(scores, LA_TZ);
    assert.deepEqual(
      days.map((d) => d.dateKey),
      ["2026-03-07", "2026-03-08", "2026-03-09"],
    );

    const springDay = days[1];
    assert.equal(springDay.dayDurationMinutes, 1380);
    assert.equal(springDay.scores.length, 92);
    assert.equal(springDay.isWeekend, true);

    // 01:45 PST (minuteOfDay=105, elapsed=105) jumps directly to 03:00 PDT (minuteOfDay=180, elapsed=120)
    const beforeJump = springDay.scores[7];
    const afterJump = springDay.scores[8];
    assert.equal(beforeJump.minuteOfDay, 105);
    assert.equal(beforeJump.elapsedMinutes, 105);
    assert.equal(afterJump.minuteOfDay, 180);
    assert.equal(afterJump.elapsedMinutes, 120);

    // Final slot is 23:45 wall-clock at elapsed 1365 (22h45m elapsed)
    const last = springDay.scores[springDay.scores.length - 1];
    assert.equal(last.minuteOfDay, 1425);
    assert.equal(last.elapsedMinutes, 1365);

    // Range timezone display spans PST -> PDT
    const tzDisplay = getRangeTimezoneDisplay(LA_TZ, days, new Date("2026-03-08T12:00:00Z"));
    assert.equal(tzDisplay.short, "PST/PDT");
  });

  test("handles 25-hour Fall Back DST day (2026-11-01 America/Los_Angeles)", () => {
    // 2026-10-31 00:00 PDT (07:00Z) through 2026-11-03 00:00 PST (08:00Z)
    const scores = buildSyntheticRange(
      "2026-10-31T07:00:00.000Z",
      "2026-11-03T08:00:00.000Z",
    );

    const days = analyzeTideDays(scores, LA_TZ);
    assert.deepEqual(
      days.map((d) => d.dateKey),
      ["2026-10-31", "2026-11-01", "2026-11-02"],
    );

    const fallDay = days[1];
    assert.equal(fallDay.dayDurationMinutes, 1500);
    assert.equal(fallDay.scores.length, 100);
    assert.equal(fallDay.isWeekend, true);

    // Repeated 01:00..01:45 wall-clock hour is preserved with strictly monotonic elapsedMinutes
    const firstOneAm = fallDay.scores[4];
    const secondOneAm = fallDay.scores[8];
    assert.equal(firstOneAm.minuteOfDay, 60);
    assert.equal(firstOneAm.elapsedMinutes, 60);
    assert.equal(secondOneAm.minuteOfDay, 60);
    assert.equal(secondOneAm.elapsedMinutes, 120);

    for (let i = 1; i < fallDay.scores.length; i++) {
      assert.equal(
        fallDay.scores[i].elapsedMinutes - fallDay.scores[i - 1].elapsedMinutes,
        15,
      );
    }

    // Final slot is 23:45 wall-clock at elapsed 1485 (24h45m elapsed)
    const last = fallDay.scores[fallDay.scores.length - 1];
    assert.equal(last.minuteOfDay, 1425);
    assert.equal(last.elapsedMinutes, 1485);

    // Range timezone display spans PDT -> PST
    const tzDisplay = getRangeTimezoneDisplay(LA_TZ, days, new Date("2026-11-01T12:00:00Z"));
    assert.equal(tzDisplay.short, "PDT/PST");
  });
});

describe("getRankedWindows and getNextGoodWindow", () => {
  function buildTwoDayFixture() {
    // 2026-06-15 00:00 PDT (07:00Z) to 2026-06-17 00:00 PDT (07:00Z)
    const raw = buildSyntheticRange(
      "2026-06-15T07:00:00.000Z",
      "2026-06-17T07:00:00.000Z",
      (ts) => {
        const iso = ts.toISOString();
        // Day 1 morning fair window: 06:00-07:00 PDT (13:00Z-13:45Z) -> peak 0.35 (fair, 60m)
        if (iso >= "2026-06-15T13:00:00.000Z" && iso <= "2026-06-15T13:45:00.000Z") {
          return { score: 0.35, tideScore: 0.35, sunScore: 1, heightFt: 0.8 };
        }
        // Day 1 afternoon good window: 14:00-15:30 PDT (21:00Z-22:15Z) -> peak 0.65 (good, 90m)
        if (iso >= "2026-06-15T21:00:00.000Z" && iso <= "2026-06-15T22:15:00.000Z") {
          return { score: 0.65, tideScore: 0.65, sunScore: 1, heightFt: 0.1 };
        }
        // Day 2 morning prime window: 07:00-08:00 PDT (14:00Z-14:45Z) -> peak 0.718 (prime 72, 60m)
        if (iso >= "2026-06-16T14:00:00.000Z" && iso <= "2026-06-16T14:45:00.000Z") {
          return { score: 0.718, tideScore: 0.718, sunScore: 1, heightFt: -0.5 };
        }
        // Day 2 afternoon prime window (longer at same rounded pts 72): 15:00-16:30 PDT (22:00Z-23:15Z) -> peak 0.716 (prime 72, 90m)
        if (iso >= "2026-06-16T22:00:00.000Z" && iso <= "2026-06-16T23:15:00.000Z") {
          return { score: 0.716, tideScore: 0.716, sunScore: 1, heightFt: -0.6 };
        }
        return { score: 0.05, tideScore: 0.05, sunScore: 1, heightFt: 3.5 };
      },
    );
    return analyzeTideDays(raw, LA_TZ);
  }

  test("ranks upcoming windows by tier, rounded points, then duration and filters ended windows", () => {
    const days = buildTwoDayFixture();

    // At 06:15 PDT on Day 1 (13:15Z), all 4 windows are upcoming (first ends at 07:00 > 06:30)
    const nowEarly = new Date("2026-06-15T13:15:00.000Z");
    const ranked = getRankedWindows(days, nowEarly, LA_TZ, 10);
    assert.equal(ranked.length, 4);

    // Both Day 2 windows round to 72 (prime), so longer duration (90m) beats shorter (60m)
    assert.equal(ranked[0].dateKey, "2026-06-16");
    assert.equal(ranked[0].durationMinutes, 90);
    assert.equal(ranked[0].tier, "prime");

    assert.equal(ranked[1].dateKey, "2026-06-16");
    assert.equal(ranked[1].durationMinutes, 60);
    assert.equal(ranked[1].tier, "prime");

    assert.equal(ranked[2].dateKey, "2026-06-15");
    assert.equal(ranked[2].tier, "good");

    assert.equal(ranked[3].dateKey, "2026-06-15");
    assert.equal(ranked[3].tier, "fair");

    // Respects limit parameter
    assert.equal(getRankedWindows(days, nowEarly, LA_TZ, 2).length, 2);

    // At 06:45 PDT (13:45Z), Day 1 morning window ends at 07:00 <= nowMinute + 15 -> filtered out
    const nowCutoff = new Date("2026-06-15T13:45:00.000Z");
    const afterCutoff = getRankedWindows(days, nowCutoff, LA_TZ, 10);
    assert.equal(afterCutoff.length, 3);
    assert.ok(afterCutoff.every((w) => w.tier !== "fair"));
  });

  test("getNextGoodWindow prefers good/prime over earlier fair, detects active windows, and falls back to fair", () => {
    const days = buildTwoDayFixture();

    // At 06:15 PDT (inside fair window), next good window skips fair and picks Day 1 14:00 good window
    const nextFromMorning = getNextGoodWindow(
      days,
      new Date("2026-06-15T13:15:00.000Z"),
      LA_TZ,
    );
    assert.ok(nextFromMorning !== null);
    assert.equal(nextFromMorning.dateKey, "2026-06-15");
    assert.equal(nextFromMorning.startMinute, 14 * 60);
    assert.equal(nextFromMorning.tier, "good");
    assert.equal(nextFromMorning.isActiveNow, false);

    // At 14:30 PDT (inside Day 1 good window 14:00-15:30), marks isActiveNow = true
    const activeGood = getNextGoodWindow(
      days,
      new Date("2026-06-15T21:30:00.000Z"),
      LA_TZ,
    );
    assert.ok(activeGood !== null);
    assert.equal(activeGood.dateKey, "2026-06-15");
    assert.equal(activeGood.isActiveNow, true);

    // After all windows on Day 2 (17:00 PDT = 2026-06-17T00:00Z), returns null
    const noneLeft = getNextGoodWindow(
      days,
      new Date("2026-06-17T00:00:00.000Z"),
      LA_TZ,
    );
    assert.equal(noneLeft, null);

    // Falls back to fair when only fair windows exist
    const fairOnlyRaw = buildSyntheticRange(
      "2026-06-15T07:00:00.000Z",
      "2026-06-16T07:00:00.000Z",
      (ts) => {
        const iso = ts.toISOString();
        if (iso >= "2026-06-15T15:00:00.000Z" && iso <= "2026-06-15T16:00:00.000Z") {
          return { score: 0.32, tideScore: 0.32, sunScore: 1, heightFt: 0.9 };
        }
        return { score: 0.05, tideScore: 0.05, sunScore: 1, heightFt: 3.5 };
      },
    );
    const fairDays = analyzeTideDays(fairOnlyRaw, LA_TZ);
    const fallback = getNextGoodWindow(
      fairDays,
      new Date("2026-06-15T15:15:00.000Z"),
      LA_TZ,
    );
    assert.ok(fallback !== null);
    assert.equal(fallback.tier, "fair");
    assert.equal(fallback.isActiveNow, true);
  });
});

describe("getCurrentCondition", () => {
  test("returns nearest slot, rising/falling/slack trends, daylight flag, and null for missing date", () => {
    // 2026-06-15 00:00 PDT = 07:00Z
    const raw: RawScore[] = [
      // 00:00 -> 00:30: rising (+0.6 ft delta)
      {
        timestamp: new Date("2026-06-15T07:00:00.000Z"),
        heightFt: 1.0,
        tideScore: 0.5,
        sunDeg: -15,
        sunScore: 0,
        score: 0,
      },
      {
        timestamp: new Date("2026-06-15T07:15:00.000Z"),
        heightFt: 1.3,
        tideScore: 0.4,
        sunDeg: -14,
        sunScore: 0,
        score: 0,
      },
      {
        timestamp: new Date("2026-06-15T07:30:00.000Z"),
        heightFt: 1.6,
        tideScore: 0.3,
        sunDeg: -13,
        sunScore: 0,
        score: 0,
      },
      // 00:45: slack (prev=1.6, next=1.62 -> delta=+0.02)
      {
        timestamp: new Date("2026-06-15T07:45:00.000Z"),
        heightFt: 1.61,
        tideScore: 0.3,
        sunDeg: 5,
        sunScore: 0.9,
        score: 0.715,
      },
      // 01:00: falling (prev=1.61, next=1.0 -> delta=-0.61)
      {
        timestamp: new Date("2026-06-15T08:00:00.000Z"),
        heightFt: 1.62,
        tideScore: 0.3,
        sunDeg: 10,
        sunScore: 1.0,
        score: 0.5,
      },
      {
        timestamp: new Date("2026-06-15T08:15:00.000Z"),
        heightFt: 1.0,
        tideScore: 0.5,
        sunDeg: 12,
        sunScore: 1.0,
        score: 0.5,
      },
    ];

    const days = analyzeTideDays(raw, LA_TZ);

    const rising = getCurrentCondition(
      days,
      new Date("2026-06-15T07:17:00.000Z"),
      LA_TZ,
    );
    assert.ok(rising !== null);
    assert.equal(rising.dateKey, "2026-06-15");
    assert.equal(rising.heightFt, 1.3);
    assert.equal(rising.trend, "rising");
    assert.equal(rising.isDaylight, false);
    assert.equal(rising.tier, "poor");

    const slack = getCurrentCondition(
      days,
      new Date("2026-06-15T07:45:00.000Z"),
      LA_TZ,
    );
    assert.ok(slack !== null);
    assert.equal(slack.trend, "slack");
    assert.equal(slack.isDaylight, true);
    assert.equal(slack.tier, "prime");

    const falling = getCurrentCondition(
      days,
      new Date("2026-06-15T08:00:00.000Z"),
      LA_TZ,
    );
    assert.ok(falling !== null);
    assert.equal(falling.trend, "falling");
    assert.equal(falling.tier, "good");

    const missing = getCurrentCondition(
      days,
      new Date("2026-06-20T12:00:00.000Z"),
      LA_TZ,
    );
    assert.equal(missing, null);
  });

  test("distinguishes repeated 01:30 PDT vs 01:30 PST slots on Fall Back DST day", () => {
    const raw = buildSyntheticRange(
      "2026-11-01T07:00:00.000Z",
      "2026-11-02T08:00:00.000Z",
      (ts) => {
        if (ts.toISOString() === "2026-11-01T08:30:00.000Z") {
          return { heightFt: 1.11, score: 0.4, sunScore: 0 };
        }
        if (ts.toISOString() === "2026-11-01T09:30:00.000Z") {
          return { heightFt: 4.44, score: 0.1, sunScore: 0 };
        }
        return {};
      },
    );
    const days = analyzeTideDays(raw, LA_TZ);

    const first = getCurrentCondition(
      days,
      new Date("2026-11-01T08:30:00.000Z"),
      LA_TZ,
    );
    const second = getCurrentCondition(
      days,
      new Date("2026-11-01T09:30:00.000Z"),
      LA_TZ,
    );

    assert.ok(first !== null && second !== null);
    assert.equal(first.minuteOfDay, 90);
    assert.equal(first.elapsedMinutes, 90);
    assert.equal(first.heightFt, 1.11);

    assert.equal(second.minuteOfDay, 90);
    assert.equal(second.elapsedMinutes, 150);
    assert.equal(second.heightFt, 4.44);
  });
});
