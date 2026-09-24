// Idempotent bootstrap mirrors the generated JEV migration. Add columns before indexes.
export const JEV_TABLES = [
  "CREATE TABLE IF NOT EXISTS `jev_batch_evaluations` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`course_id` integer NOT NULL,\n\t`round_id` integer,\n\t`student_key` text NOT NULL,\n\t`student_id` text NOT NULL,\n\t`student_name` text NOT NULL,\n\t`problem_id` text NOT NULL,\n\t`job_item_id` integer,\n\t`submission_id` integer,\n\t`submission_version` integer,\n\t`submission_text` text,\n\t`mode` text DEFAULT 'legacy' NOT NULL,\n\t`source` text DEFAULT 'legacy' NOT NULL,\n\t`algorithm_steps` text NOT NULL,\n\t`total_trials` integer NOT NULL,\n\t`correct_count` integer NOT NULL,\n\t`incorrect_count` integer NOT NULL,\n\t`error_count` integer NOT NULL,\n\t`trials` text NOT NULL,\n\t`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS `jev_job_items` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`job_id` integer NOT NULL,\n\t`submission_id` integer NOT NULL,\n\t`submission_version` integer NOT NULL,\n\t`student_key` text NOT NULL,\n\t`student_id` text NOT NULL,\n\t`student_name` text NOT NULL,\n\t`algorithm_text` text NOT NULL,\n\t`status` text DEFAULT 'pending' NOT NULL,\n\t`trials` text DEFAULT '[]' NOT NULL,\n\t`last_error` text\n);",
  "CREATE TABLE IF NOT EXISTS `jev_jobs` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`request_key` text NOT NULL,\n\t`course_id` integer NOT NULL,\n\t`round_id` integer NOT NULL,\n\t`status` text DEFAULT 'queued' NOT NULL,\n\t`mode` text NOT NULL,\n\t`trials_per_student` integer NOT NULL,\n\t`lease_token` text,\n\t`lease_until` integer,\n\t`last_error` text,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL\n);"
];
export const JEV_INDEXES = [
  "CREATE UNIQUE INDEX IF NOT EXISTS `jev_batch_evaluations_job_item_idx` ON `jev_batch_evaluations` (`job_item_id`);",
  "CREATE INDEX IF NOT EXISTS `jev_batch_evaluations_student_idx` ON `jev_batch_evaluations` (`student_key`);",
  "CREATE INDEX IF NOT EXISTS `jev_batch_evaluations_course_idx` ON `jev_batch_evaluations` (`course_id`);",
  "CREATE INDEX IF NOT EXISTS `jev_batch_evaluations_round_idx` ON `jev_batch_evaluations` (`round_id`);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `jev_job_items_job_submission_idx` ON `jev_job_items` (`job_id`,`submission_id`);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `jev_jobs_request_key_unique` ON `jev_jobs` (`request_key`);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `jev_jobs_active_round_idx` ON `jev_jobs` (`course_id`,`round_id`) WHERE \"jev_jobs\".\"status\" in ('queued', 'running');",
  "CREATE INDEX IF NOT EXISTS `jev_jobs_course_idx` ON `jev_jobs` (`course_id`,`id`);"
];
