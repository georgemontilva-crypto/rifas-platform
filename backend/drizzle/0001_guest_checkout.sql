ALTER TABLE `payments` MODIFY COLUMN `user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `payments` ADD `guest_name` varchar(150);--> statement-breakpoint
ALTER TABLE `payments` ADD `guest_phone` varchar(30);--> statement-breakpoint
ALTER TABLE `payments` ADD `guest_email` varchar(255);--> statement-breakpoint
ALTER TABLE `payments` ADD `ticket_code` varchar(40);--> statement-breakpoint
ALTER TABLE `tickets` ADD `reservation_token` varchar(64);--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_ticket_code_idx` UNIQUE(`ticket_code`);