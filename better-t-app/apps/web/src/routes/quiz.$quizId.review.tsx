import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/quiz/$quizId/review")({
  component: ReviewPage,
});

// ──── Types ───────────────────────────────────────────────────────────────────

interface ChoiceEdit {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface EditState {
  sentence: string;
  explanation: string;
  choices: ChoiceEdit[];
}

interface UndoData {
  sentence: string;
  answer: string;
  explanation: string;
  choices: ChoiceEdit[];
}

// ──── Main Component ──────────────────────────────────────────────────────────

function ReviewPage() {
  const { quizId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [aiId, setAiId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [undoMap, setUndoMap] = useState<Record<string, UndoData>>({});

  const reviewQuery = useQuery(
    orpc.quiz.review.queryOptions({ input: { quizId } }),
  );

  const updateMutation = useMutation({
    ...orpc.quiz.updateQuestion.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.quiz.review.queryOptions({ input: { quizId } }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.quiz.get.queryOptions({ input: { quizId } }).queryKey,
      });
      setEditingId(null);
      setEditState(null);
      toast.success("問題を更新しました");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const undoMutation = useMutation({
    ...orpc.quiz.updateQuestion.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: orpc.quiz.review.queryOptions({ input: { quizId } }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.quiz.get.queryOptions({ input: { quizId } }).queryKey,
      });
      setUndoMap((prev) => {
        const next = { ...prev };
        delete next[variables.questionId];
        return next;
      });
      toast.success("元の問題に戻しました");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const aiMutation = useMutation({
    ...orpc.quiz.aiRefineQuestion.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.quiz.review.queryOptions({ input: { quizId } }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.quiz.get.queryOptions({ input: { quizId } }).queryKey,
      });
      setAiId(null);
      setAiPrompt("");
      toast.success("AIによる問題の修正が完了しました");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openEdit(question: {
    id: string;
    sentence: string;
    explanation: string;
    choices: { id: string; text: string; isCorrect: boolean; orderIndex: number }[];
  }) {
    setEditingId(question.id);
    setEditState({
      sentence: question.sentence,
      explanation: question.explanation,
      choices: question.choices.map((c) => ({
        id: c.id,
        text: c.text,
        isCorrect: c.isCorrect,
      })),
    });
    setAiId(null);
    setAiPrompt("");
  }

  function openAiRefine(questionId: string) {
    setAiId(questionId);
    setAiPrompt("");
    setEditingId(null);
    setEditState(null);
  }

  function handleSaveEdit(questionId: string) {
    if (!editState) return;
    const correctChoice = editState.choices.find((c) => c.isCorrect);
    if (!correctChoice) {
      toast.error("正解の選択肢を選んでください");
      return;
    }
    if (!editState.sentence.includes("___")) {
      toast.error('問題文に「___」を含めてください');
      return;
    }
    updateMutation.mutate({
      questionId,
      sentence: editState.sentence,
      answer: correctChoice.text,
      explanation: editState.explanation,
      choices: editState.choices,
    });
  }

  function handleAiRefine(questionId: string) {
    if (!aiPrompt.trim()) {
      toast.error("修正指示を入力してください");
      return;
    }
    // 修正前の問題データを保存しておく
    const currentQuestion = reviewQuery.data?.questions.find((q) => q.id === questionId);
    if (!currentQuestion) return;
    const snapshot: UndoData = {
      sentence: currentQuestion.sentence,
      answer: currentQuestion.answer,
      explanation: currentQuestion.explanation,
      choices: currentQuestion.choices.map((c) => ({
        id: c.id,
        text: c.text,
        isCorrect: c.isCorrect,
      })),
    };
    aiMutation.mutate(
      { questionId, prompt: aiPrompt },
      {
        onSuccess: () => {
          // AI修正成功後にスナップショットを undoMap に登録
          setUndoMap((prev) => ({ ...prev, [questionId]: snapshot }));
        },
      },
    );
  }

  function handleUndo(questionId: string) {
    const undoData = undoMap[questionId];
    if (!undoData) return;
    undoMutation.mutate({
      questionId,
      sentence: undoData.sentence,
      answer: undoData.answer,
      explanation: undoData.explanation,
      choices: undoData.choices,
    });
  }

  function updateChoice(index: number, field: keyof ChoiceEdit, value: string | boolean) {
    if (!editState) return;
    setEditState((prev) => {
      if (!prev) return prev;
      const newChoices = prev.choices.map((c, i) => {
        if (field === "isCorrect") {
          return { ...c, isCorrect: i === index };
        }
        if (i === index) return { ...c, [field]: value };
        return c;
      });
      return { ...prev, choices: newChoices };
    });
  }

  const quiz = reviewQuery.data;

  if (reviewQuery.isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0a0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              width: 40,
              height: 40,
              border: "3px solid rgba(200,255,0,0.2)",
              borderTopColor: "#c8ff00",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              marginBottom: 16,
            }}
          />
          <p style={{ color: "#6b6b80", fontSize: "0.9rem" }}>読み込み中...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (reviewQuery.isError || !quiz) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0a0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#ff4d6d", marginBottom: 16 }}>
            クイズの読み込みに失敗しました
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            style={{
              background: "#1a1a26",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#f0f0f5",
              padding: "10px 24px",
              cursor: "pointer",
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
          >
            ダッシュボードへ戻る
          </button>
        </div>
      </div>
    );
  }

  const difficultyLabel =
    quiz.difficulty === "easy"
      ? "初級"
      : quiz.difficulty === "medium"
        ? "中級"
        : "上級";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#f0f0f5",
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      {/* ヘッダーナビ */}
      <nav
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(10,10,15,0.9)",
          backdropFilter: "blur(16px)",
          padding: "16px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            fontFamily: "Syne, sans-serif",
            fontWeight: 800,
            fontSize: "1.2rem",
            letterSpacing: "-0.02em",
            cursor: "pointer",
          }}
          onClick={() => navigate({ to: "/dashboard" })}
        >
          web<span style={{ color: "#c8ff00" }}>quizize</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
            maxWidth: 320,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontSize: "0.85rem",
              color: "#6b6b80",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {quiz.sourceTitle ?? quiz.sourceUrl}
          </span>
          <a
            href={quiz.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.72rem",
              color: "#00e5ff",
              opacity: 0.7,
              textDecoration: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            🔗 {quiz.sourceUrl}
          </a>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 24px",
        }}
      >
        {/* タイトル行 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 32,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "Syne, sans-serif",
                fontWeight: 800,
                fontSize: "1.5rem",
                letterSpacing: "-0.02em",
                marginBottom: 4,
              }}
            >
              問題一覧
            </h1>
            <p style={{ fontSize: "0.82rem", color: "#6b6b80", margin: 0 }}>
              {quiz.questions.length}問・{difficultyLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              navigate({ to: "/quiz/$quizId", params: { quizId } })
            }
            style={{
              background: "#c8ff00",
              border: "none",
              color: "#0a0a0f",
              padding: "10px 24px",
              cursor: "pointer",
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "0.85rem",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            挑戦する →
          </button>
        </div>

        {/* 問題カード一覧 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {quiz.questions.map((question, index) => {
            const isEditing = editingId === question.id;
            const isAiMode = aiId === question.id;

            return (
              <div
                key={question.id}
                style={{
                  background: "#111118",
                  border: `1px solid ${isEditing || isAiMode ? "rgba(200,255,0,0.25)" : "rgba(255,255,255,0.07)"}`,
                  overflow: "hidden",
                  transition: "border-color 0.2s",
                }}
              >
                {/* 問題ヘッダー */}
                <div
                  style={{
                    background: "rgba(200,255,0,0.04)",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    padding: "12px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "Syne, sans-serif",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      color: "#c8ff00",
                      letterSpacing: "0.1em",
                    }}
                  >
                    問 {index + 1}
                  </span>

                  {/* 編集ボタン群 */}
                  <div style={{ display: "flex", gap: 8 }}>
                    {isEditing || isAiMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditState(null);
                          setAiId(null);
                          setAiPrompt("");
                        }}
                        disabled={updateMutation.isPending || aiMutation.isPending}
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#6b6b80",
                          padding: "5px 14px",
                          cursor: "pointer",
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          letterSpacing: "0.04em",
                        }}
                      >
                        キャンセル
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(question)}
                          style={{
                            background: "rgba(200,255,0,0.08)",
                            border: "1px solid rgba(200,255,0,0.25)",
                            color: "#c8ff00",
                            padding: "5px 14px",
                            cursor: "pointer",
                            fontFamily: "Syne, sans-serif",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            letterSpacing: "0.04em",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          ✏️ 手動編集
                        </button>
                        <button
                          type="button"
                          onClick={() => openAiRefine(question.id)}
                          style={{
                            background: "rgba(0,229,255,0.08)",
                            border: "1px solid rgba(0,229,255,0.25)",
                            color: "#00e5ff",
                            padding: "5px 14px",
                            cursor: "pointer",
                            fontFamily: "Syne, sans-serif",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            letterSpacing: "0.04em",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          🤖 AI修正
                        </button>
                        {/* AI修正後の元に戻すボタン */}
                        {undoMap[question.id] && (
                          <button
                            type="button"
                            onClick={() => handleUndo(question.id)}
                            disabled={undoMutation.isPending}
                            style={{
                              background: "rgba(255,180,0,0.08)",
                              border: "1px solid rgba(255,180,0,0.3)",
                              color: undoMutation.isPending ? "rgba(255,180,0,0.4)" : "#ffb400",
                              padding: "5px 14px",
                              cursor: undoMutation.isPending ? "not-allowed" : "pointer",
                              fontFamily: "Syne, sans-serif",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              letterSpacing: "0.04em",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            {undoMutation.isPending && undoMutation.variables?.questionId === question.id ? (
                              <>
                                <span
                                  style={{
                                    display: "inline-block",
                                    width: 11,
                                    height: 11,
                                    border: "2px solid rgba(255,180,0,0.2)",
                                    borderTopColor: "#ffb400",
                                    borderRadius: "50%",
                                    animation: "spin 1s linear infinite",
                                  }}
                                />
                                戻し中...
                              </>
                            ) : (
                              "↩ AI修正を元に戻す"
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* ─── 手動編集フォーム ─── */}
                {isEditing && editState && (
                  <div style={{ padding: "24px" }}>
                    {/* 問題文 */}
                    <div style={{ marginBottom: 20 }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 700,
                          color: "#6b6b80",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        問題文
                        <span
                          style={{
                            marginLeft: 8,
                            color: "#4a4a5a",
                            fontWeight: 400,
                            textTransform: "none",
                            letterSpacing: 0,
                            fontSize: "0.7rem",
                          }}
                        >
                          「___」で空欄を表します
                        </span>
                      </label>
                      <textarea
                        value={editState.sentence}
                        onChange={(e) =>
                          setEditState((prev) =>
                            prev ? { ...prev, sentence: e.target.value } : prev,
                          )
                        }
                        rows={3}
                        style={{
                          width: "100%",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#f0f0f5",
                          padding: "12px 14px",
                          fontFamily: "'Noto Sans JP', sans-serif",
                          fontSize: "0.9rem",
                          lineHeight: 1.7,
                          resize: "vertical",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "rgba(200,255,0,0.4)";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "rgba(255,255,255,0.1)";
                        }}
                      />
                    </div>

                    {/* 選択肢 */}
                    <div style={{ marginBottom: 20 }}>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 700,
                          color: "#6b6b80",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          marginBottom: 10,
                        }}
                      >
                        選択肢
                        <span
                          style={{
                            marginLeft: 8,
                            color: "#4a4a5a",
                            fontWeight: 400,
                            textTransform: "none",
                            letterSpacing: 0,
                            fontSize: "0.7rem",
                          }}
                        >
                          ラジオボタンで正解を選択
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {editState.choices.map((choice, ci) => (
                          <div
                            key={choice.id}
                            style={{ display: "flex", alignItems: "center", gap: 10 }}
                          >
                            <input
                              type="radio"
                              name={`correct-${question.id}`}
                              checked={choice.isCorrect}
                              onChange={() => updateChoice(ci, "isCorrect", true)}
                              style={{
                                accentColor: "#c8ff00",
                                width: 16,
                                height: 16,
                                flexShrink: 0,
                              }}
                            />
                            <input
                              type="text"
                              value={choice.text}
                              onChange={(e) => updateChoice(ci, "text", e.target.value)}
                              style={{
                                flex: 1,
                                background: choice.isCorrect
                                  ? "rgba(200,255,0,0.05)"
                                  : "rgba(255,255,255,0.03)",
                                border: `1px solid ${choice.isCorrect ? "rgba(200,255,0,0.35)" : "rgba(255,255,255,0.1)"}`,
                                color: choice.isCorrect ? "#c8ff00" : "#f0f0f5",
                                padding: "9px 12px",
                                fontFamily: "'Noto Sans JP', sans-serif",
                                fontSize: "0.88rem",
                                outline: "none",
                              }}
                              onFocus={(e) => {
                                e.target.style.borderColor = choice.isCorrect
                                  ? "rgba(200,255,0,0.6)"
                                  : "rgba(255,255,255,0.25)";
                              }}
                              onBlur={(e) => {
                                e.target.style.borderColor = choice.isCorrect
                                  ? "rgba(200,255,0,0.35)"
                                  : "rgba(255,255,255,0.1)";
                              }}
                            />
                            {choice.isCorrect && (
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  color: "#c8ff00",
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                ✓ 正解
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 解説 */}
                    <div style={{ marginBottom: 24 }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 700,
                          color: "#6b6b80",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        解説
                      </label>
                      <textarea
                        value={editState.explanation}
                        onChange={(e) =>
                          setEditState((prev) =>
                            prev ? { ...prev, explanation: e.target.value } : prev,
                          )
                        }
                        rows={3}
                        style={{
                          width: "100%",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#f0f0f5",
                          padding: "12px 14px",
                          fontFamily: "'Noto Sans JP', sans-serif",
                          fontSize: "0.88rem",
                          lineHeight: 1.7,
                          resize: "vertical",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "rgba(200,255,0,0.4)";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "rgba(255,255,255,0.1)";
                        }}
                      />
                    </div>

                    {/* 保存 / キャンセル */}
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(question.id)}
                        disabled={updateMutation.isPending}
                        style={{
                          background: updateMutation.isPending
                            ? "rgba(200,255,0,0.4)"
                            : "#c8ff00",
                          border: "none",
                          color: "#0a0a0f",
                          padding: "10px 28px",
                          cursor: updateMutation.isPending ? "not-allowed" : "pointer",
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 800,
                          fontSize: "0.85rem",
                          letterSpacing: "0.05em",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {updateMutation.isPending ? (
                          <>
                            <span
                              style={{
                                display: "inline-block",
                                width: 14,
                                height: 14,
                                border: "2px solid rgba(10,10,15,0.3)",
                                borderTopColor: "#0a0a0f",
                                borderRadius: "50%",
                                animation: "spin 1s linear infinite",
                              }}
                            />
                            保存中...
                          </>
                        ) : (
                          "保存する"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditState(null);
                        }}
                        disabled={updateMutation.isPending}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#6b6b80",
                          padding: "10px 20px",
                          cursor: "pointer",
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                        }}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── AI修正パネル ─── */}
                {isAiMode && (
                  <div style={{ padding: "24px" }}>
                    <div
                      style={{
                        background: "rgba(0,229,255,0.04)",
                        border: "1px solid rgba(0,229,255,0.15)",
                        padding: "12px 16px",
                        marginBottom: 16,
                        fontSize: "0.82rem",
                        color: "#a0a0b5",
                        lineHeight: 1.7,
                      }}
                    >
                      <span style={{ color: "#00e5ff", fontWeight: 700 }}>🤖 AI修正</span>
                      　修正指示を入力すると、AIが問題文・選択肢・解説を自動で書き直します。
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 700,
                          color: "#6b6b80",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        修正指示
                      </label>
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="例: 難易度を上げてください / 選択肢をもっとわかりやすくしてください / 違う観点の問題にしてください"
                        rows={4}
                        maxLength={500}
                        style={{
                          width: "100%",
                          background: "rgba(0,229,255,0.03)",
                          border: "1px solid rgba(0,229,255,0.2)",
                          color: "#f0f0f5",
                          padding: "12px 14px",
                          fontFamily: "'Noto Sans JP', sans-serif",
                          fontSize: "0.88rem",
                          lineHeight: 1.7,
                          resize: "vertical",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "rgba(0,229,255,0.5)";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "rgba(0,229,255,0.2)";
                        }}
                      />
                      <div
                        style={{
                          textAlign: "right",
                          fontSize: "0.72rem",
                          color: "#4a4a5a",
                          marginTop: 4,
                        }}
                      >
                        {aiPrompt.length} / 500
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => handleAiRefine(question.id)}
                        disabled={aiMutation.isPending}
                        style={{
                          background: aiMutation.isPending
                            ? "rgba(0,229,255,0.3)"
                            : "rgba(0,229,255,0.15)",
                          border: "1px solid rgba(0,229,255,0.4)",
                          color: aiMutation.isPending
                            ? "rgba(0,229,255,0.6)"
                            : "#00e5ff",
                          padding: "10px 28px",
                          cursor: aiMutation.isPending ? "not-allowed" : "pointer",
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 800,
                          fontSize: "0.85rem",
                          letterSpacing: "0.05em",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {aiMutation.isPending ? (
                          <>
                            <span
                              style={{
                                display: "inline-block",
                                width: 14,
                                height: 14,
                                border: "2px solid rgba(0,229,255,0.2)",
                                borderTopColor: "#00e5ff",
                                borderRadius: "50%",
                                animation: "spin 1s linear infinite",
                              }}
                            />
                            AI修正中...
                          </>
                        ) : (
                          "🤖 AI修正を実行"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAiId(null);
                          setAiPrompt("");
                        }}
                        disabled={aiMutation.isPending}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#6b6b80",
                          padding: "10px 20px",
                          cursor: "pointer",
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                        }}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── 通常表示（閲覧モード） ─── */}
                {!isEditing && !isAiMode && (
                  <>
                    {/* 問題文（正答を埋め込んで表示） */}
                    <div
                      style={{
                        padding: "24px",
                        lineHeight: 1.9,
                        fontSize: "1rem",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      {question.sentence.split("___").map((part, i, arr) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: static rendering
                        <span key={i}>
                          {part}
                          {i < arr.length - 1 && (
                            <span
                              style={{
                                display: "inline-block",
                                minWidth: 80,
                                borderBottom: "2px solid #c8ff00",
                                marginInline: 4,
                                verticalAlign: "bottom",
                                color: "#c8ff00",
                                fontWeight: 700,
                                textAlign: "center",
                                padding: "0 4px",
                              }}
                            >
                              {question.answer}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* 選択肢 */}
                    <div
                      style={{
                        padding: "16px 24px",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      {question.choices.map((choice) => (
                        <div
                          key={choice.id}
                          style={{
                            background: choice.isCorrect
                              ? "rgba(200,255,0,0.06)"
                              : "rgba(255,255,255,0.02)",
                            border: `1px solid ${choice.isCorrect ? "rgba(200,255,0,0.4)" : "rgba(255,255,255,0.06)"}`,
                            color: choice.isCorrect ? "#c8ff00" : "#4a4a5a",
                            padding: "12px 16px",
                            fontSize: "0.9rem",
                            lineHeight: 1.6,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {choice.isCorrect && (
                            <span
                              style={{
                                flexShrink: 0,
                                fontSize: "0.75rem",
                                fontWeight: 700,
                              }}
                            >
                              ✓
                            </span>
                          )}
                          <span>{choice.text}</span>
                        </div>
                      ))}
                    </div>

                    {/* 解説 */}
                    {question.explanation && (
                      <div
                        style={{
                          padding: "16px 24px",
                          background: "rgba(255,255,255,0.01)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.72rem",
                            fontFamily: "Syne, sans-serif",
                            fontWeight: 700,
                            color: "#6b6b80",
                            letterSpacing: "0.08em",
                            marginBottom: 6,
                            textTransform: "uppercase",
                          }}
                        >
                          解説
                        </div>
                        <p
                          style={{
                            color: "#a0a0b5",
                            fontSize: "0.87rem",
                            lineHeight: 1.8,
                            margin: 0,
                          }}
                        >
                          {question.explanation}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 下部ボタン */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#6b6b80",
              padding: "10px 24px",
              cursor: "pointer",
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
          >
            ← ダッシュボードへ
          </button>
          <button
            type="button"
            onClick={() =>
              navigate({ to: "/quiz/$quizId", params: { quizId } })
            }
            style={{
              background: "#c8ff00",
              border: "none",
              color: "#0a0a0f",
              padding: "10px 28px",
              cursor: "pointer",
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "0.85rem",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            挑戦する →
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
