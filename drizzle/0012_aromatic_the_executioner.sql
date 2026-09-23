CREATE TABLE `jev_batch_evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`student_key` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`problem_id` text NOT NULL,
	`algorithm_steps` text NOT NULL,
	`total_trials` integer NOT NULL,
	`correct_count` integer NOT NULL,
	`incorrect_count` integer NOT NULL,
	`error_count` integer NOT NULL,
	`trials` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jev_batch_evaluations_student_idx` ON `jev_batch_evaluations` (`student_key`);--> statement-breakpoint
CREATE INDEX `jev_batch_evaluations_course_idx` ON `jev_batch_evaluations` (`course_id`);