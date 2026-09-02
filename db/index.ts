import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// Mirrors drizzle/0000_*.sql with `IF NOT EXISTS` added. Drizzle migrations
// are the source of truth (regenerate with `npm run db:generate` after
// changing db/schema.ts and keep this list in sync); this bootstrap exists so
// local dev and any environment where the Sites platform hasn't run the
// migration yet still has a working database on first request. Every
// statement is idempotent, so re-running it once tables already exist is a
// no-op.
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS courses (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    code text NOT NULL,
    name text DEFAULT '알고리즘 수업' NOT NULL,
    stage2_active integer DEFAULT false NOT NULL,
    activated_at text,
    retention_days integer DEFAULT 90 NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS courses_code_idx ON courses (code)`,
  `CREATE TABLE IF NOT EXISTS students (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    course_id integer NOT NULL,
    student_id text NOT NULL,
    name text NOT NULL,
    student_key text NOT NULL,
    consent_at text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS students_course_student_key_idx ON students (course_id, student_key)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    token_hash text NOT NULL,
    student_id integer NOT NULL,
    course_id integer NOT NULL,
    student_key text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at text NOT NULL,
    last_seen_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions (token_hash)`,
  `CREATE INDEX IF NOT EXISTS sessions_student_key_idx ON sessions (student_key)`,
  `DROP TABLE IF EXISTS stage_state`,
  `CREATE TABLE IF NOT EXISTS submissions (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    student_key text NOT NULL,
    student_id text NOT NULL,
    student_name text NOT NULL,
    problem_type text NOT NULL,
    algorithm_text text NOT NULL,
    example_input text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS submissions_student_type_idx ON submissions (student_key, problem_type)`,
  `CREATE TABLE IF NOT EXISTS attempts (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    submission_id integer NOT NULL,
    problem_type text NOT NULL,
    executor_key text NOT NULL,
    executor_id text NOT NULL,
    executor_name text NOT NULL,
    input text NOT NULL,
    correct_answer integer NOT NULL,
    reference_action_count integer NOT NULL,
    state text NOT NULL,
    action_log text NOT NULL,
    action_count integer DEFAULT 0 NOT NULL,
    unexecutable_flag integer DEFAULT false NOT NULL,
    unexecutable_reason text,
    final_answer integer,
    is_correct integer,
    evaluation_responses text,
    status text DEFAULT 'in_progress' NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    submitted_at text,
    evaluated_at text
  )`,
  `CREATE INDEX IF NOT EXISTS attempts_submission_idx ON attempts (submission_id)`,
  `CREATE INDEX IF NOT EXISTS attempts_executor_idx ON attempts (executor_key)`,
  `CREATE INDEX IF NOT EXISTS attempts_problem_type_idx ON attempts (problem_type)`,
  `CREATE TABLE IF NOT EXISTS warmup_rounds (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    course_id integer NOT NULL,
    title text NOT NULL,
    prompt text NOT NULL,
    status text DEFAULT 'draft' NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    published_at text,
    closed_at text
  )`,
  `CREATE INDEX IF NOT EXISTS warmup_rounds_course_idx ON warmup_rounds (course_id)`,
  `CREATE TABLE IF NOT EXISTS warmup_submissions (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    round_id integer NOT NULL,
    student_key text NOT NULL,
    student_id text NOT NULL,
    student_name text NOT NULL,
    anon_label text NOT NULL,
    algorithm_text text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS warmup_submissions_round_student_idx ON warmup_submissions (round_id, student_key)`,
  `CREATE INDEX IF NOT EXISTS warmup_submissions_round_idx ON warmup_submissions (round_id)`,
  `CREATE TABLE IF NOT EXISTS warmup_votes (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    submission_id integer NOT NULL,
    round_id integer NOT NULL,
    voter_student_key text NOT NULL,
    vote_type text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS warmup_votes_unique_idx ON warmup_votes (submission_id, voter_student_key, vote_type)`,
  `CREATE INDEX IF NOT EXISTS warmup_votes_submission_idx ON warmup_votes (submission_id)`,
  `CREATE TABLE IF NOT EXISTS warmup_experiences (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    submission_id integer NOT NULL,
    round_id integer NOT NULL,
    executor_student_key text NOT NULL,
    executor_id text NOT NULL,
    executor_name text NOT NULL,
    checked_steps text NOT NULL,
    total_steps integer NOT NULL,
    executable integer NOT NULL,
    feedback text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS warmup_experiences_unique_idx ON warmup_experiences (submission_id, executor_student_key)`,
  `CREATE INDEX IF NOT EXISTS warmup_experiences_submission_idx ON warmup_experiences (submission_id)`,
];

let schemaReady: Promise<void> | null = null;

function ensureSchema(d1: D1Database): Promise<void> {
  if (!schemaReady) {
    schemaReady = d1
      .batch(SCHEMA_STATEMENTS.map((sql) => d1.prepare(sql)))
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null; // allow a retry on the next call instead of caching a failure
        throw error;
      });
  }
  return schemaReady;
}

export async function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  await ensureSchema(env.DB);
  return drizzle(env.DB, { schema });
}
