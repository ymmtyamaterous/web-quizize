import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { BookOpen, Clock, Flame, LogOut, Target, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

const DIFFICULTY_LABELS = { easy: "初級", medium: "中級", hard: "上級" } as const;
const DIFFICULTY_COLORS = { easy: "#c8ff00", medium: "#00e5ff", hard: "#ff4d6d" } as const;

function DashboardPage() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [url, setUrl] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const statsQuery = useQuery(orpc.stats.summary.queryOptions());
  const quizListQuery = useQuery(orpc.quiz.list.queryOptions({ input: { page: 1, limit: 20 } }));

  const deleteMutation = useMutation({
    ...orpc.quiz.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.quiz.list.key() });
      queryClient.invalidateQueries({ queryKey: orpc.stats.summary.key() });
      toast.success("クイズを削除しました");
      setDeleteTargetId(null);
    },
    onError: () => toast.error("削除に失敗しました"),
  });

  const handleGenerate = () => {
    if (!url.trim()) {
      toast.error("URLを入力してください");
      return;
    }
    navigate({
      to: "/quiz/generating",
      search: { url, difficulty, questionCount },
    });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}時間${m}分`;
    if (m > 0) return `${m}分`;
    return `${seconds}秒`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0f0f5]" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
      {/* NAV */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)", background: "rgba(10,10,15,0.9)", position: "sticky", top: 0, zIndex: 50, padding: "16px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.02em", cursor: "pointer" }} onClick={() => navigate({ to: "/" })}>
          web<span style={{ color: "#c8ff00" }}>quizize</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: "0.85rem", color: "#6b6b80" }}>{session.data?.user.name}</span>
          <button
            type="button"
            onClick={() => authClient.signOut().then(() => navigate({ to: "/" }))}
            style={{ background: "rgba(255,255,255,0.07)", border: "none", color: "#6b6b80", padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}
          >
            <LogOut size={14} /> ログアウト
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        {/* URL INPUT */}
        <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", padding: "36px 40px", marginBottom: 40 }}>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "1.4rem", marginBottom: 24, letterSpacing: "-0.02em" }}>
            クイズを生成する
          </h2>
          <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder="https://クイズにしたいページのURL…"
              style={{ flex: 1, minWidth: 280, background: "#1a1a26", border: "1px solid rgba(255,255,255,0.07)", color: "#f0f0f5", fontSize: "0.95rem", padding: "14px 18px", outline: "none", fontFamily: "'Noto Sans JP', sans-serif" }}
            />
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
              style={{ background: "#1a1a26", border: "1px solid rgba(255,255,255,0.07)", color: "#f0f0f5", padding: "14px 18px", cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", fontSize: "0.9rem" }}
            >
              <option value="easy">初級</option>
              <option value="medium">中級</option>
              <option value="hard">上級</option>
            </select>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              style={{ background: "#1a1a26", border: "1px solid rgba(255,255,255,0.07)", color: "#f0f0f5", padding: "14px 18px", cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", fontSize: "0.9rem" }}
            >
              {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}問</option>)}
            </select>
            <button
              type="button"
              onClick={handleGenerate}
              style={{ background: "#c8ff00", color: "#0a0a0f", border: "none", padding: "14px 28px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              クイズ生成 →
            </button>
          </div>
        </div>

        {/* STATS */}
        {statsQuery.data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2, marginBottom: 40 }}>
            {[
              { icon: <BookOpen size={18} />, label: "生成クイズ数", value: `${statsQuery.data.totalQuizzesGenerated}件` },
              { icon: <Target size={18} />, label: "挑戦回数", value: `${statsQuery.data.totalAttempts}回` },
              { icon: <Trophy size={18} />, label: "総合正答率", value: `${statsQuery.data.overallAccuracy}%` },
              { icon: <Clock size={18} />, label: "累計学習時間", value: statsQuery.data.totalStudyTimeSeconds > 0 ? formatTime(statsQuery.data.totalStudyTimeSeconds) : "—" },
              { icon: <Flame size={18} />, label: "連続学習日数", value: `${statsQuery.data.currentStreak}日` },
            ].map((s) => (
              <div key={s.label} style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", padding: "24px 28px" }}>
                <div style={{ color: "#c8ff00", marginBottom: 12 }}>{s.icon}</div>
                <div style={{ fontFamily: "Syne, sans-serif", fontSize: "1.6rem", fontWeight: 800, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: "0.75rem", color: "#6b6b80", letterSpacing: "0.05em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* QUIZ LIST */}
        <div>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "1.1rem", marginBottom: 16, letterSpacing: "-0.01em", color: "#6b6b80" }}>生成済みクイズ</h2>
          {quizListQuery.isLoading ? (
            <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", padding: 32, textAlign: "center", color: "#6b6b80" }}>読み込み中...</div>
          ) : quizListQuery.data?.quizzes.length === 0 ? (
            <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", padding: 48, textAlign: "center", color: "#6b6b80" }}>
              <p>まだクイズがありません</p>
              <p style={{ fontSize: "0.85rem", marginTop: 8 }}>上のフォームにURLを入力してクイズを生成しましょう</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {quizListQuery.data?.quizzes.map((q) => (
                <div key={q.id} style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 500, marginBottom: 6, fontSize: "0.95rem" }}>{q.sourceTitle}</div>
                    <a
                      href={q.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={q.sourceUrl}
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        color: "#00e5ff",
                        marginBottom: 6,
                        maxWidth: 420,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textDecoration: "none",
                        opacity: 0.8,
                      }}
                    >
                      🔗 {q.sourceUrl}
                    </a>
                    <div style={{ fontSize: "0.75rem", color: "#6b6b80", display: "flex", gap: 12 }}>
                      <span style={{ color: DIFFICULTY_COLORS[q.difficulty] }}>{DIFFICULTY_LABELS[q.difficulty]}</span>
                      <span>{q.questionCount}問</span>
                      <span>{new Date(q.createdAt).toLocaleDateString("ja-JP")}</span>
                      {q.attemptCount > 0 && (
                        <>
                          <span style={{ color: "#3d3d4d" }}>|</span>
                          <span>{q.attemptCount}回挑戦</span>
                          {q.bestScore !== null && (
                            <span style={{ color: "#c8ff00" }}>
                              最高 {q.bestScore}/{q.questionCount}問
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/quiz/$quizId", params: { quizId: q.id } })}
                      style={{ background: "#c8ff00", color: "#0a0a0f", border: "none", padding: "8px 18px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}
                    >
                      挑戦する
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(q.id)}
                      style={{ background: "rgba(255,77,109,0.12)", border: "1px solid rgba(255,77,109,0.3)", color: "#ff4d6d", padding: "8px 14px", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DELETE DIALOG */}
      {deleteTargetId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", padding: "40px 48px", maxWidth: 400, width: "90%" }}>
            <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.1rem", marginBottom: 12 }}>クイズを削除しますか？</h3>
            <p style={{ color: "#6b6b80", fontSize: "0.9rem", marginBottom: 28 }}>この操作は取り消せません。関連する挑戦記録もすべて削除されます。</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" onClick={() => setDeleteTargetId(null)} style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "none", color: "#f0f0f5", padding: "10px", cursor: "pointer" }}>キャンセル</button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate({ quizId: deleteTargetId })}
                disabled={deleteMutation.isPending}
                style={{ flex: 1, background: "#ff4d6d", border: "none", color: "#fff", padding: "10px", cursor: "pointer", fontWeight: 700 }}
              >
                {deleteMutation.isPending ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
