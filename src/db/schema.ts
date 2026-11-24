import { sql } from "drizzle-orm";
import {
  int,
  sqliteTable,
  real,
  primaryKey,
  text,
} from "drizzle-orm/sqlite-core";

export const tidePoolLocationsTable = sqliteTable("tide_pool_locations", {
  slug: text().primaryKey(),
  name: text().notNull(),
  lat: real().notNull(),
  lon: real().notNull(),
  timezone: text().notNull(),
  noaa_station_id: text().notNull(),
});

export const tidePredictionsTable = sqliteTable(
  "tide_predictions",
  {
    noaa_station_id: text().notNull(),
    timestamp: int({ mode: "timestamp" }).notNull(),
    height_ft: real().notNull(),
    last_updated: int({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.noaa_station_id, table.timestamp] }),
  ],
);
