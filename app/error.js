"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("Application error caught by boundary:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f7",
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: "2rem",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "2.5rem",
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 10px 40px rgba(0,0,0,0.06)",
          border: "1px solid #e5e7eb",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h2
          style={{
            fontSize: "1.35rem",
            fontWeight: 700,
            color: "#111",
            marginBottom: "0.5rem",
            letterSpacing: "-0.02em",
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            fontSize: "0.875rem",
            color: "#6b7280",
            marginBottom: "1.5rem",
            lineHeight: 1.5,
          }}
        >
          An unexpected error occurred while processing your request. Please try
          again or return to the dashboard.
        </p>

        {error?.message && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "0.75rem",
              fontSize: "0.78rem",
              color: "#991b1b",
              textAlign: "left",
              marginBottom: "1.5rem",
              wordBreak: "break-all",
              fontFamily: "monospace",
            }}
          >
            {error.message}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.55rem 1.25rem",
              background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
              color: "#fff",
              borderRadius: 8,
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            style={{
              padding: "0.55rem 1.25rem",
              background: "#fff",
              color: "#4b5563",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
