import React, { useRef, useState } from "react";
import { useApp, useResource } from "../state";
import { api } from "../lib/api";
import { Button, Card, Heading, Label, Field, Notice, Page } from "./ui";
import { money } from "../lib/domain";
import { recoveryExperience } from "../../../../packages/contracts/src/order-updates";
export function PaymentRecovery({ orderId }: { orderId?: string }) {
  const r = useResource<{ items: any[] }>("/orders/recoveries", true, 15000);
  const items = (r.data?.items || []).filter((i) => !orderId || i.orderId === orderId);
  return (
    <>
      {r.error && <Notice text={r.error} error />}
      {items.slice(0, orderId ? 50 : 3).map((i) => (
        <RecoveryCard key={i.id} item={i} compact={!orderId} refresh={r.reload} />
      ))}
      {orderId && !r.loading && !r.error && !items.length && (
        <Notice text="No recovery action is currently required for this order." />
      )}
    </>
  );
}
function RecoveryCard({
  item: i,
  compact,
  refresh,
}: {
  item: any;
  compact: boolean;
  refresh: () => Promise<unknown>;
}) {
  const a = useApp(),
    experience = recoveryExperience(i),
    running = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [minutes, setMinutes] = useState("60"),
    [notes, setNotes] = useState("");
  const act = async (path: string, body: any) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/orders/recoveries/${i.id}/${path}`, { method: "POST", body });
      setNotice(a.ui("Your response has been saved."));
      await refresh();
    } catch (e) {
      setError(a.error(e));
      await refresh().catch(() => {});
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const confirm = () => {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isInteger(Number(minutes)) ||
      Number(minutes) < 0 ||
      Number(minutes) > 1440
    ) {
      setError(a.ui("Check the pickup date and preparation time."));
      return;
    }
    void act("farmer", { pickupDate: date, preparationMinutes: Number(minutes), notes });
  };
  return (
    <Card>
      <Heading>{a.ui(experience.title)}</Heading>
      <Label style={{ fontFamily: "NotoBold" }}>{i.title}</Label>
      <Label muted>
        {a.ui("Order")}: {String(i.reference).slice(-8).toUpperCase()}
      </Label>
      <Label>{a.ui(experience.body)}</Label>
      {i.deadline?.refundDueAt && !experience.closed && (
        <Label muted>
          {a.ui("Respond before")}: {a.date(i.deadline.refundDueAt)}
        </Label>
      )}
      {compact ? (
        <Button title="Review order issue" secondary onPress={() => a.go("recovery", i.orderId)} />
      ) : (
        <>
          <Label>
            {a.ui("Quantity")}: {i.quantity} {i.unitCode ? a.unit(i.unitCode) : ""}
          </Label>
          {i.packing && (
            <>
              <Label>
                {a.ui("Number of packages")}: {i.packing.packageCount}
              </Label>
              <Label>
                {a.ui("Total packed weight (kg)")}: {i.packing.weightKg}
              </Label>
              {i.packing.notes && <Label>{i.packing.notes}</Label>}
            </>
          )}
          {i.isBuyer && i.payment?.amountMinor && (
            <Label>
              {a.ui("Payment confirmed")}: {money(i.payment.amountMinor)}
            </Label>
          )}
          {!i.isBuyer && i.pickup && (
            <>
              <Label>{a.ui("Pickup location")}</Label>
              <Label>
                {i.pickup.address}, {i.pickup.state}
              </Label>
            </>
          )}
          {experience.canFarmerConfirm && (
            <>
              <Label>Confirm the original quantity, packaging and saved pickup location.</Label>
              <Field
                label="Pickup date"
                placeholder="YYYY-MM-DD"
                value={date}
                onChangeText={setDate}
              />
              <Field
                label="Preparation time (minutes)"
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="numeric"
              />
              <Field label="Preparation notes" value={notes} onChangeText={setNotes} />
              <Button
                title="Confirm stock and pickup availability"
                disabled={busy}
                onPress={confirm}
              />
            </>
          )}
          {experience.canBuyerAccept && (
            <>
              <Label>
                {a.ui("Pickup date")}: {i.proposal.snapshot.pickupDate}
              </Label>
              <Label>
                {a.ui("Produce")}: {money(i.proposal.snapshot.produceMinor)}
              </Label>
              {i.proposal.snapshot.collection ? (
                <Button
                  title="Accept recovery proposal"
                  disabled={busy}
                  onPress={() =>
                    void act("decision", { version: i.version, quoteId: null, accept: true })
                  }
                />
              ) : (
                i.proposal.snapshot.options.map((q: any) => {
                  const delta =
                    BigInt(q.shippingMinor) - BigInt(i.proposal.snapshot.originalShippingMinor);
                  return (
                    <Card key={q.id}>
                      <Label>
                        {q.courier} · {money(q.shippingMinor)}
                      </Label>
                      <Label>{q.eta}</Label>
                      <Label>
                        {a.ui(
                          delta > 0n
                            ? "Additional delivery payment required"
                            : "Refundable delivery surplus",
                        )}
                        : {money((delta < 0n ? -delta : delta).toString())}
                      </Label>
                      <Button
                        title="Accept recovery proposal"
                        disabled={busy}
                        onPress={() =>
                          void act("decision", { version: i.version, quoteId: q.id, accept: true })
                        }
                      />
                    </Card>
                  );
                })
              )}
            </>
          )}
          {experience.canRequestRefund && (
            <Button
              title={i.isBuyer ? "Request refund" : "Cannot fulfill this order"}
              secondary
              disabled={busy}
              onPress={() =>
                void act("decline", {
                  reason: i.isBuyer
                    ? "Buyer requested a refund instead of recovery"
                    : "Farmer cannot fulfill the original order",
                })
              }
            />
          )}
          {i.isBuyer && experience.closed && (
            <Label>
              Refunds return produce and shipping. Processing fees may be non-returnable; bank
              credit can take longer.
            </Label>
          )}
          <Button
            title="View order & tracking"
            secondary
            onPress={() => a.go("delivery", i.orderId)}
          />
          {i.support ? (
            <>
              <Label>
                {a.ui("Support request")}: {a.status(i.support.status)}
              </Label>
              {i.support.reply && <Notice text={i.support.reply} />}
            </>
          ) : (
            <Button
              title="Ask staff for help"
              secondary
              disabled={busy}
              onPress={() =>
                void act("support", {
                  message: i.isBuyer
                    ? "Please help me resolve this paid order or refund."
                    : "Please help me understand the next action for this order.",
                  sourceLocale: "en",
                })
              }
            />
          )}
          <Button title="Help and support" secondary onPress={() => a.go("help")} />
        </>
      )}
      {notice && <Notice text={notice} />}
      {error && <Notice text={error} error />}
    </Card>
  );
}
export function RecoveryScreen() {
  const a = useApp();
  return (
    <Page title="Order assistance" back={a.back}>
      <PaymentRecovery orderId={a.route.id} />
    </Page>
  );
}
