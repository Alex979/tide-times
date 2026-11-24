const BASE_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

interface NoaaTidePredictionsApiResponse {
  predictions: {
    t: string;
    v: string;
  }[];
}

function isNoaaTidePredictionsApiResponse(
  data: unknown,
): data is NoaaTidePredictionsApiResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  if (!("predictions" in data) || !Array.isArray(data.predictions)) {
    return false;
  }

  for (const prediction of data.predictions) {
    if (
      !("t" in prediction) ||
      typeof prediction.t !== "string" ||
      !("v" in prediction) ||
      typeof prediction.v !== "string"
    ) {
      return false;
    }
  }

  return true;
}

interface TidePrediction {
  timestamp: Date;
  value: number;
}

async function fetchNoaaTidePredictions(
  station: string,
  startDatetime: Date,
  rangeHours: number,
): Promise<TidePrediction[]> {
  const noaaDatetime = startDatetime
    .toISOString()
    .slice(0, 16)
    .replaceAll("-", "")
    .replace("T", " ");
  const url = new URL(BASE_URL);
  url.searchParams.append("begin_date", noaaDatetime);
  url.searchParams.append("range", Math.floor(rangeHours).toString());
  url.searchParams.append("station", station);
  url.searchParams.append("product", "predictions");
  url.searchParams.append("datum", "MLLW");
  url.searchParams.append("time_zone", "gmt");
  url.searchParams.append("interval", "15");
  url.searchParams.append("units", "english");
  url.searchParams.append("application", "tide-times");
  url.searchParams.append("format", "json");

  const response = await fetch(url);
  const data = await response.json();
  if (!isNoaaTidePredictionsApiResponse(data)) {
    throw Error(`Invalid API response: ${JSON.stringify(data, null, 2)}`);
  }

  return data.predictions.map((prediction) => {
    const dateStr = prediction.t.replace(" ", "T") + "Z";
    const date = new Date(dateStr);
    return {
      timestamp: date,
      value: Number(prediction.v),
    };
  });
}

export { fetchNoaaTidePredictions };
export type { TidePrediction };
