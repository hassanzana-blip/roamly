CREATE TABLE `expense_receipts` (
	`expense_id` bigint unsigned NOT NULL,
	`data` mediumtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expense_receipts_expense_id` PRIMARY KEY(`expense_id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`staff_user_id` bigint unsigned NOT NULL,
	`spent_on` varchar(10) NOT NULL,
	`vendor` varchar(120) NOT NULL,
	`category` varchar(32) NOT NULL DEFAULT 'annet',
	`gross_minor` bigint NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NOK',
	`vat_rate_bp` int,
	`vat_minor` bigint NOT NULL DEFAULT 0,
	`note` varchar(500),
	`status` varchar(16) NOT NULL DEFAULT 'draft',
	`period` varchar(7) NOT NULL,
	`receipt_mime` varchar(64),
	`receipt_name` varchar(160),
	`receipt_bytes` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `expense_receipts` ADD CONSTRAINT `expense_receipts_expense_id_expenses_id_fk` FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_staff_user_id_staff_users_id_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_expense_period` ON `expenses` (`period`,`staff_user_id`);--> statement-breakpoint
CREATE INDEX `idx_expense_staff` ON `expenses` (`staff_user_id`,`spent_on`);