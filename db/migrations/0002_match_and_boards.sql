CREATE TABLE `match_comments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`session_id` bigint unsigned NOT NULL,
	`participant_id` bigint unsigned NOT NULL,
	`body` varchar(500) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `match_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `match_participants` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`session_id` bigint unsigned NOT NULL,
	`name` varchar(40) NOT NULL,
	`customer_id` bigint unsigned,
	`key_hash` varchar(64) NOT NULL,
	`answers_json` text NOT NULL,
	`share_budget` boolean NOT NULL DEFAULT false,
	`unavailable_json` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `match_participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `match_sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token` varchar(32) NOT NULL,
	`mode` varchar(12) NOT NULL,
	`title` varchar(80) NOT NULL,
	`owner_customer_id` bigint unsigned,
	`owner_key_hash` varchar(64),
	`decided_destination_id` varchar(40),
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `match_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_match_token` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `match_votes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`session_id` bigint unsigned NOT NULL,
	`participant_id` bigint unsigned NOT NULL,
	`destination_id` varchar(40) NOT NULL,
	`value` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `match_votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_matchvote` UNIQUE(`participant_id`,`destination_id`)
);
--> statement-breakpoint
CREATE TABLE `trip_board_comments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`board_id` bigint unsigned NOT NULL,
	`author_name` varchar(40) NOT NULL,
	`author_customer_id` bigint unsigned,
	`body` varchar(500) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trip_board_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trip_board_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`board_id` bigint unsigned NOT NULL,
	`kind` varchar(16) NOT NULL,
	`ref_id` varchar(120),
	`payload_json` text,
	`note` varchar(500),
	`added_by_name` varchar(40),
	`added_by_customer_id` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trip_board_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trip_board_votes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`item_id` bigint unsigned NOT NULL,
	`voter_key` varchar(64) NOT NULL,
	`voter_name` varchar(40) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trip_board_votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_boardvote` UNIQUE(`item_id`,`voter_key`)
);
--> statement-breakpoint
CREATE TABLE `trip_boards` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token` varchar(32) NOT NULL,
	`owner_customer_id` bigint unsigned NOT NULL,
	`title` varchar(80) NOT NULL,
	`cover_destination_id` varchar(40),
	`when_text` varchar(60),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trip_boards_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_board_token` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `match_comments` ADD CONSTRAINT `match_comments_session_id_match_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `match_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_comments` ADD CONSTRAINT `match_comments_participant_id_match_participants_id_fk` FOREIGN KEY (`participant_id`) REFERENCES `match_participants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_participants` ADD CONSTRAINT `match_participants_session_id_match_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `match_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_participants` ADD CONSTRAINT `match_participants_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_sessions` ADD CONSTRAINT `match_sessions_owner_customer_id_customer_accounts_id_fk` FOREIGN KEY (`owner_customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_votes` ADD CONSTRAINT `match_votes_session_id_match_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `match_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_votes` ADD CONSTRAINT `match_votes_participant_id_match_participants_id_fk` FOREIGN KEY (`participant_id`) REFERENCES `match_participants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trip_board_comments` ADD CONSTRAINT `trip_board_comments_board_id_trip_boards_id_fk` FOREIGN KEY (`board_id`) REFERENCES `trip_boards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trip_board_comments` ADD CONSTRAINT `trip_board_comments_author_customer_id_customer_accounts_id_fk` FOREIGN KEY (`author_customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trip_board_items` ADD CONSTRAINT `trip_board_items_board_id_trip_boards_id_fk` FOREIGN KEY (`board_id`) REFERENCES `trip_boards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trip_board_items` ADD CONSTRAINT `trip_board_items_added_by_customer_id_customer_accounts_id_fk` FOREIGN KEY (`added_by_customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trip_board_votes` ADD CONSTRAINT `trip_board_votes_item_id_trip_board_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `trip_board_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trip_boards` ADD CONSTRAINT `trip_boards_owner_customer_id_customer_accounts_id_fk` FOREIGN KEY (`owner_customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_matchcomment_session` ON `match_comments` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_matchpart_session` ON `match_participants` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_match_owner` ON `match_sessions` (`owner_customer_id`);--> statement-breakpoint
CREATE INDEX `idx_matchvote_session` ON `match_votes` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_boardcomment_board` ON `trip_board_comments` (`board_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_boarditem_board` ON `trip_board_items` (`board_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_board_owner` ON `trip_boards` (`owner_customer_id`);