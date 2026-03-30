import { createFileRoute, useNavigate } from "@tanstack/react-router";

import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/signup")({
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Noto Sans JP', sans-serif",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 背景装飾 */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,255,0,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          right: "-10%",
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,77,109,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: 440, position: "relative", zIndex: 1 }}>
        {/* ロゴ */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "1.5rem",
              letterSpacing: "-0.02em",
              color: "#f0f0f5",
              padding: 0,
            }}
          >
            web<span style={{ color: "#c8ff00" }}>quizize</span>
          </button>
        </div>

        {/* カード */}
        <div
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "40px 36px",
          }}
        >
          <SignUpForm onSwitchToSignIn={() => navigate({ to: "/login" })} />
        </div>

        {/* 切り替えリンク */}
        <p
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: "0.85rem",
            color: "#6b6b80",
          }}
        >
          すでにアカウントをお持ちの方は{" "}
          <button
            type="button"
            onClick={() => navigate({ to: "/login" })}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#c8ff00",
              fontWeight: 700,
              fontSize: "0.85rem",
              padding: 0,
              fontFamily: "Syne, sans-serif",
            }}
          >
            ← ログイン
          </button>
        </p>
      </div>
    </div>
  );
}
