CREATE TABLE `roster` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`school` text NOT NULL,
	`student_id` text NOT NULL,
	`name` text NOT NULL,
	`student_key` text NOT NULL,
	`sort_order` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `roster_course_idx` ON `roster` (`course_id`);--> statement-breakpoint
CREATE INDEX `roster_course_student_key_idx` ON `roster` (`course_id`,`student_key`);