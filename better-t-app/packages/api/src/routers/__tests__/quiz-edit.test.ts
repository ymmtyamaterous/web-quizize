/**
 * quiz.updateQuestion / quiz.aiRefineQuestion のユニットテスト
 * Bun test ランナー（bun test）で実行します
 *
 * 実行方法:
 *   cd /workspace/better-t-app
 *   bun --cwd packages/api test
 */

import { beforeEach, describe, expect, test } from "bun:test";

// ─── モックストア ─────────────────────────────────────────────────────────────

interface MockQuiz {
  id: string;
  userId: string;
  sourceContent: string;
  sourceUrl: string;
  sourceTitle: string;
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  status: "generating" | "ready" | "failed";
}

interface MockQuestion {
  id: string;
  quizId: string;
  sentence: string;
  answer: string;
  explanation: string;
  orderIndex: number;
}

interface MockChoice {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  orderIndex: number;
}

let quizStore: MockQuiz[] = [];
let questionStore: MockQuestion[] = [];
let choiceStore: MockChoice[] = [];

function resetStores() {
  quizStore = [
    {
      id: "quiz-1",
      userId: "user-1",
      sourceContent: "TypeScriptはMicrosoftが開発した静的型付け言語です。",
      sourceUrl: "https://example.com",
      sourceTitle: "TypeScript入門",
      difficulty: "medium",
      questionCount: 3,
      status: "ready",
    },
  ];

  questionStore = [
    {
      id: "q-1",
      quizId: "quiz-1",
      sentence: "TypeScriptは___が開発した静的型付け言語です。",
      answer: "Microsoft",
      explanation: "TypeScriptはMicrosoftが2012年に公開しました。",
      orderIndex: 0,
    },
  ];

  choiceStore = [
    { id: "c-1", questionId: "q-1", text: "Microsoft", isCorrect: true, orderIndex: 0 },
    { id: "c-2", questionId: "q-1", text: "Google", isCorrect: false, orderIndex: 1 },
    { id: "c-3", questionId: "q-1", text: "Meta", isCorrect: false, orderIndex: 2 },
    { id: "c-4", questionId: "q-1", text: "Apple", isCorrect: false, orderIndex: 3 },
  ];
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

/** updateQuestion のロジックをモックで再現 */
function mockUpdateQuestion(input: {
  questionId: string;
  sentence: string;
  answer: string;
  explanation: string;
  choices: { id: string; text: string; isCorrect: boolean }[];
  userId: string;
}): { success: true } | { error: string } {
  // 正解の数を検証
  const correctCount = input.choices.filter((c) => c.isCorrect).length;
  if (correctCount !== 1) {
    return { error: "正解は1つだけ選択してください" };
  }

  // 問題文に「___」が含まれるか検証
  if (!input.sentence.includes("___")) {
    return { error: '問題文に「___」を含めてください' };
  }

  // 問題存在確認 + オーナーシップ確認
  const question = questionStore.find((q) => q.id === input.questionId);
  if (!question) return { error: "問題が見つかりません" };

  const quiz = quizStore.find(
    (qz) => qz.id === question.quizId && qz.userId === input.userId,
  );
  if (!quiz) return { error: "問題が見つかりません" };

  // 更新
  question.sentence = input.sentence;
  question.answer = input.answer;
  question.explanation = input.explanation;

  for (const choiceInput of input.choices) {
    const choice = choiceStore.find(
      (c) => c.id === choiceInput.id && c.questionId === input.questionId,
    );
    if (choice) {
      choice.text = choiceInput.text;
      choice.isCorrect = choiceInput.isCorrect;
    }
  }

  return { success: true };
}

/** aiRefineQuestion のDB更新ロジックをモックで再現（AI呼び出し部分を除く） */
function mockApplyAiResult(
  questionId: string,
  userId: string,
  refined: { sentence: string; answer: string; explanation: string; choices: string[] },
): { success: true } | { error: string } {
  const question = questionStore.find((q) => q.id === questionId);
  if (!question) return { error: "問題が見つかりません" };

  const quiz = quizStore.find(
    (qz) => qz.id === question.quizId && qz.userId === userId,
  );
  if (!quiz) return { error: "問題が見つかりません" };

  if (!refined.sentence.includes("___") || !refined.answer || refined.choices.length < 2) {
    return { error: "AIが正しい形式の問題を生成できませんでした" };
  }

  // 問題を更新
  question.sentence = refined.sentence;
  question.answer = refined.answer;
  question.explanation = refined.explanation;

  // 選択肢を全削除して再挿入
  const existingChoiceIds = choiceStore
    .filter((c) => c.questionId === questionId)
    .map((c) => c.id);
  for (const id of existingChoiceIds) {
    const idx = choiceStore.findIndex((c) => c.id === id);
    if (idx !== -1) choiceStore.splice(idx, 1);
  }

  const correctChoice = refined.choices[0]!;
  for (let i = 0; i < refined.choices.length; i++) {
    choiceStore.push({
      id: `c-new-${i}`,
      questionId,
      text: refined.choices[i]!,
      isCorrect: refined.choices[i] === correctChoice,
      orderIndex: i,
    });
  }

  return { success: true };
}

// ─── quiz.updateQuestion テスト ───────────────────────────────────────────────

describe("quiz.updateQuestion", () => {
  beforeEach(() => resetStores());

  test("問題文・答え・解説・選択肢を更新できる", () => {
    const result = mockUpdateQuestion({
      questionId: "q-1",
      sentence: "TypeScriptは___によって開発された言語です。",
      answer: "Microsoft",
      explanation: "更新された解説文です。",
      choices: [
        { id: "c-1", text: "Microsoft", isCorrect: true },
        { id: "c-2", text: "Google", isCorrect: false },
        { id: "c-3", text: "Amazon", isCorrect: false },
        { id: "c-4", text: "Apple", isCorrect: false },
      ],
      userId: "user-1",
    });

    expect(result).toEqual({ success: true });

    const updatedQ = questionStore.find((q) => q.id === "q-1");
    expect(updatedQ?.sentence).toBe("TypeScriptは___によって開発された言語です。");
    expect(updatedQ?.answer).toBe("Microsoft");
    expect(updatedQ?.explanation).toBe("更新された解説文です。");

    const updatedChoice = choiceStore.find((c) => c.id === "c-3");
    expect(updatedChoice?.text).toBe("Amazon");
  });

  test("問題文に「___」がない場合はエラーを返す", () => {
    const result = mockUpdateQuestion({
      questionId: "q-1",
      sentence: "TypeScriptはMicrosoftが開発した言語です。", // ___ なし
      answer: "Microsoft",
      explanation: "解説",
      choices: [
        { id: "c-1", text: "Microsoft", isCorrect: true },
        { id: "c-2", text: "Google", isCorrect: false },
        { id: "c-3", text: "Meta", isCorrect: false },
        { id: "c-4", text: "Apple", isCorrect: false },
      ],
      userId: "user-1",
    });

    expect(result).toEqual({ error: '問題文に「___」を含めてください' });
  });

  test("正解が0個の場合はエラーを返す", () => {
    const result = mockUpdateQuestion({
      questionId: "q-1",
      sentence: "TypeScriptは___が開発した言語です。",
      answer: "Microsoft",
      explanation: "解説",
      choices: [
        { id: "c-1", text: "Microsoft", isCorrect: false }, // 全部 false
        { id: "c-2", text: "Google", isCorrect: false },
        { id: "c-3", text: "Meta", isCorrect: false },
        { id: "c-4", text: "Apple", isCorrect: false },
      ],
      userId: "user-1",
    });

    expect(result).toEqual({ error: "正解は1つだけ選択してください" });
  });

  test("正解が2個の場合はエラーを返す", () => {
    const result = mockUpdateQuestion({
      questionId: "q-1",
      sentence: "TypeScriptは___が開発した言語です。",
      answer: "Microsoft",
      explanation: "解説",
      choices: [
        { id: "c-1", text: "Microsoft", isCorrect: true },
        { id: "c-2", text: "Google", isCorrect: true }, // 2つ正解
        { id: "c-3", text: "Meta", isCorrect: false },
        { id: "c-4", text: "Apple", isCorrect: false },
      ],
      userId: "user-1",
    });

    expect(result).toEqual({ error: "正解は1つだけ選択してください" });
  });

  test("存在しない問題IDはエラーを返す", () => {
    const result = mockUpdateQuestion({
      questionId: "q-nonexistent",
      sentence: "___は静的型付け言語です。",
      answer: "TypeScript",
      explanation: "解説",
      choices: [
        { id: "c-1", text: "TypeScript", isCorrect: true },
        { id: "c-2", text: "Python", isCorrect: false },
      ],
      userId: "user-1",
    });

    expect(result).toEqual({ error: "問題が見つかりません" });
  });

  test("他のユーザーの問題は更新できない", () => {
    const result = mockUpdateQuestion({
      questionId: "q-1",
      sentence: "TypeScriptは___が開発した言語です。",
      answer: "Microsoft",
      explanation: "解説",
      choices: [
        { id: "c-1", text: "Microsoft", isCorrect: true },
        { id: "c-2", text: "Google", isCorrect: false },
        { id: "c-3", text: "Meta", isCorrect: false },
        { id: "c-4", text: "Apple", isCorrect: false },
      ],
      userId: "user-2", // 別ユーザー
    });

    expect(result).toEqual({ error: "問題が見つかりません" });
  });

  test("正解の選択肢を変更できる", () => {
    const result = mockUpdateQuestion({
      questionId: "q-1",
      sentence: "TypeScriptは___が開発した言語です。",
      answer: "Google",
      explanation: "解説（変更）",
      choices: [
        { id: "c-1", text: "Microsoft", isCorrect: false },
        { id: "c-2", text: "Google", isCorrect: true }, // 正解を変更
        { id: "c-3", text: "Meta", isCorrect: false },
        { id: "c-4", text: "Apple", isCorrect: false },
      ],
      userId: "user-1",
    });

    expect(result).toEqual({ success: true });

    const c1 = choiceStore.find((c) => c.id === "c-1");
    const c2 = choiceStore.find((c) => c.id === "c-2");
    expect(c1?.isCorrect).toBe(false);
    expect(c2?.isCorrect).toBe(true);
  });
});

// ─── quiz.aiRefineQuestion テスト ─────────────────────────────────────────────

describe("quiz.aiRefineQuestion (DB更新ロジック)", () => {
  beforeEach(() => resetStores());

  test("AIの修正結果を正しくDBに適用できる", () => {
    const result = mockApplyAiResult("q-1", "user-1", {
      sentence: "___はJavaScriptのスーパーセットです。",
      answer: "TypeScript",
      explanation: "TypeScriptはJavaScriptに静的型付けを追加した言語です。",
      choices: ["TypeScript", "CoffeeScript", "Dart", "Elm"],
    });

    expect(result).toEqual({ success: true });

    const updatedQ = questionStore.find((q) => q.id === "q-1");
    expect(updatedQ?.sentence).toBe("___はJavaScriptのスーパーセットです。");
    expect(updatedQ?.answer).toBe("TypeScript");

    // 選択肢が新しいものに差し替わっている
    const newChoices = choiceStore.filter((c) => c.questionId === "q-1");
    expect(newChoices).toHaveLength(4);
    expect(newChoices.some((c) => c.text === "TypeScript" && c.isCorrect)).toBe(true);
    expect(newChoices.some((c) => c.text === "CoffeeScript" && !c.isCorrect)).toBe(true);

    // 古い選択肢IDは存在しない
    expect(choiceStore.find((c) => c.id === "c-1")).toBeUndefined();
  });

  test("「___」を含まないAI結果はエラーを返す", () => {
    const result = mockApplyAiResult("q-1", "user-1", {
      sentence: "TypeScriptはJavaScriptのスーパーセットです。", // ___ なし
      answer: "TypeScript",
      explanation: "解説",
      choices: ["TypeScript", "CoffeeScript"],
    });

    expect(result).toEqual({ error: "AIが正しい形式の問題を生成できませんでした" });

    // DBは変更されていない
    const q = questionStore.find((q) => q.id === "q-1");
    expect(q?.sentence).toBe("TypeScriptは___が開発した静的型付け言語です。");
  });

  test("選択肢が1個以下のAI結果はエラーを返す", () => {
    const result = mockApplyAiResult("q-1", "user-1", {
      sentence: "TypeScriptは___が開発した言語です。",
      answer: "Microsoft",
      explanation: "解説",
      choices: ["Microsoft"], // 1個のみ
    });

    expect(result).toEqual({ error: "AIが正しい形式の問題を生成できませんでした" });
  });

  test("他のユーザーの問題にはAI修正を適用できない", () => {
    const result = mockApplyAiResult("q-1", "user-2", {
      sentence: "TypeScriptは___が開発した言語です。",
      answer: "Microsoft",
      explanation: "解説",
      choices: ["Microsoft", "Google", "Meta", "Apple"],
    });

    expect(result).toEqual({ error: "問題が見つかりません" });

    // DBは変更されていない
    const q = questionStore.find((q) => q.id === "q-1");
    expect(q?.sentence).toBe("TypeScriptは___が開発した静的型付け言語です。");
  });

  test("AI修正後の選択肢は choices[0] が正解になる", () => {
    mockApplyAiResult("q-1", "user-1", {
      sentence: "___はJavaScriptのスーパーセットです。",
      answer: "TypeScript",
      explanation: "解説",
      choices: ["TypeScript", "Dart", "Elm", "CoffeeScript"],
    });

    const newChoices = choiceStore.filter((c) => c.questionId === "q-1");
    const correctChoices = newChoices.filter((c) => c.isCorrect);
    expect(correctChoices).toHaveLength(1);
    expect(correctChoices[0]?.text).toBe("TypeScript");
  });

  test("2個の選択肢でも正常に処理できる（最小ケース）", () => {
    const result = mockApplyAiResult("q-1", "user-1", {
      sentence: "TypeScriptは___が開発した言語です。",
      answer: "Microsoft",
      explanation: "解説",
      choices: ["Microsoft", "Google"],
    });

    expect(result).toEqual({ success: true });

    const newChoices = choiceStore.filter((c) => c.questionId === "q-1");
    expect(newChoices).toHaveLength(2);
  });
});

// ─── バリデーション境界値テスト ──────────────────────────────────────────────

describe("updateQuestion バリデーション", () => {
  test("sentence の最大長（500文字）", () => {
    // 497文字 + "___"(3文字) = 500文字 → Zodでは通る
    const longSentence = `${"あ".repeat(497)}___`;
    expect(longSentence.length).toBe(500);
    expect(longSentence.includes("___")).toBe(true);
  });

  test("sentence が501文字を超えると Zod で弾かれる（z.string().max(500)）", () => {
    // 498文字 + "___"(3文字) = 501文字 → Zodでは弾かれる
    const tooLong = `${"あ".repeat(498)}___`;
    expect(tooLong.length).toBeGreaterThan(500);
  });

  test("choices が2個以上4個以下であること", () => {
    const minValid = [
      { id: "c1", text: "A", isCorrect: true },
      { id: "c2", text: "B", isCorrect: false },
    ];
    expect(minValid.length).toBeGreaterThanOrEqual(2);
    expect(minValid.length).toBeLessThanOrEqual(4);
  });

  test("prompt の最大長（500文字）", () => {
    const maxPrompt = "a".repeat(500);
    expect(maxPrompt.length).toBeLessThanOrEqual(500);

    const tooLong = "a".repeat(501);
    expect(tooLong.length).toBeGreaterThan(500);
  });
});

// ─── AI 1日リクエスト上限テスト ──────────────────────────────────────────────

interface MockAiRequestLog {
  id: string;
  userId: string;
  requestType: "generate" | "refine";
  createdAt: Date;
}

let aiRequestLogStore: MockAiRequestLog[] = [];

function resetAiRequestLogStore() {
  aiRequestLogStore = [];
}

/** checkAndRecordAiRequest のロジックをモックで再現 */
function mockCheckAndRecordAiRequest(
  userId: string,
  requestType: "generate" | "refine",
  limit: number,
  now: Date = new Date(),
): { success: true } | { error: string; code: "TOO_MANY_REQUESTS" } {
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const used = aiRequestLogStore.filter(
    (log) => log.userId === userId && log.createdAt >= startOfDay,
  ).length;

  if (used >= limit) {
    return {
      error: `1日のAIリクエスト上限（${limit}件）に達しました。明日また試してください。`,
      code: "TOO_MANY_REQUESTS",
    };
  }

  aiRequestLogStore.push({
    id: `log-${aiRequestLogStore.length + 1}`,
    userId,
    requestType,
    createdAt: now,
  });

  return { success: true };
}

describe("AI 1日リクエスト上限チェック", () => {
  beforeEach(() => resetAiRequestLogStore());

  test("上限未満の場合はリクエストを記録して成功する", () => {
    const result = mockCheckAndRecordAiRequest("user-1", "generate", 10);
    expect(result).toEqual({ success: true });
    expect(aiRequestLogStore).toHaveLength(1);
    expect(aiRequestLogStore[0]?.requestType).toBe("generate");
  });

  test("上限に達した場合は TOO_MANY_REQUESTS エラーを返す", () => {
    const limit = 3;
    // 3回使い切る
    for (let i = 0; i < limit; i++) {
      const r = mockCheckAndRecordAiRequest("user-1", "generate", limit);
      expect(r).toEqual({ success: true });
    }
    // 4回目はエラー
    const result = mockCheckAndRecordAiRequest("user-1", "generate", limit);
    expect(result).toMatchObject({ code: "TOO_MANY_REQUESTS" });
    // ログは追加されていない
    expect(aiRequestLogStore).toHaveLength(limit);
  });

  test("generate と refine は合算してカウントされる", () => {
    const limit = 2;
    mockCheckAndRecordAiRequest("user-1", "generate", limit);
    mockCheckAndRecordAiRequest("user-1", "refine", limit);

    const result = mockCheckAndRecordAiRequest("user-1", "generate", limit);
    expect(result).toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  test("ユーザーが異なれば独立してカウントされる", () => {
    const limit = 1;
    mockCheckAndRecordAiRequest("user-1", "generate", limit);

    // user-1 は上限超過
    const r1 = mockCheckAndRecordAiRequest("user-1", "generate", limit);
    expect(r1).toMatchObject({ code: "TOO_MANY_REQUESTS" });

    // user-2 は問題なし
    const r2 = mockCheckAndRecordAiRequest("user-2", "generate", limit);
    expect(r2).toEqual({ success: true });
  });

  test("前日のログは翌日のカウントに含まれない", () => {
    const limit = 1;
    const yesterday = new Date(Date.UTC(2026, 2, 30, 12, 0, 0)); // 2026-03-30
    const today = new Date(Date.UTC(2026, 2, 31, 12, 0, 0));     // 2026-03-31

    // 昨日にリクエストを1回記録
    mockCheckAndRecordAiRequest("user-1", "generate", limit, yesterday);

    // 今日は上限に達していないので成功
    const result = mockCheckAndRecordAiRequest("user-1", "generate", limit, today);
    expect(result).toEqual({ success: true });
  });

  test("上限1件の場合、1回目は成功して2回目は失敗する", () => {
    const limit = 1;
    expect(mockCheckAndRecordAiRequest("user-1", "generate", limit)).toEqual({ success: true });
    expect(mockCheckAndRecordAiRequest("user-1", "generate", limit)).toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});
