import { createDb } from "#/db";
import { getLocationTideScores } from "#/services/tide-scores";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

export const Route = createFileRoute("/api/scores/$locationSlug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const db = createDb(env.tide_times);
        const result = await getLocationTideScores(db, params.locationSlug);

        if (!result.ok) {
          return Response.json(
            { error: result.error },
            { status: result.status },
          );
        }

        return Response.json(result.data);
      },
    },
  },
});
