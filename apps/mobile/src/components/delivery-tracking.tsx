import React, { useState } from "react";
import { Linking, View } from "react-native";
import type { DeliveryVisibility } from "../../../../packages/contracts/src/delivery-visibility";
import { deliveryEventSource, deliveryStatusCopy, safeTrackingUrl } from "../../../../packages/contracts/src/delivery-visibility";
import { useApp } from "../state";
import { Button, Card, Heading, Label, Notice, colors } from "./ui";

export function DeliveryTracking({ tracking, showGuidance = true }: { tracking: DeliveryVisibility | null | undefined; showGuidance?: boolean }) {
  const a = useApp(), [timeline, setTimeline] = useState(false), [error, setError] = useState("");
  if (!tracking) return null;
  const date = (value: string | null) => value ? a.date(value) : "—";
  return <Card>
    <Heading>Delivery progress</Heading>
    <Label style={{ fontWeight: "700", color: colors.green }}>{a.ui(tracking.label)}</Label>
    {showGuidance && <Label>{a.ui(tracking.body)}</Label>}
    <Label muted>Status updates, not live rider tracking.</Label>
    <View style={{ gap: 12 }} accessibilityLabel={a.ui("Delivery progress")}>
      {tracking.milestones.map(step => <View key={step.status} style={{ borderLeftWidth: 4, borderLeftColor: step.reported ? colors.green : colors.line, paddingLeft: 12, gap: 4 }}>
        <Label>{a.ui(step.label)}</Label>
        <Label muted>{a.ui(step.reported ? "Reported" : "Not reported yet")}</Label>
        {step.providerTime && <Label muted>{a.ui("Provider time")}: {step.occurredAt ? date(step.occurredAt) : `${step.providerTime} (${a.ui("Time zone not supplied")})`}</Label>}
        {step.recordedAt && <Label muted>{a.ui("Recorded at")}: {date(step.recordedAt)}</Label>}
      </View>)}
    </View>
    <Label muted>{a.ui("Last courier check")}: {tracking.lastSyncedAt ? date(tracking.lastSyncedAt) : a.ui("No courier update received yet.")}</Label>
    {tracking.receiptConfirmedAt && <Label muted>{a.ui(tracking.receiptSource === "legacy-staff" ? "Legacy staff confirmation" : "Buyer confirmed receipt")}: {date(tracking.receiptConfirmedAt)}</Label>}
    {tracking.packageCount > 1 && <Label>{a.ui("{number} of {total} packages delivered", { number: tracking.deliveredPackages, total: tracking.packageCount })}</Label>}
    {tracking.warnings.map(warning => <View key={warning.code} style={{ gap: 4 }}>
      <Label style={{ fontWeight: "700" }}>{a.ui(warning.title)}</Label><Notice text={a.ui(warning.body)} />
    </View>)}
    {tracking.assignments.map((assignment, index) => <View key={`${assignment.providerShipmentId || "pending"}:${index}`} style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderColor: colors.line }}>
      {tracking.packageCount > 1 && <Label>{a.ui("Parcel {number}", { number: (assignment.parcelIndex ?? index) + 1 })} · {a.ui(deliveryStatusCopy(assignment.status).label)}</Label>}
      <Label>{a.ui("Courier")}: {assignment.courier.name || "—"}{tracking.provider ? ` · ${a.ui(tracking.provider)}` : ""}</Label>
      {assignment.courier.phone && <Label>{assignment.courier.phone}</Label>}
      <Label>{a.ui("Rider")}: {assignment.rider ? [assignment.rider.name, assignment.rider.phone].filter(Boolean).join(" · ") : a.ui(tracking.provider === "Shipbubble" ? "Rider details not supplied by the provider." : "Rider details not recorded.")}</Label>
      {assignment.reportedAt && <Label muted>{a.ui("Contact details last reported")}: {date(assignment.reportedAt)}</Label>}
      {assignment.trackingRef && <Label>{a.ui("Tracking reference")}: {assignment.trackingRef}</Label>}
      {assignment.trackingUrl && safeTrackingUrl(assignment.trackingUrl) && <Button title="Open provider tracking" secondary onPress={() => {
        void Linking.openURL(assignment.trackingUrl!).catch(() => setError(a.ui("Unable to open link")));
      }} />}
    </View>)}
    {error && <Notice text={error} error />}
    <Button title="Delivery timeline" secondary onPress={() => setTimeline(!timeline)} />
    {timeline && (tracking.timeline.length ? tracking.timeline.map(event => <View key={event.id} style={{ borderLeftWidth: 2, borderColor: colors.line, paddingLeft: 12, gap: 4 }}>
      <Label>{a.ui(event.label)}{event.parcelIndex !== null ? ` · ${a.ui("Parcel {number}", { number: event.parcelIndex + 1 })}` : ""}</Label>
      <Label muted>{a.ui(deliveryEventSource(event.source))}</Label>
      {event.providerTime && <Label muted>{a.ui("Provider time")}: {event.occurredAt ? date(event.occurredAt) : `${event.providerTime} (${a.ui("Time zone not supplied")})`}</Label>}
      <Label muted>{a.ui("Recorded at")}: {date(event.recordedAt)}</Label>
      {event.status === "PROVIDER_UPDATE" && event.providerStatus && <Label>{event.providerStatus}</Label>}
    </View>) : <Label>No delivery updates yet.</Label>)}
  </Card>;
}
