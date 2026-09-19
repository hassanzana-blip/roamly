CREATE TABLE `customer_identities` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`provider` varchar(20) NOT NULL,
	`subject` varchar(191) NOT NULL,
	`social` varchar(20),
	`email` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_login_at` timestamp,
	CONSTRAINT `customer_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_custident_provider_subject` UNIQUE(`provider`,`subject`)
);
--> statement-breakpoint
ALTER TABLE `customer_identities` ADD CONSTRAINT `customer_identities_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_custident_customer` ON `customer_identities` (`customer_id`);