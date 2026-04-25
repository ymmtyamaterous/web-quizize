import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ArrowDownUp,
  Clock,
  Flame,
  Heart,
  LogOut,
  Plus,
  Search,
  StickyNote,
  Tag,
  Target,
  Trash2,
  Trophy,
  X,
  Zap,
} from "lucide-react";
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

type QuizItem = {
  id: string;
  sourceUrl: string;
  sourceTitle: string;
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  status: string;
  isFavorite: boolean;
  memo: string;
  createdAt: string;
  lastAttemptAt: string | null;
  bestScore: number | null;
  attemptCount: number;
  tags: { id: string; name: string; color: string }[];
};

// ── TagBadge ──────────────────────────────────────────────────────────────
function TagBadge({
  tag,
  onRemove,
}: {
  tag: { id: string; name: string; color: string };
  onRemove?: () => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 2,
        fontSize: "0.72rem",
        fontWeight: 600,
        background: `${tag.color}22`,
        color: tag.color,
        border: `1px solid ${tag.color}55`,
        whiteSpace: "nowrap",
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{ background: "none", border: "none", cursor: "pointer", color: tag.color, padding: 0, lineHeight: 1, display: "flex" }}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

// ── TagSelector ───────────────────────────────────────────────────────────
function TagSelector({
  quizId: _quizId,
  attachedTags,
  allTags,
  onAttach,
  onDetach,
  onCreateTag,
}: {
  quizId: string;
  attachedTags: { id: string; name: string; color: string }[];
  allTags: { id: string; name: string; color: string }[];
  onAttach: (tagId: string) => void;
  onDetach: (tagId: string) => void;
  onCreateTag: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const attachedIds = new Set(attachedTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !attachedIds.has(t.id));

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#6b6b80",
          padding: "4px 8px",
          cursor: "pointer",
          fontSize: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderRadius: 2,
        }}
        title="タグを管理"
      >
        <Tag size={12} />
        タグ
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 100,
            background: "#1a1a26",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4,
            padding: 12,
            minWidth: 200,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 付与済みタグ */}
          {attachedTags.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: "0.7rem", color: "#6b6b80", marginBottom: 4 }}>付与中</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {attachedTags.map((t) => (
                  <TagBadge key={t.id} tag={t} onRemove={() => onDetach(t.id)} />
                ))}
              </div>
            </div>
          )}
          {/* 追加可能なタグ */}
          {availableTags.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: "0.7rem", color: "#6b6b80", marginBottom: 4 }}>追加する</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {availableTags.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => onAttach(t.id)}
                    style={{
                      background: `${t.color}22`,
                      border: `1px solid ${t.color}55`,
                      color: t.color,
                      padding: "2px 8px",
                      borderRadius: 2,
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* 新規タグ作成 */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 8 }}>
            <div style={{ fontSize: "0.7rem", color: "#6b6b80", marginBottom: 4 }}>新しいタグを作成</div>
            <div style={{ display: "flex", gap: 4 }}>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTagName.trim()) {
                    onCreateTag(newTagName.trim());
                    setNewTagName("");
                  }
                }}
                placeholder="タグ名..."
                style={{
                  flex: 1,
                  background: "#111118",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#f0f0f5",
                  padding: "4px 8px",
                  fontSize: "0.8rem",
                  borderRadius: 2,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (newTagName.trim()) {
                    onCreateTag(newTagName.trim());
                    setNewTagName("");
                  }
                }}
                style={{
                  background: "#c8ff00",
                  color: "#0a0a0f",
                  border: "none",
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ marginTop: 8, width: "100%", background: "none", border: "none", color: "#6b6b80", fontSize: "0.75rem", cursor: "pointer", padding: "4px 0" }}
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}

