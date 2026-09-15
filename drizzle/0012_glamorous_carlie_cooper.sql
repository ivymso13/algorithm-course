CREATE TABLE `warmup_peer_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round_id` integer NOT NULL,
	`submission_id` integer NOT NULL,
	`evaluator_student_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warmup_peer_assignments_unique_idx` ON `warmup_peer_assignments` (`round_id`,`submission_id`,`evaluator_student_key`);--> statement-breakpoint
CREATE INDEX `warmup_peer_assignments_evaluator_idx` ON `warmup_peer_assignments` (`round_id`,`evaluator_student_key`);--> statement-breakpoint
ALTER TABLE `warmup_rounds` ADD `writing_opened_at` text;--> statement-breakpoint
ALTER TABLE `warmup_rounds` ADD `self_review_opened_at` text;