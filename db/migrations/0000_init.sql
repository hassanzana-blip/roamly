CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`actor_type` varchar(16) NOT NULL,
	`actor_id` varchar(64),
	`actor_label` varchar(120),
	`action` varchar(64) NOT NULL,
	`target_type` varchar(32),
	`target_id` varchar(64),
	`metadata_json` text,
	`ip` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_access_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_bat_token` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `booking_attempt_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`attempt_id` bigint unsigned NOT NULL,
	`from_state` varchar(24),
	`to_state` varchar(24) NOT NULL,
	`detail` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_attempt_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_attempts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`checkout_session_id` bigint unsigned NOT NULL,
	`idempotency_key` varchar(64) NOT NULL,
	`state` varchar(24) NOT NULL DEFAULT 'CREATED',
	`supplier_order_id` varchar(64),
	`supplier_booking_reference` varchar(12),
	`supplier_total_minor` bigint,
	`supplier_currency` varchar(3),
	`psp_intent_id` varchar(128),
	`psp_charge_id` varchar(128),
	`booking_id` bigint unsigned,
	`attempts` int NOT NULL DEFAULT 0,
	`last_error` text,
	`last_error_code` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `booking_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_attempt_idem` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `booking_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`from_state` varchar(32),
	`to_state` varchar(32) NOT NULL,
	`actor_type` varchar(16) NOT NULL,
	`actor_id` varchar(64),
	`reason` text,
	`correlation_id` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_holds` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`offer_id` varchar(128) NOT NULL,
	`offer_snapshot` text NOT NULL,
	`search_ctx` varchar(512),
	`customer_id` bigint unsigned,
	`email` varchar(255),
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_holds_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_hold_token` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `booking_segments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`slice_index` int NOT NULL,
	`segment_index` int NOT NULL,
	`origin_iata` varchar(3) NOT NULL,
	`destination_iata` varchar(3) NOT NULL,
	`carrier_iata` varchar(3),
	`flight_number` varchar(8),
	`departing_at` varchar(40),
	`arriving_at` varchar(40),
	`cabin_class` varchar(24),
	CONSTRAINT `booking_segments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`order_id` varchar(64) NOT NULL,
	`booking_reference` varchar(12) NOT NULL,
	`contact_email` varchar(255) NOT NULL,
	`contact_phone` varchar(32),
	`live_mode` boolean NOT NULL DEFAULT false,
	`payload` mediumtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`state` varchar(32) NOT NULL DEFAULT 'CONFIRMED',
	`customer_id` bigint unsigned,
	`quote_id` bigint unsigned,
	`total_amount` decimal(12,2),
	`total_currency` varchar(3),
	`source` varchar(16) NOT NULL DEFAULT 'web',
	`idempotency_key` varchar(64),
	`customer_account_id` bigint unsigned,
	`checkout_session_id` bigint unsigned,
	`supplier` varchar(16) NOT NULL DEFAULT 'duffel',
	`cancelled_at` timestamp,
	`travel_completed_at` timestamp,
	`last_reconciled_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookings_order_id_unique` UNIQUE(`order_id`),
	CONSTRAINT `uq_bookings_idempotency` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `checkout_sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(36) NOT NULL,
	`offer_id` varchar(128) NOT NULL,
	`offer_snapshot` mediumtext NOT NULL,
	`offer_expires_at` timestamp,
	`search_ctx` varchar(512),
	`passengers_json` text NOT NULL,
	`services_json` text,
	`contact_email` varchar(255) NOT NULL,
	`contact_phone` varchar(32) NOT NULL,
	`customer_account_id` bigint unsigned,
	`locale` varchar(5) NOT NULL DEFAULT 'nb',
	`currency` varchar(3) NOT NULL,
	`supplier_amount_minor` bigint NOT NULL,
	`services_amount_minor` bigint NOT NULL DEFAULT 0,
	`service_fee_amount_minor` bigint NOT NULL DEFAULT 0,
	`bonus_used_minor` bigint NOT NULL DEFAULT 0,
	`total_amount_minor` bigint NOT NULL,
	`breakdown_json` text NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'created',
	`psp_provider` varchar(24),
	`psp_intent_id` varchar(128),
	`payment_method` varchar(24),
	`idempotency_key` varchar(64) NOT NULL,
	`booking_id` bigint unsigned,
	`last_error` text,
	`ip` varchar(45),
	`user_agent` varchar(255),
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checkout_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_checkout_public` UNIQUE(`public_id`),
	CONSTRAINT `uq_checkout_idem` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `community_comments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`post_id` bigint unsigned NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`body` text NOT NULL,
	`hidden` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_likes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`post_id` bigint unsigned NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_community_like` UNIQUE(`post_id`,`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `community_posts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`kind` varchar(16) NOT NULL DEFAULT 'story',
	`body` text NOT NULL,
	`route_tag` varchar(16),
	`likes` int NOT NULL DEFAULT 0,
	`hidden` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consents` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_account_id` bigint unsigned,
	`email` varchar(255) NOT NULL,
	`type` varchar(32) NOT NULL,
	`version` varchar(16) NOT NULL,
	`granted` boolean NOT NULL,
	`source` varchar(32) NOT NULL,
	`ip` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_accounts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(255),
	`phone` varchar(32),
	`password_hash` varchar(255) NOT NULL,
	`first_name` varchar(60) NOT NULL,
	`last_name` varchar(60) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`bonus_kr` int NOT NULL DEFAULT 0,
	`referral_code` varchar(16),
	`referred_by_id` bigint unsigned,
	`locale` varchar(5) NOT NULL DEFAULT 'nb',
	`currency` varchar(3) NOT NULL DEFAULT 'NOK',
	`marketing_consent_at` timestamp,
	`deleted_at` timestamp,
	`avatar_url` mediumtext,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_custacct_email` UNIQUE(`email`),
	CONSTRAINT `uq_custacct_phone` UNIQUE(`phone`),
	CONSTRAINT `uq_custacct_referral` UNIQUE(`referral_code`)
);
--> statement-breakpoint
CREATE TABLE `customer_email_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_email_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_custemailtoken_token` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `customer_otp_codes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_otp_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_password_resets` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_password_resets_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_custreset_token` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `customer_sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`ip` varchar(45),
	`user_agent` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp,
	CONSTRAINT `customer_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_custsession_token` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(120),
	`phone` varchar(32),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_customers_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `email_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`recipient` varchar(255) NOT NULL,
	`kind` varchar(48) NOT NULL,
	`locale` varchar(5) NOT NULL DEFAULT 'nb',
	`booking_id` bigint unsigned,
	`provider` varchar(24),
	`provider_message_id` varchar(128),
	`status` varchar(16) NOT NULL DEFAULT 'queued',
	`error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fraud_flags` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_account_id` bigint unsigned,
	`checkout_session_id` bigint unsigned,
	`booking_id` bigint unsigned,
	`type` varchar(48) NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`note` varchar(255),
	`status` varchar(16) NOT NULL DEFAULT 'open',
	`reviewed_by_id` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fraud_flags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `internal_notes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned,
	`case_id` bigint unsigned,
	`author_id` bigint unsigned NOT NULL,
	`body` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `internal_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`invoice_number` int NOT NULL,
	`kind` varchar(16) NOT NULL DEFAULT 'receipt',
	`booking_id` bigint unsigned NOT NULL,
	`refund_case_id` bigint unsigned,
	`currency` varchar(3) NOT NULL,
	`total_minor` bigint NOT NULL,
	`vat_minor` bigint NOT NULL DEFAULT 0,
	`lines_json` text NOT NULL,
	`issued_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_invoice_number` UNIQUE(`invoice_number`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`type` varchar(48) NOT NULL,
	`payload` mediumtext NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`max_attempts` int NOT NULL DEFAULT 5,
	`run_at` timestamp NOT NULL DEFAULT (now()),
	`locked_by` varchar(64),
	`locked_at` timestamp,
	`last_error` text,
	`dedupe_key` varchar(128),
	`active_dedupe_key` varchar(128),
	`priority` int NOT NULL DEFAULT 5,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_jobs_active_dedupe` UNIQUE(`active_dedupe_key`)
);
--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned,
	`payment_id` bigint unsigned,
	`refund_case_id` bigint unsigned,
	`account` varchar(32) NOT NULL,
	`direction` varchar(6) NOT NULL,
	`amount_minor` bigint NOT NULL,
	`currency` varchar(3) NOT NULL,
	`description` varchar(255),
	`external_ref` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ledger_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_requests` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`type` varchar(16) NOT NULL,
	`partner` varchar(40),
	`customer_name` varchar(120) NOT NULL,
	`customer_email` varchar(255) NOT NULL,
	`customer_phone` varchar(32),
	`details_json` text NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'new',
	`handled_by_id` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `passenger_documents` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned,
	`checkout_session_id` bigint unsigned,
	`passenger_id` varchar(64) NOT NULL,
	`type` varchar(24) NOT NULL DEFAULT 'passport',
	`identifier_ciphertext` varchar(255) NOT NULL,
	`identifier_last4` varchar(4) NOT NULL,
	`issuing_country_code` varchar(2) NOT NULL,
	`expires_on` varchar(10) NOT NULL,
	`nationality` varchar(2),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passenger_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned,
	`quote_id` bigint unsigned,
	`provider` varchar(24) NOT NULL,
	`provider_ref` varchar(128),
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NOK',
	`status` varchar(24) NOT NULL DEFAULT 'pending',
	`note` varchar(255),
	`amount_minor` bigint,
	`refunded_minor` bigint NOT NULL DEFAULT 0,
	`psp_fee_minor` bigint,
	`idempotency_key` varchar(64),
	`failure_code` varchar(64),
	`authorized_at` timestamp,
	`captured_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_payments_idem` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `payroll_entries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`staff_user_id` bigint unsigned NOT NULL,
	`period_label` varchar(40) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NOK',
	`status` varchar(16) NOT NULL DEFAULT 'planned',
	`note` varchar(255),
	`registered_by_id` bigint unsigned NOT NULL,
	`paid_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payroll_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_alerts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned,
	`email` varchar(255) NOT NULL,
	`origin_iata` varchar(3) NOT NULL,
	`destination_iata` varchar(3) NOT NULL,
	`depart_date` varchar(10) NOT NULL,
	`target_price` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `problem_reports` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`severity` varchar(16) NOT NULL DEFAULT 'medium',
	`status` varchar(16) NOT NULL DEFAULT 'open',
	`reported_by_id` bigint unsigned NOT NULL,
	`assigned_to_id` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`resolved_at` timestamp,
	CONSTRAINT `problem_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reference` varchar(16) NOT NULL,
	`created_by_id` bigint unsigned NOT NULL,
	`customer_name` varchar(120) NOT NULL,
	`customer_email` varchar(255) NOT NULL,
	`customer_phone` varchar(32),
	`offer_id` varchar(128) NOT NULL,
	`offer_snapshot` text NOT NULL,
	`passengers_json` text,
	`service_fee_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`total_amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NOK',
	`status` varchar(24) NOT NULL DEFAULT 'draft',
	`checkout_token_hash` varchar(64),
	`expires_at` timestamp NOT NULL,
	`booked_order_id` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_quotes_ref` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `refund_cases` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reference` varchar(16) NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`payment_id` bigint unsigned,
	`state` varchar(32) NOT NULL DEFAULT 'requested',
	`kind` varchar(24) NOT NULL DEFAULT 'customer_cancellation',
	`initiated_by` varchar(16) NOT NULL,
	`requested_by_id` varchar(64),
	`approved_by_id` bigint unsigned,
	`currency` varchar(3) NOT NULL,
	`requested_amount_minor` bigint,
	`supplier_cancellation_id` varchar(64),
	`supplier_refund_amount_minor` bigint,
	`supplier_refund_currency` varchar(3),
	`service_fee_refund_minor` bigint NOT NULL DEFAULT 0,
	`services_refund_minor` bigint NOT NULL DEFAULT 0,
	`customer_refund_amount_minor` bigint,
	`psp_refund_id` varchar(128),
	`psp_refund_status` varchar(24),
	`reason` text NOT NULL,
	`passenger_ids` varchar(255),
	`evidence_json` text,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`closed_at` timestamp,
	CONSTRAINT `refund_cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_refund_ref` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `refund_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`refund_case_id` bigint unsigned NOT NULL,
	`from_state` varchar(32),
	`to_state` varchar(32) NOT NULL,
	`actor_type` varchar(16) NOT NULL,
	`actor_id` varchar(64),
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `refund_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`payment_id` bigint unsigned NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`reason` text NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'requested',
	`requested_by_id` bigint unsigned NOT NULL,
	`processed_by_id` bigint unsigned,
	`processed_at` timestamp,
	`currency` varchar(3) NOT NULL DEFAULT 'NOK',
	`refund_case_id` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `refunds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_travelers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` bigint unsigned NOT NULL,
	`first_name` varchar(60) NOT NULL,
	`last_name` varchar(60) NOT NULL,
	`born_on` varchar(10),
	`gender` varchar(1),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_travelers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_changes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`webhook_event_id` bigint unsigned,
	`old_segments_json` text NOT NULL,
	`new_segments_json` text NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'detected',
	`customer_notified_at` timestamp,
	`resolved_at` timestamp,
	`resolved_by_id` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `schedule_changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`value_json` text NOT NULL,
	`updated_by_id` bigint unsigned,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_settings_key` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `staff_invites` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`role` varchar(16) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`created_by_id` bigint unsigned,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_invite_token` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `staff_notes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`author_id` bigint unsigned NOT NULL,
	`title` varchar(120) NOT NULL,
	`body` text NOT NULL,
	`pinned` boolean NOT NULL DEFAULT false,
	`color` varchar(16) NOT NULL DEFAULT 'sun',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`mfa_verified` boolean NOT NULL DEFAULT false,
	`ip` varchar(45),
	`user_agent` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp,
	CONSTRAINT `staff_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_session_token` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `staff_users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(100) NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'READ_ONLY',
	`status` varchar(16) NOT NULL DEFAULT 'invited',
	`password_hash` varchar(255),
	`avatar_url` varchar(255),
	`totp_secret` varchar(64),
	`mfa_enabled` boolean NOT NULL DEFAULT false,
	`recovery_codes_json` text,
	`invited_by_id` bigint unsigned,
	`last_login_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_staff_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `support_cases` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reference` varchar(16) NOT NULL,
	`subject` varchar(160) NOT NULL,
	`customer_email` varchar(255) NOT NULL,
	`customer_name` varchar(120),
	`booking_id` bigint unsigned,
	`priority` varchar(12) NOT NULL DEFAULT 'normal',
	`status` varchar(24) NOT NULL DEFAULT 'open',
	`assignee_id` bigint unsigned,
	`due_at` timestamp,
	`tags` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_cases_ref` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `support_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`case_reference` varchar(16) NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(255) NOT NULL,
	`booking_reference` varchar(8),
	`topic` varchar(24) NOT NULL,
	`message` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`case_id` bigint unsigned,
	`author_type` varchar(16) NOT NULL DEFAULT 'customer',
	`author_id` bigint unsigned,
	`is_internal` boolean NOT NULL DEFAULT false,
	CONSTRAINT `support_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sender_id` bigint unsigned NOT NULL,
	`body` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`passenger_id` varchar(64),
	`passenger_name` varchar(140),
	`type` varchar(32) NOT NULL DEFAULT 'electronic_ticket',
	`unique_identifier` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_ticket` UNIQUE(`booking_id`,`unique_identifier`)
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`provider` varchar(16) NOT NULL DEFAULT 'duffel',
	`event_id` varchar(64) NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`payload` mediumtext NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'received',
	`error` text,
	`processed_at` timestamp,
	`attempts` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_webhook_event` UNIQUE(`provider`,`event_id`)
);
--> statement-breakpoint
ALTER TABLE `booking_access_tokens` ADD CONSTRAINT `booking_access_tokens_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_attempt_events` ADD CONSTRAINT `booking_attempt_events_attempt_id_booking_attempts_id_fk` FOREIGN KEY (`attempt_id`) REFERENCES `booking_attempts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_attempts` ADD CONSTRAINT `booking_attempts_checkout_session_id_checkout_sessions_id_fk` FOREIGN KEY (`checkout_session_id`) REFERENCES `checkout_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_attempts` ADD CONSTRAINT `booking_attempts_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_events` ADD CONSTRAINT `booking_events_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_holds` ADD CONSTRAINT `booking_holds_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_segments` ADD CONSTRAINT `booking_segments_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_quote_id_quotes_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_customer_account_id_customer_accounts_id_fk` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_checkout_session_id_checkout_sessions_id_fk` FOREIGN KEY (`checkout_session_id`) REFERENCES `checkout_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD CONSTRAINT `checkout_sessions_customer_account_id_customer_accounts_id_fk` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD CONSTRAINT `checkout_sessions_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_comments` ADD CONSTRAINT `community_comments_post_id_community_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_comments` ADD CONSTRAINT `community_comments_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_likes` ADD CONSTRAINT `community_likes_post_id_community_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_likes` ADD CONSTRAINT `community_likes_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_posts` ADD CONSTRAINT `community_posts_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consents` ADD CONSTRAINT `consents_customer_account_id_customer_accounts_id_fk` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_accounts` ADD CONSTRAINT `customer_accounts_referred_by_id_customer_accounts_id_fk` FOREIGN KEY (`referred_by_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_email_tokens` ADD CONSTRAINT `customer_email_tokens_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_otp_codes` ADD CONSTRAINT `customer_otp_codes_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_password_resets` ADD CONSTRAINT `customer_password_resets_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_sessions` ADD CONSTRAINT `customer_sessions_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_events` ADD CONSTRAINT `email_events_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fraud_flags` ADD CONSTRAINT `fraud_flags_customer_account_id_customer_accounts_id_fk` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fraud_flags` ADD CONSTRAINT `fraud_flags_checkout_session_id_checkout_sessions_id_fk` FOREIGN KEY (`checkout_session_id`) REFERENCES `checkout_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fraud_flags` ADD CONSTRAINT `fraud_flags_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fraud_flags` ADD CONSTRAINT `fraud_flags_reviewed_by_id_staff_users_id_fk` FOREIGN KEY (`reviewed_by_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `internal_notes` ADD CONSTRAINT `internal_notes_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `internal_notes` ADD CONSTRAINT `internal_notes_case_id_support_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `support_cases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `internal_notes` ADD CONSTRAINT `internal_notes_author_id_staff_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_refund_case_id_refund_cases_id_fk` FOREIGN KEY (`refund_case_id`) REFERENCES `refund_cases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_refund_case_id_refund_cases_id_fk` FOREIGN KEY (`refund_case_id`) REFERENCES `refund_cases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_requests` ADD CONSTRAINT `partner_requests_handled_by_id_staff_users_id_fk` FOREIGN KEY (`handled_by_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `passenger_documents` ADD CONSTRAINT `passenger_documents_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `passenger_documents` ADD CONSTRAINT `passenger_documents_checkout_session_id_checkout_sessions_id_fk` FOREIGN KEY (`checkout_session_id`) REFERENCES `checkout_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_quote_id_quotes_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_entries` ADD CONSTRAINT `payroll_entries_staff_user_id_staff_users_id_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_entries` ADD CONSTRAINT `payroll_entries_registered_by_id_staff_users_id_fk` FOREIGN KEY (`registered_by_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_alerts` ADD CONSTRAINT `price_alerts_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `problem_reports` ADD CONSTRAINT `problem_reports_reported_by_id_staff_users_id_fk` FOREIGN KEY (`reported_by_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `problem_reports` ADD CONSTRAINT `problem_reports_assigned_to_id_staff_users_id_fk` FOREIGN KEY (`assigned_to_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_created_by_id_staff_users_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refund_cases` ADD CONSTRAINT `refund_cases_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refund_cases` ADD CONSTRAINT `refund_cases_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refund_cases` ADD CONSTRAINT `refund_cases_approved_by_id_staff_users_id_fk` FOREIGN KEY (`approved_by_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refund_events` ADD CONSTRAINT `refund_events_refund_case_id_refund_cases_id_fk` FOREIGN KEY (`refund_case_id`) REFERENCES `refund_cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_requested_by_id_staff_users_id_fk` FOREIGN KEY (`requested_by_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_processed_by_id_staff_users_id_fk` FOREIGN KEY (`processed_by_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_refund_case_id_refund_cases_id_fk` FOREIGN KEY (`refund_case_id`) REFERENCES `refund_cases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saved_travelers` ADD CONSTRAINT `saved_travelers_customer_id_customer_accounts_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_changes` ADD CONSTRAINT `schedule_changes_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_changes` ADD CONSTRAINT `schedule_changes_webhook_event_id_webhook_events_id_fk` FOREIGN KEY (`webhook_event_id`) REFERENCES `webhook_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_changes` ADD CONSTRAINT `schedule_changes_resolved_by_id_staff_users_id_fk` FOREIGN KEY (`resolved_by_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `settings` ADD CONSTRAINT `settings_updated_by_id_staff_users_id_fk` FOREIGN KEY (`updated_by_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_invites` ADD CONSTRAINT `staff_invites_created_by_id_staff_users_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_notes` ADD CONSTRAINT `staff_notes_author_id_staff_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_sessions` ADD CONSTRAINT `staff_sessions_user_id_staff_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_users` ADD CONSTRAINT `staff_users_invited_by_id_staff_users_id_fk` FOREIGN KEY (`invited_by_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_cases` ADD CONSTRAINT `support_cases_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_cases` ADD CONSTRAINT `support_cases_assignee_id_staff_users_id_fk` FOREIGN KEY (`assignee_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_messages` ADD CONSTRAINT `support_messages_case_id_support_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `support_cases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_messages` ADD CONSTRAINT `team_messages_sender_id_staff_users_id_fk` FOREIGN KEY (`sender_id`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_target` ON `audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_actor` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_bat_booking` ON `booking_access_tokens` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_attempt_events` ON `booking_attempt_events` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `idx_attempt_session` ON `booking_attempts` (`checkout_session_id`);--> statement-breakpoint
CREATE INDEX `idx_attempt_state` ON `booking_attempts` (`state`);--> statement-breakpoint
CREATE INDEX `idx_attempt_supplier` ON `booking_attempts` (`supplier_order_id`);--> statement-breakpoint
CREATE INDEX `idx_events_booking` ON `booking_events` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_hold_expires` ON `booking_holds` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_segments_booking` ON `booking_segments` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_segments_departing` ON `booking_segments` (`departing_at`);--> statement-breakpoint
CREATE INDEX `idx_bookings_ref` ON `bookings` (`booking_reference`);--> statement-breakpoint
CREATE INDEX `idx_bookings_email` ON `bookings` (`contact_email`);--> statement-breakpoint
CREATE INDEX `idx_bookings_state` ON `bookings` (`state`);--> statement-breakpoint
CREATE INDEX `idx_bookings_created` ON `bookings` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_bookings_customer` ON `bookings` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_bookings_account` ON `bookings` (`customer_account_id`);--> statement-breakpoint
CREATE INDEX `idx_bookings_live` ON `bookings` (`live_mode`);--> statement-breakpoint
CREATE INDEX `idx_checkout_status` ON `checkout_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_checkout_intent` ON `checkout_sessions` (`psp_intent_id`);--> statement-breakpoint
CREATE INDEX `idx_checkout_email` ON `checkout_sessions` (`contact_email`);--> statement-breakpoint
CREATE INDEX `idx_checkout_expires` ON `checkout_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_community_comments_post` ON `community_comments` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_community_comments_customer` ON `community_comments` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_community_likes_post` ON `community_likes` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_community_posts_created` ON `community_posts` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_community_posts_customer` ON `community_posts` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_community_posts_hidden` ON `community_posts` (`hidden`);--> statement-breakpoint
CREATE INDEX `idx_consents_email` ON `consents` (`email`,`type`);--> statement-breakpoint
CREATE INDEX `idx_consents_account` ON `consents` (`customer_account_id`);--> statement-breakpoint
CREATE INDEX `idx_custotp_customer` ON `customer_otp_codes` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_custsession_customer` ON `customer_sessions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_email_recipient` ON `email_events` (`recipient`);--> statement-breakpoint
CREATE INDEX `idx_email_booking` ON `email_events` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_email_status` ON `email_events` (`status`);--> statement-breakpoint
CREATE INDEX `idx_fraud_status` ON `fraud_flags` (`status`);--> statement-breakpoint
CREATE INDEX `idx_fraud_account` ON `fraud_flags` (`customer_account_id`);--> statement-breakpoint
CREATE INDEX `idx_notes_booking` ON `internal_notes` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_notes_case` ON `internal_notes` (`case_id`);--> statement-breakpoint
CREATE INDEX `idx_invoice_booking` ON `invoices` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_jobs_poll` ON `jobs` (`status`,`run_at`);--> statement-breakpoint
CREATE INDEX `idx_jobs_dedupe` ON `jobs` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_ledger_booking` ON `ledger_entries` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_ledger_account` ON `ledger_entries` (`account`,`currency`);--> statement-breakpoint
CREATE INDEX `idx_partnerreq_status` ON `partner_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_partnerreq_type` ON `partner_requests` (`type`);--> statement-breakpoint
CREATE INDEX `idx_pdoc_booking` ON `passenger_documents` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_pdoc_session` ON `passenger_documents` (`checkout_session_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_booking` ON `payments` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_quote` ON `payments` (`quote_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_status` ON `payments` (`status`);--> statement-breakpoint
CREATE INDEX `idx_payments_provider_ref` ON `payments` (`provider_ref`);--> statement-breakpoint
CREATE INDEX `idx_payroll_user` ON `payroll_entries` (`staff_user_id`);--> statement-breakpoint
CREATE INDEX `idx_payroll_status` ON `payroll_entries` (`status`);--> statement-breakpoint
CREATE INDEX `idx_alerts_customer` ON `price_alerts` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_alerts_active` ON `price_alerts` (`active`,`depart_date`);--> statement-breakpoint
CREATE INDEX `idx_problems_status` ON `problem_reports` (`status`);--> statement-breakpoint
CREATE INDEX `idx_problems_assignee` ON `problem_reports` (`assigned_to_id`);--> statement-breakpoint
CREATE INDEX `idx_quotes_status` ON `quotes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_quotes_email` ON `quotes` (`customer_email`);--> statement-breakpoint
CREATE INDEX `idx_quotes_token` ON `quotes` (`checkout_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_quotes_expires` ON `quotes` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_refundcase_booking` ON `refund_cases` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_refundcase_state` ON `refund_cases` (`state`);--> statement-breakpoint
CREATE INDEX `idx_refundcase_psp` ON `refund_cases` (`psp_refund_id`);--> statement-breakpoint
CREATE INDEX `idx_refund_events` ON `refund_events` (`refund_case_id`);--> statement-breakpoint
CREATE INDEX `idx_refunds_payment` ON `refunds` (`payment_id`);--> statement-breakpoint
CREATE INDEX `idx_refunds_status` ON `refunds` (`status`);--> statement-breakpoint
CREATE INDEX `idx_travelers_customer` ON `saved_travelers` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_schedchange_booking` ON `schedule_changes` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_schedchange_status` ON `schedule_changes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_staffnotes_created` ON `staff_notes` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_session_user` ON `staff_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_cases_status` ON `support_cases` (`status`);--> statement-breakpoint
CREATE INDEX `idx_cases_assignee` ON `support_cases` (`assignee_id`);--> statement-breakpoint
CREATE INDEX `idx_cases_email` ON `support_cases` (`customer_email`);--> statement-breakpoint
CREATE INDEX `idx_cases_booking` ON `support_cases` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_support_email` ON `support_messages` (`email`);--> statement-breakpoint
CREATE INDEX `idx_support_case` ON `support_messages` (`case_id`);--> statement-breakpoint
CREATE INDEX `idx_teammsg_created` ON `team_messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tickets_booking` ON `tickets` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_webhook_status` ON `webhook_events` (`status`);