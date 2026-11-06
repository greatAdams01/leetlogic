"use client";
import { useEffect } from "react";
export type PageErrorProps = { error: Error & { digest?: string }; retry: () => void };
export function PageError({ error, retry, staff = false }: PageErrorProps & { staff?: boolean }) {
  useEffect(() => {
    console.error("Page rendering failed", error);
  }, [error]);
  return (
    <section
      role="alert"
      aria-labelledby="page-error-heading"
      style={{
        maxWidth: 560,
        margin: "48px auto",
        padding: 24,
        color: "#1c1c1c",
        background: "#faf7f0",
        border: "1px solid #e2ddd5",
        borderRadius: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 id="page-error-heading" style={{ fontSize: 26, margin: "0 0 12px" }}>
        We couldn’t open this page
      </h1>
      <p style={{ lineHeight: 1.6 }}>
        Please try again. If the problem continues, contact support.
      </p>
      <button
        type="button"
        onClick={retry}
        style={{
          minHeight: 48,
          padding: "12px 20px",
          border: 0,
          borderRadius: 12,
          background: "#14532d",
          color: "white",
          font: "inherit",
          fontWeight: 700,
        }}
      >
        Try again
      </button>
      <p>
        <a
          href={staff ? "/admin" : "/account"}
          style={{ color: "#14532d", display: "inline-flex", minHeight: 44, alignItems: "center" }}
        >
          {staff ? "Back to staff workspace" : "Go to your account"}
        </a>
      </p>
    </section>
  );
}
