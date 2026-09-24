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
    // Set once, the first time this course's roster is seeded from
    // DEFAULT_ROSTER (see lib/roster.ts). Deliberately independent of the
    // roster table's current row count — a teacher emptying the roster later
    // must never cause it to silently reseed the old default students.
    rosterSeededAt: text("roster_seeded_at"),
  },
  (table) => ({
    codeIdx: uniqueIndex("courses_code_idx").on(table.code),
  })
);

/**
 * The teacher-editable class roster (school/student ID/name) — the source of
 * truth for problem-type assignment (see `lib/roster.ts`). Seeded once per
 * course from `lib/assignments.ts`'s `DEFAULT_ROSTER` so existing deployments
 * keep their roster unchanged after this table was introduced.
 *
 * `sortOrder` is assigned once at creation and never reused or renumbered —
 * write/execute problem-type pairing is derived from it (see
 * `comboForSortOrder`), so editing or deleting *other* students can never
 * reshuffle a student's own assignment. `active=false` is a soft delete: used
 * instead of a hard delete whenever the student already has submissions/
 * votes/attempts, so that data is never orphaned or lost (see
 * `lib/roster.ts`'s `deleteRosterStudent`).
 *
 * The (course_id, school, student_id) and (course_id, student_key) indexes
 * are UNIQUE — across every row, active or deactivated — not just to keep
 * two *active* students from colliding, but to stop a student ID/identity
 * that already has real history from ever being handed to a different row
 * (see `lib/rosterGuards.ts`'s `assertNoDuplicateStudentId`). They also
 * close the concurrent-request race an app-level check alone can't: two
 * simultaneous adds/edits for the same identity now fail at the DB layer,
 * which `lib/roster.ts` normalizes back into the same RosterDuplicateError.
 *
 * (school, student_id) — not student_id alone — is the actual student login
 * identifier (see `app/api/student/login/route.ts`): two different schools
 * may legitimately share a student ID, so uniqueness is scoped per school.
 */
export const roster = sqliteTable(
  "roster",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id").notNull(),
    school: text("school").notNull(),
    studentId: text("student_id").notNull(),
    name: text("name").notNull(),
    studentKey: text("student_key").notNull(),
    sortOrder: integer("sort_order").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    courseIdx: index("roster_course_idx").on(table.courseId),
    courseStudentKeyIdx: uniqueIndex("roster_course_student_key_unique_idx").on(table.courseId, table.studentKey),
    courseSchoolStudentIdIdx: uniqueIndex("roster_course_school_student_id_unique_idx").on(
      table.courseId,
      table.school,
      table.studentId
    ),
  })
);

/**
 * A student who has actually logged into a course (course code + student ID
 * + name, matched against the `roster` table). This is a login/consent
 * record, not the source of truth for problem-type assignment — `roster`
 * keeps that role. `studentKey` mirrors the `"{studentId} {name}"` format
 * already used as the foreign key on submissions/attempts.
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

/**
 * One teacher-authored warm-up problem. `status`: draft -> open -> closed.
 *
 * `problemId` is the source `WARMUP_PROBLEMS` entry (see
 * lib/warmupProblems.ts) this round was created from — nullable because
 * rounds created before this column existed have none. It's how the student
 * write page safely knows which interactive sandbox (if any) matches the
 * currently open round; a null value falls back to matching the round's
 * title/prompt against the problem bank (see
 * `resolveWarmupSandboxProblemType`), and if that also fails the sandbox is
 * simply hidden — writing an algorithm never depends on this column.
 *
 * `reviewOpenedAt` is a second gate layered on top of `status === "open"`:
 * students can submit their own algorithm as soon as the round opens, but
 * the peer-review board (/write/explore) stays locked — showing a "waiting
 * for everyone" screen — until this is set. It's a manual teacher action
 * (see `openWarmupReview`), not automatic on "everyone submitted", so the
 * teacher can eyeball the roster's submission status first. Null while
 * waiting; once set it never reverts to null (closing the round via
 * `status` is what actually stops review activity).
 */
export const warmupRounds = sqliteTable(
  "warmup_rounds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id").notNull(),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    problemId: text("problem_id"),
    status: text("status").notNull().default("draft"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    publishedAt: text("published_at"),
    closedAt: text("closed_at"),
    reviewOpenedAt: text("review_opened_at"),
  },
  (table) => ({
    courseIdx: index("warmup_rounds_course_idx").on(table.courseId),
  })
);

/**
 * One student's algorithm for one round. `anonLabel` (e.g. "참가자 3") is
 * the only identity shown to peers on the board — `studentId`/`studentName`
 * stay in the row for the teacher-only detail view.
 *
 * `isDemo` marked a source-controlled example submission auto-seeded so the
 * vote/experience flow could be tried with a full board even before any real
 * student had submitted. That seeding was removed (it confused students, who
 * can't tell a demo card from a real one) — `lib/warmupStore.ts` now filters
 * `isDemo = false` everywhere a student or the roster/participation views
 * touch this table, so no new demo rows are created and any that already
 * exist from before stay invisible. The column stays only so those old rows
 * keep meaning what they meant; nothing writes `true` to it anymore.
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
    revision: integer("revision").notNull().default(1),
    algorithmText: text("algorithm_text").notNull(),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
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

// Jev AI executor (lib/jev/*). A warm-up round's final, peer-reviewed
// submissions get replayed by Jev against many independently randomized
// instances of the activity (lib/jev/batchEvaluate.ts) once the teacher
// closes the round — not self-triggered by students, and not just the one
// instance they solved by hand.
// ---------------------------------------------------------------------------

/**
 * One batch-evaluation run for one student's submission in one round.
 * Per-trial detail (which random instance, what Jev did with it) is kept as
 * JSON on the row rather than its own table — it's read-only diagnostic
 * detail nobody queries or joins across rows, not a first-class record the
 * way the run itself is.
 */
