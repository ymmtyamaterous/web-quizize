import { createFileRoute, useNavigate } from "@tanstack/react-router";

import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/signup")({
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="text-2xl font-bold cursor-pointer"
            style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.02em", color: "#f0f0f5" }}
            onClick={() => navigate({ to: "/" })}
            onKeyDown={(e) => e.key === "Enter" && navigate({ to: "/" })}
          >
            web<span style={{ color: "#c8ff00" }}>quizize</span>
          </div>
        </div>
        <div className="bg-[#111118] border border-white/7 p-8">
          <SignUpForm onSwitchToSignIn={() => navigate({ to: "/login" })} />
        </div>
        <p className="text-center mt-4 text-sm text-[#6b6b80]">
          すでにアカウントをお持ちの方は{" "}
          <button
            type="button"
            onClick={() => navigate({ to: "/login" })}
            className="text-[#c8ff00] hover:underline"
          >
            ログイン
          </button>
        </p>
      </div>
    </div>
  );
}
