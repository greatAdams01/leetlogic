import React, { useCallback, useEffect, useState } from "react";
import { AppState, Linking, View } from "react-native";
import { useApp } from "../state";
import { api } from "../lib/api";
import { money } from "../lib/domain";
import { Button, Card, Heading, Label, Notice } from "./ui";
export function OrderPayment({
  orderId,
  isBuyer,
  onChanged,
  topup = false,
}: {
  orderId: string;
  isBuyer: boolean;
  topup?: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const a = useApp();
  const [data, setData] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setData(await api(`/orders/${orderId}/payments`));
  }, [orderId]);
  useEffect(() => {
    void load().catch(() => {});
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void load().catch(() => {});
    });
    return () => sub.remove();
  }, [load]);
  const item = data?.items?.[0];
  const act = async (kind: "ORDER" | "DELIVERY_TOPUP" | "REFRESH") => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (kind === "REFRESH") {
        if (item)
          await api(`/orders/${orderId}/payments/${item.id}/refresh`, { method: "POST", body: {} });
      } else {
        const result = await api(`/orders/${orderId}/checkout`, { method: "POST", body: { kind } });
        if (result.checkoutUrl) {
          const url = new URL(result.checkoutUrl);
          if (url.protocol !== "https:" || url.hostname !== "checkout.bachs.io")
            throw new Error("We couldn’t open the secure payment page. Please try again.");
          await Linking.openURL(result.checkoutUrl);
        }
      }
      await load();
      await onChanged();
    } catch (e) {
      setError(a.error(e));
    } finally {
      setBusy(false);
    }
  };
  if (!data?.enabled) return null;
  return (
    <Card>
      <Heading>Payment</Heading>
      <Label>
        Payment-processing fees are shown before you pay. Non-returnable fees are deducted from
        refunds.
      </Label>
      {!!data.financialHold && (
        <Notice text="Your payment is being reviewed. Please contact support for help." />
      )}
      {item && (
        <View style={{ gap: 8 }}>
          <Label>{a.status(item.status)}</Label>
          <Label>{money(item.amountMinor)}</Label>
        </View>
      )}
      {isBuyer &&
        data.heldMinor === "0" &&
        data.releasedMinor === "0" &&
        data.refundedMinor === "0" &&
        !data.financialHold && (
          <Button
            title="Pay securely"
            disabled={busy}
            loading={busy}
            onPress={() => void act("ORDER")}
          />
        )}
      {isBuyer && topup && data.heldMinor !== "0" && !data.financialHold && (
        <Button
          title="Pay delivery difference"
          secondary
          disabled={busy}
          onPress={() => void act("DELIVERY_TOPUP")}
        />
      )}
      {isBuyer && item && (
        <Button
          title="Check payment status"
          secondary
          disabled={busy}
          onPress={() => void act("REFRESH")}
        />
      )}
      {error && <Notice text={error} error />}
    </Card>
  );
}
