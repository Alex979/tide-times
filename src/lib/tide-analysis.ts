import type { LocationTideScores } from "#/lib/tide-scores.server";

const MINUTES_IN_DAY = 1440;

export type QualityTier = "prime" | "good" | "fair" | "poor";

export type ScoreSlot = LocationTideScores["scores"][number] & {
  minuteOfDay: number;
  /** Monotonic minutes elapsed since local midnight (handles 23h/25h DST days cleanly). */
  elapsedMinutes: number;
};

export type TideExtremum = {
  type: "high" | "low";
  minuteOfDay: number;
  elapsedMinutes: number;
  heightFt: number;
  timestamp: Date;
  isDaylight: boolean;
};

export type PoolingWindow = {
  dateKey: string;
  startMinute: number;
  endMinute: number;
  startElapsed: number;
  endElapsed: number;
  durationMinutes: number;
  peakMinute: number;
  peakElapsed: number;
  peakScore: number;
  peakHeightFt: number;
  peakSlot: ScoreSlot;
  minHeightFt: number;
  tier: Exclude<QualityTier, "poor">;
};

export type DayAnalysis = {
  dateKey: string;
  dayIndex: number;
  weekdayShort: string;
  weekdayLong: string;
  monthShort: string;
  dayNumber: number;
  fullDateLabel: string;
  shortDateLabel: string;
  timezoneShort: string;
  isWeekend: boolean;
  /** Full chronological duration of this local calendar day in minutes (1440 normally; 1380/1500 on DST days). */
  dayDurationMinutes: number;
  scores: ScoreSlot[];
  sunriseMinute: number | null;
  sunsetMinute: number | null;
  civilDawnMinute: number | null;
  civilDuskMinute: number | null;
  sunriseElapsed: number | null;
  sunsetElapsed: number | null;
  civilDawnElapsed: number | null;
  civilDuskElapsed: number | null;
  extrema: TideExtremum[];
  windows: PoolingWindow[];
  bestWindow: PoolingWindow | null;
  peakSlot: ScoreSlot | null;
  peakScore: number;
  lowestDaylightHeightFt: number | null;
  lowestOverallLow: TideExtremum | null;
  tier: QualityTier;
};

export type RankedWindow = PoolingWindow & {
  day: DayAnalysis;
};

export type NextWindowInfo = RankedWindow & {
  isActiveNow: boolean;
};

export type CurrentCondition = {
  dateKey: string;
  minuteOfDay: number;
  elapsedMinutes: number;
  heightFt: number;
  trend: "rising" | "falling" | "slack";
  score: number;
  tideScore: number;
  sunScore: number;
  tier: QualityTier;
  isDaylight: boolean;
};

export function scoreToPoints(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

export function formatScorePoints(score: number): string {
  const pts = scoreToPoints(score);
  return pts > 0 ? String(pts) : "—";
}

const PRIME_POINTS_THRESHOLD = 72;
const GOOD_POINTS_THRESHOLD = 48;
const FAIR_POINTS_THRESHOLD = 28;

export function classifyScore(score: number): QualityTier {
  const pts = scoreToPoints(score);
  if (pts >= PRIME_POINTS_THRESHOLD) return "prime";
  if (pts >= GOOD_POINTS_THRESHOLD) return "good";
  if (pts >= FAIR_POINTS_THRESHOLD) return "fair";
  return "poor";
}

export function tierLabel(tier: QualityTier): string {
  switch (tier) {
    case "prime":
      return "Prime";
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    case "poor":
      return "Poor";
  }
}

export function daylightStatusLabel(sunScore: number): string {
  if (sunScore <= 0.02) return "After dark";
  if (sunScore < 0.85) return "Twilight";
  return "Daylight";
}

export function formatHeightFt(heightFt: number, compact = false): string {
  const rounded = Math.abs(heightFt) < 0.05 ? 0 : heightFt;
  const fixed = rounded.toFixed(1);
  if (compact) {
    return `${fixed}'`;
  }
  return `${fixed} ft`;
}

export function formatMinuteOfDay(
  minuteOfDay: number,
  options?: { compact?: boolean },
): string {
  const clamped = Math.max(
    0,
    Math.min(MINUTES_IN_DAY, Math.round(minuteOfDay)),
  );
  const totalHours = Math.floor(clamped / 60) % 24;
  const mins = clamped % 60;
  const period = totalHours >= 12 ? "PM" : "AM";
  const periodCompact = totalHours >= 12 ? "p" : "a";
  const hour12 = totalHours % 12 === 0 ? 12 : totalHours % 12;

  if (options?.compact) {
    if (mins === 0) return `${hour12}${periodCompact}`;
    return `${hour12}:${String(mins).padStart(2, "0")}${periodCompact}`;
  }

  return `${hour12}:${String(mins).padStart(2, "0")} ${period}`;
}

export function formatDuration(minutes: number): string {
  const rounded = Math.max(15, Math.round(minutes / 15) * 15);
  const hours = Math.floor(rounded / 60);
  const rem = rounded % 60;
  if (hours === 0) return `${rem}m`;
  if (rem === 0) return `${hours}h`;
  return `${hours}h ${rem}m`;
}

function getTimezoneShortForDate(timezone: string, date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timezone;
  } catch {
    return timezone;
  }
}

