import {
  SunriseIcon,
  SunsetIcon,
} from "#/components/location/LocationIcons";
import {
  formatHeightFt,
  formatMinuteOfDay,
  type DayAnalysis,
} from "#/lib/tide-analysis";

type DayAlmanacFooterProps = {
  day: DayAnalysis;
};

export function DayAlmanacFooter({ day }: DayAlmanacFooterProps) {
  return (
    <div className="grid grid-cols-1 gap-4 border-t border-line-subtle px-4 py-3.5 text-sm sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {day.extrema.map((ext, i) => (
          <div key={`${ext.type}-${i}`} className="flex items-baseline gap-1.5">
            <span className="text-xs font-medium text-ink-muted">
              {ext.type === "high" ? "High" : "Low"}
            </span>
            <span className="tabular-nums font-semibold text-ink">
              {formatHeightFt(ext.heightFt)}
            </span>
            <span className="tabular-nums text-xs text-ink-muted">
              {formatMinuteOfDay(ext.minuteOfDay)}
            </span>
          </div>
        ))}
      </div>

      {(day.sunriseMinute !== null || day.sunsetMinute !== null) && (
        <div className="flex items-center gap-4 border-t border-line-subtle pt-3 text-xs text-ink-secondary sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
          {day.sunriseMinute !== null && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <SunriseIcon className="h-4 w-4 text-sun" />
              {formatMinuteOfDay(day.sunriseMinute)}
            </span>
          )}
          {day.sunsetMinute !== null && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <SunsetIcon className="h-4 w-4 text-sun" />
              {formatMinuteOfDay(day.sunsetMinute)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
