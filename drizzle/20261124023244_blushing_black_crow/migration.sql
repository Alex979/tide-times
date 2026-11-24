PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tide_predictions` (
	`noaa_station_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`height_ft` real NOT NULL,
	`last_updated` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `tide_predictions_pk` PRIMARY KEY(`noaa_station_id`, `timestamp`)
);
--> statement-breakpoint
INSERT INTO `__new_tide_predictions`(`noaa_station_id`, `timestamp`, `height_ft`, `last_updated`) SELECT `noaa_station_id`, `timestamp`, `height_ft`, `last_updated` FROM `tide_predictions`;--> statement-breakpoint
DROP TABLE `tide_predictions`;--> statement-breakpoint
ALTER TABLE `__new_tide_predictions` RENAME TO `tide_predictions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;