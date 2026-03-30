import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const quiz = sqliteTable(
  "quiz",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title").notNull(),
    sourceContent: text("source_content").notNull(),
    difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] })
      .notNull()
      .default("medium"),
    questionCount: integer("question_count").notNull().default(5),
    status: text("status", { enum: ["generating", "ready", "failed"] })
      .notNull()
      .default("generating"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("quiz_userId_idx").on(table.userId),
    index("quiz_createdAt_idx").on(table.createdAt),
  ],
);

export const quizQuestion = sqliteTable(
  "quiz_question",
  {
    id: text("id").primaryKey(),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quiz.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["fill_blank", "multiple_choice"] }).notNull(),
    sentence: text("sentence").notNull(),
    answer: text("answer").notNull(),
    explanation: text("explanation").notNull(),
    orderIndex: integer("order_index").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("quiz_question_quizId_idx").on(table.quizId)],
);

export const quizChoice = sqliteTable(
  "quiz_choice",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => quizQuestion.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
    orderIndex: integer("order_index").notNull(),
  },
  (table) => [index("quiz_choice_questionId_idx").on(table.questionId)],
);

export const quizRelations = relations(quiz, ({ one, many }) => ({
  user: one(user, { fields: [quiz.userId], references: [user.id] }),
  questions: many(quizQuestion),
}));

export const quizQuestionRelations = relations(quizQuestion, ({ one, many }) => ({
  quiz: one(quiz, { fields: [quizQuestion.quizId], references: [quiz.id] }),
  choices: many(quizChoice),
}));

export const quizChoiceRelations = relations(quizChoice, ({ one }) => ({
  question: one(quizQuestion, {
    fields: [quizChoice.questionId],
    references: [quizQuestion.id],
  }),
}));
