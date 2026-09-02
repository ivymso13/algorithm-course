import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * A class/session the site is running for. Replaces the old singleton
 * `stage_state` row: this table still holds the stage-2 gate, but also owns
 * the student-facing access code (public deployment has no ChatGPT/GitHub
 * login, so this code is the only gate keeping strangers off the roster)
 * and the data-retention policy shown in the privacy notice.
 */
export const courses = sqliteTable(
  "courses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    name: text("name").notNull().default("알고리즘 수업"),
    stage2Active: integer("stage2_active", { mode: "boolean" }).notNull().default(false),
    activatedAt: text("activated_at"),
    retentionDays: integer("retention_days").notNull().default(90),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    codeIdx: uniqueIndex("courses_code_idx").on(table.code),
  })
);

/**
 * A student who has actually logged into a course (course code + student ID
 * + name, all matched against `lib/assignments.ts`'s hardcoded roster/
 * assignment table). This is a login/consent record, not the source of
 * truth for problem-type assignment — `lib/assignments.ts` keeps that role
 * unchanged. `studentKey` mirrors the `"{studentId} {name}"` format already
 * used as the foreign key on submissions/attempts.
 */
export const students = sqliteTable(
  "students",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id").notNull(),
    studentId: text("student_id").notNull(),
    name: text("name").notNull(),
    studentKey: text("student_key").notNull(),
    consentAt: text("consent_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastLoginAt: text("last_login_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    courseStudentKeyIdx: uniqueIndex("students_course_student_key_idx").on(
      table.courseId,
      table.studentKey
    ),
  })
);

/**
 * An opaque, server-issued session. The raw token only ever lives in the
 * HttpOnly cookie sent to the browser — only its SHA-256 hash is persisted,
 * so a leaked/dumped DB row can't be replayed as a live session.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenHash: text("token_hash").notNull(),
    studentId: integer("student_id").notNull(),
    courseId: integer("course_id").notNull(),
    studentKey: text("student_key").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    studentKeyIdx: index("sessions_student_key_idx").on(table.studentKey),
  })
);

/**
 * A page-1 submission: one student's natural-language algorithm for one
 * assigned "write" problem type. Upserted (unique per student+type) so a
 * student can revise and resubmit before it gets picked up by an executor.
 */
export const submissions = sqliteTable(
  "submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentKey: text("student_key").notNull(),
    studentId: text("student_id").notNull(),
    studentName: text("student_name").notNull(),
    problemType: text("problem_type").notNull(),
    algorithmText: text("algorithm_text").notNull(),
    exampleInput: text("example_input", { mode: "json" }).notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueAuthorType: uniqueIndex("submissions_student_type_idx").on(
      table.studentKey,
      table.problemType
    ),
  })
);

/**
 * A page-2 attempt: one execution of another student's submitted algorithm,
 * including the random instance, the action log, the final answer/grading,
 * and the post-submission evaluation responses.
 */
export const attempts = sqliteTable(
  "attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    submissionId: integer("submission_id").notNull(),
    problemType: text("problem_type").notNull(),
    executorKey: text("executor_key").notNull(),
    executorId: text("executor_id").notNull(),
    executorName: text("executor_name").notNull(),

    // input_seed: the randomly generated instance data for this attempt
    // (kept alongside a separately generated hidden `secret` used only for
    // server-side simulation/grading, e.g. which coin is fake).
    input: text("input", { mode: "json" }).notNull(),
    correctAnswer: integer("correct_answer").notNull(),
    referenceActionCount: integer("reference_action_count").notNull(),

    state: text("state", { mode: "json" }).notNull(),
    actionLog: text("action_log", { mode: "json" }).notNull(),
    actionCount: integer("action_count").notNull().default(0),

    unexecutableFlag: integer("unexecutable_flag", { mode: "boolean" })
      .notNull()
      .default(false),
    unexecutableReason: text("unexecutable_reason"),

    finalAnswer: integer("final_answer"),
    isCorrect: integer("is_correct", { mode: "boolean" }),

    evaluationResponses: text("evaluation_responses", { mode: "json" }),

    status: text("status").notNull().default("in_progress"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    submittedAt: text("submitted_at"),
    evaluatedAt: text("evaluated_at"),
  },
  (table) => ({
    submissionIdx: index("attempts_submission_idx").on(table.submissionId),
    executorIdx: index("attempts_executor_idx").on(table.executorKey),
    problemTypeIdx: index("attempts_problem_type_idx").on(table.problemType),
  })
);

