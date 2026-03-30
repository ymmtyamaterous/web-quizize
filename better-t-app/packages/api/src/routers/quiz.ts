import { db } from "@better-t-app/db";
import { quiz, quizChoice, quizQuestion, quizTag, tag } from "@better-t-app/db/schema/quiz";
import { quizAttempt } from "@better-t-app/db/schema/quizAttempt";
import { env } from "@better-t-app/env/server";
import { ORPCError } from "@orpc/server";
import * as cheerio from "cheerio";
import { and, desc, eq, exists, inArray, isNotNull, like, sql } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";

// ──── AI question refinement helper ──────────────────────────────────────────

async function refineQuestionWithAi(
  currentQuestion: { sentence: string; answer: string; explanation: string; choices: string[] },
  sourceContent: string,
  userPrompt: string,
): Promise<{ sentence: string; answer: string; explanation: string; choices: string[] }> {
  const openai = new OpenAI({
    apiKey: env.SAKURA_AI_API_KEY,
    baseURL: env.SAKURA_AI_API_BASE_URL,
  });

  const exampleJson = JSON.stringify(
    {
      sentence: "Goのコンパイラは___と呼ばれる最適化でインデックスチェックを除去する。",
      answer: "BCE",
      explanation: "BCEはBounds Check Eliminationの略で、コンパイラが安全と証明できたアクセスのチェックを省略する。",
      choices: ["BCE", "SSA", "GC", "CSE"],
    },
    null,
    2,
  );

  const systemPrompt = `あなたはJSONデータ生成プログラムです。
既存の穴埋めクイズをユーザーの指示に従って修正し、必ず有効なJSONのみを出力してください。
説明文、前置き、コードブロック記号(バッククォート)は一切不要です。
最初の文字は必ず「{」にしてください。

出力するJSONの構造（この形式を厳守すること）:
${exampleJson}

ルール:
- sentenceには必ず「___」を1つ含める
- choices[0]が正解、choices[1〜3]が誤答（計4個）
- choicesの誤答は本文中の別の語句から選ぶ
- 正解は本文から直接引用する`;

  const userMsg = `以下の既存問題をユーザーの指示に従って修正してください。

## 元の問題
${JSON.stringify(currentQuestion, null, 2)}

## ソーステキスト（参考）
${sourceContent.slice(0, 3000)}

## 修正指示
${userPrompt}

出力はJSONのみ。`;

  const completion = await openai.chat.completions
    .create({
      model: env.SAKURA_AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
        { role: "assistant", content: "{" },
      ],
      temperature: 0.4,
    })
    .catch((err) => {
      console.error("[quiz.aiRefineQuestion] OpenAI API error:", err?.message ?? err);
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "AIによる修正に失敗しました" });
    });

  const rawContent = completion.choices[0]?.message?.content ?? "";
  const prependBrace = !rawContent.trimStart().startsWith("{");
  const candidate = prependBrace ? `{${rawContent}` : rawContent;

  const jsonMatch =
    candidate.match(/```json\s*([\s\S]*?)```/) ??
    candidate.match(/```\s*([\s\S]*?)```/) ??
    candidate.match(/(\{[\s\S]*\})/);
  const jsonText = jsonMatch?.[1]?.trim() ?? candidate.trim();

  let refined: { sentence: string; answer: string; explanation: string; choices: string[] };
  try {
    refined = JSON.parse(jsonText);
  } catch {
    console.error("[quiz.aiRefineQuestion] JSON parse error. raw content:", rawContent.slice(0, 500));
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "AIレスポンスの解析に失敗しました" });
  }

  if (
    typeof refined.sentence !== "string" ||
    !refined.sentence.includes("___") ||
    typeof refined.answer !== "string" ||
    !refined.answer ||
    !Array.isArray(refined.choices) ||
    refined.choices.length < 2
  ) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "AIが正しい形式の問題を生成できませんでした",
    });
  }

  return {
    sentence: refined.sentence,
    answer: refined.answer,
    explanation: refined.explanation ?? "",
    choices: refined.choices.slice(0, 4) as string[],
  };
}

import { protectedProcedure } from "../index";

// ──── helpers ────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function isPrivateIp(hostname: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|localhost$)/i.test(hostname);
}

