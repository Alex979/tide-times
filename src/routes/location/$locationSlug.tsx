import { BestWindowsList } from "#/components/location/BestWindowsList";
import { DayTideChart } from "#/components/location/DayTideChart";
import { LocationFieldNotes } from "#/components/location/LocationFieldNotes";
import {
  ChevronLeftIcon,
  ClockIcon,
  PinIcon,
  TideFallingIcon,
  TideRisingIcon,
  TideSlackIcon,
  WaveIcon,
} from "#/components/location/LocationIcons";
import { TideOutlookMatrix } from "#/components/location/TideOutlookMatrix";
import { ThemeToggle } from "#/components/ThemeToggle";
import { getLocationFieldGuide } from "#/lib/location-guide";
import { scoreToCssColor } from "#/lib/score-palette";
import {
  analyzeTideDays,
  daylightStatusLabel,
  formatDuration,
  formatHeightFt,
  formatMinuteOfDay,
  getCurrentCondition,
  getNextGoodWindow,
  getRangeTimezoneDisplay,
  getRankedWindows,
  scoreToPoints,
  tierLabel,
} from "#/lib/tide-analysis";
import { getLocationTideScoresFn } from "#/lib/tide-scores.function";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const FEATURED_FALLBACK_SLUG = "fitzgerald-marine-reserve";

function isMissingPredictionsError(error: string): boolean {
  return error.toLowerCase().includes("prediction");
}

export const Route = createFileRoute("/location/$locationSlug")({
  loader: async ({ params: { locationSlug } }) => ({
    result: await getLocationTideScoresFn({ data: locationSlug }),
    loadedAt: Date.now(),
  }),
  head: ({ loaderData }) => {
    const result = loaderData?.result;
    return {
      meta: [
        {
          title: result?.ok
            ? `${result.data.location.name} — Tide Times`
            : result && isMissingPredictionsError(result.error)
              ? "Tide predictions unavailable — Tide Times"
              : "Location not found — Tide Times",
        },
      ],
    };
  },
  component: LocationPage,
});

