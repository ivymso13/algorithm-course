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
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    roster_seeded_at text
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS courses_code_idx ON courses (code)`,
  `CREATE TABLE IF NOT EXISTS roster (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    course_id integer NOT NULL,
    school text NOT NULL,
    student_id text NOT NULL,
    name text NOT NULL,
    student_key text NOT NULL,
    sort_order integer NOT NULL,
    active integer DEFAULT true NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS roster_course_idx ON roster (course_id)`,
  // Each superseded by the UNIQUE index below it; dropped by name
  // (idempotent) in case an earlier bootstrap already created it as a
  // plain, or differently-scoped, index — CREATE INDEX IF NOT EXISTS alone
  // wouldn't upgrade or rescope it in place.
  `DROP INDEX IF EXISTS roster_course_student_key_idx`,
  `CREATE UNIQUE INDEX IF NOT EXISTS roster_course_student_key_unique_idx ON roster (course_id, student_key)`,
  `DROP INDEX IF EXISTS roster_course_student_id_unique_idx`,
  `CREATE UNIQUE INDEX IF NOT EXISTS roster_course_school_student_id_unique_idx ON roster (course_id, school, student_id)`,
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
    problem_id text,
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
    is_demo integer DEFAULT false NOT NULL,
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
  // Added with the research-cycle feature (warmup_versions/executions/
  // reflections) — this bootstrap list wasn't updated when that feature was
  // merged, so any environment that never ran drizzle's migrations directly
  // was silently missing these three tables until now.
  `CREATE TABLE IF NOT EXISTS warmup_versions (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    submission_id integer NOT NULL,
    round_id integer NOT NULL,
    version integer NOT NULL,
    algorithm_text text NOT NULL,
    revision_reason text,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS warmup_versions_submission_version_idx ON warmup_versions (submission_id, version)`,
  `CREATE INDEX IF NOT EXISTS warmup_versions_round_idx ON warmup_versions (round_id)`,
  `CREATE TABLE IF NOT EXISTS warmup_executions (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    version_id integer NOT NULL,
    submission_id integer NOT NULL,
    round_id integer NOT NULL,
    executor_student_key text NOT NULL,
    executor_id text NOT NULL,
    executor_name text NOT NULL,
    result text NOT NULL,
    solved_status text DEFAULT 'uncertain' NOT NULL,
    problem_location text,
    execution_note text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS warmup_executions_version_executor_idx ON warmup_executions (version_id, executor_student_key)`,
  `CREATE INDEX IF NOT EXISTS warmup_executions_submission_idx ON warmup_executions (submission_id)`,
  `CREATE TABLE IF NOT EXISTS warmup_reflections (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    execution_id integer NOT NULL,
    version_id integer NOT NULL,
    submission_id integer NOT NULL,
    expected_match text NOT NULL,
    problem_location text,
    cause text NOT NULL,
    planned_revision text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS warmup_reflections_execution_idx ON warmup_reflections (execution_id)`,
  // Jev AI executor — batch evaluations (see lib/jev/batchEvaluate.ts).
  `CREATE TABLE IF NOT EXISTS jev_batch_evaluations (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    course_id integer NOT NULL,
    round_id integer,
    student_key text NOT NULL,
    student_id text NOT NULL,
    student_name text NOT NULL,
    problem_id text NOT NULL,
    algorithm_steps text NOT NULL,
    total_trials integer NOT NULL,
    correct_count integer NOT NULL,
    incorrect_count integer NOT NULL,
    error_count integer NOT NULL,
    trials text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS jev_batch_evaluations_student_idx ON jev_batch_evaluations (student_key)`,
  `CREATE INDEX IF NOT EXISTS jev_batch_evaluations_course_idx ON jev_batch_evaluations (course_id)`,
  // jev_batch_evaluations_round_idx is NOT here — see ensureRetrofittedColumns
  // below. A database that already has this table from before round_id
  // existed would hit this CREATE INDEX in the same batch as the (no-op)
  // CREATE TABLE, before ensureColumn ever gets a chance to add the column —
  // "no such column: round_id". Creating the index only after the retrofit
  // avoids that ordering trap.
];

// Some columns were added to tables that predate them, so a database that
// already ran the bootstrap once (or a real deployment mid-migration) may
// have that table without the new column — CREATE TABLE IF NOT EXISTS above
// only helps brand new databases. Each is run as its own statement, outside
// the batch, so a "duplicate column" failure (the expected, idempotent case
// once the column exists) can't abort the rest of ensureSchema's batch.
async function ensureColumn(d1: D1Database, table: string, column: string, sqlType: string): Promise<void> {
  try {
    await d1.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}`).run();
  } catch (error) {
    if (!(error instanceof Error) || !/duplicate column/i.test(error.message)) throw error;
  }
}

async function ensureRetrofittedColumns(d1: D1Database): Promise<void> {
  await ensureColumn(d1, "courses", "roster_seeded_at", "text");
  await ensureColumn(d1, "warmup_rounds", "problem_id", "text");
  await ensureColumn(d1, "warmup_rounds", "review_opened_at", "text");
  await ensureColumn(d1, "warmup_submissions", "is_demo", "integer DEFAULT false NOT NULL");
  await ensureColumn(d1, "jev_batch_evaluations", "round_id", "integer");
  await d1.prepare(`CREATE INDEX IF NOT EXISTS jev_batch_evaluations_round_idx ON jev_batch_evaluations (round_id)`).run();
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(d1: D1Database): Promise<void> {
  if (!schemaReady) {
    schemaReady = d1
      .batch(SCHEMA_STATEMENTS.map((sql) => d1.prepare(sql)))
      .then(() => ensureRetrofittedColumns(d1))
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
