"use client";
import type { DeliveryVisibility } from "../../../packages/contracts/src/delivery-visibility";
import { deliveryStatusCopy } from "../../../packages/contracts/src/delivery-visibility";
import { useLanguage } from "./language-provider";
import { ui } from "../../mobile/src/lib/localization";

export function DeliveryTracking({ tracking, staff = false, showGuidance = true, openTimeline = false }: {
  tracking: DeliveryVisibility | null | undefined;
  staff?: boolean;
  showGuidance?: boolean;
  openTimeline?: boolean;
}) {
  const language = useLanguage(), locale = staff ? "en" : language.locale;
  const say = (source: string, params: Record<string, string | number> = {}) => ui(locale, source, params);
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(locale === "pcm" ? "en-NG" : `${locale}-NG`, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos", timeZoneName: "short",
  }).format(new Date(value)) : "—";
  if (!tracking) return null;
  return (
    <section className="delivery-tracking" aria-label={say("Delivery progress")}>
      <div className="delivery-tracking-heading">
        <h2>{say("Delivery progress")}</h2>
        <strong>{say(tracking.label)}</strong>
      </div>
      {showGuidance && <p>{say(tracking.body)}</p>}
      <p className="delivery-tracking-meta">{say("Status updates, not live rider tracking.")}</p>
      <ol className="delivery-milestones" aria-label={say("Delivery progress")}>
        {tracking.milestones.map(step => (
          <li key={step.status} className={step.reported ? "reported" : "pending"}>
            <strong>{say(step.label)}</strong>
            <small>{say(step.reported ? "Reported" : "Not reported yet")}</small>
            {(step.occurredAt || step.recordedAt) && <small>{date(step.occurredAt || step.recordedAt)}</small>}
          </li>
        ))}
      </ol>
      <p className="delivery-tracking-meta">{say("Last courier check")}: {tracking.lastSyncedAt ? date(tracking.lastSyncedAt) : say("No courier update received yet.")}</p>
      {tracking.packageCount > 1 && <p>{say("{number} of {total} packages delivered", { number: tracking.deliveredPackages, total: tracking.packageCount })}</p>}
      {tracking.warnings.map(warning => <aside key={warning.code} className="delivery-warning" role="status">
        <strong>{say(warning.title)}</strong><p>{say(warning.body)}</p>
      </aside>)}
      <div className="delivery-assignments">
        {tracking.assignments.map((assignment, index) => (
          <article key={`${assignment.providerShipmentId || "pending"}:${index}`}>
            {tracking.packageCount > 1 && <h3>{say("Parcel {number}", { number: (assignment.parcelIndex ?? index) + 1 })} · {say(deliveryStatusCopy(assignment.status).label)}</h3>}
            <p><strong>{say("Courier")}</strong>: {assignment.courier.name || "—"}{tracking.provider ? ` · ${tracking.provider}` : ""}</p>
            {assignment.courier.phone && <p>{assignment.courier.phone}</p>}
            <p><strong>{say("Rider")}</strong>: {assignment.rider
              ? [assignment.rider.name, assignment.rider.phone].filter(Boolean).join(" · ")
              : say(tracking.provider === "Shipbubble" ? "Rider details not supplied by the provider." : "Rider details not recorded.")}</p>
            {assignment.reportedAt && <small>{say("Contact details last reported")}: {date(assignment.reportedAt)}</small>}
            {staff && assignment.providerShipmentId && <p className="delivery-reference">{assignment.providerShipmentId}</p>}
            {assignment.trackingUrl && <a href={assignment.trackingUrl} target="_blank" rel="noopener noreferrer">{say("Open provider tracking")}</a>}
          </article>
        ))}
      </div>
      <details open={openTimeline || undefined}>
        <summary>{say("Delivery timeline")}</summary>
        {tracking.timeline.length ? <ol className="delivery-timeline">
          {tracking.timeline.map(event => (
            <li key={event.id}>
              <strong>{say(event.label)}</strong>
              {event.parcelIndex !== null && <span> · {say("Parcel {number}", { number: event.parcelIndex + 1 })}</span>}
              <p className="delivery-tracking-meta">{event.source === "shipbubble" ? "Shipbubble" : say(event.source === "admin" ? "Staff" : event.status.startsWith("FARMER_") || event.status === "READY_FOR_PICKUP" ? "Farmer" : event.status === "BUYER_RECEIPT_CONFIRMED" ? "Buyer" : "LeetLogic")}</p>
              {event.providerTime && <p>{say("Provider time")}: {event.occurredAt ? date(event.occurredAt) : `${event.providerTime} (${say("Time zone not supplied")})`}</p>}
              <small>{say("Recorded at")}: {date(event.recordedAt)}</small>
              {event.status === "PROVIDER_UPDATE" && event.providerStatus && <p>{event.providerStatus}</p>}
              {staff && event.providerShipmentId && <small className="delivery-reference">{event.providerShipmentId}</small>}
            </li>
          ))}
        </ol> : <p>{say("No delivery updates yet.")}</p>}
      </details>
    </section>
  );
}
