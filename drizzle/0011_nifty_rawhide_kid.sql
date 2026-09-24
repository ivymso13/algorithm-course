CREATE TABLE `jev_auto_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`round_id` integer NOT NULL,
	`submission_id` integer NOT NULL,
	`submission_version` integer NOT NULL,
	`student_key` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`algorithm_text` text NOT NULL,
	`mode` text NOT NULL,
	`target_trials` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jev_auto_runs_submission_version_idx` ON `jev_auto_runs` (`submission_id`,`submission_version`);--> statement-breakpoint
CREATE INDEX `jev_auto_runs_course_status_idx` ON `jev_auto_runs` (`course_id`,`status`);--> statement-breakpoint
CREATE INDEX `jev_auto_runs_round_student_idx` ON `jev_auto_runs` (`round_id`,`student_key`);--> statement-breakpoint
CREATE TABLE `jev_auto_trials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`trial_index` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`lease_token` text,
	`lease_until` integer,
	`committed_by` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`result` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jev_auto_trials_run_trial_idx` ON `jev_auto_trials` (`run_id`,`trial_index`);--> statement-breakpoint
CREATE TABLE `jev_trial_slots` (
	`id` integer PRIMARY KEY NOT NULL,
	`lease_token` text,
	`lease_until` integer,
	`holder` text
);
--> statement-breakpoint
INSERT OR IGNORE INTO `jev_trial_slots` (`id`) VALUES (1), (2), (3), (4), (5);