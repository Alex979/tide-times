import type { PlannedFactorPreview } from "#/lib/location-guide";
import {
  classifyScore,
  daylightStatusLabel,
  formatHeightFt,
  formatMinuteOfDay,
  scoreToPoints,
  tierLabel,
  type DayAnalysis,
  type ScoreSlot,
} from "#/lib/tide-analysis";

type ScoreFactorsGridProps = {
  day: DayAnalysis;
  factorSlot: ScoreSlot;
  scrubSlot: ScoreSlot | null;
  plannedFactors: PlannedFactorPreview;
};

export function ScoreFactorsGrid({
  day,
  factorSlot,
  scrubSlot,
  plannedFactors,
}: ScoreFactorsGridProps) {
  return (
    <div className="border-t border-line-subtle bg-mist/30 px-4 py-3.5 sm:px-6">
      <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
        <h3 className="text-xs font-semibold text-ink">
          {scrubSlot
            ? `Factors at ${formatMinuteOfDay(scrubSlot.minuteOfDay)}`
            : day.bestWindow
              ? `Factors at peak (${formatMinuteOfDay(day.bestWindow.peakMinute)})`
              : "Score factors"}
        </h3>
        <span className="tabular-nums text-xs font-semibold text-teal-deep">
          {scoreToPoints(factorSlot.score)}/100 (
          {tierLabel(classifyScore(factorSlot.score))})
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-line-subtle bg-paper px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-ink-secondary">Tide</span>
            <span className="tabular-nums text-xs font-semibold text-ink">
              {scoreToPoints(factorSlot.tideScore)}/100
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-mist-deep">
            <div
              className="h-full rounded-full bg-teal-mid transition-[width] duration-150"
              style={{ width: `${scoreToPoints(factorSlot.tideScore)}%` }}
            />
          </div>
          <div className="tabular-nums mt-1.5 text-xs text-ink-muted">
            {formatHeightFt(factorSlot.heightFt)}
          </div>
        </div>

        <div className="rounded-lg border border-line-subtle bg-paper px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-ink-secondary">
              Daylight
            </span>
            <span className="tabular-nums text-xs font-semibold text-ink">
              {scoreToPoints(factorSlot.sunScore)}/100
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-mist-deep">
            <div
              className="h-full rounded-full bg-sun transition-[width] duration-150"
              style={{ width: `${scoreToPoints(factorSlot.sunScore)}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-ink-muted">
            {daylightStatusLabel(factorSlot.sunScore)}
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-line bg-paper/65 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-ink-secondary">
              Swell
            </span>
            <span className="rounded bg-mist px-1.5 py-0.5 text-[10px] leading-none font-medium text-ink-muted">
              Planned
            </span>
          </div>
          <div className="mt-2 text-xs font-medium text-ink-secondary">
            {plannedFactors.swellSummary}
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-line bg-paper/65 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-ink-secondary">
              Weather
            </span>
            <span className="rounded bg-mist px-1.5 py-0.5 text-[10px] leading-none font-medium text-ink-muted">
              Planned
            </span>
          </div>
          <div className="mt-2 text-xs font-medium text-ink-secondary">
            {plannedFactors.weatherSummary}
          </div>
        </div>
      </div>
    </div>
  );
}