export function getRangeTimezoneDisplay(
  timezone: string,
  days: DayAnalysis[],
  fallbackDate: Date,
): { short: string; long: string } {
  const uniqueShorts = [...new Set(days.map((d) => d.timezoneShort).filter(Boolean))];
  const spansDst = uniqueShorts.length > 1;
  const refDate = days[0]?.scores[0]?.timestamp ?? fallbackDate;

  try {
    if (spansDst) {
      const genericParts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "longGeneric",
      }).formatToParts(refDate);
      const longGeneric =
        genericParts.find((p) => p.type === "timeZoneName")?.value ?? timezone;
      return {
        short: uniqueShorts.join("/"),
        long: longGeneric,
      };
    }

    const longParts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "long",
    }).formatToParts(refDate);
    const long =
      longParts.find((p) => p.type === "timeZoneName")?.value ?? timezone;
    const short = uniqueShorts[0] ?? getTimezoneShortForDate(timezone, refDate);
    return { short, long };
  } catch {
    return { short: uniqueShorts.join("/") || timezone, long: timezone };
  }
}

function getDatePartsInTimezone(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  let year = "";
  let month = "";
  let day = "";
  let hour = 0;
  let minute = 0;

  for (const part of fmt.formatToParts(date)) {
    switch (part.type) {
      case "year":
        year = part.value;
        break;
      case "month":
        month = part.value;
        break;
      case "day":
        day = part.value;
        break;
      case "hour":
        hour = Number(part.value);
        break;
      case "minute":
        minute = Number(part.value);
        break;
    }
  }

  return {
    dateKey: `${year}-${month}-${day}`,
    year: Number(year),
    month: Number(month),
    day: Number(day),
    minuteOfDay: hour * 60 + minute,
  };
}

function interpolateCrossing(
  slots: ScoreSlot[],
  threshold: number,
  direction: "rising" | "falling",
): { minuteOfDay: number; elapsedMinutes: number } | null {
  for (let i = 1; i < slots.length; i++) {
    const prev = slots[i - 1];
    const curr = slots[i];
    const crossed =
      direction === "rising"
        ? prev.sunDeg < threshold && curr.sunDeg >= threshold
        : prev.sunDeg >= threshold && curr.sunDeg < threshold;

    if (crossed) {
      const denom = curr.sunDeg - prev.sunDeg;
      if (Math.abs(denom) < 1e-6) {
        return {
          minuteOfDay: curr.minuteOfDay,
          elapsedMinutes: curr.elapsedMinutes,
        };
      }
      const frac = (threshold - prev.sunDeg) / denom;
      return {
        minuteOfDay:
          prev.minuteOfDay + frac * (curr.minuteOfDay - prev.minuteOfDay),
        elapsedMinutes:
          prev.elapsedMinutes +
          frac * (curr.elapsedMinutes - prev.elapsedMinutes),
      };
    }
  }
  return null;
}

