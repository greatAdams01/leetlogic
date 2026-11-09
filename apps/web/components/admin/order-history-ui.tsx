"use client";
import type { HistoryChange } from "../../../../packages/contracts/src/admin-order-history";
import { formatMoney } from "../../../../packages/contracts/src/money";
import { financeLabel } from "./finance-ui";
import { orderStatusLabel } from "./order-ui";

export function historyValue(value: unknown, field = ""): string {
  if (value == null) return "Not recorded";
  if (value === "") return "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (/Minor$/.test(field) && /^-?\d+$/.test(String(value))) return formatMoney(String(value));
  if (/parcelIndex$/.test(field) && typeof value === "number") return String(value + 1);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))) return historyDate(value);
  if (typeof value === "string" && /^status$|\.status$/.test(field)) return ["AWAITING_PAYMENT", "FUNDED", "COMPLETED", "REFUNDED"].includes(value) ? orderStatusLabel(value) : financeLabel(value);
  if (typeof value === "string" && /^[A-Z]+(?:_[A-Z]+)+$/.test(value)) return financeLabel(value);
  if (Array.isArray(value)) return value.length ? value.map(item => historyValue(item)).join(", ") : "None";
  if (typeof value === "object") return Object.entries(value).map(([key, item]) => `${financeLabel(key)}: ${historyValue(item)}`).join(" · ");
  return String(value);
}
export const historyDate = (value: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(value));

export function ChangeComparison({ changes, label = "Original and updated values" }: { changes: HistoryChange[]; label?: string }) {
  return <div className="operations-change-list" role="table" aria-label={label}>
    <div className="operations-change-head" role="row"><span role="columnheader">Field</span><span role="columnheader">Original</span><span role="columnheader">Updated</span></div>
    {changes.map(change => <div className="operations-change-row" role="row" key={change.field}>
      <strong role="cell">{change.label}</strong><span role="cell" data-label="Original">{historyValue(change.before, change.field)}</span><span role="cell" data-label="Updated">{historyValue(change.after, change.field)}</span>
    </div>)}
  </div>;
}
