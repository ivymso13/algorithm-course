import { integer,sqliteTable,text,uniqueIndex,index } from "drizzle-orm/sqlite-core";

export const algorithmVersions=sqliteTable("algorithm_versions",{
  id:integer("id").primaryKey({autoIncrement:true}),courseId:integer("course_id").notNull(),roundId:integer("round_id").notNull(),submissionId:integer("submission_id").notNull(),revision:integer("revision").notNull(),algorithmText:text("algorithm_text").notNull(),reason:text("reason").notNull().default(""),origin:text("origin").notNull().default("submitted"),createdAt:text("created_at").notNull(),
},t=>({versionIdx:uniqueIndex("algorithm_version_unique_idx").on(t.submissionId,t.revision),roundIdx:index("algorithm_versions_round_idx").on(t.roundId,t.submissionId)}));
export const algorithmReviewAssignments=sqliteTable("algorithm_review_assignments",{
  id:integer("id").primaryKey({autoIncrement:true}),roundId:integer("round_id").notNull(),versionId:integer("version_id").notNull(),reviewerKey:text("reviewer_key").notNull(),status:text("status").notNull().default("pending"),feedback:text("feedback"),executable:integer("executable"),checkedSteps:text("checked_steps"),completedAt:text("completed_at"),
},t=>({assignmentIdx:uniqueIndex("algorithm_review_unique_idx").on(t.versionId,t.reviewerKey),reviewerIdx:index("algorithm_review_reviewer_idx").on(t.roundId,t.reviewerKey)}));
export const algorithmRoundCohorts=sqliteTable("algorithm_round_cohorts",{roundId:integer("round_id").primaryKey(),createdAt:text("created_at").notNull()});
export const algorithmAiFeedback=sqliteTable("algorithm_ai_feedback",{id:integer("id").primaryKey({autoIncrement:true}),versionId:integer("version_id").notNull().unique(),status:text("status").notNull().default("queued"),token:text("token"),leaseUntil:integer("lease_until"),result:text("result"),error:text("error"),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull()});
export const algorithmInterpretationNotes=sqliteTable("algorithm_interpretation_notes",{id:integer("id").primaryKey({autoIncrement:true}),versionId:integer("version_id").notNull(),studentKey:text("student_key").notNull(),agrees:integer("agrees").notNull(),note:text("note").notNull(),createdAt:text("created_at").notNull()},t=>({noteIdx:uniqueIndex("algorithm_note_unique_idx").on(t.versionId,t.studentKey)}));
export const algorithmRevisionOverrides=sqliteTable("algorithm_revision_overrides",{submissionId:integer("submission_id").primaryKey(),reason:text("reason").notNull(),createdAt:text("created_at").notNull()});
export const algorithmObservations=sqliteTable("algorithm_observations",{id:integer("id").primaryKey({autoIncrement:true}),versionId:integer("version_id").notNull(),studentKey:text("student_key").notNull(),agrees:integer("agrees").notNull(),note:text("note").notNull(),createdAt:text("created_at").notNull()});

/** Additive tables: existing submissions are retained as a legacy baseline. */
export const RESEARCH_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS algorithm_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL, round_id INTEGER NOT NULL, submission_id INTEGER NOT NULL, revision INTEGER NOT NULL, algorithm_text TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', origin TEXT NOT NULL DEFAULT 'submitted', created_at TEXT NOT NULL, UNIQUE(submission_id,revision))`,
  `CREATE TABLE IF NOT EXISTS algorithm_review_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, round_id INTEGER NOT NULL, version_id INTEGER NOT NULL, reviewer_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', feedback TEXT, executable INTEGER, checked_steps TEXT, completed_at TEXT, UNIQUE(version_id,reviewer_key))`,
  `CREATE TABLE IF NOT EXISTS algorithm_round_cohorts (round_id INTEGER PRIMARY KEY, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS algorithm_ai_feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, version_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'queued', token TEXT, lease_until INTEGER, result TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(version_id))`,
  `CREATE TABLE IF NOT EXISTS algorithm_interpretation_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, version_id INTEGER NOT NULL, student_key TEXT NOT NULL, agrees INTEGER NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(version_id,student_key))`,
  `CREATE TABLE IF NOT EXISTS algorithm_revision_overrides (submission_id INTEGER PRIMARY KEY, reason TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS algorithm_versions_round_idx ON algorithm_versions(round_id,submission_id)`,
  `CREATE INDEX IF NOT EXISTS algorithm_review_reviewer_idx ON algorithm_review_assignments(round_id,reviewer_key)`,
  `CREATE TABLE IF NOT EXISTS algorithm_observations (id INTEGER PRIMARY KEY AUTOINCREMENT, version_id INTEGER NOT NULL, student_key TEXT NOT NULL, agrees INTEGER NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TRIGGER IF NOT EXISTS algorithm_note_insert_log AFTER INSERT ON algorithm_interpretation_notes BEGIN INSERT INTO algorithm_observations(version_id,student_key,agrees,note,created_at) VALUES(NEW.version_id,NEW.student_key,NEW.agrees,NEW.note,NEW.created_at); END`,
  `CREATE TRIGGER IF NOT EXISTS algorithm_note_update_log AFTER UPDATE ON algorithm_interpretation_notes BEGIN INSERT INTO algorithm_observations(version_id,student_key,agrees,note,created_at) VALUES(NEW.version_id,NEW.student_key,NEW.agrees,NEW.note,NEW.created_at); END`,
];
