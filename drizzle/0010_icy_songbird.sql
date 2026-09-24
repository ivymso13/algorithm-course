CREATE TABLE `jev_batch_evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`round_id` integer,
	`student_key` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`problem_id` text NOT NULL,
	`job_item_id` integer,
	`submission_id` integer,
	`submission_version` integer,
	`submission_text` text,
	`mode` text DEFAULT 'legacy' NOT NULL,
	`source` text DEFAULT 'legacy' NOT NULL,
	`algorithm_steps` text NOT NULL,
	`total_trials` integer NOT NULL,
	`correct_count` integer NOT NULL,
	`incorrect_count` integer NOT NULL,
	`error_count` integer NOT NULL,
	`trials` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jev_batch_evaluations_job_item_idx` ON `jev_batch_evaluations` (`job_item_id`);--> statement-breakpoint
CREATE INDEX `jev_batch_evaluations_student_idx` ON `jev_batch_evaluations` (`student_key`);--> statement-breakpoint
CREATE INDEX `jev_batch_evaluations_course_idx` ON `jev_batch_evaluations` (`course_id`);--> statement-breakpoint
CREATE INDEX `jev_batch_evaluations_round_idx` ON `jev_batch_evaluations` (`round_id`);--> statement-breakpoint
CREATE TABLE `jev_job_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`submission_id` integer NOT NULL,
	`submission_version` integer NOT NULL,
	`student_key` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`algorithm_text` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`trials` text DEFAULT '[]' NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jev_job_items_job_submission_idx` ON `jev_job_items` (`job_id`,`submission_id`);--> statement-breakpoint
CREATE TABLE `jev_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_key` text NOT NULL,
	`course_id` integer NOT NULL,
	`round_id` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`mode` text NOT NULL,
	`trials_per_student` integer NOT NULL,
	`lease_token` text,
	`lease_until` integer,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jev_jobs_request_key_unique` ON `jev_jobs` (`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `jev_jobs_active_round_idx` ON `jev_jobs` (`course_id`,`round_id`) WHERE "jev_jobs"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX `jev_jobs_course_idx` ON `jev_jobs` (`course_id`,`id`);--> statement-breakpoint
ALTER TABLE `warmup_submissions` ADD `revision` integer DEFAULT 1 NOT NULL;