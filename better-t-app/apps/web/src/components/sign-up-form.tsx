import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  color: "#6b6b80",
  textTransform: "uppercase" as const,
  fontFamily: "Syne, sans-serif",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0f",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#f0f0f5",
  padding: "12px 16px",
  fontSize: "0.95rem",
  fontFamily: "'Noto Sans JP', sans-serif",
  outline: "none",
  boxSizing: "border-box" as const,
  transition: "border-color 0.2s",
};

const errorStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "#ff4d6d",
  marginTop: 2,
};

function PasswordInput({
  id,
  name,
  value,
  hasError,
  onBlur,
  onChange,
  autoComplete,
}: {
  id: string;
  name: string;
  value: string;
  hasError: boolean;
  onBlur: () => void;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...inputStyle,
          paddingRight: 48,
          borderColor: hasError ? "rgba(255,77,109,0.6)" : "rgba(255,255,255,0.1)",
        }}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#6b6b80",
          padding: 0,
          display: "flex",
          alignItems: "center",
        }}
        aria-label={show ? "パスワードを隠す" : "パスワードを表示"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const navigate = useNavigate({ from: "/" });

  const form = useForm({
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        { email: value.email, password: value.password, name: value.name },
        {
          onSuccess: () => {
            navigate({ to: "/dashboard" });
            toast.success("アカウントを作成しました");
          },
          onError: (error) => {
            toast.error(error.error.message || "登録に失敗しました");
          },
        },
      );
    },
    validators: {
      onSubmit: z
        .object({
          name: z.string().min(2, "名前は2文字以上で入力してください"),
          email: z.email("メールアドレスの形式が正しくありません"),
          password: z.string().min(8, "パスワードは8文字以上で入力してください"),
          confirmPassword: z.string().min(1, "確認用パスワードを入力してください"),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: "パスワードが一致しません",
          path: ["confirmPassword"],
        }),
    },
  });

  return (
    <div style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
      <h2
        style={{
          fontFamily: "Syne, sans-serif",
          fontWeight: 800,
          fontSize: "1.5rem",
          letterSpacing: "-0.02em",
          marginBottom: 8,
          color: "#f0f0f5",
        }}
      >
        新規登録
      </h2>
      <p style={{ fontSize: "0.85rem", color: "#6b6b80", marginBottom: 32 }}>
        アカウントを作成してください
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        {/* 名前 */}
        <form.Field name="name">
          {(field) => (
            <div style={fieldStyle}>
              <label htmlFor={field.name} style={labelStyle}>
                お名前
              </label>
              <input
                id={field.name}
                name={field.name}
                type="text"
                autoComplete="name"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor:
                    field.state.meta.errors.length > 0
                      ? "rgba(255,77,109,0.6)"
                      : "rgba(255,255,255,0.1)",
                }}
              />
              {field.state.meta.errors.map((error) => (
                <span key={error?.message} style={errorStyle}>
                  {error?.message}
                </span>
              ))}
            </div>
          )}
        </form.Field>

        {/* メールアドレス */}
        <form.Field name="email">
          {(field) => (
            <div style={fieldStyle}>
              <label htmlFor={field.name} style={labelStyle}>
                メールアドレス
              </label>
              <input
                id={field.name}
                name={field.name}
                type="email"
                autoComplete="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor:
                    field.state.meta.errors.length > 0
                      ? "rgba(255,77,109,0.6)"
                      : "rgba(255,255,255,0.1)",
                }}
              />
              {field.state.meta.errors.map((error) => (
                <span key={error?.message} style={errorStyle}>
                  {error?.message}
                </span>
              ))}
            </div>
          )}
        </form.Field>

        {/* パスワード */}
        <form.Field name="password">
          {(field) => (
            <div style={fieldStyle}>
              <label htmlFor={field.name} style={labelStyle}>
                パスワード
                <span
                  style={{ fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 400, marginLeft: 8, fontSize: "0.72rem", color: "#4a4a5a", letterSpacing: 0 }}
                >
                  （8文字以上）
                </span>
              </label>
              <PasswordInput
                id={field.name}
                name={field.name}
                value={field.state.value}
                hasError={field.state.meta.errors.length > 0}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                autoComplete="new-password"
              />
              {field.state.meta.errors.map((error) => (
                <span key={error?.message} style={errorStyle}>
                  {error?.message}
                </span>
              ))}
            </div>
          )}
        </form.Field>

        {/* パスワード確認 */}
        <form.Field name="confirmPassword">
          {(field) => (
            <div style={fieldStyle}>
              <label htmlFor={field.name} style={labelStyle}>
                パスワード（確認）
              </label>
              <PasswordInput
                id={field.name}
                name={field.name}
                value={field.state.value}
                hasError={field.state.meta.errors.length > 0}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                autoComplete="new-password"
              />
              {field.state.meta.errors.map((error) => (
                <span key={error?.message} style={errorStyle}>
                  {error?.message}
                </span>
              ))}
            </div>
          )}
        </form.Field>

        {/* 送信ボタン */}
        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              style={{
                background: canSubmit && !isSubmitting ? "#c8ff00" : "rgba(200,255,0,0.3)",
                border: "none",
                color: "#0a0a0f",
                padding: "14px",
                fontFamily: "Syne, sans-serif",
                fontWeight: 800,
                fontSize: "0.95rem",
                letterSpacing: "0.05em",
                cursor: canSubmit && !isSubmitting ? "pointer" : "not-allowed",
                width: "100%",
                marginTop: 4,
                transition: "background 0.2s",
              }}
            >
              {isSubmitting ? "登録中..." : "アカウントを作成"}
            </button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
