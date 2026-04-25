import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { z } from "zod";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/quiz/generating")({
  component: GeneratingPage,
  validateSearch: z.object({
    url: z.string().url(),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    questionCount: z.coerce.number().int().min(1).max(10).default(5),
    autoQuestionCount: z.coerce.boolean().default(false),
    language: z.enum(["ja", "en", "zh", "ko"]).default("ja"),
    appendToQuizId: z.string().optional(),
  }),
});

function GeneratingPage() {
  const navigate = useNavigate();
  const { url, difficulty, questionCount, autoQuestionCount, language, appendToQuizId } = Route.useSearch();
  const called = useRef(false);

  const generateMutation = useMutation({
    ...orpc.quiz.generate.mutationOptions(),
    onSuccess: (data) => {
      navigate({ to: "/quiz/$quizId", params: { quizId: data.quizId } });
    },
    onError: (err) => {
      console.error(err);
    },
  });

  useEffect(() => {
    if (!called.current) {
      called.current = true;
      generateMutation.mutate({ url, difficulty, questionCount, autoQuestionCount, language, appendToQuizId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 480, padding: "0 24px" }}>
        {generateMutation.isError ? (
          <>
            <div style={{ fontSize: "2rem", marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.3rem", color: "#ff4d6d", marginBottom: 12 }}>
              生成に失敗しました
            </h2>
            <p style={{ color: "#6b6b80", marginBottom: 28, fontSize: "0.9rem", lineHeight: 1.8 }}>
              {(generateMutation.error as Error)?.message ?? "エラーが発生しました"}
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/dashboard" })}
              style={{ background: "#1a1a26", border: "1px solid rgba(255,255,255,0.07)", color: "#f0f0f5", padding: "12px 28px", cursor: "pointer", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.05em" }}
            >
              ← ダッシュボードへ戻る
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "inline-block", width: 48, height: 48, border: "3px solid rgba(200,255,0,0.2)", borderTopColor: "#c8ff00", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            </div>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "1.4rem", marginBottom: 12, letterSpacing: "-0.02em" }}>
              クイズを生成中...
            </h2>
            <p style={{ color: "#6b6b80", marginBottom: 24, fontSize: "0.9rem", lineHeight: 1.8 }}>
              AIがページを解析しています<br />
              <span style={{ fontSize: "0.8rem" }}>{url}</span>
            </p>
            <div style={{ maxWidth: 320, margin: "0 auto 32px", height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#c8ff00", width: "60%", animation: "progress-pulse 2s ease-in-out infinite" }} />
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/dashboard" })}
              style={{ background: "transparent", border: "none", color: "#6b6b80", cursor: "pointer", fontSize: "0.85rem" }}
            >
              キャンセル
            </button>
          </>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes progress-pulse {
          0%, 100% { width: 40%; opacity: 0.7; }
          50% { width: 80%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
