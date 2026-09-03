DROP INDEX `roster_course_student_id_unique_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `roster_course_school_student_id_unique_idx` ON `roster` (`course_id`,`school`,`student_id`);