import { db } from "@better-t-app/db";
import { quiz } from "@better-t-app/db/schema/quiz";
import { tag, quizTag } from "@better-t-app/db/schema/quiz";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

// タグカラーのプリセット
const TAG_COLOR_PRESETS = [
  "#c8ff00", "#00e5ff", "#ff4d6d", "#ff9e00", "#7c3aed",
  "#10b981", "#f59e0b", "#ec4899", "#6366f1", "#14b8a6",
];

export const tagRouter = {
  /** ユーザーのタグ一覧（各タグに紐付けられたクイズ数付き） */
  list: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const tags = await db.query.tag.findMany({
      where: eq(tag.userId, userId),
      with: {
        quizTags: true,
      },
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });

    return tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      quizCount: t.quizTags.length,
      createdAt: t.createdAt?.toISOString() ?? "",
    }));
  }),

  /** タグ新規作成 */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "タグ名を入力してください").max(30, "タグ名は30文字以内にしてください"),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "カラーコードが不正です").optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 同名タグが既に存在するか確認
      const existing = await db.query.tag.findFirst({
        where: and(eq(tag.userId, userId), eq(tag.name, input.name)),
      });

      if (existing) {
        throw new ORPCError("CONFLICT", { message: "同名のタグが既に存在します" });
      }

      // カラーが指定されていない場合はランダムプリセット
      const color =
        input.color ?? TAG_COLOR_PRESETS[Math.floor(Math.random() * TAG_COLOR_PRESETS.length)] ?? "#6b6b80";

      const tagId = generateId();
      await db.insert(tag).values({
        id: tagId,
        userId,
        name: input.name,
        color,
      });

      return { id: tagId, name: input.name, color };
    }),

  /** タグ削除（紐付けも cascade 削除される） */
  delete: protectedProcedure
    .input(z.object({ tagId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const tagRow = await db.query.tag.findFirst({
        where: and(eq(tag.id, input.tagId), eq(tag.userId, userId)),
      });

      if (!tagRow) {
        throw new ORPCError("NOT_FOUND", { message: "タグが見つかりません" });
      }

      await db.delete(tag).where(and(eq(tag.id, input.tagId), eq(tag.userId, userId)));

      return { success: true as const };
    }),

  /** クイズにタグを付与 */
  attachToQuiz: protectedProcedure
    .input(z.object({ quizId: z.string(), tagId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // クイズとタグの所有者確認
      const [quizRow, tagRow] = await Promise.all([
        db.query.quiz.findFirst({
          where: and(eq(quiz.id, input.quizId), eq(quiz.userId, userId)),
        }),
        db.query.tag.findFirst({
          where: and(eq(tag.id, input.tagId), eq(tag.userId, userId)),
        }),
      ]);

      if (!quizRow) throw new ORPCError("NOT_FOUND", { message: "クイズが見つかりません" });
      if (!tagRow) throw new ORPCError("NOT_FOUND", { message: "タグが見つかりません" });

      // 既に紐付き済みなら何もしない
      const existing = await db.query.quizTag.findFirst({
        where: and(eq(quizTag.quizId, input.quizId), eq(quizTag.tagId, input.tagId)),
      });

      if (!existing) {
        await db.insert(quizTag).values({
          quizId: input.quizId,
          tagId: input.tagId,
        });
      }

      return { success: true as const };
    }),

  /** クイズからタグを解除 */
  detachFromQuiz: protectedProcedure
    .input(z.object({ quizId: z.string(), tagId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 所有者確認
      const quizRow = await db.query.quiz.findFirst({
        where: and(eq(quiz.id, input.quizId), eq(quiz.userId, userId)),
      });

      if (!quizRow) throw new ORPCError("NOT_FOUND", { message: "クイズが見つかりません" });

      await db
        .delete(quizTag)
        .where(and(eq(quizTag.quizId, input.quizId), eq(quizTag.tagId, input.tagId)));

      return { success: true as const };
    }),
};
