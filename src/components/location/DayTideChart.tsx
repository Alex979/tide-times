import { DayAlmanacFooter } from "#/components/location/DayAlmanacFooter";
import type { ScrubState } from "#/components/location/dayChartUtils";
import { DayTideHeader } from "#/components/location/DayTideHeader";
import { ScoreFactorsGrid } from "#/components/location/ScoreFactorsGrid";
import { TideCurvePlot } from "#/components/location/TideCurvePlot";
import type { PlannedFactorPreview } from "#/lib/location-guide";
import type {
  CurrentCondition,
  DayAnalysis,
  ScoreSlot,
} from "#/lib/tide-analysis";
import { useCallback, useEffect, useMemo, useState } from "react";

type DayTideChartProps = {
  day: DayAnalysis;
  dayIndex: number;
  totalDays: number;
  onPrevDay: () => void;
  onNextDay: () => void;
  globalMinHeight: number;
  globalMaxHeight: number;
  currentCondition: CurrentCondition | null;
  plannedFactors: PlannedFactorPreview;
};

export function DayTideChart({
  day,
  dayIndex,
  totalDays,
  onPrevDay,
  onNextDay,
  globalMinHeight,
  globalMaxHeight,
  currentCondition,
  plannedFactors,
}: DayTideChartProps) {
  const [scrub, setScrub] = useState<ScrubState | null>(null);

  useEffect(() => {
    setScrub(null);
  }, [day]);

  const handleScrub = useCallback((slot: ScoreSlot, pinned: boolean) => {
    setScrub({ slot, pinned });
  }, []);

  const handleClearScrub = useCallback(() => {
    setScrub(null);
  }, []);

  const handleMouseLeavePlot = useCallback(() => {
    setScrub((prev) => (prev?.pinned ? prev : null));
  }, []);

  // Factor breakdown targets scrubbed slot if active, otherwise bestWindow's peak slot
  const scrubSlot = scrub?.slot ?? null;
  const factorSlot = useMemo(() => {
    if (scrubSlot) return scrubSlot;
    if (day.bestWindow) return day.bestWindow.peakSlot;
    if (day.peakSlot && day.peakScore > 0) return day.peakSlot;
    return day.scores[Math.floor(day.scores.length / 2)] ?? null;
  }, [scrubSlot, day.bestWindow, day.peakSlot, day.peakScore, day.scores]);

  const isToday = currentCondition?.dateKey === day.dateKey;

  return (
    <section
      aria-labelledby="selected-day-heading"
      className="flex flex-col rounded-2xl border border-line bg-paper"
    >
      <DayTideHeader
        day={day}
        dayIndex={dayIndex}
        totalDays={totalDays}
        isToday={isToday}
        onPrevDay={onPrevDay}
        onNextDay={onNextDay}
      />

      <TideCurvePlot
        day={day}
        globalMinHeight={globalMinHeight}
        globalMaxHeight={globalMaxHeight}
        currentCondition={currentCondition}
        isToday={isToday}
        scrub={scrub}
        onScrub={handleScrub}
        onClearScrub={handleClearScrub}
        onMouseLeavePlot={handleMouseLeavePlot}
      />

      {factorSlot && (
        <ScoreFactorsGrid
          day={day}
          factorSlot={factorSlot}
          scrubSlot={scrubSlot}
          plannedFactors={plannedFactors}
        />
      )}

      <DayAlmanacFooter day={day} />
    </section>
  );
}
