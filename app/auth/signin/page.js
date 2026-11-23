"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthHero } from "@/app/components/AuthHero";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .auth-page {
          min-height: 100vh;
          display: flex;
          width: 100%;
          background: #ffffff;
          font-family: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* LEFT HERO PANEL */
        .hero-section {
          flex: 1.35;
          background: linear-gradient(145deg, #07172f 0%, #0c274c 50%, #081a34 100%);
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem 2rem;
          color: #ffffff;
        }

        .bg-grid-pattern {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px);
          background-size: 24px 24px;
          pointer-events: none;
          opacity: 0.75;
        }

        .bg-circle {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .bg-circle-1 {
          width: 480px;
          height: 480px;
          top: -120px;
          left: -120px;
          background: radial-gradient(circle, rgba(29, 78, 216, 0.25) 0%, rgba(7, 23, 47, 0) 70%);
        }

        .bg-circle-2 {
          width: 360px;
          height: 360px;
          top: 40%;
          right: -80px;
          background: radial-gradient(circle, rgba(30, 64, 175, 0.25) 0%, rgba(7, 23, 47, 0) 70%);
        }

        .bg-circle-3 {
          width: 500px;
          height: 500px;
          bottom: -150px;
          left: 20%;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.2) 0%, rgba(7, 23, 47, 0) 70%);
        }

        .hero-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 420px;
          width: 100%;
          text-align: center;
        }

        .service-subtitle {
          margin-top: 1rem;
          margin-bottom: 2.25rem;
          font-size: 0.8125rem;
          font-weight: 500;
          letter-spacing: 0.04em;
          color: #94a3b8;
        }

        .feature-cards {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          width: 100%;
          margin-bottom: 2.25rem;
        }

        .feature-card {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 0.75rem 1.125rem;
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          font-size: 0.84rem;
          font-weight: 500;
          color: #e2e8f0;
          text-align: left;
          transition: transform 0.2s ease, background 0.2s ease;
        }

        .feature-card:hover {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.09);
        }

        .feature-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(29, 78, 216, 0.35);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          flex-shrink: 0;
        }

        .tag-pills {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
        }

        .tag-pill {
          padding: 0.25rem 0.875rem;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.04em;
        }

        /* RIGHT FORM PANEL */
        .form-section {
          flex: 1;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2.5rem 3.5rem;
          min-width: 400px;
        }

        .form-wrapper {
          margin: auto 0;
          width: 100%;
          max-width: 380px;
          align-self: center;
        }

        .form-header h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.025em;
          margin-bottom: 0.375rem;
        }

        .form-header p {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 2rem;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.125rem;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .input-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #334155;
        }

        .input-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon-left {
          position: absolute;
          left: 0.875rem;
          color: #94a3b8;
          pointer-events: none;
          display: flex;
          align-items: center;
        }

        .input-field {
          width: 100%;
          height: 2.75rem;
          padding: 0 0.875rem 0 2.625rem;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.875rem;
          font-family: inherit;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }

        .input-field-password {
          padding-right: 2.625rem;
        }

        .input-field::placeholder {
          color: #94a3b8;
        }

        .input-field:focus {
          background: #ffffff;
          border-color: #1d4ed8;
          box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.12);
        }

        .input-toggle-password {
          position: absolute;
          right: 0.75rem;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s ease;
        }

        .input-toggle-password:hover {
          color: #475569;
        }

        .error-banner {
          padding: 0.625rem 0.875rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 0.8125rem;
        }

        .submit-btn {
          height: 2.75rem;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          color: #ffffff;
          font-size: 0.9375rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
          box-shadow: 0 4px 12px rgba(29, 78, 216, 0.25);
          margin-top: 0.25rem;
        }

        .submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          box-shadow: 0 6px 16px rgba(29, 78, 216, 0.35);
        }

        .submit-btn:active:not(:disabled) {
          transform: scale(0.99);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .or-divider {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 0.25rem 0;
        }

        .divider-line {
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }

        .divider-text {
          font-size: 0.75rem;
          color: #94a3b8;
          text-transform: lowercase;
        }

        .google-btn {
          height: 2.625rem;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #334155;
          font-size: 0.875rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .google-btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        .trouble-text {
          margin-top: 1.25rem;
          text-align: center;
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .switch-account-text {
          margin-top: 0.875rem;
          text-align: center;
          font-size: 0.8125rem;
          color: #64748b;
        }

        .switch-account-link {
          color: #1d4ed8;
          font-weight: 600;
          text-decoration: none;
          margin-left: 0.25rem;
        }

        .switch-account-link:hover {
          text-decoration: underline;
        }

        .form-footer {
          margin-top: 2rem;
          text-align: center;
          font-size: 0.75rem;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
        }

        .form-footer strong {
          color: #475569;
          font-weight: 600;
        }

        /* RESPONSIVE DESIGN */
        @media (max-width: 900px) {
          .auth-page {
            flex-direction: column;
          }
          .hero-section {
            padding: 2.5rem 1.5rem;
            flex: none;
          }
          .form-section {
            padding: 2.5rem 1.5rem;
            min-width: unset;
          }
        }
      `}</style>

      <div className="auth-page">
        <AuthHero />

        <div className="form-section">
          <div className="form-wrapper">
            <div className="form-header">
              <h1>Welcome back</h1>
              <p>Sign in to your V-Systems account</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label" htmlFor="email">
                  Email Address
                </label>
                <div className="input-container">
                  <span className="input-icon-left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M22 6l-10 7L2 6" />
                    </svg>
                  </span>
                  <input
                    id="email"
                    className="input-field"
                    type="email"
                    autoComplete="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="password">
                  Password
                </label>
                <div className="input-container">
                  <span className="input-icon-left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    className="input-field input-field-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="input-toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && <div className="error-banner" role="alert">{error}</div>}

              <button
                id="signin-btn"
                className="submit-btn"
                type="submit"
                disabled={loading}
              >
                <span>{loading ? "Signing in…" : "Sign In"}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </button>

              <div className="or-divider">
                <span className="divider-line" />
                <span className="divider-text">or</span>
                <span className="divider-line" />
              </div>

              <button
                id="google-signin-btn"
                type="button"
                className="google-btn"
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </form>

            <p className="trouble-text">
              Having trouble signing in? Contact your system administrator.
            </p>

            <p className="switch-account-text">
              Don&apos;t have an account?
              <Link id="register-redirect-link" href="/auth/register" className="switch-account-link">
                Sign up
              </Link>
            </p>
          </div>

          <footer className="form-footer">
            <span>Powered by</span>
            <strong>Vidyalankar IT Systems</strong>
            <span>|</span>
            <span>IT Infrastructure Platform</span>
          </footer>
        </div>
      </div>
    </>
  );
}
