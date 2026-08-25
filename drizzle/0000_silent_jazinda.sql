CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`problem_type` text NOT NULL,
	`executor_key` text NOT NULL,
	`executor_id` text NOT NULL,
	`executor_name` text NOT NULL,
	`input` text NOT NULL,
	`correct_answer` integer NOT NULL,
	`reference_action_count` integer NOT NULL,
	`state` text NOT NULL,
	`action_log` text NOT NULL,
	`action_count` integer DEFAULT 0 NOT NULL,
	`unexecutable_flag` integer DEFAULT false NOT NULL,
	`unexecutable_reason` text,
	`final_answer` integer,
	`is_correct` integer,
	`evaluation_responses` text,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`submitted_at` text,
	`evaluated_at` text
);
--> statement-breakpoint
CREATE INDEX `attempts_submission_idx` ON `attempts` (`submission_id`);--> statement-breakpoint
CREATE INDEX `attempts_executor_idx` ON `attempts` (`executor_key`);--> statement-breakpoint
CREATE INDEX `attempts_problem_type_idx` ON `attempts` (`problem_type`);--> statement-breakpoint
CREATE TABLE `stage_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`stage2_active` integer DEFAULT false NOT NULL,
	`activated_at` text
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_key` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`problem_type` text NOT NULL,
	`algorithm_text` text NOT NULL,
	`example_input` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_student_type_idx` ON `submissions` (`student_key`,`problem_type`);