export const jevBatchEvaluations = sqliteTable(
  "jev_batch_evaluations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id").notNull(),
    // Nullable: rows created before this column existed (or a future ad-hoc
    // run not tied to any round) simply aren't shown by the round-scoped
    // student result lookup.
    roundId: integer("round_id"),
    studentKey: text("student_key").notNull(),
    studentId: text("student_id").notNull(),
    studentName: text("student_name").notNull(),
    // "max-finding" today; a second activity's evaluations land in this same
    // table under their own problemId once lib/jev/problems/*.json grows.
    problemId: text("problem_id").notNull(),
    jobItemId: integer("job_item_id"),
    submissionId: integer("submission_id"),
    submissionVersion: integer("submission_version"),
    submissionText: text("submission_text"),
    mode: text("mode").notNull().default("legacy"),
    source: text("source").notNull().default("legacy"),
    algorithmSteps: text("algorithm_steps", { mode: "json" }).notNull(),
    totalTrials: integer("total_trials").notNull(),
    correctCount: integer("correct_count").notNull(),
    incorrectCount: integer("incorrect_count").notNull(),
    errorCount: integer("error_count").notNull(),
    trials: text("trials", { mode: "json" }).$type<import("@/lib/jev/batchEvaluate").BatchTrialResult[]>().notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    jobItemIdx: uniqueIndex("jev_batch_evaluations_job_item_idx").on(table.jobItemId),
    studentIdx: index("jev_batch_evaluations_student_idx").on(table.studentKey),
    courseIdx: index("jev_batch_evaluations_course_idx").on(table.courseId),
    roundIdx: index("jev_batch_evaluations_round_idx").on(table.roundId),
  })
);

/** A resumable teacher run. A partial unique index prevents double starts. */
export const jevJobs = sqliteTable("jev_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestKey: text("request_key").notNull().unique(),
  courseId: integer("course_id").notNull(),
  roundId: integer("round_id").notNull(),
  status: text("status").notNull().default("queued"),
  mode: text("mode").notNull(),
  trialsPerStudent: integer("trials_per_student").notNull(),
  leaseToken: text("lease_token"),
  leaseUntil: integer("lease_until"),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({
  activeRoundIdx: uniqueIndex("jev_jobs_active_round_idx").on(t.courseId, t.roundId)
    .where(sql`${t.status} in ('queued', 'running')`),
  courseIdx: index("jev_jobs_course_idx").on(t.courseId, t.id),
}));

/** Immutable submission snapshot plus checkpointed randomized trials. */
export const jevJobItems = sqliteTable("jev_job_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull(),
  submissionId: integer("submission_id").notNull(),
  submissionVersion: integer("submission_version").notNull(),
  studentKey: text("student_key").notNull(),
  studentId: text("student_id").notNull(),
  studentName: text("student_name").notNull(),
  algorithmText: text("algorithm_text").notNull(),
  status: text("status").notNull().default("pending"),
  trials: text("trials").notNull().default("[]"),
  lastError: text("last_error"),
}, (t) => ({
  jobSubmissionIdx: uniqueIndex("jev_job_items_job_submission_idx").on(t.jobId, t.submissionId),
}));

/**
 * Automatic grading of one maxbox submission revision (lib/jevAuto.ts),
 * enqueued in the same D1 batch that saves the submission. Unique per
 * (submission, revision): an identical resubmit does not bump the revision,
 * so it lands on the existing run instead of paying for a second one.
 */
export const jevAutoRuns = sqliteTable("jev_auto_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id").notNull(),
  roundId: integer("round_id").notNull(),
  submissionId: integer("submission_id").notNull(),
  submissionVersion: integer("submission_version").notNull(),
  studentKey: text("student_key").notNull(),
  studentId: text("student_id").notNull(),
  studentName: text("student_name").notNull(),
  algorithmText: text("algorithm_text").notNull(),
  mode: text("mode").notNull(),
  targetTrials: integer("target_trials").notNull(),
  status: text("status").notNull().default("queued"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  nextAttemptAt: integer("next_attempt_at").notNull().default(0),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
}, (t) => ({
  submissionVersionIdx: uniqueIndex("jev_auto_runs_submission_version_idx").on(t.submissionId, t.submissionVersion),
  courseStatusIdx: index("jev_auto_runs_course_status_idx").on(t.courseId, t.status),
  roundStudentIdx: index("jev_auto_runs_round_student_idx").on(t.roundId, t.studentKey),
}));

/** One randomized trial of an auto run; a row per trial so parallel commits never lose updates. */
export const jevAutoTrials = sqliteTable("jev_auto_trials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull(),
  trialIndex: integer("trial_index").notNull(),
  status: text("status").notNull().default("pending"),
  leaseToken: text("lease_token"),
  leaseUntil: integer("lease_until"),
  committedBy: text("committed_by"),
  attempts: integer("attempts").notNull().default(0),
  result: text("result"),
  updatedAt: text("updated_at"),
}, (t) => ({
  runTrialIdx: uniqueIndex("jev_auto_trials_run_trial_idx").on(t.runId, t.trialIndex),
}));

/**
 * The global concurrency limit for Jev trials across every course and every
 * runner (auto and teacher). A fixed set of rows; a trial may only call the
 * API while it holds an unexpired lease on one of them.
 */
export const jevTrialSlots = sqliteTable("jev_trial_slots", {
  id: integer("id").primaryKey(),
  leaseToken: text("lease_token"),
  leaseUntil: integer("lease_until"),
  holder: text("holder"),
});
