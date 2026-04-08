import { db } from "@better-t-app/db";
import { quiz, quizQuestion } from "@better-t-app/db/schema/quiz";
import { quizAttempt, quizAttemptAnswer } from "@better-t-app/db/schema/quizAttempt";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export const quizAttemptRouter = {
  start: protectedProcedure
    .input(z.object({ quizId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const quizRow = await db.query.quiz.findFirst({
        where: and(eq(quiz.id, input.quizId), eq(quiz.userId, userId)),
      });

      if (!quizRow) {
        throw new ORPCError("NOT_FOUND", { message: "クイズが見つかりません" });
      }

      if (quizRow.status !== "ready") {
        throw new ORPCError("BAD_REQUEST", { message: "クイズの準備ができていません" });
      }

      const attemptId = generateId();
      const now = new Date();

      await db.insert(quizAttempt).values({
        id: attemptId,
        userId,
        quizId: input.quizId,
        totalQuestions: quizRow.questionCount,
        startedAt: now,
      });

      return {
        attemptId,
        startedAt: now.toISOString(),
      };
    }),

  answer: protectedProcedure
    .input(
      z.object({
        attemptId: z.string(),
        questionId: z.string(),
        selectedChoiceId: z.string(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // Attempt の存在確認 + 所有確認
      const attemptRow = await db.query.quizAttempt.findFirst({
        where: and(eq(quizAttempt.id, input.attemptId), eq(quizAttempt.userId, userId)),
      });

      if (!attemptRow) {
        throw new ORPCError("NOT_FOUND", { message: "挑戦セッションが見つかりません" });
      }

      if (attemptRow.completedAt) {
        throw new ORPCError("BAD_REQUEST", { message: "この挑戦はすでに完了しています" });
      }

      // 問題と選択肢を取得
      const questionRow = await db.query.quizQuestion.findFirst({
        where: eq(quizQuestion.id, input.questionId),
        with: { choices: true },
      });

      if (!questionRow) {
        throw new ORPCError("NOT_FOUND", { message: "問題が見つかりません" });
      }

      const selectedChoice = questionRow.choices.find((c) => c.id === input.selectedChoiceId);
      if (!selectedChoice) {
        throw new ORPCError("BAD_REQUEST", { message: "選択肢が見つかりません" });
      }

      const correctChoice = questionRow.choices.find((c) => c.isCorrect);
      if (!correctChoice) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "正解データが見つかりません" });
      }

      const isCorrect = selectedChoice.isCorrect;

      // 回答を記録
      await db.insert(quizAttemptAnswer).values({
        id: generateId(),
        attemptId: input.attemptId,
        questionId: input.questionId,
        selectedChoiceId: input.selectedChoiceId,
        isCorrect,
        answeredAt: new Date(),
      });

      return {
        isCorrect,
        correctChoiceId: correctChoice.id,
        explanation: questionRow.explanation,
        correctAnswer: questionRow.answer,
      };
    }),

  complete: protectedProcedure
    .input(z.object({ attemptId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const attemptRow = await db.query.quizAttempt.findFirst({
        where: and(eq(quizAttempt.id, input.attemptId), eq(quizAttempt.userId, userId)),
        with: {
          answers: {
            with: {
              question: true,
              selectedChoice: true,
            },
          },
        },
      });

      if (!attemptRow) {
        throw new ORPCError("NOT_FOUND", { message: "挑戦セッションが見つかりません" });
      }

      if (attemptRow.completedAt) {
        throw new ORPCError("BAD_REQUEST", { message: "この挑戦はすでに完了しています" });
      }

      const score = attemptRow.answers.filter((a) => a.isCorrect).length;
      const totalQuestions = attemptRow.totalQuestions;
      const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
      const now = new Date();
      const timeTakenSeconds = Math.round(
        (now.getTime() - (attemptRow.startedAt?.getTime() ?? now.getTime())) / 1000,
      );

      await db
        .update(quizAttempt)
        .set({ score, completedAt: now })
        .where(eq(quizAttempt.id, input.attemptId));

      // 全問の正解選択肢を取得
      const questionIds = attemptRow.answers.map((a) => a.questionId);
      const allChoices = await db.query.quizChoice.findMany({
        where: (c, { inArray }) => inArray(c.questionId, questionIds),
      });
      const correctChoiceMap = new Map(
        allChoices.filter((c) => c.isCorrect).map((c) => [c.questionId, c]),
      );

      return {
        score,
        totalQuestions,
        accuracy,
        timeTakenSeconds,
        answers: attemptRow.answers.map((a) => {
          const correctChoice = correctChoiceMap.get(a.questionId);
          return {
            questionId: a.questionId,
            sentence: a.question.sentence,
            selectedChoiceId: a.selectedChoiceId,
            isCorrect: a.isCorrect,
            correctAnswer: a.question.answer,
            explanation: a.question.explanation,
            correctChoiceId: correctChoice?.id ?? "",
          };
        }),
      };
    }),
};