async function fetchPageContent(url: string): Promise<{ title: string; text: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ORPCError("BAD_REQUEST", { message: "不正な URL 形式です" });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ORPCError("BAD_REQUEST", { message: "http または https の URL を入力してください" });
  }

  if (isPrivateIp(parsed.hostname)) {
    throw new ORPCError("BAD_REQUEST", { message: "アクセスできない URL です" });
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "WebQuizize/1.0 (+https://webquizize.app)" },
  }).catch(() => {
    throw new ORPCError("BAD_REQUEST", { message: "ページの取得に失敗しました" });
  });

  if (!response.ok) {
    throw new ORPCError("BAD_REQUEST", { message: `ページの取得に失敗しました (HTTP ${response.status})` });
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  $("script, style, nav, header, footer, aside, [role='navigation']").remove();

  const title = $("title").first().text().trim() || parsed.hostname;
  const text = $("h1, h2, h3, h4, p, li, td, th, blockquote, article, main")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 0)
    .join("\n")
    .slice(0, 50_000);

  if (text.length < 100) {
    throw new ORPCError("BAD_REQUEST", { message: "ページのテキストコンテンツが短すぎます" });
  }

  return { title, text };
}

interface AiQuestion {
  sentence: string;
  answer: string;
  explanation: string;
  choices: string[];
}

async function generateQuestionsWithAi(
  content: string,
  difficulty: "easy" | "medium" | "hard",
  questionCount: number,
): Promise<AiQuestion[]> {
  const difficultyGuide = {
    easy: "見出しレベルの重要語句、固有名詞、数値など明確なキーワードを空欄にする。",
    medium: "文脈理解が必要な概念語・動詞・因果関係を空欄にする。",
    hard: "複数の情報を組み合わせた推論が必要なキーワードや専門的な表現を空欄にする。",
  };

  const openai = new OpenAI({
    apiKey: env.SAKURA_AI_API_KEY,
    baseURL: env.SAKURA_AI_API_BASE_URL,
  });

  // few-shot例を含む厳格なJSONプロンプト
  const exampleJson = JSON.stringify({
    questions: [
      {
        sentence: "Goのコンパイラは___と呼ばれる最適化でインデックスチェックを除去する。",
        answer: "BCE",
        explanation: "BCEはBounds Check Eliminationの略で、コンパイラが安全と証明できたアクセスのチェックを省略する。",
        choices: ["BCE", "SSA", "GC", "CSE"],
      },
    ],
  }, null, 2);

  const systemPrompt = `あなたはJSONデータ生成プログラムです。
与えられたテキストから穴埋めクイズを生成し、必ず有効なJSONのみを出力してください。
説明文、前置き、コードブロック記号(バッククォート)は一切不要です。
最初の文字は必ず「{」にしてください。

難易度: ${difficultyGuide[difficulty]}

出力するJSONの構造（この形式を厳守すること）:
${exampleJson}

ルール:
- sentenceには必ず「___」を1つ含める
- choices[0]が正解、choices[1〜3]が誤答（計4個）
- choicesの誤答は本文中の別の語句から選ぶ
- 正解は本文から直接引用する`;

  const userPrompt = `以下のテキストから${questionCount}問のクイズをJSON形式で生成してください。出力はJSONのみ。

${content.slice(0, 6000)}`;

  const completion = await openai.chat.completions
    .create({
      model: env.SAKURA_AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
        { role: "assistant", content: "{" },
      ],
      temperature: 0.3,
    })
    .catch((err) => {
      console.error("[quiz.generate] OpenAI API error:", err?.message ?? err);
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "AI によるクイズ生成に失敗しました" });
    });

  const rawContent = completion.choices[0]?.message?.content ?? "";

  // assistantプレフィルで "{ " が先頭に付く場合と付かない場合の両方に対応
  const prependBrace = !rawContent.trimStart().startsWith("{");
  const candidate = prependBrace ? `{${rawContent}` : rawContent;

  // JSON ブロックをテキストから抽出（```json ... ``` や裸の { ... } に対応）
  const jsonMatch =
    candidate.match(/```json\s*([\s\S]*?)```/) ??
    candidate.match(/```\s*([\s\S]*?)```/) ??
    candidate.match(/(\{[\s\S]*\})/);
  const jsonText = jsonMatch?.[1]?.trim() ?? candidate.trim();

  let parsed: { questions: AiQuestion[] };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error("[quiz.generate] JSON parse error. raw content:", rawContent.slice(0, 500));
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "AI レスポンスの解析に失敗しました" });
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "クイズの生成に失敗しました" });
  }

  return parsed.questions.slice(0, questionCount);
}

// ──── router ─────────────────────────────────────────────

