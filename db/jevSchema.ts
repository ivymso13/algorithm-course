// Idempotent bootstrap mirrors the generated JEV migration. Add columns before indexes.
export const JEV_TABLES = [
  "CREATE TABLE IF NOT EXISTS `jev_batch_evaluations` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`course_id` integer NOT NULL,\n\t`round_id` integer,\n\t`student_key` text NOT NULL,\n\t`student_id` text NOT NULL,\n\t`student_name` text NOT NULL,\n\t`problem_id` text NOT NULL,\n\t`job_item_id` integer,\n\t`submission_id` integer,\n\t`submission_version` integer,\n\t`submission_text` text,\n\t`mode` text DEFAULT 'legacy' NOT NULL,\n\t`source` text DEFAULT 'legacy' NOT NULL,\n\t`algorithm_steps` text NOT NULL,\n\t`total_trials` integer NOT NULL,\n\t`correct_count` integer NOT NULL,\n\t`incorrect_count` integer NOT NULL,\n\t`error_count` integer NOT NULL,\n\t`trials` text NOT NULL,\n\t`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS `jev_job_items` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`job_id` integer NOT NULL,\n\t`submission_id` integer NOT NULL,\n\t`submission_version` integer NOT NULL,\n\t`student_key` text NOT NULL,\n\t`student_id` text NOT NULL,\n\t`student_name` text NOT NULL,\n\t`algorithm_text` text NOT NULL,\n\t`status` text DEFAULT 'pending' NOT NULL,\n\t`trials` text DEFAULT '[]' NOT NULL,\n\t`last_error` text\n);",
  "CREATE TABLE IF NOT EXISTS `jev_jobs` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`request_key` text NOT NULL,\n\t`course_id` integer NOT NULL,\n\t`round_id` integer NOT NULL,\n\t`status` text DEFAULT 'queued' NOT NULL,\n\t`mode` text NOT NULL,\n\t`trials_per_student` integer NOT NULL,\n\t`lease_token` text,\n\t`lease_until` integer,\n\t`last_error` text,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS `jev_auto_runs` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`course_id` integer NOT NULL,\n\t`round_id` integer NOT NULL,\n\t`submission_id` integer NOT NULL,\n\t`submission_version` integer NOT NULL,\n\t`student_key` text NOT NULL,\n\t`student_id` text NOT NULL,\n\t`student_name` text NOT NULL,\n\t`algorithm_text` text NOT NULL,\n\t`mode` text NOT NULL,\n\t`target_trials` integer NOT NULL,\n\t`status` text DEFAULT 'queued' NOT NULL,\n\t`consecutive_failures` integer DEFAULT 0 NOT NULL,\n\t`next_attempt_at` integer DEFAULT 0 NOT NULL,\n\t`last_error` text,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL,\n\t`completed_at` text\n);",
  "CREATE TABLE IF NOT EXISTS `jev_auto_trials` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`run_id` integer NOT NULL,\n\t`trial_index` integer NOT NULL,\n\t`status` text DEFAULT 'pending' NOT NULL,\n\t`lease_token` text,\n\t`lease_until` integer,\n\t`committed_by` text,\n\t`attempts` integer DEFAULT 0 NOT NULL,\n\t`result` text,\n\t`updated_at` text\n);",
  "CREATE TABLE IF NOT EXISTS `jev_trial_slots` (\n\t`id` integer PRIMARY KEY NOT NULL,\n\t`lease_token` text,\n\t`lease_until` integer,\n\t`holder` text\n);"
];
export const JEV_INDEXES = [
  "CREATE UNIQUE INDEX IF NOT EXISTS `jev_batch_evaluations_job_item_idx` ON `jev_batch_evaluations` (`job_item_id`);",
  "CREATE INDEX IF NOT EXISTS `jev_batch_evaluations_student_idx` ON `jev_batch_evaluations` (`student_key`);",
  "CREATE INDEX IF NOT EXISTS `jev_batch_evaluations_course_idx` ON `jev_batch_evaluations` (`course_id`);",
  "CREATE INDEX IF NOT EXISTS `jev_batch_evaluations_round_idx` ON `jev_batch_evaluations` (`round_id`);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `jev_job_items_job_submission_idx` ON `jev_job_items` (`job_id`,`submission_id`);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `jev_jobs_request_key_unique` ON `jev_jobs` (`request_key`);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `jev_jobs_active_round_idx` ON `jev_jobs` (`course_id`,`round_id`) WHERE \"jev_jobs\".\"status\" in ('queued', 'running');",
  "CREATE INDEX IF NOT EXISTS `jev_jobs_course_idx` ON `jev_jobs` (`course_id`,`id`);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `jev_auto_runs_submission_version_idx` ON `jev_auto_runs` (`submission_id`,`submission_version`);",
  "CREATE INDEX IF NOT EXISTS `jev_auto_runs_course_status_idx` ON `jev_auto_runs` (`course_id`,`status`);",
  "CREATE INDEX IF NOT EXISTS `jev_auto_runs_round_student_idx` ON `jev_auto_runs` (`round_id`,`student_key`);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `jev_auto_trials_run_trial_idx` ON `jev_auto_trials` (`run_id`,`trial_index`);",
  "INSERT OR IGNORE INTO `jev_trial_slots` (`id`) VALUES (1), (2), (3), (4), (5);"
];
