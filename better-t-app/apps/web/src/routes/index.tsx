import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState(false);
  const { data: session } = authClient.useSession();

  const revealRefs = useRef<HTMLElement[]>([]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("lp-visible");
            observer.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1 },
    );
    for (const el of revealRefs.current) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const addReveal = (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  };

  const handleGenerate = () => {
    if (!url.trim()) {
      setUrlError(true);
      setTimeout(() => setUrlError(false), 2000);
      return;
    }
    if (session) {
      navigate({ to: "/quiz/generating", search: { url, difficulty: "medium", questionCount: 5, autoQuestionCount: false } });
    } else {
      navigate({ to: "/login" });
    }
  };

  return (
    <>
      <style>{`
        :root {
          --lp-bg: #0a0a0f;
          --lp-surface: #111118;
          --lp-surface2: #1a1a26;
          --lp-accent: #c8ff00;
          --lp-accent2: #ff4d6d;
          --lp-accent3: #00e5ff;
          --lp-text: #f0f0f5;
          --lp-muted: #6b6b80;
          --lp-border: rgba(255,255,255,0.07);
        }
        .lp-wrap { background: var(--lp-bg); color: var(--lp-text); font-family: 'Noto Sans JP', sans-serif; font-weight: 300; overflow-x: hidden; min-height: 100vh; }
        .lp-wrap a { text-decoration: none; color: inherit; }
        .lp-syne { font-family: 'Syne', sans-serif; }
        .lp-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .lp-reveal.lp-visible { opacity: 1; transform: none; }
        .lp-d1 { transition-delay: 0.1s; }
        .lp-d2 { transition-delay: 0.2s; }
        .lp-d3 { transition-delay: 0.3s; }
        .lp-d4 { transition-delay: 0.4s; }
        @keyframes lp-fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .lp-anim-0 { animation: lp-fadeUp 0.6s ease both; }
        .lp-anim-1 { animation: lp-fadeUp 0.6s 0.1s ease both; }
        .lp-anim-2 { animation: lp-fadeUp 0.6s 0.2s ease both; }
        .lp-anim-3 { animation: lp-fadeUp 0.6s 0.3s ease both; }
        .lp-anim-4 { animation: lp-fadeUp 0.6s 0.4s ease both; }
        /* ── Responsive ─────────────────────── */
        @media (max-width: 768px) {
          .lp-nav-r { padding: 14px 20px !important; }
          .lp-hide-sp { display: none !important; }
          .lp-hero-r { padding: 90px 20px 60px !important; }
          .lp-url-form-r { flex-direction: column !important; }
          .lp-stats-r { gap: 24px !important; flex-wrap: wrap; }
          .lp-how-r { padding: 60px 20px !important; }
          .lp-steps-r { grid-template-columns: 1fr !important; }
          .lp-demo-r { grid-template-columns: 1fr !important; }
          .lp-demo-left-r { padding: 36px 24px !important; }
          .lp-demo-right-r { padding: 36px 24px !important; }
          .lp-features-r { padding: 60px 20px !important; }
          .lp-features-grid-r { grid-template-columns: 1fr 1fr !important; margin-top: 40px !important; }
          .lp-cta-r { padding: 80px 20px !important; }
          .lp-footer-r { flex-direction: column !important; gap: 12px !important; text-align: center; padding: 24px 20px !important; }
        }
        @media (max-width: 480px) {
          .lp-features-grid-r { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="lp-wrap">
        {/* NAV */}
        <nav className="lp-nav-r" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 48px", borderBottom: "1px solid var(--lp-border)", backdropFilter: "blur(16px)", background: "rgba(10,10,15,0.7)" }}>
          <div className="lp-syne" style={{ fontWeight: 800, fontSize: "1.3rem", letterSpacing: "-0.02em" }}>
            web<span style={{ color: "var(--lp-accent)" }}>quizize</span>
          </div>
          <ul style={{ listStyle: "none", display: "flex", gap: 36, margin: 0, padding: 0, alignItems: "center" }}>
            <li className="lp-hide-sp"><a href="#how" style={{ color: "var(--lp-muted)", fontSize: "0.85rem", letterSpacing: "0.04em" }}>使い方</a></li>
            <li className="lp-hide-sp"><a href="#features" style={{ color: "var(--lp-muted)", fontSize: "0.85rem", letterSpacing: "0.04em" }}>機能</a></li>
            <li>
              {session ? (
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ color: "var(--lp-muted)", fontSize: "0.82rem" }}>
                    {session.user.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/dashboard" })}
                    style={{ background: "var(--lp-accent)", color: "var(--lp-bg)", border: "none", padding: "8px 20px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}
                  >
                    マイページ
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/login" })}
                    style={{ background: "transparent", color: "var(--lp-muted)", border: "1px solid rgba(255,255,255,0.15)", padding: "8px 18px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}
                  >
                    ログイン
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/signup" })}
                    style={{ background: "var(--lp-accent)", color: "var(--lp-bg)", border: "none", padding: "8px 20px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}
                  >
                    無料で試す
                  </button>
                </div>
              )}
            </li>
          </ul>
        </nav>

        {/* HERO */}
        <section className="lp-hero-r" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "120px 48px 80px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "80px 80px", WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 80%)", maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 80%)" }} />
          <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(200,255,0,0.08) 0%, transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }} />
          <div className="lp-anim-0" style={{ fontSize: "0.72rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--lp-accent)", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "block", width: 32, height: 1, background: "var(--lp-accent)" }} />
            AI-Powered Learning Tool
          </div>
          <h1 className="lp-syne lp-anim-1" style={{ fontSize: "clamp(3.2rem, 8vw, 7rem)", fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.04em", maxWidth: 900, margin: "0 0 0 0" }}>
            URLを貼るだけで<br />
            <em style={{ fontStyle: "normal", color: "var(--lp-accent)" }}>クイズに</em>なる
          </h1>
          <p className="lp-anim-2" style={{ marginTop: 32, fontSize: "1.05rem", color: "var(--lp-muted)", maxWidth: 480, lineHeight: 1.8 }}>
            読んだ記事、調べたページ。そのURLを貼り付けるだけで、AIが自動で穴埋めクイズを生成します。読むより、解く。
          </p>
          <div className="lp-anim-3 lp-url-form-r" style={{ marginTop: 52, display: "flex", alignItems: "stretch", maxWidth: 680 }}>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder="https://例えばこのページのURLを貼り付けて…"
              style={{ flex: 1, background: "var(--lp-surface2)", border: `1px solid ${urlError ? "var(--lp-accent2)" : "var(--lp-border)"}`, borderRight: "none", color: "var(--lp-text)", fontSize: "0.95rem", padding: "18px 22px", outline: "none", fontFamily: "'Noto Sans JP', sans-serif", transition: "border-color 0.2s" }}
            />
            <button type="button" onClick={handleGenerate} style={{ background: "var(--lp-accent)", color: "var(--lp-bg)", border: "none", padding: "18px 32px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>
              クイズ生成 →
            </button>
          </div>
          <div className="lp-anim-4 lp-stats-r" style={{ marginTop: 48, display: "flex", gap: 48 }}>
            {[["3秒", "で生成完了"], ["12+", "対応サイト形式"], ["98%", "ユーザー満足度"]].map(([num, label]) => (
              <div key={label}>
                <div className="lp-syne" style={{ fontSize: "2rem", fontWeight: 800 }}>{num}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--lp-muted)", letterSpacing: "0.05em", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="lp-how-r" style={{ padding: "120px 48px" }}>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--lp-accent)", marginBottom: 16 }}>How It Works</div>
          <h2 ref={addReveal} className="lp-syne lp-reveal" style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 64 }}>
            たった3ステップで<br />学習が変わる
          </h2>
          <div className="lp-steps-r" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            {[
              { num: "01", title: "URLをコピペ", desc: "ニュース、Wikipedia、技術ブログ、論文——どんなWebページでもOK。URLをフォームに貼り付けるだけ。" },
              { num: "02", title: "AIが自動生成", desc: "ページ内容をAIが解析し、重要語句を抽出。文脈を理解した、質の高い穴埋めクイズを自動で作成します。" },
              { num: "03", title: "解いて定着", desc: "4択形式で直感的に解答。正解・不正解を即時フィードバック。解説付きでしっかり理解できます。" },
            ].map((step, i) => (
              <div key={step.num} ref={addReveal} className={`lp-reveal lp-d${i + 1}`} style={{ background: "var(--lp-surface)", padding: "48px 40px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 24, right: 32, fontFamily: "Syne, sans-serif", fontSize: "5rem", fontWeight: 800, color: "var(--lp-border)", lineHeight: 1 }}>{step.num}</div>
                <h3 className="lp-syne" style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 12 }}>{step.title}</h3>
                <p style={{ fontSize: "0.88rem", color: "var(--lp-muted)", lineHeight: 1.8, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DEMO */}
        <div className="lp-demo-r" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, background: "var(--lp-surface)" }}>
          <div ref={addReveal} className="lp-reveal lp-demo-left-r" style={{ background: "var(--lp-bg)", padding: "64px 56px" }}>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--lp-accent3)", marginBottom: 8 }}>Input — 元記事</div>
            <div className="lp-syne" style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 28 }}>Webページのテキスト</div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--lp-border)", padding: 28, fontSize: "0.83rem", lineHeight: 2, color: "var(--lp-muted)" }}>
              <div className="lp-syne" style={{ fontSize: "1rem", color: "var(--lp-text)", fontWeight: 700, marginBottom: 10 }}>日本の四季と文化</div>
              日本には<mark style={{ background: "rgba(200,255,0,0.18)", color: "var(--lp-accent)", padding: "1px 4px" }}>春・夏・秋・冬</mark>の四季があり、それぞれの季節に独自の文化や行事が根付いています。<mark style={{ background: "rgba(200,255,0,0.18)", color: "var(--lp-accent)", padding: "1px 4px" }}>桜</mark>は春の象徴として、多くの人々に愛され、花見の習慣は平安時代から続くとされています。
            </div>
          </div>
          <div ref={addReveal} className="lp-reveal lp-d1 lp-demo-right-r" style={{ background: "var(--lp-surface2)", padding: "64px 56px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--lp-accent2)", marginBottom: 8 }}>Output — 生成クイズ</div>
            <div className="lp-syne" style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 28 }}>穴埋めクイズ</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 3, background: "var(--lp-border)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: "40%", height: "100%", background: "var(--lp-accent2)" }} />
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--lp-muted)", whiteSpace: "nowrap" }}>2 / 5問</span>
            </div>
            <div style={{ background: "var(--lp-bg)", border: "1px solid var(--lp-border)", padding: 28 }}>
              <div style={{ fontSize: "0.68rem", color: "var(--lp-muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>問題 2</div>
              <div style={{ fontSize: "1rem", lineHeight: 1.9, color: "var(--lp-text)", marginBottom: 24 }}>
                春の象徴である
                <span style={{ display: "inline-block", width: 90, height: 26, background: "rgba(255,77,109,0.12)", borderBottom: "2px solid var(--lp-accent2)", verticalAlign: "middle", margin: "0 4px" }} />
                は、花見の習慣と共に平安時代から人々に愛されてきました。
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[{ text: "梅", correct: false }, { text: "桜 ✓", correct: true }, { text: "椿", correct: false }, { text: "菊", correct: false }].map((c) => (
                  <div key={c.text} style={{ background: c.correct ? "rgba(200,255,0,0.07)" : "rgba(255,255,255,0.04)", border: `1px solid ${c.correct ? "var(--lp-accent)" : "var(--lp-border)"}`, padding: "10px 16px", fontSize: "0.85rem", textAlign: "center", color: c.correct ? "var(--lp-accent)" : "var(--lp-text)" }}>{c.text}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FEATURES */}
        <section id="features" className="lp-features-r" style={{ padding: "120px 48px", background: "var(--lp-bg)" }}>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--lp-accent)", marginBottom: 16 }}>Features</div>
          <h2 ref={addReveal} className="lp-syne lp-reveal" style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>学習を加速させる機能</h2>
            <div className="lp-features-grid-r" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, marginTop: 64 }}>
            {[
              { icon: "🧠", title: "文脈理解AI", desc: "単語の頻度ではなく、文脈上の重要度を判定してキーワードを抽出します。" },
              { icon: "⚡", title: "高速生成", desc: "URLを送信してから数秒でクイズが完成。待ち時間なく学習を始められます。" },
              { icon: "🎯", title: "難易度調整", desc: "初級・中級・上級の3段階。学習レベルに合わせてクイズの難しさを変えられます。" },
              { icon: "📊", title: "学習記録", desc: "正答率・学習時間・挑戦回数をトラッキング。成長が数字で見えます。" },
            ].map((f, i) => (
              <div key={f.title} ref={addReveal} className={`lp-reveal lp-d${i}`} style={{ padding: "36px 32px", background: "var(--lp-surface)", borderTop: "2px solid transparent", transition: "all 0.25s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderTopColor = "var(--lp-accent)"; (e.currentTarget as HTMLElement).style.background = "var(--lp-surface2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderTopColor = "transparent"; (e.currentTarget as HTMLElement).style.background = "var(--lp-surface)"; }}>
                <div style={{ fontSize: "1.6rem", marginBottom: 20 }}>{f.icon}</div>
                <h4 className="lp-syne" style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 10 }}>{f.title}</h4>
                <p style={{ fontSize: "0.82rem", color: "var(--lp-muted)", lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="lp-cta-r" style={{ padding: "140px 48px", textAlign: "center", position: "relative", overflow: "hidden", background: "var(--lp-surface)" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(200,255,0,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
          <h2 ref={addReveal} className="lp-syne lp-reveal" style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: 20 }}>
            さあ、<em style={{ color: "var(--lp-accent)", fontStyle: "normal" }}>解いて</em>みよう
          </h2>
          <p ref={addReveal} className="lp-reveal lp-d1" style={{ color: "var(--lp-muted)", marginBottom: 48, fontSize: "1rem" }}>クレジットカード不要。今すぐ無料で使えます。</p>
          <button type="button" ref={addReveal} className="lp-reveal lp-d2" onClick={() => navigate({ to: "/signup" })} style={{ background: "var(--lp-accent)", color: "var(--lp-bg)", border: "none", padding: "18px 44px", fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.95rem", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>
            無料でクイズを作る →
          </button>
        </section>

        {/* FOOTER */}
        <footer className="lp-footer-r" style={{ padding: "40px 48px", borderTop: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--lp-bg)" }}>
          <div className="lp-syne" style={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.02em" }}>web<span style={{ color: "var(--lp-accent)" }}>quizize</span></div>
          <p style={{ fontSize: "0.78rem", color: "var(--lp-muted)", margin: 0 }}>© 2026 Web Quizize. AIで学習をもっと楽しく。</p>
        </footer>
      </div>
    </>
  );
}
