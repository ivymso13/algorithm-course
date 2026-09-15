CREATE TABLE `warmup_teacher_assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version_id` integer NOT NULL,
	`submission_id` integer NOT NULL,
	`round_id` integer NOT NULL,
	`clarity` integer NOT NULL,
	`completeness` integer NOT NULL,
	`accuracy` integer NOT NULL,
	`executability` integer NOT NULL,
	`solved_status` text NOT NULL,
	`comment` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warmup_teacher_assessments_version_idx` ON `warmup_teacher_assessments` (`version_id`);--> statement-breakpoint
CREATE INDEX `warmup_teacher_assessments_round_idx` ON `warmup_teacher_assessments` (`round_id`);--> statement-breakpoint
ALTER TABLE `warmup_reflections` ADD `source_execution_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `warmup_reflections` ADD `peer_feedback_count` integer DEFAULT 0 NOT NULL;