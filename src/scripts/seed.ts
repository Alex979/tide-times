/**
 * Seeds persistent data in the DB, such as tide-pooling location data.
 */

import { createDb } from "#/db";
import { tidePoolLocationsTable } from "#/db/schema";
import { sql } from "drizzle-orm";
import { getPlatformProxy } from "wrangler";

const isRemote = process.argv.includes("--remote");
console.log(`Target D1: ${isRemote ? "REMOTE (prod)" : "local"}`);

const { env, dispose } = await getPlatformProxy<Env>({
  environment: isRemote ? "remote" : undefined,
  remoteBindings: isRemote,
});

const TIDE_POOL_LOCATIONS: (typeof tidePoolLocationsTable.$inferInsert)[] = [
  {
    slug: "fitzgerald-marine-reserve",
    name: "Fitzgerald Marine Reserve",
    lat: 37.523754,
    lon: -122.51752,
    timezone: "America/Los_Angeles",
    noaa_station_id: "9414131",
  },
];

try {
  const db = createDb(env.tide_times);
  await db
    .insert(tidePoolLocationsTable)
    .values(TIDE_POOL_LOCATIONS)
    .onConflictDoUpdate({
      target: tidePoolLocationsTable.slug,
      set: {
        name: sql`excluded.name`,
        lat: sql`excluded.lat`,
        lon: sql`excluded.lon`,
        timezone: sql`excluded.timezone`,
        noaa_station_id: sql`excluded.noaa_station_id`,
      },
    });
} finally {
  await dispose();
}
