import { sql } from "drizzle-orm";
import {
  int,
  sqliteTable,
  real,
  primaryKey,
  text,
} from "drizzle-orm/sqlite-core";

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
