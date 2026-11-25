import type { tidePredictionsTable } from "#/db/schema";
import { smoothstep } from "./math";
import * as SunCalc from "suncalc";

const TIDE_LEVEL_IDEAL_MAX_FEET = 1.5;
const TIDE_LEVEL_IDEAL_MIN_FEET = -2.0;

export function scoreTidePoolTimestamps(
  predictions: (typeof tidePredictionsTable.$inferSelect)[],
  lat: number,
  lon: number,
) {
  return predictions.map((prediction) => {
    const tideScore =
      1.0 -
      smoothstep(
        TIDE_LEVEL_IDEAL_MIN_FEET,
        TIDE_LEVEL_IDEAL_MAX_FEET,
        prediction.height_ft,
      );

    const { altitude } = SunCalc.getPosition(prediction.timestamp, lat, lon);
    const sunScore = smoothstep(-6, 0, altitude);

    const score = tideScore * sunScore;

    return {
      timestamp: prediction.timestamp,
      heightFt: prediction.height_ft,
      tideScore,
      sunDeg: altitude,
      sunScore,
      score,
    };
  });
}
