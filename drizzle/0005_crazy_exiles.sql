DROP INDEX `roster_course_student_key_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `roster_course_student_key_unique_idx` ON `roster` (`course_id`,`student_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `roster_course_student_id_unique_idx` ON `roster` (`course_id`,`student_id`);