function LocationPage() {
  const { result, loadedAt } = Route.useLoaderData();
  const { locationSlug } = Route.useParams();

  if (!result.ok) {
    const missingPredictions = isMissingPredictionsError(result.error);
    const isAlreadyFallback =
      locationSlug.toLowerCase().trim() === FEATURED_FALLBACK_SLUG;

    return (
      <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-5 py-16">
        <div className="rounded-2xl border border-line bg-paper p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mist text-teal-deep">
            <WaveIcon className="h-5 w-5" />
          </div>
          <h1 className="font-display mt-5 text-2xl font-semibold tracking-tight text-ink">
            {missingPredictions
              ? "Tide predictions unavailable"
              : "Location not found"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
            {result.error}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {!isAlreadyFallback && (
              <Link
                to="/location/$locationSlug"
                params={{ locationSlug: FEATURED_FALLBACK_SLUG }}
                className="rounded-lg bg-teal-solid px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                View Fitzgerald Marine Reserve
              </Link>
            )}
            <Link
              to="/"
              className="rounded-lg border border-line bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-mist"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <LocationView
      key={result.data.location.slug}
      data={result.data}
      loadedAt={loadedAt}
    />
  );
}

function LocationView({
  data,
  loadedAt,
}: {
  data: Extract<
    ReturnType<typeof Route.useLoaderData>["result"],
    { ok: true }
  >["data"];
  loadedAt: number;
}) {
  const { location, scores } = data;
  const detailRef = useRef<HTMLDivElement | null>(null);

  // Seed `now` from the loader timestamp so SSR and initial hydration render identically
  const [now, setNow] = useState<Date>(() => new Date(loadedAt));
  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, [loadedAt]);

  const days = useMemo(
    () => analyzeTideDays(scores, location.timezone),
    [scores, location.timezone],
  );

  const defaultDateKey = days[0]?.dateKey ?? "";
  const [selectedDateKey, setSelectedDateKey] = useState<string>(defaultDateKey);

  useEffect(() => {
    setSelectedDateKey((prev) =>
      days.some((d) => d.dateKey === prev) ? prev : defaultDateKey,
    );
  }, [days, defaultDateKey]);

  const selectedDayIndex = useMemo(() => {
    const idx = days.findIndex((d) => d.dateKey === selectedDateKey);
    return idx >= 0 ? idx : 0;
  }, [days, selectedDateKey]);

  const selectedDay = days[selectedDayIndex];

  const { globalMinHeight, globalMaxHeight } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of scores) {
      if (s.heightFt < min) min = s.heightFt;
      if (s.heightFt > max) max = s.heightFt;
    }
    return {
      globalMinHeight: Number.isFinite(min) ? min : -1.5,
      globalMaxHeight: Number.isFinite(max) ? max : 6,
    };
  }, [scores]);

  const rankedWindows = useMemo(
    () => getRankedWindows(days, now, location.timezone, 6),
    [days, now, location.timezone],
  );

  const currentCondition = useMemo(
    () => getCurrentCondition(days, now, location.timezone),
    [days, now, location.timezone],
  );

  const nextWindow = useMemo(
    () => getNextGoodWindow(days, now, location.timezone),
    [days, now, location.timezone],
  );

  const tzDisplay = useMemo(() => {
    const refDate = scores[0]?.timestamp ?? new Date(2026, 0, 1);
    return getRangeTimezoneDisplay(location.timezone, days, refDate);
  }, [location.timezone, days, scores]);

  const guide = useMemo(
    () => getLocationFieldGuide(location.slug),
    [location.slug],
  );

  const handleSelectDay = useCallback((dateKey: string) => {
    setSelectedDateKey(dateKey);
  }, []);

  const handleJumpToDay = useCallback(
    (dateKey: string, scrollToChart = false) => {
      setSelectedDateKey(dateKey);
      if (scrollToChart) {
        detailRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    },
    [],
  );

  return (
    <div className="min-h-screen bg-mist text-ink">
      {/* Quiet Top Navigation Bar */}
      <header className="border-b border-line-subtle bg-paper/75 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-secondary transition-colors hover:text-ink"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            <span>Tide Times</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <ClockIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="sm:hidden">{tzDisplay.short}</span>
              <span className="hidden sm:inline">
                {tzDisplay.long} ({tzDisplay.short})
              </span>
            </div>

            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-7 pb-16 sm:px-6 sm:pt-9 lg:px-8">
        {/* Location Hero Header */}
        <div className="flex flex-col gap-6 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl leading-[1.06] font-semibold tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
              {location.name}
            </h1>

            <div className="mt-2 flex items-center gap-1.5 text-sm text-ink-secondary">
              <PinIcon className="h-4 w-4 shrink-0 text-teal-mid" />
              <span>{guide.region}</span>
            </div>

            {/* Live Score & Supporting Tide State */}
            <div className="mt-3 min-h-[26px] text-sm">
              {currentCondition ? (
                <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1.5 text-ink-secondary">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      currentCondition.tier === "prime"
                        ? "bg-teal-solid text-white"
                        : currentCondition.tier === "good"
                          ? "bg-teal-soft text-teal-deep"
                          : "border border-line bg-paper text-ink-secondary"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-block h-2 w-2 rounded-full ring-1 ${
                        currentCondition.tier === "prime"
                          ? "ring-white/50"
                          : "ring-ink/15"
                      }`}
                      style={{
                        backgroundColor: scoreToCssColor(
                          currentCondition.score,
                        ),
                      }}
                    />
                    <span className="tabular-nums">
                      Score {scoreToPoints(currentCondition.score)} now
                    </span>
                    <span className="opacity-85">
                      ({tierLabel(currentCondition.tier)})
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1 text-ink-secondary">
                    {currentCondition.trend === "falling" ? (
                      <TideFallingIcon className="h-4 w-4 text-teal-deep" />
                    ) : currentCondition.trend === "rising" ? (
                      <TideRisingIcon className="h-4 w-4 text-ink-muted" />
                    ) : (
                      <TideSlackIcon className="h-4 w-4 text-ink-muted" />
                    )}
                    <span className="tabular-nums font-medium text-ink">
                      {formatHeightFt(currentCondition.heightFt)}
                    </span>
                    <span>
                      and{" "}
                      {currentCondition.trend === "slack"
                        ? "near slack"
                        : currentCondition.trend}
                    </span>
                  </span>

                  {!currentCondition.isDaylight && (
                    <span className="text-xs text-ink-muted">
                      {daylightStatusLabel(currentCondition.sunScore)}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-ink-muted">
                  14-day tide pooling forecast
                </span>
              )}
            </div>
          </div>

          {/* Primary Actionable Takeaway: Active or Next Upcoming Window */}
          {nextWindow && (
            <button
              type="button"
              onClick={() => handleJumpToDay(nextWindow.dateKey, true)}
              className="group flex min-h-[104px] w-full cursor-pointer items-center justify-between gap-5 rounded-xl border border-line bg-paper px-4 py-3.5 text-left transition-colors hover:border-teal-deep/50 lg:w-auto lg:min-w-[324px]"
            >
              <div>
                <div className="text-xs font-medium text-teal-deep">
                  {nextWindow.isActiveNow
                    ? `${tierLabel(nextWindow.tier)} window open now`
                    : `Next ${tierLabel(nextWindow.tier).toLowerCase()} window`}
                </div>
                <div className="font-display mt-0.5 text-lg leading-snug font-semibold text-ink">
                  {nextWindow.day.shortDateLabel}
                </div>
                <div className="tabular-nums mt-0.5 text-sm text-ink-secondary">
                  {formatMinuteOfDay(nextWindow.startMinute)}–
                  {formatMinuteOfDay(nextWindow.endMinute)}{" "}
                  <span className="whitespace-nowrap text-ink-muted">
                    ({formatDuration(nextWindow.durationMinutes)})
                  </span>
                </div>
                <div className="tabular-nums mt-0.5 text-xs text-ink-muted">
                  Low tide {formatHeightFt(nextWindow.minHeightFt)}
                </div>
              </div>

              <div className="shrink-0 border-l border-line-subtle pl-4 text-right">
                <div className="tabular-nums font-display text-3xl leading-none font-semibold text-teal-deep">
                  {scoreToPoints(nextWindow.peakScore)}
                </div>
                <div className="mt-1 text-xs font-medium text-ink-muted">
                  Peak score
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Hero Instrument: 14-Day Intertidal Outlook Matrix */}
        {days.length > 0 && (
          <TideOutlookMatrix
            days={days}
            selectedDateKey={selectedDay?.dateKey ?? ""}
            onSelectDay={handleSelectDay}
            currentCondition={currentCondition}
            timezoneAxisLabel={tzDisplay.short}
          />
        )}

        {/* Secondary Instruments: Selected Day Chart + Ranked Best Windows */}
        {selectedDay && (
          <div
            ref={detailRef}
            className="mt-7 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_316px] lg:items-start"
          >
            <DayTideChart
              day={selectedDay}
              dayIndex={selectedDayIndex}
              totalDays={days.length}
              onPrevDay={() => {
                if (selectedDayIndex > 0) {
                  handleSelectDay(days[selectedDayIndex - 1].dateKey);
                }
              }}
              onNextDay={() => {
                if (selectedDayIndex < days.length - 1) {
                  handleSelectDay(days[selectedDayIndex + 1].dateKey);
                }
              }}
              globalMinHeight={globalMinHeight}
              globalMaxHeight={globalMaxHeight}
              currentCondition={currentCondition}
              plannedFactors={guide.plannedFactors}
            />

            <BestWindowsList
              windows={rankedWindows}
              days={days}
              selectedDateKey={selectedDay.dateKey}
              onSelectDay={handleSelectDay}
            />
          </div>
        )}

        {/* Coastal Field Guide & Safety Notes */}
        <div className="mt-12">
          <LocationFieldNotes locationName={location.name} guide={guide} />
        </div>
      </main>
    </div>
  );
}