export function findDayExtrema(
  slots: ScoreSlot[],
  prevLast: ScoreSlot | null,
  nextFirst: ScoreSlot | null,
): TideExtremum[] {
  if (slots.length === 0) return [];
  const extrema: TideExtremum[] = [];

  let i = 0;
  while (i < slots.length) {
    const start = i;
    const plateauHeight = slots[start].heightFt;
    while (i + 1 < slots.length && slots[i + 1].heightFt === plateauHeight) {
      i++;
    }
    const end = i;
    i++;

    const prev = start > 0 ? slots[start - 1] : prevLast;
    const next = end < slots.length - 1 ? slots[end + 1] : nextFirst;

    if (!prev || !next) continue;

    const isLow =
      prev.heightFt > plateauHeight && next.heightFt > plateauHeight;
    const isHigh =
      prev.heightFt < plateauHeight && next.heightFt < plateauHeight;

    if (!isLow && !isHigh) continue;

    const mid = slots[Math.floor((start + end) / 2)];
    const type: TideExtremum["type"] = isLow ? "low" : "high";
    const candidate: TideExtremum = {
      type,
      minuteOfDay: mid.minuteOfDay,
      elapsedMinutes: mid.elapsedMinutes,
      heightFt: mid.heightFt,
      timestamp: mid.timestamp,
      isDaylight: mid.sunScore > 0.15,
    };

    const last = extrema[extrema.length - 1];
    if (last && last.type === type) {
      const gapMinutes =
        (candidate.timestamp.getTime() - last.timestamp.getTime()) / 60_000;
      if (gapMinutes < 90) {
        if (
          (isLow && candidate.heightFt < last.heightFt) ||
          (isHigh && candidate.heightFt > last.heightFt)
        ) {
          extrema[extrema.length - 1] = candidate;
        }
        continue;
      }
    } else if (extrema.length >= 2) {
      const prevSame = extrema[extrema.length - 2];
      const gapMinutes =
        (candidate.timestamp.getTime() - prevSame.timestamp.getTime()) / 60_000;
      if (prevSame.type === type && gapMinutes < 90) {
        extrema.pop();
        if (
          (isLow && candidate.heightFt < prevSame.heightFt) ||
          (isHigh && candidate.heightFt > prevSame.heightFt)
        ) {
          extrema[extrema.length - 1] = candidate;
        }
        continue;
      }
    }

    extrema.push(candidate);
  }

  return extrema;
}

export function findPoolingWindows(
  dateKey: string,
  slots: ScoreSlot[],
  dayDurationMinutes: number,
): PoolingWindow[] {
  const windows: PoolingWindow[] = [];
  let run: ScoreSlot[] = [];

  const flush = () => {
    if (run.length === 0) return;

    const first = run[0];
    const last = run[run.length - 1];
    const startMinute = first.minuteOfDay;
    const endMinute = Math.min(MINUTES_IN_DAY, last.minuteOfDay + 15);
    const startElapsed = first.elapsedMinutes;
    const endElapsed = Math.min(dayDurationMinutes, last.elapsedMinutes + 15);
    const durationMinutes = Math.max(15, endElapsed - startElapsed);

    let peakSlot = run[0];
    let lowestSlot = run[0];
    for (const s of run) {
      if (s.score > peakSlot.score) peakSlot = s;
      if (s.heightFt < lowestSlot.heightFt) lowestSlot = s;
    }

    const tier = classifyScore(peakSlot.score);
    if (tier !== "poor") {
      windows.push({
        dateKey,
        startMinute,
        endMinute,
        startElapsed,
        endElapsed,
        durationMinutes,
        peakMinute: peakSlot.minuteOfDay,
        peakElapsed: peakSlot.elapsedMinutes,
        peakScore: peakSlot.score,
        peakHeightFt: peakSlot.heightFt,
        peakSlot,
        minHeightFt: lowestSlot.heightFt,
        tier,
      });
    }

    run = [];
  };

  for (const slot of slots) {
    if (classifyScore(slot.score) !== "poor") {
      run.push(slot);
    } else {
      flush();
    }
  }
  flush();

  return windows;
}