// ── MemoEditor ────────────────────────────────────────────────────────────
function MemoEditor({
  quizId: _quizId,
  initialMemo,
  onSave,
}: {
  quizId: string;
  initialMemo: string;
  onSave: (memo: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialMemo);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setValue(initialMemo);
          setOpen((v) => !v);
        }}
        style={{
          background: initialMemo ? "rgba(200,255,0,0.08)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${initialMemo ? "rgba(200,255,0,0.3)" : "rgba(255,255,255,0.1)"}`,
          color: initialMemo ? "#c8ff00" : "#6b6b80",
          padding: "4px 8px",
          cursor: "pointer",
          fontSize: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderRadius: 2,
        }}
        title="メモを編集"
      >
        <StickyNote size={12} />
        メモ
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 100,
            background: "#1a1a26",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4,
            padding: 12,
            width: 280,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: "0.7rem", color: "#6b6b80", marginBottom: 6 }}>メモ（最大500文字）</div>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="学習ポイント、気づきなどを記録..."
            style={{
              width: "100%",
              background: "#111118",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f0f0f5",
              padding: "8px",
              fontSize: "0.82rem",
              borderRadius: 2,
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "none", color: "#6b6b80", padding: "6px", cursor: "pointer", borderRadius: 2, fontSize: "0.8rem" }}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(value);
                setOpen(false);
              }}
              style={{ flex: 1, background: "#c8ff00", border: "none", color: "#0a0a0f", padding: "6px", cursor: "pointer", borderRadius: 2, fontSize: "0.8rem", fontWeight: 700 }}
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DashboardPage ─────────────────────────────────────────────────────────
function DashboardPage() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── 生成フォーム
  const [url, setUrl] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [autoQuestionCount, setAutoQuestionCount] = useState(false);
  const [language, setLanguage] = useState<"ja" | "en" | "zh" | "ko">("ja");

  // ── フィルタ状態
  const [search, setSearch] = useState("");
  const [filterTagId, setFilterTagId] = useState<string | undefined>(undefined);
  const [filterFavorite, setFilterFavorite] = useState<boolean | undefined>(undefined);
  const [filterDifficulty, setFilterDifficulty] = useState<"easy" | "medium" | "hard" | undefined>(undefined);
  // ソート状態
  const [sortBy, setSortBy] = useState<"createdAt" | "title" | "bestScore" | "attemptCount">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  // ── 削除確認
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // ── クエリ
  const statsQuery = useQuery(orpc.stats.summary.queryOptions());
  const tagListQuery = useQuery(orpc.tag.list.queryOptions());
  const quizListQuery = useQuery(
    orpc.quiz.list.queryOptions({
      input: {
        page: 1,
        limit: 50,
        search: search || undefined,
        tagId: filterTagId,
        isFavorite: filterFavorite,
        difficulty: filterDifficulty,
        sortBy,
        sortOrder,
      },
    }),
  );

  // ── ミューテーション
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

  const updateMutation = useMutation({
    ...orpc.quiz.update.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.quiz.list.key() }),
    onError: () => toast.error("更新に失敗しました"),
  });

  const createTagMutation = useMutation({
    ...orpc.tag.create.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.tag.list.key() }),
    onError: (err: Error) => toast.error(err.message ?? "タグの作成に失敗しました"),
  });

  const attachTagMutation = useMutation({
    ...orpc.tag.attachToQuiz.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.quiz.list.key() }),
    onError: () => toast.error("タグの付与に失敗しました"),
  });

  const detachTagMutation = useMutation({
    ...orpc.tag.detachFromQuiz.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.quiz.list.key() }),
    onError: () => toast.error("タグの解除に失敗しました"),
  });

  // ── ハンドラ
  const handleGenerate = () => {
    if (!url.trim()) {
      toast.error("URLを入力してください");
      return;
    }
    navigate({ to: "/quiz/generating", search: { url, difficulty, questionCount, autoQuestionCount, language } });
  };

  const handleToggleFavorite = (q: QuizItem) => {
    updateMutation.mutate(
      { quizId: q.id, isFavorite: !q.isFavorite },
      {
        onSuccess: () =>
          toast.success(q.isFavorite ? "お気に入りを解除しました" : "お気に入りに追加しました"),
      },
    );
  };

  const handleSaveMemo = (quizId: string, memo: string) => {
    updateMutation.mutate(
      { quizId, memo },
      { onSuccess: () => toast.success("メモを保存しました") },
    );
  };

  const handleCreateTagAndAttach = (quizId: string, name: string) => {
    createTagMutation.mutate(
      { name },
      {
        onSuccess: (data) => {
          attachTagMutation.mutate({ quizId, tagId: data.id });
          toast.success(`タグ「${name}」を作成して付与しました`);
        },
      },
    );
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}時間${m}分`;
    if (m > 0) return `${m}分`;
    return `${seconds}秒`;
  };

  const allTags = tagListQuery.data ?? [];
  const hasActiveFilter = search || filterTagId || filterFavorite !== undefined || filterDifficulty;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0f0f5]" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
      <style>{`
        .dash-nav { padding: 16px 48px; }
        .dash-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px; margin-bottom: 40px; }
        .dash-gen-box { padding: 36px 40px; }
        @media (max-width: 1024px) {
          .dash-stats { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 768px) {
          .dash-nav { padding: 12px 16px !important; }
          .dash-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-gen-box { padding: 24px 16px !important; }
        }
      `}</style>
      {/* NAV */}
      <nav className="dash-nav" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)", background: "rgba(10,10,15,0.9)", position: "sticky", top: 0, zIndex: 50, padding: "16px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
        <div className="dash-gen-box" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", padding: "36px 40px", marginBottom: 40 }}>
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
              value={language}
              onChange={(e) => setLanguage(e.target.value as "ja" | "en" | "zh" | "ko")}
              style={{ background: "#1a1a26", border: "1px solid rgba(255,255,255,0.07)", color: "#f0f0f5", padding: "14px 18px", cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", fontSize: "0.9rem" }}
            >
              <option value="ja">🇯🇵 日本語</option>
              <option value="en">🇺🇸 English</option>
              <option value="zh">🇨🇳 中文</option>
              <option value="ko">🇰🇷 한국어</option>
            </select>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              disabled={autoQuestionCount}
              style={{ background: "#1a1a26", border: "1px solid rgba(255,255,255,0.07)", color: autoQuestionCount ? "#3d3d4d" : "#f0f0f5", padding: "14px 18px", cursor: autoQuestionCount ? "not-allowed" : "pointer", fontFamily: "'Noto Sans JP', sans-serif", fontSize: "0.9rem", opacity: autoQuestionCount ? 0.45 : 1 }}
            >
              {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}問</option>)}
            </select>
            <label
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", fontSize: "0.85rem", color: autoQuestionCount ? "#c8ff00" : "#6b6b80", whiteSpace: "nowrap" }}
            >
              <input
                type="checkbox"
                checked={autoQuestionCount}
                onChange={(e) => setAutoQuestionCount(e.target.checked)}
                style={{ accentColor: "#c8ff00", width: 16, height: 16 }}
              />
              自動設定
            </label>
            <button
              type="button"
              onClick={handleGenerate}
              style={{ background: "#c8ff00", color: "#0a0a0f", border: "none", padding: "14px 28px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              クイズ生成 →
            </button>
          </div>
          {/* AI 使用状況バー */}
          {statsQuery.data && (() => {
            const used = statsQuery.data.aiRequestsToday;
            const limit = statsQuery.data.aiRequestLimit;
            const pct = Math.min((used / limit) * 100, 100);
            const remaining = limit - used;
            const color = pct >= 100 ? "#ff4d6d" : pct >= 70 ? "#ffaa00" : "#c8ff00";
            return (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "#6b6b80" }}>
                    <Zap size={13} color={color} />
                    本日のAIリクエスト
                  </div>
                  <span style={{ fontSize: "0.78rem", color: pct >= 100 ? "#ff4d6d" : "#6b6b80" }}>
                    {pct >= 100
                      ? "上限に達しました"
                      : `残り ${remaining} 回 （${used} / ${limit}）`}
                  </span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })()}
        </div>

        {/* STATS */}
        {statsQuery.data && (
          <div className="dash-stats" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 2, marginBottom: 40 }}>
            {[
              { icon: <BookOpen size={18} />, label: "生成クイズ数", value: `${statsQuery.data.totalQuizzesGenerated}件`, color: "#c8ff00" },
              { icon: <Target size={18} />, label: "挑戦回数", value: `${statsQuery.data.totalAttempts}回`, color: "#c8ff00" },
              { icon: <Trophy size={18} />, label: "総合正答率", value: `${statsQuery.data.overallAccuracy}%`, color: "#c8ff00" },
              { icon: <Clock size={18} />, label: "累計学習時間", value: statsQuery.data.totalStudyTimeSeconds > 0 ? formatTime(statsQuery.data.totalStudyTimeSeconds) : "—", color: "#c8ff00" },
              { icon: <Flame size={18} />, label: "連続学習日数", value: `${statsQuery.data.currentStreak}日`, color: "#c8ff00" },
              {
                icon: <Zap size={18} />,
                label: "本日AI使用",
                value: `${statsQuery.data.aiRequestsToday} / ${statsQuery.data.aiRequestLimit}`,
                color: statsQuery.data.aiRequestsToday >= statsQuery.data.aiRequestLimit
                  ? "#ff4d6d"
                  : statsQuery.data.aiRequestsToday / statsQuery.data.aiRequestLimit >= 0.7
                  ? "#ffaa00"
                  : "#c8ff00",
              },
            ].map((s) => (
              <div key={s.label} style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", padding: "24px 28px" }}>
                <div style={{ color: s.color, marginBottom: 12 }}>{s.icon}</div>
                <div style={{ fontFamily: "Syne, sans-serif", fontSize: "1.6rem", fontWeight: 800, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: "0.75rem", color: "#6b6b80", letterSpacing: "0.05em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* QUIZ LIST */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.01em", color: "#6b6b80", margin: 0 }}>生成済みクイズ</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {/* ソートセレクター */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <ArrowDownUp size={13} style={{ color: "#6b6b80" }} />
                <select
                  value={`${sortBy}:${sortOrder}`}
                  onChange={(e) => {
                    const [by, order] = e.target.value.split(":") as [typeof sortBy, typeof sortOrder];
                    setSortBy(by);
                    setSortOrder(order);
                  }}
                  style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", color: "#a0a0b5", padding: "7px 12px", fontSize: "0.82rem", cursor: "pointer" }}
                >
                  <option value="createdAt:desc">新着順</option>
                  <option value="createdAt:asc">古い順</option>
                  <option value="title:asc">タイトル (A→Z)</option>
                  <option value="title:desc">タイトル (Z→A)</option>
                  <option value="bestScore:desc">スコア高い順</option>
                  <option value="bestScore:asc">スコア低い順</option>
                  <option value="attemptCount:desc">プレイ回数多い順</option>
                  <option value="attemptCount:asc">プレイ回数少ない順</option>
                </select>
              </div>

              {/* テキスト検索 */}
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={14} style={{ position: "absolute", left: 10, color: "#6b6b80", pointerEvents: "none" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="タイトルで検索..."
                  style={{
                    background: "#111118",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: "#f0f0f5",
                    padding: "7px 12px 7px 30px",
                    fontSize: "0.82rem",
                    outline: "none",
                    width: 180,
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                />
              </div>

              {/* タグフィルタ */}
              <select
                value={filterTagId ?? ""}
                onChange={(e) => setFilterTagId(e.target.value || undefined)}
                style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", color: filterTagId ? "#c8ff00" : "#6b6b80", padding: "7px 12px", fontSize: "0.82rem", cursor: "pointer" }}
              >
                <option value="">すべてのタグ</option>
                {allTags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              {/* 難易度フィルタ */}
              <select
                value={filterDifficulty ?? ""}
                onChange={(e) => setFilterDifficulty((e.target.value as "easy" | "medium" | "hard") || undefined)}
                style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", color: filterDifficulty ? DIFFICULTY_COLORS[filterDifficulty] : "#6b6b80", padding: "7px 12px", fontSize: "0.82rem", cursor: "pointer" }}
              >
                <option value="">すべての難易度</option>
                <option value="easy">初級</option>
                <option value="medium">中級</option>
                <option value="hard">上級</option>
              </select>

              {/* お気に入りフィルタ */}
              <button
                type="button"
                onClick={() => setFilterFavorite(filterFavorite === true ? undefined : true)}
                style={{
                  background: filterFavorite === true ? "rgba(255,77,109,0.15)" : "#111118",
                  border: `1px solid ${filterFavorite === true ? "rgba(255,77,109,0.5)" : "rgba(255,255,255,0.07)"}`,
                  color: filterFavorite === true ? "#ff4d6d" : "#6b6b80",
                  padding: "7px 12px",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Heart size={13} fill={filterFavorite === true ? "#ff4d6d" : "none"} />
                お気に入り
              </button>

              {/* フィルタリセット */}
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilterTagId(undefined);
                    setFilterFavorite(undefined);
                    setFilterDifficulty(undefined);
                  }}
                  style={{ background: "none", border: "none", color: "#6b6b80", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <X size={13} /> リセット
                </button>
              )}
            </div>
          </div>

          {quizListQuery.isLoading ? (
            <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", padding: 32, textAlign: "center", color: "#6b6b80" }}>読み込み中...</div>
          ) : quizListQuery.data?.quizzes.length === 0 ? (
            <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", padding: 48, textAlign: "center", color: "#6b6b80" }}>
              <p>{hasActiveFilter ? "条件に一致するクイズがありません" : "まだクイズがありません"}</p>
              {!hasActiveFilter && <p style={{ fontSize: "0.85rem", marginTop: 8 }}>上のフォームにURLを入力してクイズを生成しましょう</p>}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {quizListQuery.data?.quizzes.map((q) => (
                <div key={q.id} style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", padding: "20px 24px" }}>
                  {/* メイン行 */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    {/* お気に入りボタン */}
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(q)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "2px",
                        color: q.isFavorite ? "#ff4d6d" : "#3d3d4d",
                        flexShrink: 0,
                        marginTop: 2,
                        transition: "color 0.15s",
                      }}
                      title={q.isFavorite ? "お気に入り解除" : "お気に入りに追加"}
                    >
                      <Heart size={18} fill={q.isFavorite ? "#ff4d6d" : "none"} />
                    </button>

                    {/* 情報エリア */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 500, marginBottom: 4, fontSize: "0.95rem" }}>{q.sourceTitle}</div>
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
                      <div style={{ fontSize: "0.75rem", color: "#6b6b80", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ color: DIFFICULTY_COLORS[q.difficulty] }}>{DIFFICULTY_LABELS[q.difficulty]}</span>
                        <span>{q.questionCount}問</span>
                        <span>{new Date(q.createdAt).toLocaleDateString("ja-JP")}</span>
                        {q.attemptCount > 0 && (
                          <>
                            <span style={{ color: "#3d3d4d" }}>|</span>
                            <span>{q.attemptCount}回挑戦</span>
                            {q.bestScore !== null && (
                              <span style={{ color: "#c8ff00" }}>最高 {q.bestScore}/{q.questionCount}問</span>
                            )}
                          </>
                        )}
                      </div>

                      {/* タグ一覧 */}
                      {q.tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                          {q.tags.map((t) => (
                            <TagBadge key={t.id} tag={t} />
                          ))}
                        </div>
                      )}

                      {/* メモプレビュー */}
                      {q.memo && (
                        <div style={{ marginTop: 8, fontSize: "0.78rem", color: "#6b6b80", background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.1)", padding: "6px 10px", borderRadius: 2 }}>
                          📝 {q.memo.length > 80 ? `${q.memo.slice(0, 80)}…` : q.memo}
                        </div>
                      )}
                    </div>

                    {/* アクションボタン群 */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", alignItems: "flex-start" }}>
                      {/* タグ管理 */}
                      <TagSelector
                        quizId={q.id}
                        attachedTags={q.tags}
                        allTags={allTags}
                        onAttach={(tagId) => attachTagMutation.mutate({ quizId: q.id, tagId })}
                        onDetach={(tagId) => detachTagMutation.mutate({ quizId: q.id, tagId })}
                        onCreateTag={(name) => handleCreateTagAndAttach(q.id, name)}
                      />

                      {/* メモ編集 */}
                      <MemoEditor
                        quizId={q.id}
                        initialMemo={q.memo}
                        onSave={(memo) => handleSaveMemo(q.id, memo)}
                      />

                      {/* 問題を追加 */}
                      <button
                        type="button"
                        onClick={() =>
                          navigate({
                            to: "/quiz/generating",
                            search: {
                              url: q.sourceUrl,
                              difficulty: q.difficulty,
                              questionCount: 5,
                              autoQuestionCount: false,
                              language: "ja",
                              appendToQuizId: q.id,
                            },
                          })
                        }
                        style={{ background: "rgba(0,229,255,0.07)", color: "#00e5ff", border: "1px solid rgba(0,229,255,0.25)", padding: "4px 8px", cursor: "pointer", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4, borderRadius: 2 }}
                        title="同じURLから問題を追加"
                      >
                        <Plus size={12} />
                        問題を追加
                      </button>

                      {/* 確認ボタン */}
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/quiz/$quizId/review", params: { quizId: q.id } })}
                        style={{ background: "rgba(255,255,255,0.06)", color: "#a0a0b5", border: "1px solid rgba(255,255,255,0.12)", padding: "8px 14px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.05em", cursor: "pointer" }}
                      >
                        確認する
                      </button>

                      {/* 挑戦ボタン */}
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/quiz/$quizId", params: { quizId: q.id } })}
                        style={{ background: "#c8ff00", color: "#0a0a0f", border: "none", padding: "8px 18px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}
                      >
                        挑戦する
                      </button>

                      {/* 削除ボタン */}
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(q.id)}
                        style={{ background: "rgba(255,77,109,0.12)", border: "1px solid rgba(255,77,109,0.3)", color: "#ff4d6d", padding: "8px 10px", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center" }}
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
