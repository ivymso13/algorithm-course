CREATE TABLE `warmup_assignment_reassignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round_id` integer NOT NULL,
	`assignment_id` integer NOT NULL,
	`submission_id` integer NOT NULL,
	`from_evaluator_student_key` text NOT NULL,
	`to_evaluator_student_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `warmup_assignment_reassignments_round_idx` ON `warmup_assignment_reassignments` (`round_id`);