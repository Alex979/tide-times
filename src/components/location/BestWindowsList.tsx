import {
  formatDuration,
  formatHeightFt,
  formatMinuteOfDay,
  scoreToPoints,
  tierLabel,
  type DayAnalysis,
  type RankedWindow,
} from "#/lib/tide-analysis";

type BestWindowsListProps = {
  windows: RankedWindow[];
  days: DayAnalysis[];
  selectedDateKey: string;
  onSelectDay: (dateKey: string) => void;
};

export function BestWindowsList({
  windows,
  days,
  selectedDateKey,
  onSelectDay,
}: BestWindowsListProps) {
  const fallbackHighestDay =
    windows.length === 0
      ? [...days].sort((a, b) => b.peakScore - a.peakScore)[0] ?? null
      : null;

  return (
    <aside aria-labelledby="best-windows-heading" className="flex flex-col">
      <div className="flex items-baseline justify-between pb-3">
        <h2
          id="best-windows-heading"
          className="font-display text-lg font-semibold tracking-tight text-ink"
        >
          Best windows
        </h2>
        <span className="text-xs text-ink-muted">Next 14 days</span>
      </div>

      {windows.length === 0 ? (
        <div className="rounded-xl border border-line bg-paper p-4 text-sm text-ink-secondary">
          <p className="m-0">
            No strong tide pooling windows fall in this 14-day forecast.
          </p>
          {fallbackHighestDay && (
            <button
              type="button"
              onClick={() => onSelectDay(fallbackHighestDay.dateKey)}
              className="mt-3 cursor-pointer text-left text-xs font-semibold text-teal-deep underline underline-offset-4 hover:text-ink"
            >
              View highest-scoring day: {fallbackHighestDay.shortDateLabel} (
              {scoreToPoints(fallbackHighestDay.peakScore)}/100)
            </button>
          )}
        </div>
      ) : (
        <ul className="m-0 list-none divide-y divide-line border-t border-b border-line p-0">
          {windows.map((win) => {
            const isSelected = win.dateKey === selectedDateKey;
            const barColor =
              win.tier === "prime"
                ? "bg-teal-deep"
                : win.tier === "good"
                  ? "bg-teal-mid"
                  : "bg-teal-fair";

            return (
              <li key={`${win.dateKey}-${win.startMinute}`}>
                <button
                  type="button"
                  onClick={() => onSelectDay(win.dateKey)}
                  aria-current={isSelected ? "true" : undefined}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-3 text-left transition-colors ${
                    isSelected
                      ? "my-0.5 rounded-lg bg-paper ring-1 ring-inset ring-teal-deep/25 dark:ring-teal-deep/40"
                      : "hover:bg-paper/75"
                  }`}
                >
                  <div className="flex min-w-0 items-stretch gap-3">
                    <span
                      aria-hidden="true"
                      className={`w-1 shrink-0 rounded-full ${barColor}`}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-ink">
                          {win.day.shortDateLabel}
                        </span>
                        {win.day.isWeekend && (
                          <span className="rounded bg-teal-soft px-1.5 py-0.5 text-[11px] leading-none font-medium text-teal-deep">
                            Weekend
                          </span>
                        )}
                      </div>
                      <div className="tabular-nums mt-0.5 text-xs text-ink-secondary">
                        {formatMinuteOfDay(win.startMinute)}–
                        {formatMinuteOfDay(win.endMinute)}
                      </div>
                      <div className="tabular-nums mt-0.5 text-[11px] text-ink-muted">
                        Low {formatHeightFt(win.minHeightFt)}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div
                      className={`tabular-nums text-base leading-tight font-semibold ${
                        win.tier === "prime" ? "text-teal-deep" : "text-ink"
                      }`}
                    >
                      {scoreToPoints(win.peakScore)}
                      <span className="text-[11px] font-normal text-ink-muted">
                        /100
                      </span>
                    </div>
                    <div className="tabular-nums mt-0.5 text-[11px] text-ink-muted">
                      {tierLabel(win.tier)}, {formatDuration(win.durationMinutes)}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
