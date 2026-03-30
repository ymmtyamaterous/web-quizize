import { db } from "@better-t-app/db";
import { quiz } from "@better-t-app/db/schema/quiz";
import { quizAttempt, quizAttemptAnswer } from "@better-t-app/db/schema/quizAttempt";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

export const statsRouter = {
  summary: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const [
      [quizCount],
      [attemptCount],
      [answerStats],
      [timeStats],
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(quiz)
        .where(eq(quiz.userId, userId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(quizAttempt)
        .where(and(eq(quizAttempt.userId, userId), isNotNull(quizAttempt.completedAt))),
      db
        .select({
          total: sql<number>`count(*)`,
          correct: sql<number>`sum(case when ${quizAttemptAnswer.isCorrect} then 1 else 0 end)`,
        })
        .from(quizAttemptAnswer)
        .innerJoin(quizAttempt, eq(quizAttemptAnswer.attemptId, quizAttempt.id))
        .where(eq(quizAttempt.userId, userId)),
      db
        .select({
          totalMs: sql<number>`sum(${quizAttempt.completedAt} - ${quizAttempt.startedAt})`,
        })
        .from(quizAttempt)
        .where(
          and(
            eq(quizAttempt.userId, userId),
            isNotNull(quizAttempt.completedAt),
          ),
        ),
    ]);

    const totalAnswered = answerStats?.total ?? 0;
    const correctAnswered = answerStats?.correct ?? 0;
    const overallAccuracy =
      totalAnswered > 0 ? Math.round((correctAnswered / totalAnswered) * 100) : 0;
    const totalStudyTimeSeconds = Math.round((timeStats?.totalMs ?? 0) / 1000);

    return {
      totalQuizzesGenerated: quizCount?.count ?? 0,
      totalAttempts: attemptCount?.count ?? 0,
      totalQuestionsAnswered: totalAnswered,
      overallAccuracy,
      totalStudyTimeSeconds,
    };
  }),

  history: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const { page, limit } = input;
      const offset = (page - 1) * limit;

      const [attempts, [countRow]] = await Promise.all([
        db
          .select({
            attemptId: quizAttempt.id,
            quizId: quizAttempt.quizId,
            score: quizAttempt.score,
            totalQuestions: quizAttempt.totalQuestions,
            startedAt: quizAttempt.startedAt,
            completedAt: quizAttempt.completedAt,
            sourceTitle: quiz.sourceTitle,
            sourceUrl: quiz.sourceUrl,
          })
          .from(quizAttempt)
          .innerJoin(quiz, eq(quizAttempt.quizId, quiz.id))
          .where(and(eq(quizAttempt.userId, userId), isNotNull(quizAttempt.completedAt)))
          .orderBy(desc(quizAttempt.completedAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(quizAttempt)
          .where(and(eq(quizAttempt.userId, userId), isNotNull(quizAttempt.completedAt))),
      ]);

      const total = countRow?.count ?? 0;

      return {
        history: attempts.map((a) => {
          const score = a.score ?? 0;
          const accuracy =
            a.totalQuestions > 0 ? Math.round((score / a.totalQuestions) * 100) : 0;
          const timeTakenSeconds =
            a.completedAt && a.startedAt
              ? Math.round((a.completedAt.getTime() - a.startedAt.getTime()) / 1000)
              : 0;
          return {
            attemptId: a.attemptId,
            quizId: a.quizId,
            sourceTitle: a.sourceTitle,
            sourceUrl: a.sourceUrl,
            score,
            totalQuestions: a.totalQuestions,
            accuracy,
            timeTakenSeconds,
            completedAt: a.completedAt?.toISOString() ?? "",
          };
        }),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    }),
};
