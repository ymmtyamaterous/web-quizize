import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/quiz/$quizId/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const { quizId } = Route.useParams();
  const navigate = useNavigate();

  const reviewQuery = useQuery(
    orpc.quiz.review.queryOptions({ input: { quizId } }),
  );

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
            const correctChoice = question.choices.find((c) => c.isCorrect);
            return (
              <div
                key={question.id}
                style={{
                  background: "#111118",
                  border: "1px solid rgba(255,255,255,0.07)",
                  overflow: "hidden",
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
                </div>

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
