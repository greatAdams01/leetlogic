"use client";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { ChangeComparison } from "./order-history-ui";
import { orderCommandChanges } from "./order-command-review";
import type { AdminOrderCommand, AdminOrderRecord } from "./order-types";
import type { OrderRecordWorkflow } from "./use-order-record";

const ActionContext = createContext<{ active: string | null; choose: Dispatch<SetStateAction<string | null>>; target: HTMLDivElement | null } | null>(null);

export function OrderActionWorkspace({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [active, choose] = useState<string | null>(null);
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  if (!enabled) return <section className="live-card"><h2>No actions available</h2><p className="finance-muted">You can review the record and Activity History. Changes require management permission and an eligible order or delivery.</p></section>;
  return <ActionContext.Provider value={{ active, choose, target }}>
    <div className="operations-action-workspace">
      <div className="operations-action-menu" aria-label="Available actions">{children}</div>
      <div className="live-card operations-action-editor" ref={setTarget}>
        {!active && <div className="operations-action-empty"><h2>What needs to happen?</h2><p>Choose an action to work here. You’ll review the changes before saving.</p></div>}
      </div>
    </div>
  </ActionContext.Provider>;
}

/** Confirm actions in the record, using the portal's existing form and security styles. */
export function OrderActionForm({ label, description, command, workflow, children, payload, sensitive = false, reason = true, danger = false, inline = false, blocked = false, onDraftChange, onSaved }: {
  label: string; description: string; command: AdminOrderCommand; workflow: OrderRecordWorkflow; children?: ReactNode;
  payload: (form: FormData, baseline: AdminOrderRecord) => Record<string, unknown>; sensitive?: boolean; reason?: boolean; danger?: boolean;
  inline?: boolean; blocked?: boolean; onDraftChange?: () => void; onSaved?: () => void;
}) {
  const [code, setCode] = useState("");
  const [baseline, setBaseline] = useState(workflow.record!);
  const [review, setReview] = useState<Record<string, unknown> | null>(null), [error, setError] = useState("");
  const actionId = useId();
  const workspace = useContext(ActionContext);
  const [opened, setOpened] = useState(false);
  const selected = workspace ? workspace.active === actionId : opened;
  const choose = workspace?.choose;
  useEffect(() => () => { choose?.(previous => previous === actionId ? null : previous); }, [choose, actionId]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (selected) {
      heading.current?.focus({ preventScroll: true });
      if (window.innerWidth < 800) heading.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }
  }, [selected]);
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
        workspace?.choose(null); setOpened(false);
        formRef.current?.reset(); mutation.current = null; drafted.current = false; setReview(null); setError(""); onSaved?.();
      }
    }}>
      <p className="finance-muted">{description}</p>
      {stale && <p className="finance-callout danger" role="status">This record changed while you were editing. Your draft is retained. Compare it with the latest values and review again; nothing has been overwritten.</p>}
      {error && <p className="live-error" role="alert">{error}</p>}
      <fieldset className="operations-form-fields" hidden={command === "resolve" && !!review} disabled={workflow.disabled || blocked || !!review}>
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
  function open() {
    if (!drafted.current && workflow.record) {
      setBaseline(workflow.record); formRef.current?.reset(); setReview(null); setError("");
    }
    if (workspace) workspace.choose(actionId); else setOpened(!opened);
  }
  const editor = <div id={`${actionId}-editor`} hidden={!selected} className="operations-selected-action">
    <h2 ref={heading} tabIndex={-1}>{label}</h2>{form}
  </div>;
  if (workspace) return <>
    <button type="button" className={`operations-action-choice ${selected ? "selected" : ""}`} disabled={workflow.pending || blocked} aria-pressed={selected} aria-controls={`${actionId}-editor`} onClick={open}>{label}<span aria-hidden="true">→</span></button>
    {workspace.target && createPortal(editor, workspace.target)}
  </>;
  return inline ? <div className="operations-action-form">{form}</div> : <div className="operations-action-form">
    <button type="button" className="secondary" aria-expanded={opened} aria-controls={`${actionId}-editor`} onClick={open}>{label}</button>{editor}
  </div>;
}
