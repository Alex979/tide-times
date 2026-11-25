import { createCssColorScale } from "#/lib/color-scale";
import { getLocationTideScoresFn } from "#/server/tide-scores";
import type { LocationTideScores } from "#/services/tide-scores";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

const DEFAULT_LOCATION_SLUG = "fitzgerald-marine-reserve";
const MINUTES_IN_DAY = 1440;

const scoreToCssColor = createCssColorScale([
  [0, "var(--color-score-low)"],
  [0.2, "var(--color-score-mid)"],
  [0.9, "var(--color-score-high)"],
]);

export const Route = createFileRoute("/")({
  loader: () => getLocationTideScoresFn({ data: DEFAULT_LOCATION_SLUG }),
  component: Home,
});

type ScoreWithMinute = LocationTideScores["scores"][number] & {
  minuteOfDay: number;
};

type DayScores = {
  dateKey: string;
  scores: ScoreWithMinute[];
};

function groupScoresByDay(
  scores: LocationTideScores["scores"],
  timezone: string,
): DayScores[] {
  // Inner map deduplicates repeated wall-clock minutes on Fall Back DST days.
  const byDate = new Map<string, Map<number, ScoreWithMinute>>();

  const fmt = new Intl.DateTimeFormat("en-US", {
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

    for (const part of fmt.formatToParts(score.timestamp)) {
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

    let dayMap = byDate.get(dateKey);
    if (!dayMap) {
      dayMap = new Map();
      byDate.set(dateKey, dayMap);
    }

    const existing = dayMap.get(minuteOfDay);
    if (!existing || score.score > existing.score) {
      dayMap.set(minuteOfDay, {
        ...score,
        minuteOfDay,
      });
    }
  }

  // Sort days chronologically and each day's slots by ascending minuteOfDay
  // so gradient stops are always strictly ordered (including across DST days).
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, dayMap]) => ({
      dateKey,
      scores: [...dayMap.values()].sort(
        (a, b) => a.minuteOfDay - b.minuteOfDay,
      ),
    }));
}

function DayBar({ scores }: { scores: ScoreWithMinute[] }) {
  let background = "var(--color-score-low)";

  if (scores.length > 0) {
    const rawStops = scores.map((score) => ({
      color: scoreToCssColor(score.score),
      percent: ((score.minuteOfDay / MINUTES_IN_DAY) * 100).toFixed(3),
    }));

    if (rawStops.every((stop) => stop.color === rawStops[0].color)) {
      background = rawStops[0].color;
    } else {
      // Collapse interior runs of 3+ identical colors (e.g. flat nighttime spans)
      // while preserving exact transition boundaries.
      const collapsed = rawStops.filter(
        (stop, i) =>
          i === 0 ||
          i === rawStops.length - 1 ||
          rawStops[i - 1].color !== stop.color ||
          rawStops[i + 1].color !== stop.color,
      );
      const cssStops = collapsed.map((stop) => `${stop.color} ${stop.percent}%`);
      background = `linear-gradient(to bottom in oklab, ${cssStops.join(", ")})`;
    }
  }

  return (
    <div
      style={{ background }}
      className="w-10 h-50 rounded-xl flex-none"
    ></div>
  );
}

function Home() {
  const result = Route.useLoaderData();

  const days = useMemo(
    () =>
      result.ok
        ? groupScoresByDay(result.data.scores, result.data.location.timezone)
        : [],
    [result],
  );

  if (!result.ok) {
    return (
      <div className="p-8">
        <p>{result.error}</p>
      </div>
    );
  }

  const { location, scores } = result.data;

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">{location.name}</h1>
      <p className="mt-2 text-sm text-gray-600">
        {scores.length} prediction slots ({location.timezone})
      </p>
      <div className="w-full flex gap-2 overflow-x-auto">
        {days.map(({ dateKey, scores: dayScores }) => (
          <DayBar key={dateKey} scores={dayScores} />
        ))}
      </div>
    </div>
  );
}