export function analyzeTideDays(
  scores: LocationTideScores["scores"],
  timezone: string,
): DayAnalysis[] {
  // Preserve every slot keyed by exact timestamp so Fall Back DST repeated hours
  // remain intact for chronological tide curves and extrema detection.
  const byDate = new Map<
    string,
    Array<LocationTideScores["scores"][number] & { minuteOfDay: number }>
  >();

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  for (const score of scores) {
    let year = "";
    let month = "";
    let day = "";
    let hour = 0;
    let minute = 0;

    for (const part of dateFmt.formatToParts(score.timestamp)) {
      switch (part.type) {
        case "year":
          year = part.value;
          break;
        case "month":
          month = part.value;
          break;
        case "day":
          day = part.value;
          break;
        case "hour":
          hour = Number(part.value);
          break;
        case "minute":
          minute = Number(part.value);
          break;
      }
    }

    const dateKey = `${year}-${month}-${day}`;
    const minuteOfDay = hour * 60 + minute;

    let dayList = byDate.get(dateKey);
    if (!dayList) {
      dayList = [];
      byDate.set(dateKey, dayList);
    }

    dayList.push({
      ...score,
      minuteOfDay,
    });
  }

  const rawEntries = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, list]) => {
      const sorted = [...list].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
      return { dateKey, rawScores: sorted };
    });

  // Compute monotonic elapsedMinutes & exact day duration (1380/1440/1500 min across DST)
  const sortedEntries = rawEntries.map((entry, idx) => {
    const first = entry.rawScores[0];
    const last = entry.rawScores[entry.rawScores.length - 1];
    const nextFirst = rawEntries[idx + 1]?.rawScores[0] ?? null;

    // Anchor local midnight from the first slot's timestamp minus its wall-clock minute
    const midnightMs = first
      ? first.timestamp.getTime() - first.minuteOfDay * 60_000
      : 0;

    let dayDurationMinutes = MINUTES_IN_DAY;
    if (first && nextFirst && first.minuteOfDay === 0 && nextFirst.minuteOfDay === 0) {
      const spanMin = Math.round(
        (nextFirst.timestamp.getTime() - first.timestamp.getTime()) / 60_000,
      );
      if (spanMin >= 1320 && spanMin <= 1560) {
        dayDurationMinutes = spanMin;
      }
    } else if (first && last && first.minuteOfDay === 0) {
      const spanMin = Math.round(
        (last.timestamp.getTime() - first.timestamp.getTime()) / 60_000 + 15,
      );
      if (spanMin === 1380 || spanMin === 1440 || spanMin === 1500) {
        dayDurationMinutes = spanMin;
      }
    }

    const dayScores: ScoreSlot[] = entry.rawScores.map((s) => ({
      ...s,
      elapsedMinutes: Math.max(
        0,
        Math.round((s.timestamp.getTime() - midnightMs) / 60_000),
      ),
    }));

    return {
      dateKey: entry.dateKey,
      dayDurationMinutes,
      scores: dayScores,
    };
  });

  const weekdayShortFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const weekdayLongFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  });
  const monthShortFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
  });

  return sortedEntries.map((entry, index) => {
    const { dateKey, scores: dayScores, dayDurationMinutes } = entry;
    const middaySlot =
      dayScores[Math.floor(dayScores.length / 2)] ?? dayScores[0];
    const refDate = middaySlot
      ? middaySlot.timestamp
      : new Date(`${dateKey}T12:00:00Z`);

    const weekdayShort = weekdayShortFmt.format(refDate);
    const weekdayLong = weekdayLongFmt.format(refDate);
    const monthShort = monthShortFmt.format(refDate);
    const timezoneShort = getTimezoneShortForDate(timezone, refDate);
    const dayNumber = Number(dateKey.split("-")[2]);
    const isWeekend = weekdayShort === "Sat" || weekdayShort === "Sun";

    const prevLast =
      index > 0
        ? sortedEntries[index - 1].scores[
            sortedEntries[index - 1].scores.length - 1
          ] ?? null
        : null;
    const nextFirst =
      index < sortedEntries.length - 1
        ? sortedEntries[index + 1].scores[0] ?? null
        : null;

    const sunrise = interpolateCrossing(dayScores, 0, "rising");
    const sunset = interpolateCrossing(dayScores, 0, "falling");
    const civilDawn = interpolateCrossing(dayScores, -6, "rising");
    const civilDusk = interpolateCrossing(dayScores, -6, "falling");

    const extrema = findDayExtrema(dayScores, prevLast, nextFirst);
    const windows = findPoolingWindows(dateKey, dayScores, dayDurationMinutes);

    // Strictly transitive comparator: highest peak score always wins so bestWindow
    // always matches the day's peak slot, badge, and factor panel.
    const bestWindow =
      windows.length > 0
        ? [...windows].sort((a, b) => {
            if (b.peakScore !== a.peakScore) return b.peakScore - a.peakScore;
            if (b.durationMinutes !== a.durationMinutes) {
              return b.durationMinutes - a.durationMinutes;
            }
            return a.startElapsed - b.startElapsed;
          })[0]
        : null;

    let peakSlot: ScoreSlot | null = null;
    let lowestDaylightSlot: ScoreSlot | null = null;

    for (const slot of dayScores) {
      if (!peakSlot || slot.score > peakSlot.score) {
        peakSlot = slot;
      }
      if (slot.sunScore >= 0.25) {
        if (
          !lowestDaylightSlot ||
          slot.heightFt < lowestDaylightSlot.heightFt
        ) {
          lowestDaylightSlot = slot;
        }
      }
    }

    const lows = extrema.filter((e) => e.type === "low");
    const lowestOverallLow =
      lows.length > 0
        ? [...lows].sort((a, b) => a.heightFt - b.heightFt)[0]
        : null;

    const resolvedPeakSlot = bestWindow?.peakSlot ?? peakSlot;
    const peakScore = resolvedPeakSlot?.score ?? 0;
    const tier = classifyScore(peakScore);

    return {
      dateKey,
      dayIndex: index,
      weekdayShort,
      weekdayLong,
      monthShort,
      dayNumber,
      fullDateLabel: `${weekdayLong}, ${monthShort} ${dayNumber}`,
      shortDateLabel: `${weekdayShort}, ${monthShort} ${dayNumber}`,
      timezoneShort,
      isWeekend,
      dayDurationMinutes,
      scores: dayScores,
      sunriseMinute: sunrise?.minuteOfDay ?? null,
      sunsetMinute: sunset?.minuteOfDay ?? null,
      civilDawnMinute: civilDawn?.minuteOfDay ?? null,
      civilDuskMinute: civilDusk?.minuteOfDay ?? null,
      sunriseElapsed: sunrise?.elapsedMinutes ?? null,
      sunsetElapsed: sunset?.elapsedMinutes ?? null,
      civilDawnElapsed: civilDawn?.elapsedMinutes ?? null,
      civilDuskElapsed: civilDusk?.elapsedMinutes ?? null,
      extrema,
      windows,
      bestWindow,
      peakSlot: resolvedPeakSlot,
      peakScore,
      lowestDaylightHeightFt: lowestDaylightSlot?.heightFt ?? null,
      lowestOverallLow,
      tier,
    };
  });
}

