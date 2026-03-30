import { db } from "@better-t-app/db";
import { quiz, quizChoice, quizQuestion } from "@better-t-app/db/schema/quiz";
import { env } from "@better-t-app/env/server";
import { ORPCError } from "@orpc/server";
import * as cheerio from "cheerio";
import { and, desc, eq, sql } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";

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
    easy: "見出しレベルの重要語句、固有名詞、数値など明確なキーワードを空欄にしてください。",
    medium: "文脈理解が必要な概念語・動詞・因果関係を空欄にしてください。",
    hard: "複数の情報を組み合わせた推論が必要なキーワードや専門的な表現を空欄にしてください。",
  };

  const openai = new OpenAI({
    apiKey: env.SAKURA_AI_API_KEY,
    baseURL: env.SAKURA_AI_API_BASE_URL,
  });

  const systemPrompt = `あなたは教育用クイズ生成AIです。
与えられたWebページのテキストコンテンツを元に、内容理解を助ける穴埋めクイズ（4択形式）を生成してください。

ルール:
1. 文脈上重要なキーワードや概念を空欄（___）にする
2. 正解は必ず本文中から抽出すること
3. 不正解の選択肢は本文と関連があるが明らかに誤りのものにする
4. 解説は本文の内容をもとに簡潔に記述する
5. 難易度指示: ${difficultyGuide[difficulty]}

出力形式（JSON、他の文字列は一切含めない）:
{
  "questions": [
    {
      "sentence": "___を含む問題文（___が空欄）",
      "answer": "正解の語句",
      "explanation": "解説文",
      "choices": ["正解の語句", "誤答1", "誤答2", "誤答3"]
    }
  ]
}

choicesの最初の要素(choices[0])は必ず正解にすること。`;

  const userPrompt = `以下のWebページの内容から${questionCount}問の穴埋めクイズを生成してください。\n\n${content.slice(0, 8000)}`;

  const completion = await openai.chat.completions
    .create({
      model: env.SAKURA_AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    })
    .catch((err) => {
      console.error("[quiz.generate] OpenAI API error:", err?.message ?? err);
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "AI によるクイズ生成に失敗しました" });
    });

  const rawContent = completion.choices[0]?.message?.content ?? "";

  // JSON ブロックをテキストから抽出（```json ... ``` や裸の { ... } に対応）
  const jsonMatch =
    rawContent.match(/```json\s*([\s\S]*?)```/) ??
    rawContent.match(/```\s*([\s\S]*?)```/) ??
    rawContent.match(/(\{[\s\S]*\})/);
  const jsonText = jsonMatch?.[1]?.trim() ?? rawContent.trim();

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
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const { page, limit } = input;
      const offset = (page - 1) * limit;

      const [quizzes, [countRow]] = await Promise.all([
        db
          .select()
          .from(quiz)
          .where(eq(quiz.userId, userId))
          .orderBy(desc(quiz.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(quiz)
          .where(eq(quiz.userId, userId)),
      ]);

      const total = countRow?.count ?? 0;

      return {
        quizzes: quizzes.map((q) => ({
          id: q.id,
          sourceUrl: q.sourceUrl,
          sourceTitle: q.sourceTitle,
          difficulty: q.difficulty,
          questionCount: q.questionCount,
          status: q.status,
          createdAt: q.createdAt?.toISOString() ?? "",
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
};
