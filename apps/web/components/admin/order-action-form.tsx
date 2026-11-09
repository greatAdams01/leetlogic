"use client";
import { useRef, useState, type ReactNode } from "react";
import { ChangeComparison } from "./order-history-ui";
import { orderCommandChanges } from "./order-command-review";
import type { AdminOrderCommand, AdminOrderRecord } from "./order-types";
import type { OrderRecordWorkflow } from "./use-order-record";

/** Confirm actions in the record, using the portal's existing form and security styles. */
export function OrderActionForm({ label, description, command, workflow, children, payload, sensitive = false, reason = true, danger = false, inline = false, blocked = false, onDraftChange }: {
  label: string; description: string; command: AdminOrderCommand; workflow: OrderRecordWorkflow; children?: ReactNode;
  payload: (form: FormData, baseline: AdminOrderRecord) => Record<string, unknown>; sensitive?: boolean; reason?: boolean; danger?: boolean;
  inline?: boolean; blocked?: boolean; onDraftChange?: () => void;
}) {
  const [code, setCode] = useState("");
  const [baseline, setBaseline] = useState(workflow.record!);
  const [review, setReview] = useState<Record<string, unknown> | null>(null), [error, setError] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  const formRef = useRef<HTMLFormElement>(null), drafted = useRef(false);
  const draftData = useRef<FormData | null>(null);
  const mutation = useRef<{ fingerprint: string; key: string }>(null);
  const stale = baseline.staffContext.revision !== workflow.record?.staffContext.revision;
  function prepare(current = baseline) {
    if (!formRef.current || !formRef.current.reportValidity()) return;
    const data = review && draftData.current ? draftData.current : new FormData(formRef.current);
    draftData.current = data;
    const body = { ...payload(data, current), ...(reason ? { reason: String(data.get("reason") || "").trim() } : {}) };
    if (reason && (String(body.reason).length < 10 || String(body.reason).length > 500)) { setError("Enter a reason of 10–500 characters."); return; }
    if (["correct-order", "correct-delivery"].includes(command) && !orderCommandChanges(command, body, current).length) {
      setError("No information has changed. Your draft has been kept."); return;
    }
    const envelope = { ...body, ...(command === "escrow" ? {} : { expectedRevision: current.staffContext.revision }) };
    const fingerprint = JSON.stringify(envelope);
    if (mutation.current?.fingerprint !== fingerprint) mutation.current = { fingerprint, key: crypto.randomUUID() };
    setReview({ ...envelope, mutationKey: mutation.current.key }); setError(""); drafted.current = true;
  }
  const form = <form ref={formRef} aria-label={label} onChange={event => {
    if (event.target instanceof HTMLElement && event.target.getAttribute("name") === "code") return;
    drafted.current = true; setReview(null); setError(""); onDraftChange?.();
  }} onSubmit={async event => {
      event.preventDefault();
      if (workflow.disabled || blocked) return;
      if (!review) { prepare(); return; }
      if (stale) { setError("This record changed. Re-review against the latest record before saving."); return; }
      const saved = await workflow.execute(command, review, code);
      setCode("");
      if (saved) {
        if (details.current) details.current.open = false;
        formRef.current?.reset(); mutation.current = null; drafted.current = false; setReview(null); setError("");
      }
    }}>
      <p className="finance-muted">{description}</p>
      {stale && <p className="finance-callout danger" role="status">This record changed while you were editing. Your draft is retained. Compare it with the latest values and review again; nothing has been overwritten.</p>}
      {error && <p className="live-error" role="alert">{error}</p>}
      <fieldset className="operations-form-fields" disabled={workflow.disabled || blocked || !!review}>
        {children}
        {reason && <label>Reason for action<textarea name="reason" minLength={10} maxLength={500} required /></label>}
      </fieldset>
      {review && <div className="operations-change-review" aria-label="Review proposed changes">
        <h3>Review proposed changes</h3>
        <ChangeComparison changes={orderCommandChanges(command, review, baseline)} label="Proposed changes" />
        <p className="verification-prose">Reason: {String(review.reason)}</p>
        {command === "correct-delivery" && !!(review.changes as Record<string, unknown>)?.destination && baseline.staffContext.corrections.destinationRequiresNewQuote && <p className="finance-callout">This retires the old courier quote and clears its fee. Get and select a new quote before checkout.</p>}
        <p className="finance-muted">Only this reviewed request will be sent. Existing payment, receipt and courier checks still apply.</p>
        {sensitive && <label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" disabled={workflow.disabled || blocked || stale} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} maxLength={6} pattern="[0-9]{6}" required /></label>}
      </div>}
      <div className="live-actions">
        {stale ? <button type="button" className="secondary" disabled={workflow.disabled || blocked} onClick={() => {
          if (workflow.record) { setBaseline(workflow.record); setReview(null); setCode(""); prepare(workflow.record); }
        }}>Re-review latest record</button> : <button className={danger && review ? "finance-danger-button" : undefined} disabled={workflow.disabled || blocked || (!!review && sensitive && code.length !== 6)}>{workflow.pending ? "Saving…" : review ? "Confirm and save" : "Review changes"}</button>}
        {review && <button type="button" className="secondary" disabled={workflow.disabled} onClick={() => { setReview(null); setCode(""); }}>Edit draft</button>}
      </div>
    </form>;
  return inline ? <div className="operations-action-form">{form}</div> : <details className="operations-action-form" ref={details}>
    <summary onClick={() => {
      if (!details.current?.open && !drafted.current && workflow.record) {
        setBaseline(workflow.record); formRef.current?.reset(); setReview(null); setError("");
      }
    }}>{label}</summary>{form}
  </details>;
}
