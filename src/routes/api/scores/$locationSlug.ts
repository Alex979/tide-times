import { createDb } from "#/db";
import { tidePoolLocationsTable, tidePredictionsTable } from "#/db/schema";
import { scoreTidePoolTimestamps } from "#/lib/tide-scores";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { and, eq, gte, lt } from "drizzle-orm";

// Number of days after current local date to return tide pool scores.
const TIDE_SCORES_RANGE_DAYS = 14;

export const Route = createFileRoute("/api/scores/$locationSlug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { locationSlug } = params;

        const db = createDb(env.tide_times);
        const tidePoolLocation = (
          await db
            .select()
            .from(tidePoolLocationsTable)
            .where(
              eq(
                tidePoolLocationsTable.slug,
                locationSlug.toLowerCase().trim(),
              ),
            )
            .limit(1)
        ).at(0);

        if (!tidePoolLocation) {
          return Response.json(
            {
              error: `No tide pooling location found for slug "${locationSlug}"`,
            },
            { status: 404 },
          );
        }

        // Get N-day window [start, end) aligned to local midnight.
        const now = new Date();
        const start = getLocalMidnight(now, tidePoolLocation.timezone);
        const end = getLocalMidnight(
          now,
          tidePoolLocation.timezone,
          TIDE_SCORES_RANGE_DAYS,
        );

        // Fetch tide predictions for the datetime window.
        const predictions = await db
          .select()
          .from(tidePredictionsTable)
          .where(
            and(
              eq(
                tidePredictionsTable.noaa_station_id,
                tidePoolLocation.noaa_station_id,
              ),
              gte(tidePredictionsTable.timestamp, start),
              lt(tidePredictionsTable.timestamp, end),
            ),
          )
          .orderBy(tidePredictionsTable.timestamp);

        if (predictions.length === 0) {
          return Response.json(
            {
              error: `No tide prediction data found for location "${locationSlug}"`,
            },
            { status: 404 },
          );
        }

        const scores = scoreTidePoolTimestamps(
          predictions,
          tidePoolLocation.lat,
          tidePoolLocation.lon,
        );
        return Response.json({
          location: {
            slug: tidePoolLocation.slug,
            name: tidePoolLocation.name,
            timezone: tidePoolLocation.timezone,
          },
          scores,
        });
      },
    },
  },
});

function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = getTimeZoneParts(
    date,
    timeZone,
  );
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const utcSecondsMs = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - utcSecondsMs;
}

/**
 * Returns a Date for 00:00:00 in the given IANA `timeZone` on the calendar
 * date of `date` plus `dayOffset` calendar days, handling DST transitions.
 */
function getLocalMidnight(date: Date, timeZone: string, dayOffset = 0): Date {
  const { year, month, day } = getTimeZoneParts(date, timeZone);
  const targetMidnightUtc = Date.UTC(year, month - 1, day + dayOffset);

  const offset1 = getTimeZoneOffsetMs(new Date(targetMidnightUtc), timeZone);
  const candidate1 = targetMidnightUtc - offset1;

  // Re-check offset at candidate1 in case a DST transition occurred between
  // targetMidnightUtc and candidate1.
  const offset2 = getTimeZoneOffsetMs(new Date(candidate1), timeZone);
  if (offset2 === offset1) {
    return new Date(candidate1);
  }

  const candidate2 = targetMidnightUtc - offset2;
  // If 00:00 itself was skipped by spring-forward DST, candidate2 falls on the
  // previous day (its offset won't match offset2), so keep candidate1.
  const offset3 = getTimeZoneOffsetMs(new Date(candidate2), timeZone);
  return new Date(offset3 === offset2 ? candidate2 : candidate1);
}
