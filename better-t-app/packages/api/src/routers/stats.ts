import { db } from "@better-t-app/db";
import { aiRequestLog, quiz } from "@better-t-app/db/schema/quiz";
import { quizAttempt, quizAttemptAnswer } from "@better-t-app/db/schema/quizAttempt";
import { env } from "@better-t-app/env/server";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

export const statsRouter = {
  summary: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    // 今日の UTC 0:00
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const [
      [quizCount],
      [attemptCount],
      [answerStats],
      [timeStats],
      completionDates,
      [aiCountRow],
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
      // 連続学習日数計算用：完了日の一覧を取得
      db
        .selectDistinct({
          date: sql<string>`date(${quizAttempt.completedAt} / 1000, 'unixepoch')`,
        })
        .from(quizAttempt)
        .where(and(eq(quizAttempt.userId, userId), isNotNull(quizAttempt.completedAt)))
        .orderBy(desc(sql`date(${quizAttempt.completedAt} / 1000, 'unixepoch')`)),
      // 本日のAIリクエスト数
      db
        .select({ count: sql<number>`count(*)` })
        .from(aiRequestLog)
        .where(
          and(
            eq(aiRequestLog.userId, userId),
            gte(aiRequestLog.createdAt, startOfDay),
          ),
        ),
    ]);

    const totalAnswered = answerStats?.total ?? 0;
    const correctAnswered = answerStats?.correct ?? 0;
    const overallAccuracy =
      totalAnswered > 0 ? Math.round((correctAnswered / totalAnswered) * 100) : 0;
    const totalStudyTimeSeconds = Math.round((timeStats?.totalMs ?? 0) / 1000);

    // 連続学習日数を計算（今日から遡って連続した日数）
    const dateSet = new Set(completionDates.map((d) => d.date));
    let currentStreak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      if (dateSet.has(d)) {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      totalQuizzesGenerated: quizCount?.count ?? 0,
      totalAttempts: attemptCount?.count ?? 0,
      totalQuestionsAnswered: totalAnswered,
      overallAccuracy,
      totalStudyTimeSeconds,
      currentStreak,
      aiRequestsToday: aiCountRow?.count ?? 0,
      aiRequestLimit: env.AI_DAILY_REQUEST_LIMIT,
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
