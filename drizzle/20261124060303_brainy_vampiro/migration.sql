CREATE TABLE `tide_pool_locations` (
	`slug` text PRIMARY KEY,
	`name` text NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`timezone` text NOT NULL,
	`noaa_station_id` text NOT NULL
);
