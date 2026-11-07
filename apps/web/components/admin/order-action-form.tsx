"use client";
import { useRef, useState, type ReactNode } from "react";
import type { AdminOrderCommand } from "./order-types";
import type { OrderRecordWorkflow } from "./use-order-record";

/** Confirm actions in the record, using the portal's existing form and security styles. */
export function OrderActionForm({ label, description, command, workflow, children, payload, sensitive = false, reason = false, danger = false }: {
  label: string; description: string; command: AdminOrderCommand; workflow: OrderRecordWorkflow; children?: ReactNode;
  payload: (form: FormData) => Record<string, unknown>; sensitive?: boolean; reason?: boolean; danger?: boolean;
}) {
  const [code, setCode] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  const mutation = useRef<{ fingerprint: string; key: string }>(null);
  return <details className="operations-action-form" ref={details}>
    <summary>{label}</summary>
    <form aria-label={label} onSubmit={async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const body = { ...payload(data), ...(reason ? { reason: String(data.get("reason") || "").trim() } : {}) };
      if (command === "escrow") {
        const fingerprint = JSON.stringify(body);
        if (mutation.current?.fingerprint !== fingerprint) mutation.current = { fingerprint, key: crypto.randomUUID() };
        Object.assign(body, { mutationKey: mutation.current.key });
      }
      const saved = await workflow.execute(command, body, code);
      setCode("");
      if (saved) { if (details.current) details.current.open = false; form.reset(); mutation.current = null; }
    }}>
      <p className="finance-muted">{description}</p>
      <fieldset className="operations-form-fields" disabled={workflow.disabled}>
        {children}
        {reason && <label>Reason for action<textarea name="reason" minLength={10} maxLength={500} required /></label>}
        {sensitive && <label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} maxLength={6} pattern="[0-9]{6}" required /></label>}
        <button className={danger ? "finance-danger-button" : undefined} disabled={workflow.disabled || (sensitive && code.length !== 6)}>{workflow.pending ? "Saving…" : label}</button>
      </fieldset>
    </form>
  </details>;
}
