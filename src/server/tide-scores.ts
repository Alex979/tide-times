import { createDb } from "#/db";
import { getLocationTideScores } from "#/services/tide-scores";
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

export const getLocationTideScoresFn = createServerFn({ method: "GET" })
  .validator((locationSlug: string) => locationSlug)
  .handler(async ({ data: locationSlug }) => {
    const db = createDb(env.tide_times);
    return getLocationTideScores(db, locationSlug);
  });
