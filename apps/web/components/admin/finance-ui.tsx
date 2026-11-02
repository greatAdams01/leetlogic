"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
let refreshInFlight: Promise<Response> | undefined;
export async function financeRequest(path: string, body?: unknown, retry = true): Promise<any> {
  const response = await fetch(`/api/admin/${path}`, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status === 401 && retry && !path.startsWith("auth/")) {
    refreshInFlight ||= fetch("/api/admin/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).finally(() => {
      refreshInFlight = undefined;
    });
    const refreshed = await refreshInFlight;
    if (refreshed.ok) return financeRequest(path, body, false);
  }
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "Finance records are unavailable. Please retry.");
  return data;
}
export const financeDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Lagos",
      }).format(new Date(value))
    : "—";
export const financeLabel = (value: string = "") =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
export function FinanceStatus({ value }: { value: string }) {
  const tone = ["SUCCEEDED", "REFUNDED", "SECURED", "VERIFIED", "AUTHORIZED", "COMPLETED"].includes(
    value,
  )
    ? "success"
    : ["BLOCKED", "EXCEPTION", "FAILED", "REFUND_BLOCKED", "UNKNOWN", "REJECTED"].includes(value)
      ? "danger"
      : ["REQUESTED", "REFUND_DUE", "REFUND_RECONCILIATION", "TRANSFER_RECORDED"].includes(value)
        ? "warning"
        : "neutral";
  return <span className={`finance-badge ${tone}`}>{financeLabel(value)}</span>;
}
export function FinanceDrawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="finance-drawer"
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <header>
        <div>
          <p className="finance-eyebrow">FINANCIAL RECORD</p>
          <h2 id={id}>{title}</h2>
        </div>
        <button type="button" className="secondary" aria-label="Close review" onClick={onClose}>
          Close ×
        </button>
      </header>
      <div className="finance-drawer-content">{children}</div>
    </dialog>
  );
}
export function FinanceEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="finance-empty">
      <strong>No records to show</strong>
      <p>{children}</p>
    </div>
  );
}
export function useFinanceMutation(refresh: () => Promise<void>) {
  const [code, setCode] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  const action = async (path: string, body: any, step = true) => {
    if (lock.current) throw Error("An action is already in progress.");
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (step) {
        await financeRequest("auth/totp/step-up", { code });
        setCode("");
      }
      await financeRequest(`money/${path}`, body);
      setNotice("Action recorded. Updated records are shown below.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return {
    code,
    setCode,
    reason,
    setReason,
    busy,
    error,
    notice,
    action,
    ready: !busy && code.length === 6 && reason.trim().length >= 10,
  };
}
export function FinanceSecurity({ mutation }: { mutation: ReturnType<typeof useFinanceMutation> }) {
  return (
    <fieldset className="finance-security">
      <legend>Authorize a financial action</legend>
      <p>Enter a reason and a fresh authenticator code. Every action is audited.</p>
      <label>
        Reason for action
        <textarea
          maxLength={500}
          minLength={10}
          value={mutation.reason}
          onChange={(e) => mutation.setReason(e.target.value)}
        />
      </label>
      <label>
        Authenticator code
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={mutation.code}
          onChange={(e) => mutation.setCode(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      {mutation.error && (
        <p role="alert" className="live-error">
          {mutation.error}
        </p>
      )}
      {mutation.notice && <p role="status">{mutation.notice}</p>}
    </fieldset>
  );
}
