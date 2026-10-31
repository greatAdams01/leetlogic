import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, View } from "react-native";
import {
  paymentActions,
  pendingPaymentStatuses,
} from "../../../../packages/contracts/src/payment-state";
import { isHostedPaymentUrl } from "../../../../packages/contracts/src/payment-urls";
import { useApp } from "../state";
import { api } from "../lib/api";
import { money } from "../lib/domain";
import { Button, Card, Heading, Label, Notice } from "./ui";
export function OrderPayment({
  orderId,
  isBuyer,
  onChanged,
  topup = false,
  buttonTitle = "Make Payment",
  compact = false,
  revision = "",
  disabled = false,
}: {
  orderId: string;
  isBuyer: boolean;
  topup?: boolean;
  buttonTitle?: string;
  compact?: boolean;
  revision?: string;
  disabled?: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const a = useApp();
  const [data, setData] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const running = useRef(false);
  const requestVersion = useRef(0);
  const context = useRef({ orderId, revision, disabled, isBuyer, topup });
  context.current = { orderId, revision, disabled, isBuyer, topup };
  const [now, setNow] = useState(Date.now());
  const load = useCallback(
    async (reconcile = false) => {
      const version = ++requestVersion.current;
      try {
        let latest = await api(`/orders/${orderId}/payments`);
        if (version !== requestVersion.current) return null;
        const pending = latest.items?.find((payment: any) =>
          pendingPaymentStatuses.includes(payment.status) || (latest.checkoutActive && payment.status === "BLOCKED"),
        );
        if (reconcile && isBuyer && pending) {
          await api(`/orders/${orderId}/payments/${pending.id}/refresh`, {
            method: "POST",
            body: {},
          });
          latest = await api(`/orders/${orderId}/payments`);
        }
        if (version !== requestVersion.current) return null;
        setData(latest);
        return latest;
      } catch (error) {
        if (version !== requestVersion.current) return null;
        throw error;
      }
    },
    [orderId, isBuyer, revision],
  );
  const callbacks = useRef({ onChanged, error: a.error });
  callbacks.current = { onChanged, error: a.error };
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    void load().catch((e) => { if (active) setError(callbacks.current.error(e)); });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !running.current) {
        void load(true)
          .then((latest) => latest && callbacks.current.onChanged())
          .catch((e) => { if (active) setError(callbacks.current.error(e)); });
      }
    });
    return () => {
      active = false;
      sub.remove();
      clearInterval(timer);
      requestVersion.current++;
    };
  }, [load]);
  const actions = paymentActions<any>(data || {}, topup, now);
  const item = actions.item;
  const open = async (url: string) => {
    if (!isHostedPaymentUrl(url, "checkout"))
      throw new Error("We couldn’t open the secure payment page. Please try again.");
    await Linking.openURL(url);
  };
  const act = async (kind: "ORDER" | "DELIVERY_TOPUP" | "REFRESH" | "RESUME") => {
    const currentContext = () => context.current.orderId === orderId && context.current.revision === revision &&
      context.current.isBuyer === isBuyer && context.current.topup === topup;
    if (running.current || !currentContext()) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      if (kind === "RESUME") {
        const latest = await load();
        const current = paymentActions<any>(latest || {}, topup);
        if (currentContext() && !context.current.disabled && latest?.enabled && current.canResume) await open(current.pending!.checkoutUrl!);
      } else if (kind === "REFRESH") {
        await load(true);
      } else {
        if (context.current.disabled || !isBuyer || !paymentActions<any>(data || {}, topup).canPay) return;
        const result = await api(`/orders/${orderId}/checkout`, { method: "POST", body: { kind } });
        if (!currentContext()) return;
        // Persist the returned pending state before opening the hosted page.
        setData((current: any) => ({
          ...current,
          items: [result, ...(current?.items || []).filter((p: any) => p.id !== result.id)],
        }));
        const latest = await load();
        const current = paymentActions<any>(latest || {}, topup);
        if (currentContext() && !context.current.disabled && latest?.enabled && current.canResume && current.pending?.id === result.id)
          await open(current.pending!.checkoutUrl!);
      }
      if (currentContext()) await callbacks.current.onChanged();
    } catch (e) {
      if (!currentContext()) return;
      setError(a.error(e));
      // A lost response may still have created checkout. Read its state before offering another write.
      await load().catch(() => { if (currentContext()) setData(null); });
      if (currentContext()) await callbacks.current.onChanged().catch(() => {});
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const content = (
    <>
      {!compact && <Heading>Payment</Heading>}
      {!compact && (
        <Label>
          Payment-processing fees are shown before you pay. Non-returnable fees are deducted from
          refunds.
        </Label>
      )}
      {data && !data.enabled && (
        <Notice text="Payments are not available right now. Please try again later." />
      )}
      {!!data?.financialHold && (
        <Notice text="Your payment is being reviewed. Please contact support for help." />
      )}
      {!compact && actions.ready && !disabled && <Label>{money(data.payableMinor)}</Label>}
      {data?.enabled && isBuyer && !actions.ready && !actions.locked && !actions.succeeded && (
        <Notice text={a.error({ code: data.checkoutErrorCode || "QUOTE_EXPIRED" })} />
      )}
      {item && (
        <View style={{ gap: 8 }}>
          <Label>{a.status(item.status)}</Label>
          <Label>{money(item.amountMinor)}</Label>
        </View>
      )}
      {data?.enabled && isBuyer && actions.canPay && (
        <Button
          title={actions.kind === "DELIVERY_TOPUP" ? "Pay delivery difference" : buttonTitle}
          disabled={busy || disabled}
          loading={busy}
          onPress={() => void act(actions.kind as "ORDER" | "DELIVERY_TOPUP")}
        />
      )}
      {data?.enabled && isBuyer && actions.pending && (
        <>
          <Button
            title="Check Payment"
            disabled={busy}
            loading={busy}
            onPress={() => void act("REFRESH")}
          />
          <Label muted>After paying, return to this order and check your payment.</Label>
          {actions.canResume && (
            <Button
              title="Continue payment"
              secondary
              disabled={busy || disabled}
              onPress={() => void act("RESUME")}
            />
          )}
        </>
      )}
      {data?.enabled && isBuyer && actions.succeeded && <Label>Payment confirmed</Label>}
      {data?.enabled && actions.locked && !data.financialHold && (
        <Notice text="This order cannot accept a payment right now." />
      )}
      {item?.exceptionCode &&
        (["FAILED", "BLOCKED", "EXCEPTION", "UNKNOWN"].includes(item.status) ||
          item.exceptionCode === "PAYMENT_ATTEMPT_FAILED") && (
          <Notice text={a.error({ code: item.exceptionCode })} error />
        )}
      {error && <Notice text={error} error />}
      {!data && !!error && (
        <Button
          title="Check Payment"
          disabled={busy}
          loading={busy}
          onPress={() => void act("REFRESH")}
        />
      )}
    </>
  );
  return compact ? <View style={{ gap: 12 }}>{content}</View> : <Card>{content}</Card>;
}