export function computeMatrixHourRange(days: DayAnalysis[]): {
  startHour: number;
  endHour: number;
} {
  let earliest = 6 * 60;
  let latest = 18 * 60;

  for (const day of days) {
    if (day.civilDawnMinute !== null) {
      earliest = Math.min(earliest, day.civilDawnMinute);
    }
    if (day.civilDuskMinute !== null) {
      latest = Math.max(latest, day.civilDuskMinute);
    }
  }

  const startHour = Math.max(0, Math.min(5, Math.floor((earliest - 60) / 60)));
  const endHour = Math.min(24, Math.max(20, Math.ceil((latest + 75) / 60)));

  return { startHour, endHour };
}

function isWindowUpcoming(
  win: PoolingWindow,
  nowDateKey: string,
  nowMinute: number,
): boolean {
  if (win.dateKey < nowDateKey) return false;
  if (win.dateKey === nowDateKey && win.endMinute <= nowMinute + 15) {
    return false;
  }
  return true;
}

const TIER_RANK: Record<Exclude<QualityTier, "poor">, number> = {
  prime: 3,
  good: 2,
  fair: 1,
};

export function getRankedWindows(
  days: DayAnalysis[],
  now: Date,
  timezone: string,
  limit = 6,
): RankedWindow[] {
  const { dateKey: nowDateKey, minuteOfDay: nowMinute } =
    getDatePartsInTimezone(now, timezone);

  const all: RankedWindow[] = [];
  for (const day of days) {
    for (const win of day.windows) {
      if (!isWindowUpcoming(win, nowDateKey, nowMinute)) continue;
      all.push({ ...win, day });
    }
  }

  // Strictly score-first ranking: tier, then rounded 0-100 peak score, then duration
  return all
    .sort((a, b) => {
      if (TIER_RANK[b.tier] !== TIER_RANK[a.tier]) {
        return TIER_RANK[b.tier] - TIER_RANK[a.tier];
      }
      const ptsDiff = scoreToPoints(b.peakScore) - scoreToPoints(a.peakScore);
      if (ptsDiff !== 0) return ptsDiff;
      if (b.durationMinutes !== a.durationMinutes) {
        return b.durationMinutes - a.durationMinutes;
      }
      return b.peakScore - a.peakScore;
    })
    .slice(0, limit);
}