export const quizRouter = {
  generate: protectedProcedure
    .input(
      z.object({
        url: z.string().url("有効な URL を入力してください"),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
        questionCount: z.number().int().min(1).max(10).default(5),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const { url, difficulty, questionCount } = input;

      // ページ取得
      const { title, text } = await fetchPageContent(url);

      // AIでクイズ生成
      const questions = await generateQuestionsWithAi(text, difficulty, questionCount);

      // DBに保存
      const quizId = generateId();

      await db.insert(quiz).values({
        id: quizId,
        userId,
        sourceUrl: url,
        sourceTitle: title,
        sourceContent: text.slice(0, 10_000),
        difficulty,
        questionCount: questions.length,
        status: "ready",
      });

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q) continue;
        const questionId = generateId();

        await db.insert(quizQuestion).values({
          id: questionId,
          quizId,
          type: "fill_blank",
          sentence: q.sentence,
          answer: q.answer,
          explanation: q.explanation,
          orderIndex: i,
        });

        // choices[0] が正解
        const shuffledChoices = [...q.choices] as string[];
        for (let j = shuffledChoices.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          const tmp = shuffledChoices[j];
          shuffledChoices[j] = shuffledChoices[k] ?? tmp ?? "";
          shuffledChoices[k] = tmp ?? "";
        }

        const correctChoice = q.choices[0];
        for (let ci = 0; ci < shuffledChoices.length; ci++) {
          const choiceText = shuffledChoices[ci] ?? "";
          await db.insert(quizChoice).values({
            id: generateId(),
            questionId,
            text: choiceText,
            isCorrect: choiceText === correctChoice,
            orderIndex: ci,
          });
        }
      }

      return {
        quizId,
        status: "ready" as const,
        title,
        questionCount: questions.length,
      };
    }),

  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
        search: z.string().optional(),
        tagId: z.string().optional(),
        isFavorite: z.boolean().optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const { page, limit, search, tagId, isFavorite, difficulty } = input;
      const offset = (page - 1) * limit;

      // フィルタ条件を構築
      const conditions = [eq(quiz.userId, userId)];
      if (isFavorite !== undefined) {
        conditions.push(eq(quiz.isFavorite, isFavorite));
      }
      if (difficulty) {
        conditions.push(eq(quiz.difficulty, difficulty));
      }
      if (search) {
        conditions.push(like(quiz.sourceTitle, `%${search}%`));
      }
      const whereClause = and(...conditions);

      // タグフィルタがある場合は quizTag を使ったサブクエリ
      const tagFilterCondition = tagId
        ? exists(
            db
              .select({ one: sql`1` })
              .from(quizTag)
              .where(and(eq(quizTag.quizId, quiz.id), eq(quizTag.tagId, tagId))),
          )
        : undefined;

      const finalWhere = tagFilterCondition
        ? and(whereClause, tagFilterCondition)
        : whereClause;

      const [quizzes, [countRow]] = await Promise.all([
        db
          .select({
            id: quiz.id,
            sourceUrl: quiz.sourceUrl,
            sourceTitle: quiz.sourceTitle,
            difficulty: quiz.difficulty,
            questionCount: quiz.questionCount,
            status: quiz.status,
            isFavorite: quiz.isFavorite,
            memo: quiz.memo,
            createdAt: quiz.createdAt,
            lastAttemptAt: sql<number | null>`max(${quizAttempt.completedAt})`,
            bestScore: sql<number | null>`max(${quizAttempt.score})`,
            attemptCount: sql<number>`count(${quizAttempt.id})`,
          })
          .from(quiz)
          .leftJoin(
            quizAttempt,
            and(
              eq(quizAttempt.quizId, quiz.id),
              eq(quizAttempt.userId, userId),
              isNotNull(quizAttempt.completedAt),
            ),
          )
          .where(finalWhere)
          .groupBy(quiz.id)
          .orderBy(desc(quiz.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(quiz)
          .where(finalWhere),
      ]);

      // タグ情報を一括取得
      const quizIds = quizzes.map((q) => q.id);
      const quizTagRows =
        quizIds.length > 0
          ? await db
              .select({
                quizId: quizTag.quizId,
                tagId: tag.id,
                tagName: tag.name,
                tagColor: tag.color,
              })
              .from(quizTag)
              .innerJoin(tag, eq(quizTag.tagId, tag.id))
              .where(inArray(quizTag.quizId, quizIds))
          : [];

      const tagsByQuizId = quizTagRows.reduce<
        Record<string, { id: string; name: string; color: string }[]>
      >((acc, row) => {
        if (!acc[row.quizId]) acc[row.quizId] = [];
        acc[row.quizId]!.push({ id: row.tagId, name: row.tagName, color: row.tagColor });
        return acc;
      }, {});

      const total = countRow?.count ?? 0;

      return {
        quizzes: quizzes.map((q) => ({
          id: q.id,
          sourceUrl: q.sourceUrl,
          sourceTitle: q.sourceTitle,
          difficulty: q.difficulty,
          questionCount: q.questionCount,
          status: q.status,
          isFavorite: q.isFavorite,
          memo: q.memo,
          createdAt: q.createdAt?.toISOString() ?? "",
          lastAttemptAt: q.lastAttemptAt ? new Date(Number(q.lastAttemptAt)).toISOString() : null,
          bestScore: q.bestScore ?? null,
          attemptCount: q.attemptCount ?? 0,
          tags: tagsByQuizId[q.id] ?? [],
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    }),

  get: protectedProcedure
    .input(z.object({ quizId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const quizRow = await db.query.quiz.findFirst({
        where: and(eq(quiz.id, input.quizId), eq(quiz.userId, userId)),
        with: {
          questions: {
            orderBy: (q, { asc }) => [asc(q.orderIndex)],
            with: {
              choices: {
                orderBy: (c, { asc }) => [asc(c.orderIndex)],
              },
            },
          },
        },
      });

      if (!quizRow) {
        throw new ORPCError("NOT_FOUND", { message: "クイズが見つかりません" });
      }

      return {
        id: quizRow.id,
        sourceUrl: quizRow.sourceUrl,
        sourceTitle: quizRow.sourceTitle,
        difficulty: quizRow.difficulty,
        status: quizRow.status,
        createdAt: quizRow.createdAt?.toISOString() ?? "",
        questions: quizRow.questions.map((q) => ({
          id: q.id,
          type: q.type,
          sentence: q.sentence,
          orderIndex: q.orderIndex,
          choices: q.choices.map((c) => ({
            id: c.id,
            text: c.text,
            orderIndex: c.orderIndex,
          })),
        })),
      };
    }),

  /** お気に入り・メモを更新 */
  update: protectedProcedure
    .input(
      z.object({
        quizId: z.string(),
        isFavorite: z.boolean().optional(),
        memo: z.string().max(500, "メモは500文字以内にしてください").optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const quizRow = await db.query.quiz.findFirst({
        where: and(eq(quiz.id, input.quizId), eq(quiz.userId, userId)),
      });

      if (!quizRow) {
        throw new ORPCError("NOT_FOUND", { message: "クイズが見つかりません" });
      }

      const updateData: Partial<typeof quiz.$inferInsert> = {};
      if (input.isFavorite !== undefined) updateData.isFavorite = input.isFavorite;
      if (input.memo !== undefined) updateData.memo = input.memo;

      await db
        .update(quiz)
        .set(updateData)
        .where(and(eq(quiz.id, input.quizId), eq(quiz.userId, userId)));

      return { success: true as const };
    }),

  delete: protectedProcedure
    .input(z.object({ quizId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const quizRow = await db.query.quiz.findFirst({
        where: and(eq(quiz.id, input.quizId), eq(quiz.userId, userId)),
      });

      if (!quizRow) {
        throw new ORPCError("NOT_FOUND", { message: "クイズが見つかりません" });
      }

      await db.delete(quiz).where(and(eq(quiz.id, input.quizId), eq(quiz.userId, userId)));

      return { success: true as const };
    }),

  /** 問題一覧を正答・解説付きで返す（確認用） */
  review: protectedProcedure
    .input(z.object({ quizId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const quizRow = await db.query.quiz.findFirst({
        where: and(eq(quiz.id, input.quizId), eq(quiz.userId, userId)),
        with: {
          questions: {
            orderBy: (q, { asc }) => [asc(q.orderIndex)],
            with: {
              choices: {
                orderBy: (c, { asc }) => [asc(c.orderIndex)],
              },
            },
          },
        },
      });

      if (!quizRow) {
        throw new ORPCError("NOT_FOUND", { message: "クイズが見つかりません" });
      }

      return {
        id: quizRow.id,
        sourceUrl: quizRow.sourceUrl,
        sourceTitle: quizRow.sourceTitle,
        difficulty: quizRow.difficulty,
        createdAt: quizRow.createdAt?.toISOString() ?? "",
        questions: quizRow.questions.map((q) => ({
          id: q.id,
          sentence: q.sentence,
          answer: q.answer,
          explanation: q.explanation,
          orderIndex: q.orderIndex,
          choices: q.choices.map((c) => ({
            id: c.id,
            text: c.text,
            isCorrect: c.isCorrect,
            orderIndex: c.orderIndex,
          })),
        })),
      };
    }),

  /** 問題を手動編集する */
  updateQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.string(),
        sentence: z
          .string()
          .min(1, "問題文を入力してください")
          .max(500)
          .refine((s) => s.includes("___"), { message: '問題文に「___」を含めてください' }),
        answer: z.string().min(1, "答えを入力してください").max(200),
        explanation: z.string().min(1, "解説を入力してください").max(1000),
        choices: z
          .array(
            z.object({
              id: z.string(),
              text: z.string().min(1, "選択肢を入力してください").max(200),
              isCorrect: z.boolean(),
            }),
          )
          .min(2, "選択肢は2つ以上必要です")
          .max(4, "選択肢は4つまでです"),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 正解は1つだけ
      const correctCount = input.choices.filter((c) => c.isCorrect).length;
      if (correctCount !== 1) {
        throw new ORPCError("BAD_REQUEST", { message: "正解は1つだけ選択してください" });
      }

      // 問題存在確認 + オーナーシップ確認
      const questionRow = await db.query.quizQuestion.findFirst({
        where: eq(quizQuestion.id, input.questionId),
        with: { quiz: true },
      });

      if (!questionRow || questionRow.quiz.userId !== userId) {
        throw new ORPCError("NOT_FOUND", { message: "問題が見つかりません" });
      }

      // 問題文・答え・解説を更新
      await db
        .update(quizQuestion)
        .set({
          sentence: input.sentence,
          answer: input.answer,
          explanation: input.explanation,
        })
        .where(eq(quizQuestion.id, input.questionId));

      // 各選択肢をIDで更新（選択肢はこの問題に属することも確認）
      for (const choice of input.choices) {
        await db
          .update(quizChoice)
          .set({ text: choice.text, isCorrect: choice.isCorrect })
          .where(
            and(
              eq(quizChoice.id, choice.id),
              eq(quizChoice.questionId, input.questionId),
            ),
          );
      }

      return { success: true as const };
    }),

  /** AIプロンプトによる問題修正 */
  aiRefineQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.string(),
        prompt: z
          .string()
          .min(1, "修正指示を入力してください")
          .max(500, "修正指示は500文字以内にしてください"),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 問題存在確認 + オーナーシップ確認
      const questionRow = await db.query.quizQuestion.findFirst({
        where: eq(quizQuestion.id, input.questionId),
        with: {
          quiz: true,
          choices: { orderBy: (c, { asc }) => [asc(c.orderIndex)] },
        },
      });

      if (!questionRow || questionRow.quiz.userId !== userId) {
        throw new ORPCError("NOT_FOUND", { message: "問題が見つかりません" });
      }

      // AI で問題を修正
      const currentQuestion = {
        sentence: questionRow.sentence,
        answer: questionRow.answer,
        explanation: questionRow.explanation,
        choices: questionRow.choices.map((c) => c.text),
      };

      const refined = await refineQuestionWithAi(
        currentQuestion,
        questionRow.quiz.sourceContent,
        input.prompt,
      );

      // 問題文・答え・解説を更新
      await db
        .update(quizQuestion)
        .set({
          sentence: refined.sentence,
          answer: refined.answer,
          explanation: refined.explanation,
        })
        .where(eq(quizQuestion.id, input.questionId));

      // 既存選択肢を全削除して再挿入（AIは新しい選択肢を生成するため）
      await db.delete(quizChoice).where(eq(quizChoice.questionId, input.questionId));

      // choices[0] が正解、シャッフルして挿入
      const correctChoice = refined.choices[0];
      const shuffledChoices = [...refined.choices] as string[];
      for (let j = shuffledChoices.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        const tmp = shuffledChoices[j];
        shuffledChoices[j] = shuffledChoices[k] ?? tmp ?? "";
        shuffledChoices[k] = tmp ?? "";
      }

      for (let ci = 0; ci < shuffledChoices.length; ci++) {
        const choiceText = shuffledChoices[ci] ?? "";
        await db.insert(quizChoice).values({
          id: generateId(),
          questionId: input.questionId,
          text: choiceText,
          isCorrect: choiceText === correctChoice,
          orderIndex: ci,
        });
      }

      // 更新後の問題を返す
      const updatedRow = await db.query.quizQuestion.findFirst({
        where: eq(quizQuestion.id, input.questionId),
        with: { choices: { orderBy: (c, { asc }) => [asc(c.orderIndex)] } },
      });

      if (!updatedRow) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "問題の更新後の取得に失敗しました" });
      }

      return {
        id: updatedRow.id,
        sentence: updatedRow.sentence,
        answer: updatedRow.answer,
        explanation: updatedRow.explanation,
        choices: updatedRow.choices.map((c) => ({
          id: c.id,
          text: c.text,
          isCorrect: c.isCorrect,
          orderIndex: c.orderIndex,
        })),
      };
    }),
};
