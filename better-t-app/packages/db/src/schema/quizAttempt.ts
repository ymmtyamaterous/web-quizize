import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { quiz, quizChoice, quizQuestion, quizTag } from "./quiz";

export const quizAttempt = sqliteTable(
  "quiz_attempt",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quiz.id, { onDelete: "cascade" }),
    score: integer("score"),
    totalQuestions: integer("total_questions").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("quiz_attempt_userId_idx").on(table.userId),
    index("quiz_attempt_quizId_idx").on(table.quizId),
    index("quiz_attempt_completedAt_idx").on(table.completedAt),
  ],
);

export const quizAttemptAnswer = sqliteTable(
  "quiz_attempt_answer",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => quizAttempt.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => quizQuestion.id, { onDelete: "cascade" }),
    selectedChoiceId: text("selected_choice_id")
      .notNull()
      .references(() => quizChoice.id),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    answeredAt: integer("answered_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("quiz_attempt_answer_attemptId_idx").on(table.attemptId)],
);

// ── quiz / quizQuestion / quizChoice のリレーション（循環依存回避のためここで定義）──

export const quizRelations = relations(quiz, ({ one, many }) => ({
  user: one(user, { fields: [quiz.userId], references: [user.id] }),
  questions: many(quizQuestion),
  attempts: many(quizAttempt),
  quizTags: many(quizTag),
}));

export const quizQuestionRelations = relations(quizQuestion, ({ one, many }) => ({
  quiz: one(quiz, { fields: [quizQuestion.quizId], references: [quiz.id] }),
  choices: many(quizChoice),
  answers: many(quizAttemptAnswer),
}));

export const quizChoiceRelations = relations(quizChoice, ({ one }) => ({
  question: one(quizQuestion, {
    fields: [quizChoice.questionId],
    references: [quizQuestion.id],
  }),
}));

export const quizAttemptRelations = relations(quizAttempt, ({ one, many }) => ({
  user: one(user, { fields: [quizAttempt.userId], references: [user.id] }),
  quiz: one(quiz, { fields: [quizAttempt.quizId], references: [quiz.id] }),
  answers: many(quizAttemptAnswer),
}));

export const quizAttemptAnswerRelations = relations(quizAttemptAnswer, ({ one }) => ({
  attempt: one(quizAttempt, {
    fields: [quizAttemptAnswer.attemptId],
    references: [quizAttempt.id],
  }),
  question: one(quizQuestion, {
    fields: [quizAttemptAnswer.questionId],
    references: [quizQuestion.id],
  }),
  selectedChoice: one(quizChoice, {
    fields: [quizAttemptAnswer.selectedChoiceId],
    references: [quizChoice.id],
  }),
}));
