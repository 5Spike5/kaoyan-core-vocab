import { LogIn, Mail, UserPlus } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { runAutoCloudSync } from "../../repositories/cloudSync";
import { isSupabaseConfigured } from "../../repositories/supabaseClient";
import {
  requestPasswordReset,
  signIn,
  signUp,
  validateAuthInput,
} from "./authService";
import type { AuthMode } from "./authTypes";

const MODE_COPY: Record<AuthMode, { title: string; submit: string }> = {
  signin: { title: "登录", submit: "登录" },
  signup: { title: "注册", submit: "注册并登录" },
  reset: { title: "重置密码", submit: "发送重置邮件" },
};

type FormState = {
  mode: AuthMode;
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
  notice: string | null;
};

export default function AuthPage() {
  const navigate = useNavigate();
  const configured = isSupabaseConfigured();
  const [state, setState] = useState<FormState>({
    mode: "signin",
    email: "",
    password: "",
    loading: false,
    error: null,
    notice: null,
  });

  const switchMode = useCallback((mode: AuthMode) => {
    setState((previous) => ({ ...previous, mode, error: null, notice: null }));
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!configured || state.loading) {
        return;
      }

      const validation = validateAuthInput({
        email: state.email,
        password: state.password,
      });
      if (!validation.success) {
        const message = validation.error.issues[0]?.message ?? "输入有误";
        setState((previous) => ({ ...previous, error: message, notice: null }));
        return;
      }

      setState((previous) => ({
        ...previous,
        loading: true,
        error: null,
        notice: null,
      }));

      try {
        const { email, password } = validation.data;

        if (state.mode === "signin") {
          await signIn(email, password);
          void runAutoCloudSync({ notify: true }).catch(() => {
            // 同步失败不阻塞登录，可在设置页手动重试
          });
          navigate("/");
          return;
        }

        if (state.mode === "signup") {
          const user = await signUp(email, password);
          if (user) {
            void runAutoCloudSync({ notify: true }).catch(() => {
              // 同步失败不阻塞注册，可在设置页手动重试
            });
            navigate("/");
            return;
          }
          setState((previous) => ({
            ...previous,
            loading: false,
            notice: "注册成功，请前往邮箱确认后登录。",
          }));
          return;
        }

        await requestPasswordReset(email);
        setState((previous) => ({
          ...previous,
          loading: false,
          notice: "重置邮件已发送，请查收邮箱。",
        }));
      } catch (error) {
        setState((previous) => ({
          ...previous,
          loading: false,
          error:
            error instanceof Error ? error.message : "操作失败，请稍后重试",
        }));
      }
    },
    [
      configured,
      navigate,
      state.loading,
      state.mode,
      state.email,
      state.password,
    ],
  );

  return (
    <section className="page auth-page" aria-labelledby="auth-title">
      <div className="page-heading">
        <p className="eyebrow">ACCOUNT</p>
        <h1 id="auth-title">{MODE_COPY[state.mode].title}</h1>
      </div>

      {!configured ? (
        <div className="auth-local-note" role="status">
          <p>当前为本地模式，未配置云同步。</p>
          <p>
            在 <code>.env</code> 中设置 <code>VITE_SUPABASE_URL</code> 和{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>{" "}
            后即可使用邮箱登录和云端同步。参见 <code>docs/deployment.md</code>。
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => navigate("/")}
          >
            返回本地模式
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="mode-tabs" role="tablist" aria-label="认证方式">
            {(["signin", "signup", "reset"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={state.mode === mode}
                className={`mode-tab ${state.mode === mode ? "mode-tab-active" : ""}`}
                onClick={() => switchMode(mode)}
              >
                {MODE_COPY[mode].title}
              </button>
            ))}
          </div>

          <label className="field">
            <span>邮箱</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={state.email}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  email: event.target.value,
                }))
              }
            />
          </label>

          {state.mode !== "reset" ? (
            <label className="field">
              <span>密码</span>
              <input
                type="password"
                name="password"
                autoComplete={
                  state.mode === "signin" ? "current-password" : "new-password"
                }
                placeholder="至少 8 位"
                value={state.password}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    password: event.target.value,
                  }))
                }
              />
            </label>
          ) : null}

          {state.error ? (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          ) : null}

          {state.notice ? (
            <p className="form-notice" role="status">
              {state.notice}
            </p>
          ) : null}

          <button
            type="submit"
            className="button button-primary"
            disabled={state.loading}
          >
            {state.mode === "signin" ? (
              <LogIn size={16} aria-hidden="true" />
            ) : null}
            {state.mode === "signup" ? (
              <UserPlus size={16} aria-hidden="true" />
            ) : null}
            {state.mode === "reset" ? (
              <Mail size={16} aria-hidden="true" />
            ) : null}
            {state.loading ? "处理中…" : MODE_COPY[state.mode].submit}
          </button>
        </form>
      )}
    </section>
  );
}
