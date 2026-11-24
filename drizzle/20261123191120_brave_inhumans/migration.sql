CREATE TABLE `tide_predictions` (
	`noaa_station_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`height_ft` real NOT NULL,
	`last_updated` integer NOT NULL,
	CONSTRAINT `tide_predictions_pk` PRIMARY KEY(`noaa_station_id`, `timestamp`)
);
