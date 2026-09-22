CREATE TABLE `warmup_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version_id` integer NOT NULL,
	`submission_id` integer NOT NULL,
	`round_id` integer NOT NULL,
	`executor_student_key` text NOT NULL,
	`executor_id` text NOT NULL,
	`executor_name` text NOT NULL,
	`result` text NOT NULL,
	`problem_location` text,
	`execution_note` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warmup_executions_version_executor_idx` ON `warmup_executions` (`version_id`,`executor_student_key`);--> statement-breakpoint
CREATE INDEX `warmup_executions_submission_idx` ON `warmup_executions` (`submission_id`);--> statement-breakpoint
CREATE TABLE `warmup_reflections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`execution_id` integer NOT NULL,
	`version_id` integer NOT NULL,
	`submission_id` integer NOT NULL,
	`expected_match` text NOT NULL,
	`problem_location` text,
	`cause` text NOT NULL,
	`planned_revision` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warmup_reflections_execution_idx` ON `warmup_reflections` (`execution_id`);--> statement-breakpoint
CREATE TABLE `warmup_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`round_id` integer NOT NULL,
	`version` integer NOT NULL,
	`algorithm_text` text NOT NULL,
	`revision_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warmup_versions_submission_version_idx` ON `warmup_versions` (`submission_id`,`version`);--> statement-breakpoint
CREATE INDEX `warmup_versions_round_idx` ON `warmup_versions` (`round_id`);