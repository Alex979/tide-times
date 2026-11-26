import { scoreToCssColor } from "#/lib/score-palette";
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

export type SlotInspection = {
  day: DayAnalysis;
  slot: ScoreSlot;
  yPercent: number;
  pinned: boolean;
};

type OutlookReadoutStripProps = {
  inspection: SlotInspection | null;
  onClearInspection: () => void;
  hasCurrentCondition: boolean;
};

/**
 * Fixed-height unified legend / live readout strip above the 14-day outlook matrix
 * so pointer/touch scrubbing causes zero layout shift.
 */
export function OutlookReadoutStrip({
  inspection,
  onClearInspection,
  hasCurrentCondition,
}: OutlookReadoutStripProps) {
  return (
    <div className="flex h-[54px] items-center justify-between gap-2 overflow-hidden border-b border-line-subtle bg-mist/45 px-4 text-xs sm:h-[42px] sm:px-6">
      {inspection ? (
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col justify-center gap-0.5 sm:flex-row sm:items-center sm:gap-3.5">
            <div className="flex items-center gap-2.5 whitespace-nowrap text-ink sm:gap-3.5">
              <span className="font-semibold">
                {inspection.day.shortDateLabel}
              </span>
              <span className="tabular-nums font-medium">
                {formatMinuteOfDay(inspection.slot.minuteOfDay)}
                <span className="hidden sm:inline">
                  {" "}
                  {inspection.day.timezoneShort}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2.5 whitespace-nowrap sm:gap-3.5">
              <span className="inline-flex items-center gap-1.5 font-semibold text-teal-deep">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-ink/15"
                  style={{
                    backgroundColor: scoreToCssColor(inspection.slot.score),
                  }}
                />
                <span className="tabular-nums">
                  Score {scoreToPoints(inspection.slot.score)}
                </span>
                <span className="font-medium text-ink-secondary">
                  ({tierLabel(classifyScore(inspection.slot.score))})
                </span>
              </span>
              <span className="tabular-nums text-ink-secondary">
                {formatHeightFt(inspection.slot.heightFt)}
              </span>
              <span className="truncate text-ink-muted">
                {daylightStatusLabel(inspection.slot.sunScore)}
              </span>
            </div>
          </div>

          {inspection.pinned && (
            <button
              type="button"
              onClick={onClearInspection}
              aria-label="Clear inspected time"
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
        <div className="flex flex-col justify-center gap-1 text-ink-secondary sm:flex-row sm:items-center sm:gap-5">
          <div className="flex items-center gap-4 whitespace-nowrap sm:gap-5">
            <div className="flex items-center gap-2">
              <span className="text-ink-muted">Poor</span>
              <span
                aria-hidden="true"
                className="h-2.5 w-20 rounded-full ring-1 ring-inset ring-ink/10 sm:w-24"
                style={{
                  backgroundImage:
                    "linear-gradient(to right in oklab, var(--color-score-low) 0%, var(--color-score-fair) 30%, var(--color-score-good) 65%, var(--color-score-high) 100%)",
                  backgroundRepeat: "no-repeat",
                }}
              />
              <span className="font-medium text-teal-deep">Prime</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block w-4 border-t-[1.5px] border-dashed border-sun"
              />
              <span className="text-ink-muted">Sunrise &amp; sunset</span>
            </div>
          </div>

          <div className="flex items-center gap-4 whitespace-nowrap sm:gap-5">
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-teal-solid ring-1 ring-ink/15 dark:border-[#e6eeed]"
              />
              <span className="text-ink-muted">Peak</span>
            </div>

            {hasCurrentCondition && (
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-[2px] w-3.5 bg-sun"
                />
                <span className="text-ink-muted">Now</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
