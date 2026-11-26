export type PlannedFactorPreview = {
  swellSummary: string;
  swellNote: string;
  weatherSummary: string;
  weatherNote: string;
};

export type LocationFieldGuide = {
  region: string;
  habitat: string;
  summary: string;
  idealThresholdNote: string;
  plannedFactors: PlannedFactorPreview;
  accessNotes: string[];
  safetyNotes: string[];
  wildlifeHighlights: string[];
  isPlaceholder: boolean;
};

const LOCATION_GUIDES: Record<string, LocationFieldGuide> = {
  "fitzgerald-marine-reserve": {
    region: "Moss Beach, San Mateo County, California",
    habitat: "Intertidal mudstone reef and cypress bluff",
    summary:
      "Expansive flat shale benches reveal sheltered pools, surge channels, and kelp beds when overall tide pooling conditions peak.",
    idealThresholdNote:
      "Scores currently combine tide elevation and daylight, with coastal swell and weather planned next. Plan to arrive 45 minutes before the peak window.",
    plannedFactors: {
      swellSummary: "2–3 ft WNW, 11s",
      swellNote: "Sample preview",
      weatherSummary: "58°F, light breeze",
      weatherNote: "Sample preview",
    },
    accessNotes: [
      "Parking along California Avenue fills quickly on sunny weekend minus tides; arrive early or park along North Lake Street.",
      "A short walk down the cypress bluff trail leads directly to the main shale reef at the north end of the reserve.",
      "No collecting or removing shells, rocks, or marine life — this coastline is a protected State Marine Conservation Area.",
    ],
    safetyNotes: [
      "Wet algae-covered shale is extremely slick; wear lug-soled shoes or reef boots rather than sandals.",
      "Keep an eye on the incoming swell and never turn your back on the surf — sneaker waves sweep across low outer shelves.",
      "Give resting harbor seals at least 300 feet of space on the north beach and outer rocks.",
    ],
    wildlifeHighlights: [
      "Giant green anemones",
      "Ochre sea stars",
      "Purple sea urchins",
      "Hermit crabs & shore crabs",
      "Red & gumboot chitons",
      "Harbor seals offshore",
    ],
    isPlaceholder: true,
  },
};

export function getLocationFieldGuide(slug: string): LocationFieldGuide {
  const normalized = slug.toLowerCase().trim();
  if (LOCATION_GUIDES[normalized]) {
    return LOCATION_GUIDES[normalized];
  }

  return {
    region: "Coastal Intertidal Zone",
    habitat: "Rocky shoreline and tide pools",
    summary:
      "Daylight low tides expose intertidal pools and marine habitats along the rocky shore. Overall conditions depend on water level, light, and surf.",
    idealThresholdNote:
      "Scores currently combine tide elevation and daylight, with coastal swell and weather planned next. Arrive 30 to 45 minutes ahead of peak conditions.",
    plannedFactors: {
      swellSummary: "2–4 ft swell",
      swellNote: "Sample preview",
      weatherSummary: "Coastal overcast",
      weatherNote: "Sample preview",
    },
    accessNotes: [
      "Arrive 30 to 45 minutes ahead of peak low tide to explore while water is still receding.",
      "Check local coastal park advisories and parking hours before heading out.",
      "Observe marine life gently without prying animals off rocks or disturbing nesting areas.",
    ],
    safetyNotes: [
      "Wear sturdy shoes with wet-rock grip; kelp and wet stone are unexpectedly slippery.",
      "Watch ocean sets continuously and stay clear of sudden sneaker waves near outer ledges.",
      "Head back toward higher ground as soon as the tide turns and channels begin to refill.",
    ],
    wildlifeHighlights: [
      "Sea anemones",
      "Intertidal sea stars",
      "Shore & hermit crabs",
      "Barnacles & mussels",
      "Limpets & chitons",
      "Tidepool sculpins",
    ],
    isPlaceholder: true,
  };
}
