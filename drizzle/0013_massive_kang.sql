ALTER TABLE `jev_batch_evaluations` ADD `round_id` integer;--> statement-breakpoint
CREATE INDEX `jev_batch_evaluations_round_idx` ON `jev_batch_evaluations` (`round_id`);