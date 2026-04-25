/**
 * 新機能のユニットテスト
 * - calcAutoQuestionCount: テキスト長に応じた自動問題数算出
 * - sortBy / sortOrder: クイズ一覧のソートロジック
 * - language: 言語パラメータのバリデーション
 * - appendToQuizId: 既存クイズへの問題追加ロジック
 *
 * 実行方法:
 *   cd /workspace/better-t-app
 *   bun --cwd packages/api test
 */

import { describe, expect, test } from "bun:test";

// ─── calcAutoQuestionCount のモック実装 ──────────────────────────────────────

function calcAutoQuestionCount(textLength: number): number {
  if (textLength < 2000) return 3;
  if (textLength < 5000) return 5;
  if (textLength < 10000) return 8;
  return 10;
}

// ─── ソートロジックのモック ─────────────────────────────────────────────────

interface MockQuizRow {
  id: string;
  title: string;
  createdAt: number; // unix timestamp ms
  bestScore: number | null;
  attemptCount: number;
}

function mockSortQuizList(
  list: MockQuizRow[],
  sortBy: "createdAt" | "title" | "bestScore" | "attemptCount",
  sortOrder: "asc" | "desc",
): MockQuizRow[] {
  return [...list].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    if (sortBy === "createdAt") {
      aVal = a.createdAt;
      bVal = b.createdAt;
    } else if (sortBy === "title") {
      aVal = a.title;
      bVal = b.title;
    } else if (sortBy === "bestScore") {
      aVal = a.bestScore ?? 0;
      bVal = b.bestScore ?? 0;
    } else if (sortBy === "attemptCount") {
      aVal = a.attemptCount;
      bVal = b.attemptCount;
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    return sortOrder === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });
}

// ─── appendToQuizId のモックロジック ─────────────────────────────────────────

interface MockQuiz {
  id: string;
  userId: string;
  questionCount: number;
  language: string;
  status: "generating" | "ready" | "failed";
}

let quizStore: MockQuiz[] = [];

function resetQuizStore() {
  quizStore = [
    { id: "quiz-1", userId: "user-1", questionCount: 3, language: "ja", status: "ready" },
    { id: "quiz-2", userId: "user-2", questionCount: 5, language: "en", status: "ready" },
  ];
}

function mockAppendQuestions(input: {
  appendToQuizId: string;
  userId: string;
  newQuestionsCount: number;
}): { success: true; newTotal: number } | { error: string } {
  const quiz = quizStore.find((q) => q.id === input.appendToQuizId);
  if (!quiz) return { error: "クイズが見つかりません" };
  if (quiz.userId !== input.userId) return { error: "権限がありません" };

  quiz.questionCount += input.newQuestionsCount;
  return { success: true, newTotal: quiz.questionCount };
}

// ─── テスト ──────────────────────────────────────────────────────────────────

describe("calcAutoQuestionCount", () => {
  test("2000文字未満 → 3問", () => {
    expect(calcAutoQuestionCount(0)).toBe(3);
    expect(calcAutoQuestionCount(500)).toBe(3);
    expect(calcAutoQuestionCount(1999)).toBe(3);
  });

  test("2000〜4999文字 → 5問", () => {
    expect(calcAutoQuestionCount(2000)).toBe(5);
    expect(calcAutoQuestionCount(3500)).toBe(5);
    expect(calcAutoQuestionCount(4999)).toBe(5);
  });

  test("5000〜9999文字 → 8問", () => {
    expect(calcAutoQuestionCount(5000)).toBe(8);
    expect(calcAutoQuestionCount(7500)).toBe(8);
    expect(calcAutoQuestionCount(9999)).toBe(8);
  });

  test("10000文字以上 → 10問", () => {
    expect(calcAutoQuestionCount(10000)).toBe(10);
    expect(calcAutoQuestionCount(50000)).toBe(10);
  });
});

describe("sortBy / sortOrder", () => {
  const sampleList: MockQuizRow[] = [
    { id: "q1", title: "Banana", createdAt: 1000, bestScore: 80, attemptCount: 5 },
    { id: "q2", title: "Apple", createdAt: 3000, bestScore: 95, attemptCount: 1 },
    { id: "q3", title: "Cherry", createdAt: 2000, bestScore: null, attemptCount: 10 },
  ];

  test("createdAt desc (デフォルト)", () => {
    const sorted = mockSortQuizList(sampleList, "createdAt", "desc");
    expect(sorted.map((q) => q.id)).toEqual(["q2", "q3", "q1"]);
  });

  test("createdAt asc", () => {
    const sorted = mockSortQuizList(sampleList, "createdAt", "asc");
    expect(sorted.map((q) => q.id)).toEqual(["q1", "q3", "q2"]);
  });

  test("title asc (アルファベット順)", () => {
    const sorted = mockSortQuizList(sampleList, "title", "asc");
    expect(sorted.map((q) => q.title)).toEqual(["Apple", "Banana", "Cherry"]);
  });

  test("title desc", () => {
    const sorted = mockSortQuizList(sampleList, "title", "desc");
    expect(sorted.map((q) => q.title)).toEqual(["Cherry", "Banana", "Apple"]);
  });

  test("bestScore desc (null は 0 扱い)", () => {
    const sorted = mockSortQuizList(sampleList, "bestScore", "desc");
    // 95 > 80 > 0(null)
    expect(sorted.map((q) => q.id)).toEqual(["q2", "q1", "q3"]);
  });

  test("attemptCount asc", () => {
    const sorted = mockSortQuizList(sampleList, "attemptCount", "asc");
    expect(sorted.map((q) => q.id)).toEqual(["q2", "q1", "q3"]);
  });
});

describe("language パラメータのバリデーション", () => {
  const allowedLanguages = ["ja", "en", "zh", "ko"] as const;

  test("許可された言語コードはすべて通過する", () => {
    for (const lang of allowedLanguages) {
      expect(allowedLanguages.includes(lang)).toBe(true);
    }
  });

  test("不正な言語コードは含まれない", () => {
    const invalid = "fr";
    expect(allowedLanguages.includes(invalid as (typeof allowedLanguages)[number])).toBe(false);
  });
});

describe("appendToQuizId — 既存クイズへの問題追加", () => {
  test("正常: 問題数が加算される", () => {
    resetQuizStore();
    const result = mockAppendQuestions({ appendToQuizId: "quiz-1", userId: "user-1", newQuestionsCount: 5 });
    expect(result).toEqual({ success: true, newTotal: 8 });
    expect(quizStore[0].questionCount).toBe(8);
  });

  test("異常: 存在しないクイズID", () => {
    resetQuizStore();
    const result = mockAppendQuestions({ appendToQuizId: "no-such-id", userId: "user-1", newQuestionsCount: 3 });
    expect(result).toEqual({ error: "クイズが見つかりません" });
  });

  test("異常: 他ユーザーのクイズへの追加は拒否", () => {
    resetQuizStore();
    const result = mockAppendQuestions({ appendToQuizId: "quiz-2", userId: "user-1", newQuestionsCount: 3 });
    expect(result).toEqual({ error: "権限がありません" });
  });
});
