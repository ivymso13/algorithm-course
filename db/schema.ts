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
