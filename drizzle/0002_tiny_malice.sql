CREATE TABLE `warmup_experiences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`round_id` integer NOT NULL,
	`executor_student_key` text NOT NULL,
	`executor_id` text NOT NULL,
	`executor_name` text NOT NULL,
	`checked_steps` text NOT NULL,
	`total_steps` integer NOT NULL,
	`executable` integer NOT NULL,
	`feedback` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warmup_experiences_unique_idx` ON `warmup_experiences` (`submission_id`,`executor_student_key`);--> statement-breakpoint
CREATE INDEX `warmup_experiences_submission_idx` ON `warmup_experiences` (`submission_id`);--> statement-breakpoint
CREATE TABLE `warmup_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text,
	`closed_at` text
);
--> statement-breakpoint
CREATE INDEX `warmup_rounds_course_idx` ON `warmup_rounds` (`course_id`);--> statement-breakpoint
CREATE TABLE `warmup_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round_id` integer NOT NULL,
	`student_key` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`anon_label` text NOT NULL,
	`algorithm_text` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warmup_submissions_round_student_idx` ON `warmup_submissions` (`round_id`,`student_key`);--> statement-breakpoint
CREATE INDEX `warmup_submissions_round_idx` ON `warmup_submissions` (`round_id`);--> statement-breakpoint
CREATE TABLE `warmup_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`round_id` integer NOT NULL,
	`voter_student_key` text NOT NULL,
	`vote_type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warmup_votes_unique_idx` ON `warmup_votes` (`submission_id`,`voter_student_key`,`vote_type`);--> statement-breakpoint
CREATE INDEX `warmup_votes_submission_idx` ON `warmup_votes` (`submission_id`);