import { getLocationTideScoresFn } from "#/server/tide-scores";
import type { LocationTideScores } from "#/services/tide-scores";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import chroma from "chroma-js";

const DEFAULT_LOCATION_SLUG = "fitzgerald-marine-reserve";
const MINUTES_IN_DAY = 1440;
const SCORE_COLOR_SCALE = chroma
  .scale(["#e5e7eb", "#facc15", "#22c55e"])
  .domain([0, 0.2, 0.9])
  .mode("oklab");

export const Route = createFileRoute("/")({
  loader: () => getLocationTideScoresFn({ data: DEFAULT_LOCATION_SLUG }),
  component: Home,
});

type ScoreWithMinute = LocationTideScores["scores"][number] & {
  minuteOfDay: number;
};

function groupScoresByDay(
  scores: LocationTideScores["scores"],
  timezone: string,
) {
  const dateScoresMap = new Map<string, ScoreWithMinute[]>();

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
    const parts = fmt.formatToParts(score.timestamp);

    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value);

    const year = get("year");
    const month = get("month");
    const day = get("day");
    const hour = get("hour");
    const minute = get("minute");

    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const minuteOfDay = hour * 60 + minute;

    if (dateScoresMap.has(dateKey)) {
      dateScoresMap.get(dateKey)?.push({
        ...score,
        minuteOfDay,
      });
    } else {
      dateScoresMap.set(dateKey, [
        {
          ...score,
          minuteOfDay,
        },
      ]);
    }
  }

  return dateScoresMap;
}

function DayBar({ scores }: { scores: ScoreWithMinute[] }) {
  const stops = scores.map((score) => {
    const percent = (score.minuteOfDay / MINUTES_IN_DAY) * 100;
    const color = SCORE_COLOR_SCALE(score.score).hex();
    return `${color} ${percent}%`;
  });

  const gradient = `linear-gradient(to bottom in oklab, ${stops.join(",")})`;
  return <div style={{ background: gradient }} className="w-10 h-50 rounded-xl flex-none"></div>;
}

function Home() {
  const result = Route.useLoaderData();

  const dateScoresMap = useMemo(
    () =>
      result.ok
        ? groupScoresByDay(result.data.scores, result.data.location.timezone)
        : new Map<string, ScoreWithMinute[]>(),
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
      <div className="w-full flex gap-2 overflow-x-scroll">
        {[...dateScoresMap].map(([key, dayScores]) => (
          <DayBar key={key} scores={dayScores} />
        ))}
      </div>
    </div>
  );
}
