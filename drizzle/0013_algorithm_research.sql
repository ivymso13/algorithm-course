CREATE TABLE `algorithm_ai_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version_id` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`token` text,
	`lease_until` integer,
	`result` text,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `algorithm_ai_feedback_version_id_unique` ON `algorithm_ai_feedback` (`version_id`);--> statement-breakpoint
CREATE TABLE `algorithm_interpretation_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version_id` integer NOT NULL,
	`student_key` text NOT NULL,
	`agrees` integer NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `algorithm_note_unique_idx` ON `algorithm_interpretation_notes` (`version_id`,`student_key`);--> statement-breakpoint
CREATE TABLE `algorithm_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version_id` integer NOT NULL,
	`student_key` text NOT NULL,
	`agrees` integer NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `algorithm_review_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round_id` integer NOT NULL,
	`version_id` integer NOT NULL,
	`reviewer_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`feedback` text,
	`executable` integer,
	`checked_steps` text,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `algorithm_review_unique_idx` ON `algorithm_review_assignments` (`version_id`,`reviewer_key`);--> statement-breakpoint
CREATE INDEX `algorithm_review_reviewer_idx` ON `algorithm_review_assignments` (`round_id`,`reviewer_key`);--> statement-breakpoint
CREATE TABLE `algorithm_revision_overrides` (
	`submission_id` integer PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `algorithm_round_cohorts` (
	`round_id` integer PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `algorithm_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`round_id` integer NOT NULL,
	`submission_id` integer NOT NULL,
	`revision` integer NOT NULL,
	`algorithm_text` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`origin` text DEFAULT 'submitted' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `algorithm_version_unique_idx` ON `algorithm_versions` (`submission_id`,`revision`);--> statement-breakpoint
CREATE INDEX `algorithm_versions_round_idx` ON `algorithm_versions` (`round_id`,`submission_id`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS algorithm_note_insert_log AFTER INSERT ON algorithm_interpretation_notes BEGIN INSERT INTO algorithm_observations(version_id,student_key,agrees,note,created_at) VALUES(NEW.version_id,NEW.student_key,NEW.agrees,NEW.note,NEW.created_at); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS algorithm_note_update_log AFTER UPDATE ON algorithm_interpretation_notes BEGIN INSERT INTO algorithm_observations(version_id,student_key,agrees,note,created_at) VALUES(NEW.version_id,NEW.student_key,NEW.agrees,NEW.note,NEW.created_at); END;
