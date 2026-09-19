CREATE TABLE `content_reports` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reporter_id` bigint unsigned NOT NULL,
	`target_type` varchar(20) NOT NULL,
	`target_id` bigint unsigned NOT NULL,
	`reason` varchar(24) NOT NULL,
	`details` varchar(500),
	`status` varchar(12) NOT NULL DEFAULT 'open',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`resolved_at` timestamp,
	CONSTRAINT `content_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_blocks` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`blocker_id` bigint unsigned NOT NULL,
	`blocked_id` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_blocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_block` UNIQUE(`blocker_id`,`blocked_id`)
);
--> statement-breakpoint
CREATE TABLE `customer_document_blobs` (
	`document_id` bigint unsigned NOT NULL,
	`ciphertext` mediumblob NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_document_blobs_document_id` PRIMARY KEY(`document_id`)
);
--> statement-breakpoint
CREATE TABLE `customer_documents` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`trip_plan_id` bigint unsigned,
	`booking_id` bigint unsigned,
	`kind` varchar(24) NOT NULL,
	`title` varchar(120) NOT NULL,
	`file_name` varchar(160) NOT NULL,
	`mime` varchar(64) NOT NULL,
	`bytes` int NOT NULL,
	`source` varchar(12) NOT NULL DEFAULT 'manual',
	`travel_date` varchar(10),
	`sha256` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_friendships` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`requester_id` bigint unsigned NOT NULL,
	`addressee_id` bigint unsigned,
	`status` varchar(12) NOT NULL DEFAULT 'pending',
	`invite_token_hash` varchar(64),
	`invite_expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`responded_at` timestamp,
	CONSTRAINT `customer_friendships_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_friend_invite` UNIQUE(`invite_token_hash`)
);
--> statement-breakpoint
CREATE TABLE `group_poll_options` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`poll_id` bigint unsigned NOT NULL,
	`destination_id` varchar(40),
	`label` varchar(60) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `group_poll_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_poll_votes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`poll_id` bigint unsigned NOT NULL,
	`option_id` bigint unsigned NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_poll_votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_grouppollvote` UNIQUE(`poll_id`,`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `group_polls` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`group_id` bigint unsigned NOT NULL,
	`created_by_id` bigint unsigned NOT NULL,
	`question` varchar(120) NOT NULL,
	`closed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_polls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_comments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`post_id` bigint unsigned NOT NULL,
	`author_id` bigint unsigned NOT NULL,
	`body` varchar(500) NOT NULL,
	`hidden` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_likes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`post_id` bigint unsigned NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_sociallike` UNIQUE(`post_id`,`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`author_id` bigint unsigned NOT NULL,
	`audience` varchar(12) NOT NULL,
	`group_id` bigint unsigned,
	`destination_id` varchar(40),
	`body` varchar(1000) NOT NULL,
	`likes` int NOT NULL DEFAULT 0,
	`hidden` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `travel_group_members` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`group_id` bigint unsigned NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`role` varchar(12) NOT NULL DEFAULT 'member',
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	`left_at` timestamp,
	CONSTRAINT `travel_group_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_groupmember` UNIQUE(`group_id`,`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `travel_groups` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`name` varchar(60) NOT NULL,
	`cover_destination_id` varchar(40),
	`invite_token_hash` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `travel_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_group_invite` UNIQUE(`invite_token_hash`)
);
--> statement-breakpoint
CREATE TABLE `trip_plans` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`title` varchar(80) NOT NULL,
	`destination_id` varchar(40),
	`origin_iata` varchar(3),
	`destination_iata` varchar(3),
	`date_from` varchar(10),
	`date_to` varchar(10),
	`adults` int NOT NULL DEFAULT 1,
	`children` int NOT NULL DEFAULT 0,
	`status` varchar(12) NOT NULL DEFAULT 'idea',
	`booking_id` bigint unsigned,
	`group_id` bigint unsigned,
	`notes` text,
	`packing_json` text,
	`archived_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trip_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `content_reports` ADD CONSTRAINT `content_reports_reporter_id_customer_accounts_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_blocks` ADD CONSTRAINT `customer_blocks_blocker_id_customer_accounts_id_fk` FOREIGN KEY (`blocker_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_blocks` ADD CONSTRAINT `customer_blocks_blocked_id_customer_accounts_id_fk` FOREIGN KEY (`blocked_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_document_blobs` ADD CONSTRAINT `customer_document_blobs_document_id_customer_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `customer_documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_documents` ADD CONSTRAINT `customer_documents_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_documents` ADD CONSTRAINT `customer_documents_trip_plan_id_trip_plans_id_fk` FOREIGN KEY (`trip_plan_id`) REFERENCES `trip_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_documents` ADD CONSTRAINT `customer_documents_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_friendships` ADD CONSTRAINT `customer_friendships_requester_id_customer_accounts_id_fk` FOREIGN KEY (`requester_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_friendships` ADD CONSTRAINT `customer_friendships_addressee_id_customer_accounts_id_fk` FOREIGN KEY (`addressee_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_poll_options` ADD CONSTRAINT `group_poll_options_poll_id_group_polls_id_fk` FOREIGN KEY (`poll_id`) REFERENCES `group_polls`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_poll_votes` ADD CONSTRAINT `group_poll_votes_poll_id_group_polls_id_fk` FOREIGN KEY (`poll_id`) REFERENCES `group_polls`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_poll_votes` ADD CONSTRAINT `group_poll_votes_option_id_group_poll_options_id_fk` FOREIGN KEY (`option_id`) REFERENCES `group_poll_options`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_poll_votes` ADD CONSTRAINT `group_poll_votes_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_polls` ADD CONSTRAINT `group_polls_group_id_travel_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `travel_groups`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_polls` ADD CONSTRAINT `group_polls_created_by_id_customer_accounts_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `social_comments` ADD CONSTRAINT `social_comments_post_id_social_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `social_comments` ADD CONSTRAINT `social_comments_author_id_customer_accounts_id_fk` FOREIGN KEY (`author_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `social_likes` ADD CONSTRAINT `social_likes_post_id_social_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `social_likes` ADD CONSTRAINT `social_likes_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `social_posts` ADD CONSTRAINT `social_posts_author_id_customer_accounts_id_fk` FOREIGN KEY (`author_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `social_posts` ADD CONSTRAINT `social_posts_group_id_travel_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `travel_groups`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `travel_group_members` ADD CONSTRAINT `travel_group_members_group_id_travel_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `travel_groups`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `travel_group_members` ADD CONSTRAINT `travel_group_members_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `travel_groups` ADD CONSTRAINT `travel_groups_owner_id_customer_accounts_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trip_plans` ADD CONSTRAINT `trip_plans_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trip_plans` ADD CONSTRAINT `trip_plans_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trip_plans` ADD CONSTRAINT `trip_plans_group_id_travel_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `travel_groups`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_report_status` ON `content_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_report_target` ON `content_reports` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_custdoc_customer` ON `customer_documents` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_custdoc_plan` ON `customer_documents` (`trip_plan_id`);--> statement-breakpoint
CREATE INDEX `idx_friend_requester` ON `customer_friendships` (`requester_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_friend_addressee` ON `customer_friendships` (`addressee_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_grouppollopt_poll` ON `group_poll_options` (`poll_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_grouppoll_group` ON `group_polls` (`group_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_socialcomment_post` ON `social_comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_socialpost_author` ON `social_posts` (`author_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_socialpost_group` ON `social_posts` (`group_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_groupmember_customer` ON `travel_group_members` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_group_owner` ON `travel_groups` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_tripplan_customer` ON `trip_plans` (`customer_id`,`status`,`updated_at`);