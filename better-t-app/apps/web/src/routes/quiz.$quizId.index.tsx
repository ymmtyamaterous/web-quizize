import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/quiz/$quizId/")({
  component: QuizPage,
});

interface FeedbackState {
  isCorrect: boolean;
  correctChoiceId: string;
  explanation: string | null;
  correctAnswer: string;
}

function QuizPage() {
  const { quizId } = Route.useParams();
  const navigate = useNavigate();
  const startCalled = useRef(false);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [answering, setAnswering] = useState(false);

  const quizQuery = useQuery(orpc.quiz.get.queryOptions({ input: { quizId } }));

  const startMutation = useMutation({
    ...orpc.quizAttempt.start.mutationOptions(),
    onSuccess: (data) => {
      setAttemptId(data.attemptId);
    },
  });

  const answerMutation = useMutation({
    ...orpc.quizAttempt.answer.mutationOptions(),
    onSuccess: (data) => {
      setFeedback({
        isCorrect: data.isCorrect,
        correctChoiceId: data.correctChoiceId,
        explanation: data.explanation ?? null,
        correctAnswer: data.correctAnswer,
      });
      setAnswering(false);
    },
    onError: () => setAnswering(false),
  });

  const completeMutation = useMutation({
    ...orpc.quizAttempt.complete.mutationOptions(),
    onSuccess: (data) => {
      if (!attemptId) return;
      sessionStorage.setItem(
        `quiz-result-${quizId}-${attemptId}`,
        JSON.stringify(data),
      );
      navigate({
        to: "/quiz/$quizId/result",
        params: { quizId },
        search: { attemptId },
      });
    },
  });

  useEffect(() => {
    if (!startCalled.current) {
      startCalled.current = true;
      startMutation.mutate({ quizId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quiz = quizQuery.data;
  const questions = quiz?.questions ?? [];
  const currentQuestion = questions[currentIndex];

  const handleSelectChoice = (choiceId: string) => {
    if (!attemptId || !currentQuestion || feedback || answering) return;
    setAnswering(true);
    answerMutation.mutate({
      attemptId,
      questionId: currentQuestion.id,
      selectedChoiceId: choiceId,
    });
  };

  const handleNext = () => {
    if (!attemptId) return;
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setFeedback(null);
    } else {
      completeMutation.mutate({ attemptId });
    }
  };

  if (quizQuery.isLoading || startMutation.isPending) {
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

  if (quizQuery.isError || !quiz) {
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

  if (!currentQuestion) {
    return null;
  }

  const progress = ((currentIndex + 1) / questions.length) * 100;

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
        <div style={{ fontSize: "0.85rem", color: "#6b6b80" }}>
          {quiz.sourceTitle ?? quiz.sourceUrl}
        </div>
      </nav>

      {/* プログレスバー */}
      <div
        style={{
          height: 3,
          background: "rgba(255,255,255,0.07)",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "#c8ff00",
            width: `${progress}%`,
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {/* メインコンテンツ */}
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "48px 24px",
        }}
      >
        {/* 問題番号 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: "0.85rem",
              color: "#c8ff00",
              letterSpacing: "0.1em",
            }}
          >
            問 {currentIndex + 1} / {questions.length}
          </span>
          <span
            style={{
              fontSize: "0.8rem",
              color: "#6b6b80",
              background: "rgba(255,255,255,0.04)",
              padding: "4px 12px",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {quiz.difficulty === "easy"
              ? "初級"
              : quiz.difficulty === "medium"
                ? "中級"
                : "上級"}
          </span>
        </div>

        {/* 問題文 */}
        <div
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "32px",
            marginBottom: 32,
            lineHeight: 1.9,
            fontSize: "1.05rem",
          }}
        >
          {currentQuestion.sentence.split("___").map((part, i, arr) => (
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
                    color: feedback ? "#c8ff00" : "transparent",
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {feedback ? feedback.correctAnswer : "\u00a0\u00a0\u00a0\u00a0"}
                </span>
              )}
            </span>
          ))}
        </div>

        {/* 選択肢グリッド */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {currentQuestion.choices.map((choice) => {
            let borderColor = "rgba(255,255,255,0.07)";
            let bgColor = "#111118";
            let labelColor = "#f0f0f5";
            let subColor = "rgba(200,255,0,0.1)";

            if (feedback) {
              if (choice.id === feedback.correctChoiceId) {
                borderColor = "#c8ff00";
                bgColor = "rgba(200,255,0,0.06)";
                labelColor = "#c8ff00";
                subColor = "rgba(200,255,0,0.1)";
              } else if (
                answerMutation.variables?.selectedChoiceId === choice.id &&
                !feedback.isCorrect
              ) {
                borderColor = "#ff4d6d";
                bgColor = "rgba(255,77,109,0.06)";
                labelColor = "#ff4d6d";
                subColor = "rgba(255,77,109,0.1)";
              } else {
                labelColor = "#3d3d4d";
              }
            }

            return (
              <button
                key={choice.id}
                type="button"
                disabled={!!feedback || answering}
                onClick={() => handleSelectChoice(choice.id)}
                style={{
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                  color: labelColor,
                  padding: "16px 20px",
                  cursor: feedback ? "default" : "pointer",
                  textAlign: "left",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  fontSize: "0.95rem",
                  lineHeight: 1.6,
                  transition: "all 0.2s ease",
                  outline: "none",
                }}
              >
                {choice.text}
              </button>
            );
          })}
        </div>

        {/* フィードバック */}
        {feedback && (
          <div
            style={{
              background: feedback.isCorrect
                ? "rgba(200,255,0,0.06)"
                : "rgba(255,77,109,0.06)",
              border: `1px solid ${feedback.isCorrect ? "rgba(200,255,0,0.3)" : "rgba(255,77,109,0.3)"}`,
              padding: "20px 24px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontFamily: "Syne, sans-serif",
                fontWeight: 700,
                fontSize: "1rem",
                color: feedback.isCorrect ? "#c8ff00" : "#ff4d6d",
                marginBottom: 8,
              }}
            >
              {feedback.isCorrect ? "✓ 正解！" : "✗ 不正解"}
            </div>
            {feedback.explanation && (
              <p
                style={{
                  color: "#a0a0b5",
                  fontSize: "0.88rem",
                  lineHeight: 1.8,
                  margin: 0,
                }}
              >
                {feedback.explanation}
              </p>
            )}
          </div>
        )}

        {/* 次へボタン */}
        {feedback && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleNext}
              disabled={completeMutation.isPending}
              style={{
                background: "#c8ff00",
                border: "none",
                color: "#0a0a0f",
                padding: "14px 36px",
                cursor: "pointer",
                fontFamily: "Syne, sans-serif",
                fontWeight: 800,
                fontSize: "0.95rem",
                letterSpacing: "0.05em",
                opacity: completeMutation.isPending ? 0.6 : 1,
              }}
            >
              {completeMutation.isPending
                ? "集計中..."
                : currentIndex < questions.length - 1
                  ? "次の問題 →"
                  : "結果を見る →"}
            </button>
          </div>
        )}

        {completeMutation.isError && (
          <p
            style={{
              color: "#ff4d6d",
              fontSize: "0.85rem",
              textAlign: "center",
              marginTop: 12,
            }}
          >
            結果の集計に失敗しました。もう一度お試しください。
          </p>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
