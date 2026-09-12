"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(
        result.error === "CredentialsSignin"
          ? "Invalid email or password."
          : result.error
      );
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fafafa;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .card {
          width: 100%;
          max-width: 360px;
          padding: 2.5rem 2rem;
          margin: 1rem;
        }

        .wordmark {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #111;
          letter-spacing: -0.01em;
          margin-bottom: 2.5rem;
        }

        h1 {
          font-size: 1.375rem;
          font-weight: 600;
          color: #111;
          letter-spacing: -0.02em;
          margin-bottom: 0.375rem;
        }

        .sub {
          font-size: 0.875rem;
          color: #888;
          margin-bottom: 2rem;
        }

        .form { display: flex; flex-direction: column; gap: 1rem; }

        .field { display: flex; flex-direction: column; gap: 0.375rem; }

        label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #444;
        }

        input {
          width: 100%;
          height: 2.375rem;
          padding: 0 0.75rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 0.875rem;
          font-family: inherit;
          color: #111;
          background: #fff;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        input::placeholder { color: #bbb; }

        input:focus {
          border-color: #111;
          box-shadow: 0 0 0 2px rgba(17, 17, 17, 0.08);
        }

        .error-msg {
          font-size: 0.8125rem;
          color: #c0392b;
          padding: 0.5rem 0.625rem;
          background: #fdf3f2;
          border: 1px solid #f5c6c2;
          border-radius: 6px;
        }

        .btn-primary {
          height: 2.375rem;
          border: none;
          border-radius: 6px;
          background: #111;
          color: #fff;
          font-size: 0.875rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          margin-top: 0.25rem;
        }

        .btn-primary:hover:not(:disabled) { background: #333; }
        .btn-primary:active:not(:disabled) { transform: scale(0.99); }
        .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

        .divider {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 0.25rem 0;
        }

        .divider-line { flex: 1; height: 1px; background: #e5e5e5; }
        .divider-text { font-size: 0.75rem; color: #aaa; }

        .btn-google {
          height: 2.375rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: #fff;
          color: #333;
          font-size: 0.875rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
        }

        .btn-google:hover {
          background: #f8f8f8;
          border-color: #ccc;
        }

        .btn-google:active { transform: scale(0.99); }

        .google-icon { width: 16px; height: 16px; flex-shrink: 0; }

        .switch-prompt {
          margin-top: 1.5rem;
          text-align: center;
          font-size: 0.8125rem;
          color: #777;
        }

        .switch-link {
          color: #111;
          font-weight: 500;
          text-decoration: underline;
          text-underline-offset: 2px;
          margin-left: 0.25rem;
          transition: color 0.15s ease;
        }

        .switch-link:hover {
          color: #000;
        }
      `}</style>

      <div className="page">
        <div className="card">
          <p className="wordmark">Access</p>

          <h1>Sign in</h1>
          <p className="sub">Enter your credentials to continue</p>

          <form className="form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="error-msg" role="alert">{error}</p>
            )}

            <button id="signin-btn" className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <div className="divider">
              <span className="divider-line" />
              <span className="divider-text">or</span>
              <span className="divider-line" />
            </div>

            <button
              id="google-signin-btn"
              type="button"
              className="btn-google"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <p className="switch-prompt">
            Don&apos;t have an account?{" "}
            <Link id="register-redirect-link" href="/auth/register" className="switch-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

