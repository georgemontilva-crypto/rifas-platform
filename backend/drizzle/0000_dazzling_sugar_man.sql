CREATE TABLE `audit_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`actor_id` varchar(36),
	`action` varchar(100) NOT NULL,
	`target_type` varchar(50),
	`target_id` varchar(36),
	`metadata` text,
	`ip_address` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`type` varchar(50) NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`read` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`raffle_id` varchar(36) NOT NULL,
	`ticket_count` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`provider` enum('stripe','mercadopago','paypal','manual_transfer') NOT NULL,
	`provider_payment_id` varchar(255),
	`idempotency_key` varchar(100) NOT NULL,
	`status` enum('pending','processing','approved','rejected','refunded') NOT NULL DEFAULT 'pending',
	`proof_url` varchar(500),
	`approved_by` varchar(36),
	`approved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_idempotency_idx` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `raffles` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`cover_image_url` varchar(500),
	`ticket_price` decimal(12,2) NOT NULL,
	`total_tickets` int NOT NULL,
	`min_tickets_to_activate` int NOT NULL DEFAULT 0,
	`status` enum('draft','active','sold_out','closed','drawn','cancelled') NOT NULL DEFAULT 'draft',
	`draw_date` timestamp,
	`commit_hash` varchar(64),
	`revealed_seed` varchar(128),
	`winning_ticket_number` int,
	`created_by` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `raffles_id` PRIMARY KEY(`id`),
	CONSTRAINT `raffles_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`user_agent` varchar(300),
	`ip_address` varchar(64),
	`revoked` boolean NOT NULL DEFAULT false,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` varchar(36) NOT NULL,
	`raffle_id` varchar(36) NOT NULL,
	`number` int NOT NULL,
	`status` enum('available','reserved','sold') NOT NULL DEFAULT 'available',
	`user_id` varchar(36),
	`reserved_at` timestamp,
	`reservation_expires_at` timestamp,
	`purchase_id` varchar(36),
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `tickets_raffle_number_idx` UNIQUE(`raffle_id`,`number`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`full_name` varchar(150) NOT NULL,
	`phone` varchar(30),
	`role` enum('user','admin','superadmin') NOT NULL DEFAULT 'user',
	`email_verified` boolean NOT NULL DEFAULT false,
	`failed_login_attempts` int NOT NULL DEFAULT 0,
	`locked_until` timestamp,
	`two_factor_secret` varchar(255),
	`two_factor_enabled` boolean NOT NULL DEFAULT false,
	`avatar_url` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_idx` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `payments_user_idx` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `payments_raffle_idx` ON `payments` (`raffle_id`);--> statement-breakpoint
CREATE INDEX `raffles_status_idx` ON `raffles` (`status`);--> statement-breakpoint
CREATE INDEX `refresh_user_idx` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `tickets_raffle_status_idx` ON `tickets` (`raffle_id`,`status`);