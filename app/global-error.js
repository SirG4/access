"use client";

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#f5f5f7",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "2.5rem",
            maxWidth: 460,
            width: "90%",
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ fontSize: "1.4rem", color: "#111", marginBottom: "0.5rem" }}>
            Critical Error
          </h2>
          <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            A critical application error occurred.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.6rem 1.25rem",
              background: "#111",
              color: "#fff",
              borderRadius: 8,
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
