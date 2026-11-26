import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "#/components/location/LocationIcons";
import {
  formatDuration,
  formatHeightFt,
  formatMinuteOfDay,
  scoreToPoints,
  tierLabel,
  type DayAnalysis,
  type QualityTier,
} from "#/lib/tide-analysis";

type DayTideHeaderProps = {
  day: DayAnalysis;
  dayIndex: number;
  totalDays: number;
  isToday: boolean;
  onPrevDay: () => void;
  onNextDay: () => void;
};

function badgeClasses(tier: QualityTier): string {
  switch (tier) {
    case "prime":
      return "bg-teal-solid text-white";
    case "good":
      return "bg-teal-soft text-teal-deep";
    case "fair":
      return "bg-mist-deep text-ink-secondary";
    case "poor":
      return "bg-mist text-ink-muted border border-line";
  }
}

export function DayTideHeader({
  day,
  dayIndex,
  totalDays,
  isToday,
  onPrevDay,
  onNextDay,
}: DayTideHeaderProps) {
  const peakPts = scoreToPoints(day.peakScore);

  return (
    <div className="flex items-start justify-between gap-3 border-b border-line-subtle px-4 py-4 sm:px-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="selected-day-heading"
            className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
          >
            {day.fullDateLabel}
          </h2>
          <span
            className={`tabular-nums rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClasses(day.tier)}`}
          >
            {day.tier === "poor"
              ? `Poor (peak ${peakPts})`
              : `${tierLabel(day.tier)} ${peakPts}`}
          </span>
          {isToday && (
            <span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-sun">
              Today
            </span>
          )}
        </div>

        <div className="mt-2 text-sm text-ink-secondary">
          {day.bestWindow ? (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span>
                Best window{" "}
                <strong className="tabular-nums whitespace-nowrap font-semibold text-ink">
                  {formatMinuteOfDay(day.bestWindow.startMinute)}–
                  {formatMinuteOfDay(day.bestWindow.endMinute)}
                </strong>{" "}
                <span className="whitespace-nowrap text-ink-muted">
                  ({formatDuration(day.bestWindow.durationMinutes)})
                </span>
              </span>
              <span>
                Peak{" "}
                <strong className="tabular-nums whitespace-nowrap font-semibold text-teal-deep">
                  {scoreToPoints(day.bestWindow.peakScore)}/100
                </strong>{" "}
                <span className="tabular-nums whitespace-nowrap text-ink-muted">
                  at {formatMinuteOfDay(day.bestWindow.peakMinute)} (
                  {formatHeightFt(day.bestWindow.peakHeightFt)})
                </span>
              </span>
            </div>
          ) : (
            <p className="m-0 text-ink-muted">
              {day.lowestOverallLow && !day.lowestOverallLow.isDaylight
                ? `No ideal window today — lowest tide (${formatHeightFt(day.lowestOverallLow.heightFt)} at ${formatMinuteOfDay(day.lowestOverallLow.minuteOfDay)}) happens after dark.`
                : `No ideal window today — daylight tides stay at or above ${day.lowestDaylightHeightFt !== null ? formatHeightFt(day.lowestDaylightHeightFt) : "1.5 ft"}.`}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onPrevDay}
          disabled={dayIndex <= 0}
          aria-label="Previous day"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-paper text-ink transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNextDay}
          disabled={dayIndex >= totalDays - 1}
          aria-label="Next day"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-paper text-ink transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