export function getNextGoodWindow(
  days: DayAnalysis[],
  now: Date,
  timezone: string,
): NextWindowInfo | null {
  const { dateKey: nowDateKey, minuteOfDay: nowMinute } =
    getDatePartsInTimezone(now, timezone);

  const upcomingGoodOrPrime: NextWindowInfo[] = [];
  const upcomingFair: NextWindowInfo[] = [];

  for (const day of days) {
    for (const win of day.windows) {
      if (!isWindowUpcoming(win, nowDateKey, nowMinute)) continue;
      const isActiveNow =
        day.dateKey === nowDateKey &&
        nowMinute >= win.startMinute &&
        nowMinute < win.endMinute;

      const entry: NextWindowInfo = { ...win, day, isActiveNow };
      if (win.tier === "prime" || win.tier === "good") {
        upcomingGoodOrPrime.push(entry);
      } else {
        upcomingFair.push(entry);
      }
    }
  }

  return upcomingGoodOrPrime[0] ?? upcomingFair[0] ?? null;
}

export function getCurrentCondition(
  days: DayAnalysis[],
  now: Date,
  timezone: string,
): CurrentCondition | null {
  const { dateKey, minuteOfDay } = getDatePartsInTimezone(now, timezone);
  const today = days.find((d) => d.dateKey === dateKey);
  if (!today || today.scores.length === 0) return null;

  const nowMs = now.getTime();
  let nearestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < today.scores.length; i++) {
    const diff = Math.abs(today.scores[i].timestamp.getTime() - nowMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      nearestIdx = i;
    }
  }

  const slot = today.scores[nearestIdx];
  const prev = today.scores[Math.max(0, nearestIdx - 1)];
  const next = today.scores[Math.min(today.scores.length - 1, nearestIdx + 1)];
  const delta = next.heightFt - prev.heightFt;

  let trend: CurrentCondition["trend"] = "slack";
  if (delta > 0.08) trend = "rising";
  else if (delta < -0.08) trend = "falling";

  return {
    dateKey,
    minuteOfDay,
    elapsedMinutes: slot.elapsedMinutes,
    heightFt: slot.heightFt,
    trend,
    score: slot.score,
    tideScore: slot.tideScore,
    sunScore: slot.sunScore,
    tier: classifyScore(slot.score),
    isDaylight: slot.sunScore > 0.25,
  };
}