// ---------------------------------------------------------------------------
// Warm-up rounds — the site's current default activity: the teacher writes
// one free-form problem, publishes it, the whole class submits an algorithm
// for it, then reviews each other's submissions anonymously (board + vote +
// a generic step-check "experience"). Unlike submissions/attempts above
// (kept intact as a reusable template, not deleted), this flow has no fixed
// problem type and no per-type simulator — only one round is ever "open" at
// a time (§courses no longer needs a stage2 gate for this flow).
// ---------------------------------------------------------------------------

/** One teacher-authored warm-up problem. `status`: draft -> open -> closed. */
export const warmupRounds = sqliteTable(
  "warmup_rounds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id").notNull(),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    publishedAt: text("published_at"),
    closedAt: text("closed_at"),
  },
  (table) => ({
    courseIdx: index("warmup_rounds_course_idx").on(table.courseId),
  })
);

/**
 * One student's algorithm for one round. `anonLabel` (e.g. "참가자 3") is
 * the only identity shown to peers on the board — `studentId`/`studentName`
 * stay in the row for the teacher-only detail view.
 */
export const warmupSubmissions = sqliteTable(
  "warmup_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roundId: integer("round_id").notNull(),
    studentKey: text("student_key").notNull(),
    studentId: text("student_id").notNull(),
    studentName: text("student_name").notNull(),
    anonLabel: text("anon_label").notNull(),
    algorithmText: text("algorithm_text").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    roundStudentIdx: uniqueIndex("warmup_submissions_round_student_idx").on(
      table.roundId,
      table.studentKey
    ),
    roundIdx: index("warmup_submissions_round_idx").on(table.roundId),
  })
);

/**
 * One student's recommendation tag on another student's submission. The
 * (submission, voter, type) unique index is the duplicate-vote guard from
 * the spec — casting the same tag twice on the same submission is a no-op
 * toggle-off (see lib/warmupStore.ts `toggleWarmupVote`), not a stacked vote.
 */
export const warmupVotes = sqliteTable(
  "warmup_votes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    submissionId: integer("submission_id").notNull(),
    roundId: integer("round_id").notNull(),
    voterStudentKey: text("voter_student_key").notNull(),
    voteType: text("vote_type").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueVoteIdx: uniqueIndex("warmup_votes_unique_idx").on(
      table.submissionId,
      table.voterStudentKey,
      table.voteType
    ),
    submissionIdx: index("warmup_votes_submission_idx").on(table.submissionId),
  })
);

/**
 * One student's generic step-check walkthrough of another student's
 * submission: which lines of the algorithm text they checked off while
 * following along, whether they could execute it end to end, and one short
 * feedback note. No simulator/grading — "generic" per the spec.
 */
export const warmupExperiences = sqliteTable(
  "warmup_experiences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    submissionId: integer("submission_id").notNull(),
    roundId: integer("round_id").notNull(),
    executorStudentKey: text("executor_student_key").notNull(),
    executorId: text("executor_id").notNull(),
    executorName: text("executor_name").notNull(),
    checkedSteps: text("checked_steps", { mode: "json" }).notNull(),
    totalSteps: integer("total_steps").notNull(),
    executable: integer("executable", { mode: "boolean" }).notNull(),
    feedback: text("feedback").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueExperienceIdx: uniqueIndex("warmup_experiences_unique_idx").on(
      table.submissionId,
      table.executorStudentKey
    ),
    submissionIdx: index("warmup_experiences_submission_idx").on(table.submissionId),
  })
);
