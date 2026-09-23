CREATE TABLE `affiliate_conversions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`external_ref` varchar(120) NOT NULL,
	`click_ref` varchar(40),
	`provider` varchar(32) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'estimated',
	`booking_value_minor` bigint,
	`commission_minor` bigint,
	`currency` varchar(3),
	`occurred_at` timestamp,
	`reported_at` timestamp NOT NULL DEFAULT (now()),
	`settled_at` timestamp,
	`note` varchar(255),
	CONSTRAINT `affiliate_conversions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_affiliateconv_external` UNIQUE(`provider`,`external_ref`)
);
--> statement-breakpoint
CREATE TABLE `provider_clicks` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`click_ref` varchar(40) NOT NULL,
	`customer_id` bigint unsigned,
	`session_ref` varchar(64),
	`provider` varchar(32) NOT NULL,
	`seller_name` varchar(120),
	`origin_iata` varchar(3) NOT NULL,
	`destination_iata` varchar(3) NOT NULL,
	`depart_date` varchar(10) NOT NULL,
	`return_date` varchar(10),
	`adults` int NOT NULL DEFAULT 1,
	`children` int NOT NULL DEFAULT 0,
	`infants` int NOT NULL DEFAULT 0,
	`cabin` varchar(16) NOT NULL DEFAULT 'economy',
	`carrier_iata` varchar(3),
	`stops` int,
	`shown_price_minor` bigint,
	`currency` varchar(3),
	`device` varchar(16),
	`market` varchar(8),
	`source` varchar(64),
	`sandbox` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_clicks_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_providerclicks_ref` UNIQUE(`click_ref`)
);
--> statement-breakpoint
CREATE TABLE `search_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`session_ref` varchar(64),
	`origin_iata` varchar(3) NOT NULL,
	`destination_iata` varchar(3) NOT NULL,
	`depart_date` varchar(10) NOT NULL,
	`return_date` varchar(10),
	`adults` int NOT NULL DEFAULT 1,
	`children` int NOT NULL DEFAULT 0,
	`infants` int NOT NULL DEFAULT 0,
	`cabin` varchar(16) NOT NULL DEFAULT 'economy',
	`provider` varchar(32),
	`result_count` int NOT NULL DEFAULT 0,
	`lowest_price_minor` bigint,
	`currency` varchar(3),
	`duration_ms` int,
	`error_code` varchar(64),
	`device` varchar(16),
	`market` varchar(8),
	`sandbox` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `search_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `provider_clicks` ADD CONSTRAINT `provider_clicks_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_affiliateconv_status` ON `affiliate_conversions` (`status`,`reported_at`);--> statement-breakpoint
CREATE INDEX `idx_affiliateconv_click` ON `affiliate_conversions` (`click_ref`);--> statement-breakpoint
CREATE INDEX `idx_providerclicks_created` ON `provider_clicks` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_providerclicks_provider` ON `provider_clicks` (`provider`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_providerclicks_route` ON `provider_clicks` (`origin_iata`,`destination_iata`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_searchevents_created` ON `search_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_searchevents_route` ON `search_events` (`origin_iata`,`destination_iata`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_searchevents_noresult` ON `search_events` (`result_count`,`created_at`);