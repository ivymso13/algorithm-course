import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

/**
 * Single-row table holding whether the teacher has activated page 2 for the
 * whole class yet.
 */
export const stageState = sqliteTable("stage_state", {
  id: integer("id").primaryKey(),
  stage2Active: integer("stage2_active", { mode: "boolean" })
    .notNull()
    .default(false),
  activatedAt: text("activated_at"),
});
