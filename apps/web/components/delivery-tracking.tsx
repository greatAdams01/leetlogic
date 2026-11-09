"use client";
import type { DeliveryVisibility } from "../../../packages/contracts/src/delivery-visibility";
import { deliveryEventSource, deliveryStatusCopy } from "../../../packages/contracts/src/delivery-visibility";
import { useLanguage } from "./language-provider";
import { ui } from "../../mobile/src/lib/localization";

export function DeliveryTracking({ tracking, staff = false, showGuidance = true, openTimeline = false, hideTimeline = false }: {
  tracking: DeliveryVisibility | null | undefined;
  staff?: boolean;
  showGuidance?: boolean;
  openTimeline?: boolean;
  hideTimeline?: boolean;
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
            {step.providerTime && <small>{say("Provider time")}: {step.occurredAt ? date(step.occurredAt) : `${step.providerTime} (${say("Time zone not supplied")})`}</small>}
            {step.recordedAt && <small>{say("Recorded at")}: {date(step.recordedAt)}</small>}
          </li>
        ))}
      </ol>
      <p className="delivery-tracking-meta">{say("Last courier check")}: {tracking.lastSyncedAt ? date(tracking.lastSyncedAt) : say("No courier update received yet.")}</p>
      {tracking.receiptConfirmedAt && <p className="delivery-tracking-meta">{say(tracking.receiptSource === "legacy-staff" ? "Legacy staff confirmation" : "Buyer confirmed receipt")}: {date(tracking.receiptConfirmedAt)}</p>}
      {tracking.packageCount > 1 && <p>{say("{number} of {total} packages delivered", { number: tracking.deliveredPackages, total: tracking.packageCount })}</p>}
      {tracking.warnings.map(warning => <aside key={warning.code} className="delivery-warning" role="status">
        <strong>{say(warning.title)}</strong><p>{say(warning.body)}</p>
      </aside>)}
      <div className="delivery-assignments">
        {tracking.assignments.map((assignment, index) => (
          <article key={`${assignment.providerShipmentId || "pending"}:${index}`}>
            {tracking.packageCount > 1 && <h3>{say("Parcel {number}", { number: (assignment.parcelIndex ?? index) + 1 })} · {say(deliveryStatusCopy(assignment.status).label)}</h3>}
            <p><strong>{say("Courier")}</strong>: {assignment.courier.name || "—"}{tracking.provider ? ` · ${say(tracking.provider)}` : ""}</p>
            {assignment.courier.phone && <p>{assignment.courier.phone}</p>}
            <p><strong>{say("Rider")}</strong>: {assignment.rider
              ? [assignment.rider.name, assignment.rider.phone].filter(Boolean).join(" · ")
              : say(tracking.provider === "Shipbubble" ? "Rider details not supplied by the provider." : "Rider details not recorded.")}</p>
            {assignment.reportedAt && <small>{say("Contact details last reported")}: {date(assignment.reportedAt)}</small>}
            {staff && !hideTimeline && assignment.providerShipmentId && <p className="delivery-reference">{assignment.providerShipmentId}</p>}
            {assignment.trackingRef && <p className="delivery-reference">{say("Tracking reference")}: {assignment.trackingRef}</p>}
            {assignment.trackingUrl && <a href={assignment.trackingUrl} target="_blank" rel="noopener noreferrer">{say("Open provider tracking")}</a>}
          </article>
        ))}
      </div>
      {!hideTimeline && <details open={openTimeline || undefined}>
        <summary>{say("Delivery timeline")}</summary>
        {tracking.timeline.length ? <ol className="delivery-timeline">
          {tracking.timeline.map(event => (
            <li key={event.id}>
              <strong>{say(event.label)}</strong>
              {event.parcelIndex !== null && <span> · {say("Parcel {number}", { number: event.parcelIndex + 1 })}</span>}
              <p className="delivery-tracking-meta">{say(deliveryEventSource(event.source))}</p>
              {event.providerTime && <p>{say("Provider time")}: {event.occurredAt ? date(event.occurredAt) : `${event.providerTime} (${say("Time zone not supplied")})`}</p>}
              <small>{say("Recorded at")}: {date(event.recordedAt)}</small>
              {event.status === "PROVIDER_UPDATE" && event.providerStatus && <p>{event.providerStatus}</p>}
              {staff && event.providerShipmentId && <small className="delivery-reference">{event.providerShipmentId}</small>}
            </li>
          ))}
        </ol> : <p>{say("No delivery updates yet.")}</p>}
      </details>}
    </section>
  );
}
