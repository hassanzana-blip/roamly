CREATE TABLE `customer_notifications` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`type` varchar(24) NOT NULL,
	`title` varchar(160) NOT NULL,
	`body` text,
	`href` varchar(255),
	`dedupe_key` varchar(120),
	`read_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_notif_dedupe` UNIQUE(`dedupe_key`)
);
--> statement-breakpoint
CREATE TABLE `customer_travel_profiles` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`home_airports_json` text,
	`favourite_destinations_json` text,
	`preferred_cabin` varchar(16),
	`baggage_preference` varchar(16),
	`companions` varchar(16),
	`flight_prefs_json` text,
	`timing_prefs_json` text,
	`seat_preference` varchar(16),
	`taste_json` text,
	`notification_prefs_json` text,
	`referral_shares` int NOT NULL DEFAULT 0,
	`onboarding_completed_at` timestamp,
	`onboarding_skipped_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_travel_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_travelprofile_customer` UNIQUE(`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `deal_feedback` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`deal_id` varchar(64) NOT NULL,
	`verdict` varchar(16) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deal_feedback_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_dealfeedback_customer_deal` UNIQUE(`customer_id`,`deal_id`)
);
--> statement-breakpoint
CREATE TABLE `price_watches` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`origin_iata` varchar(3) NOT NULL,
	`destination_iata` varchar(3) NOT NULL,
	`date_from` varchar(10) NOT NULL,
	`date_to` varchar(10) NOT NULL,
	`weekends_only` boolean NOT NULL DEFAULT false,
	`nights_min` int,
	`nights_max` int,
	`max_price_minor` bigint NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NOK',
	`max_stops` int,
	`min_checked_bags` int,
	`adults` int NOT NULL DEFAULT 1,
	`children` int NOT NULL DEFAULT 0,
	`infants` int NOT NULL DEFAULT 0,
	`cabin` varchar(16) NOT NULL DEFAULT 'economy',
	`cadence` varchar(12) NOT NULL DEFAULT 'daily',
	`active` boolean NOT NULL DEFAULT true,
	`last_checked_at` timestamp,
	`last_notified_at` timestamp,
	`last_result_json` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_watches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reward_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`kind` varchar(24) NOT NULL,
	`amount_kr` int NOT NULL,
	`ref_type` varchar(32),
	`ref_id` varchar(64),
	`note` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reward_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_reward_ref` UNIQUE(`kind`,`ref_type`,`ref_id`)
);
--> statement-breakpoint
CREATE TABLE `saved_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`kind` varchar(16) NOT NULL,
	`ref_id` varchar(120) NOT NULL,
	`payload_json` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_saved_customer_kind_ref` UNIQUE(`customer_id`,`kind`,`ref_id`)
);
--> statement-breakpoint
CREATE TABLE `search_history` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`origin_iata` varchar(3) NOT NULL,
	`destination_iata` varchar(3) NOT NULL,
	`depart_date` varchar(10) NOT NULL,
	`return_date` varchar(10),
	`adults` int NOT NULL DEFAULT 1,
	`children` int NOT NULL DEFAULT 0,
	`infants` int NOT NULL DEFAULT 0,
	`cabin` varchar(16) NOT NULL DEFAULT 'economy',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `search_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customer_notifications` ADD CONSTRAINT `customer_notifications_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_travel_profiles` ADD CONSTRAINT `customer_travel_profiles_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deal_feedback` ADD CONSTRAINT `deal_feedback_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_watches` ADD CONSTRAINT `price_watches_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reward_events` ADD CONSTRAINT `reward_events_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saved_items` ADD CONSTRAINT `saved_items_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `search_history` ADD CONSTRAINT `search_history_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_notif_customer` ON `customer_notifications` (`customer_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_pricewatch_customer` ON `price_watches` (`customer_id`,`active`);--> statement-breakpoint
CREATE INDEX `idx_pricewatch_due` ON `price_watches` (`active`,`last_checked_at`);--> statement-breakpoint
CREATE INDEX `idx_reward_customer` ON `reward_events` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_saved_customer` ON `saved_items` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_searchhistory_customer` ON `search_history` (`customer_id`,`created_at`);