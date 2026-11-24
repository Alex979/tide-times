import { eq, max, sql } from "drizzle-orm";
import { fetchNoaaTidePredictions } from "#/api/noaa";
import type { Database } from "#/db";
import { tidePoolLocationsTable, tidePredictionsTable } from "#/db/schema";

const TIDE_PREDICTIONS_RANGE_HOURS = 4 * 7 * 24; // Four weeks out (NOAA API has 31-day cap)
const TIDE_PREDICTIONS_MINIMUM_RANGE_SECONDS = 3 * 7 * 24 * 60 * 60; // Three weeks out
const D1_INSERT_CHUNK_SIZE = 30; // 3 bound params/row -> 90 params (D1 limit is 100)

export async function populateTidePredictions(db: Database) {
  const now = new Date();

  // Fetch all unique NOAA stations across tide pooling locations.
  const uniqueStationIdRows = await db
    .selectDistinct({ noaaStationId: tidePoolLocationsTable.noaa_station_id })
    .from(tidePoolLocationsTable);

  for (const row of uniqueStationIdRows) {
    try {
      await maybePopulateTidePredictionsForStation(db, now, row.noaaStationId);
    } catch (error) {
      console.error(
        `Error populating tide predictions for station ${row.noaaStationId}:`,
        error,
      );
    }
  }
}

async function maybePopulateTidePredictionsForStation(
  db: Database,
  startTime: Date,
  noaaStationId: string,
) {
  // Check whether the maximum stored tide prediction timestamp is
  // less than our minimum timestamp range.
  const minTimestamp =
    Math.floor(startTime.getTime() / 1000) +
    TIDE_PREDICTIONS_MINIMUM_RANGE_SECONDS;

  const maxTimestampRows = await db
    .select({ value: max(tidePredictionsTable.timestamp) })
    .from(tidePredictionsTable)
    .where(eq(tidePredictionsTable.noaa_station_id, noaaStationId));
  const maxTimestamp = maxTimestampRows.at(0)?.value;

  if (
    maxTimestamp !== undefined &&
    maxTimestamp !== null &&
    Math.floor(maxTimestamp.getTime() / 1000) >= minTimestamp
  ) {
    console.log(
      `Skipping tide predictions for station ${noaaStationId}: existing data meets minimum range`,
    );
    return;
  }

  // Fetch tide predictions from NOAA Data API, and insert into DB.
  // Provide a 24h buffer.
  const fetchStart = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
  const predictions = await fetchNoaaTidePredictions(
    noaaStationId,
    fetchStart,
    TIDE_PREDICTIONS_RANGE_HOURS + 24,
  );
  const rows: (typeof tidePredictionsTable.$inferInsert)[] = predictions.map(
    (prediction) => ({
      noaa_station_id: noaaStationId,
      timestamp: prediction.timestamp,
      height_ft: prediction.value,
    }),
  );

  // Batch inserts to avoid "too many sql variables" error.
  const queries = [];
  for (let i = 0; i < rows.length; i += D1_INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + D1_INSERT_CHUNK_SIZE);
    queries.push(
      db
        .insert(tidePredictionsTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: [
            tidePredictionsTable.noaa_station_id,
            tidePredictionsTable.timestamp,
          ],
          set: {
            height_ft: sql`excluded.height_ft`,
            last_updated: sql`(unixepoch())`,
          },
        }),
    );
  }

  if (queries.length === 0) return;

  const [first, ...rest] = queries;
  const result = await db.batch([first, ...rest]);
  console.log(
    `Upserted ${rows.length} tide predictions for station ${noaaStationId} in ${result.length} batch queries`,
  );
}
