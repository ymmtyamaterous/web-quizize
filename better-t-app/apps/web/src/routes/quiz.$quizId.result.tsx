import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";

export const Route = createFileRoute("/quiz/$quizId/result")({
  component: ResultPage,
  validateSearch: z.object({
    attemptId: z.string(),
  }),
});

interface AnswerReview {
  questionId: string;
  sentence: string;
  selectedChoiceId: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string | null;
  correctChoiceId: string;
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  accuracy: number;
  timeTakenSeconds: number;
  answers: AnswerReview[];
}

function ResultPage() {
  const { quizId } = Route.useParams();
  const { attemptId } = Route.useSearch();
  const navigate = useNavigate();

  const result = useMemo<QuizResult | null>(() => {
    const raw = sessionStorage.getItem(`quiz-result-${quizId}-${attemptId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as QuizResult;
    } catch {
      return null;
    }
  }, [quizId, attemptId]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}時間${m}分${s}秒`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
  };

  if (!result) {
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
            結果データが見つかりません
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

  const rankInfo = (() => {
    if (result.accuracy >= 90) return { label: "🏆 Excellent!", color: "#c8ff00" };
    if (result.accuracy >= 70) return { label: "✨ Great!", color: "#00e5ff" };
    if (result.accuracy >= 50) return { label: "📚 Good!", color: "#a78bfa" };
    return { label: "💪 Keep Going!", color: "#ff4d6d" };
  })();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#f0f0f5",
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      <style>{`
        .result-nav { padding: 16px 48px; }
        .result-actions { display: flex; gap: 12px; justify-content: center; margin-bottom: 48px; }
        @media (max-width: 768px) {
          .result-nav { padding: 12px 16px !important; }
          .result-actions { flex-direction: column !important; align-items: center; }
          .result-actions button { width: 100%; max-width: 320px; }
        }
      `}</style>
      {/* ヘッダーナビ */}
      <nav
        className="result-nav"
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
        <span
          style={{ fontSize: "0.85rem", color: "#6b6b80" }}
        >
          クイズ結果
        </span>
      </nav>

      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 24px",
        }}
      >
        {/* スコアカード */}
        <div
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "48px 40px",
            textAlign: "center",
            marginBottom: 48,
          }}
        >
          <div
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "1rem",
              color: rankInfo.color,
              letterSpacing: "0.1em",
              marginBottom: 16,
            }}
          >
            {rankInfo.label}
          </div>

          <div
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "4rem",
              letterSpacing: "-0.04em",
              lineHeight: 1,
              marginBottom: 8,
            }}
          >
            <span style={{ color: "#c8ff00" }}>{result.score}</span>
            <span style={{ color: "#3d3d4d", fontSize: "2rem" }}>
              {" "}
              / {result.totalQuestions}
            </span>
          </div>
          <p
            style={{
              color: "#6b6b80",
              fontSize: "0.88rem",
              marginBottom: 32,
            }}
          >
            問正解
          </p>

          {/* 統計グリッド */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 1,
              background: "rgba(255,255,255,0.05)",
            }}
          >
            {[
              { label: "正解率", value: `${result.accuracy}%` },
              {
                label: "解答時間",
                value: formatTime(result.timeTakenSeconds),
              },
              { label: "全問数", value: `${result.totalQuestions}問` },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "#111118",
                  padding: "20px 16px",
                }}
              >
                <div
                  style={{
                    fontSize: "1.3rem",
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#6b6b80" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* アクションボタン */}
        <div
          className="result-actions"
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            marginBottom: 48,
          }}
        >
          <button
            type="button"
            onClick={() =>
              navigate({ to: "/quiz/$quizId", params: { quizId } })
            }
            style={{
              background: "#c8ff00",
              border: "none",
              color: "#0a0a0f",
              padding: "14px 32px",
              cursor: "pointer",
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "0.9rem",
              letterSpacing: "0.05em",
            }}
          >
            もう一度挑戦
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#f0f0f5",
              padding: "14px 32px",
              cursor: "pointer",
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: "0.9rem",
              letterSpacing: "0.05em",
            }}
          >
            ダッシュボードへ
          </button>
        </div>

        {/* 回答レビュー */}
        <div>
          <h2
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "1rem",
              letterSpacing: "0.08em",
              color: "#6b6b80",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            回答レビュー
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {result.answers.map((answer, idx) => (
              <div
                key={answer.questionId}
                style={{
                  background: "#111118",
                  border: `1px solid ${answer.isCorrect ? "rgba(200,255,0,0.15)" : "rgba(255,77,109,0.15)"}`,
                  padding: "20px 24px",
                }}
              >
                {/* 問番号 + 正誤 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "Syne, sans-serif",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      color: "#6b6b80",
                    }}
                  >
                    問{idx + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: "Syne, sans-serif",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      color: answer.isCorrect ? "#c8ff00" : "#ff4d6d",
                    }}
                  >
                    {answer.isCorrect ? "✓ 正解" : "✗ 不正解"}
                  </span>
                </div>

                {/* 問題文 */}
                <p
                  style={{
                    fontSize: "0.92rem",
                    lineHeight: 1.8,
                    marginBottom: 12,
                    color: "#d0d0e5",
                  }}
                >
                  {answer.sentence.split("___").map((part, i, arr) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static rendering
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span
                          style={{
                            color: answer.isCorrect ? "#c8ff00" : "#ff4d6d",
                            fontWeight: 700,
                            borderBottom: `1px solid ${answer.isCorrect ? "#c8ff00" : "#ff4d6d"}`,
                            paddingInline: 4,
                          }}
                        >
                          {answer.correctAnswer}
                        </span>
                      )}
                    </span>
                  ))}
                </p>

                {/* 解説 */}
                {answer.explanation && (
                  <p
                    style={{
                      fontSize: "0.83rem",
                      color: "#6b6b80",
                      lineHeight: 1.7,
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      paddingTop: 12,
                      margin: 0,
                    }}
                  >
                    💡 {answer.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
