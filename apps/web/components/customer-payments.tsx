"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { MoneyInput } from "./money-input";
import Link from "next/link";
import {
  paymentActions,
  pendingPaymentStatuses,
} from "../../../packages/contracts/src/payment-state";
import { isHostedPaymentUrl } from "../../../packages/contracts/src/payment-urls";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { ui, localizedError, localizedStatus } from "../../mobile/src/lib/localization";
import { formatMoney as money } from "../../../packages/contracts/src/money";
function useCopy() {
  const { locale } = useLanguage();
  return {
    say: (source: string) => ui(locale, source),
    error: (e: unknown) => localizedError(locale, e),
    status: (s: string) => localizedStatus(locale, s),
  };
}
export function CustomerPayment({
  orderId,
  isBuyer,
  topup = false,
  onChanged,
  revision = "",
  disabled = false,
}: {
  orderId: string;
  isBuyer: boolean;
  topup?: boolean;
  onChanged: () => Promise<unknown>;
  revision?: string;
  disabled?: boolean;
}) {
  const { say, error, status } = useCopy();
  const [data, setData] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const running = useRef(false);
  const requestVersion = useRef(0);
  const context = useRef({ orderId, revision, disabled, isBuyer, topup });
  context.current = { orderId, revision, disabled, isBuyer, topup };
  const [now, setNow] = useState(Date.now());
  const callbacks = useRef({ error, onChanged });
  callbacks.current = { error, onChanged };
  const load = useCallback(
    async (reconcile = false) => {
      const version = ++requestVersion.current;
      try {
        let latest = await customerApi(`orders/${orderId}/payments`);
        if (version !== requestVersion.current) return null;
        const pending = latest.items?.find((item: any) =>
          pendingPaymentStatuses.includes(item.status) || (latest.checkoutActive && item.status === "BLOCKED"),
        );
        if (reconcile && isBuyer && pending) {
          await customerApi(`orders/${orderId}/payments/${pending.id}/refresh`, {});
          latest = await customerApi(`orders/${orderId}/payments`);
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
  useEffect(() => {
    let active = true;
    setData(null);
    setNotice("");
    void load().catch((e) => { if (active) setNotice(callbacks.current.error(e)); });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const focus = () => {
      if (!running.current)
        void load(true)
          .then((latest) => latest && callbacks.current.onChanged())
          .catch((e) => { if (active) setNotice(callbacks.current.error(e)); });
    };
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      window.removeEventListener("focus", focus);
      clearInterval(timer);
      requestVersion.current++;
    };
  }, [load]);
  const actions = paymentActions<any>(data || {}, topup, now);
  const latest = actions.item;
  const open = (url: string) => {
    if (!isHostedPaymentUrl(url, "checkout"))
      throw new Error("We couldn’t open the secure payment page. Please try again.");
    location.assign(url);
  };
  const act = async (kind: string) => {
    const currentContext = () => context.current.orderId === orderId && context.current.revision === revision &&
      context.current.isBuyer === isBuyer && context.current.topup === topup;
    if (running.current || !currentContext()) return;
    running.current = true;
    setBusy(true);
    setNotice("");
    try {
      if (kind === "refresh") await load(true);
      else if (kind === "resume") {
        const latest = await load();
        const current = paymentActions<any>(latest || {}, topup);
        if (currentContext() && !context.current.disabled && latest?.enabled && current.canResume) open(current.pending!.checkoutUrl!);
      } else {
        if (context.current.disabled || !isBuyer || !paymentActions<any>(data || {}, topup).canPay) return;
        const result = await customerApi(`orders/${orderId}/checkout`, { kind });
        if (!currentContext()) return;
        setData((current: any) => ({
          ...current,
          items: [result, ...(current?.items || []).filter((item: any) => item.id !== result.id)],
        }));
        const latest = await load();
        const current = paymentActions<any>(latest || {}, topup);
        if (currentContext() && !context.current.disabled && latest?.enabled && current.canResume && current.pending?.id === result.id)
          open(current.pending!.checkoutUrl!);
      }
      if (currentContext()) await callbacks.current.onChanged();
    } catch (e) {
      if (!currentContext()) return;
      setNotice(error(e));
      await load().catch(() => { if (currentContext()) setData(null); });
      if (currentContext()) await callbacks.current.onChanged().catch(() => {});
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <section>
      <h2>{say("Payment")}</h2>
      <p>
        {say(
          "Payment-processing fees are shown before you pay. Non-returnable fees are deducted from refunds.",
        )}
      </p>
      {data && !data.enabled && (
        <p role="status">{say("Payments are not available right now. Please try again later.")}</p>
      )}
      {data?.financialHold && (
        <p role="status">
          {say("Your payment is being reviewed. Please contact support for help.")}
        </p>
      )}
      {actions.ready && !disabled && <p>{say("Total")}: {money(data.payableMinor)}</p>}
      {data?.enabled && isBuyer && !actions.ready && !actions.locked && !actions.succeeded && (
        <p role="status">{error({ code: data.checkoutErrorCode || "QUOTE_EXPIRED" })}</p>
      )}
      {latest && (
        <p>
          {status(latest.status)} · {money(latest.amountMinor)}
        </p>
      )}
      {data?.enabled && isBuyer && actions.canPay && (
        <button disabled={busy || disabled} onClick={() => void act(actions.kind)}>
          {say(actions.kind === "DELIVERY_TOPUP" ? "Pay delivery difference" : "Make Payment")}
        </button>
      )}
      {data?.enabled && isBuyer && actions.pending && (
        <>
          <button disabled={busy} onClick={() => void act("refresh")}>
            {say("Check Payment")}
          </button>
          <p>{say("After paying, return to this order and check your payment.")}</p>
          {actions.canResume && (
            <button disabled={busy || disabled} onClick={() => void act("resume")}>
              {say("Continue payment")}
            </button>
          )}
        </>
      )}
      {data?.enabled && isBuyer && actions.succeeded && (
        <p role="status">{say("Payment confirmed")}</p>
      )}
      {data?.enabled && actions.locked && !data.financialHold && (
        <p role="status">{say("This order cannot accept a payment right now.")}</p>
      )}
      {latest?.exceptionCode &&
        (["FAILED", "BLOCKED", "EXCEPTION", "UNKNOWN"].includes(latest.status) ||
          latest.exceptionCode === "PAYMENT_ATTEMPT_FAILED") && (
          <p role="alert">{error({ code: latest.exceptionCode })}</p>
        )}
      <p role="alert">{notice}</p>
      {!data && !!notice && (
        <button disabled={busy} onClick={() => void act("refresh")}>
          {say("Check Payment")}
        </button>
      )}
    </section>
  );
}
export function CustomerFinance() {
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const { say, error, status } = useCopy();
  const [data, setData] = useState<any>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [banks, setBanks] = useState<any[]>([]);
  const load = useCallback(async () => setData(await customerApi("financial")), []);
  useEffect(() => {
    void load().catch((e) => setNotice(error(e)));
  }, [load]);
  const running = useRef(false);
  const withdrawalKey = useRef({ input: "", key: "" });
  const act = async (work: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setNotice("");
    try {
      await work();
      await load();
    } catch (e) {
      setNotice(error(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const hosted = (url: string) => {
    if (!isHostedPaymentUrl(url, "onboarding"))
      throw new Error("We couldn’t open the secure payment page. Please try again.");
    location.assign(url);
  };
  return (
    <section className="customer-panel">
      <h1>{say("Payments and earnings")}</h1>
      <Link href="/account">{say("My account")}</Link>
      {data && !data.enabled && (
        <p>{say("Payments are not available right now. Please try again later.")}</p>
      )}
      {data?.enabled && (
        <>
          <h2>{say("Your earnings")}</h2>
          <p>
            {say("Available")}: {money(data.earnings.availableMinor)}
          </p>
          <p>
            {say("Held for delivery")}: {money(data.heldMinor)}
          </p>
          {!data.account && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void act(async () => {
                  const result = await customerApi(
                    "financial/onboarding",
                    Object.fromEntries(form),
                  );
                  if (result.url) hosted(result.url);
                });
              }}
            >
              {[
                ["firstName", "First name"],
                ["lastName", "Last name"],
                ["displayName", "Display name"],
                ["email", "Email"],
              ].map(([name, label]) => (
                <label key={name}>
                  {say(label)}
                  <input name={name} type={name === "email" ? "email" : "text"} required />
                </label>
              ))}
              <label>
                {say("Account type")}
                <select name="entityType">
                  <option value="individual">{say("Individual")}</option>
                  <option value="company">{say("Registered business")}</option>
                </select>
              </label>
              <button disabled={busy}>{say("Set up payments")}</button>
            </form>
          )}
          {data.account && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    const r = await customerApi("financial/onboarding/link", {});
                    if (r.url) hosted(r.url);
                  })
                }
              >
                {say("Continue payment setup")}
              </button>
              <button
                disabled={busy}
                onClick={() => void act(() => customerApi("financial/refresh", {}))}
              >
                {say("Check payment setup")}
              </button>
              <h2>{say("Bank account")}</h2>
              <button
                disabled={busy}
                onClick={() =>
                  void act(async () => setBanks((await customerApi("financial/banks")).items))
                }
              >
                {say("Choose bank")}
              </button>
              {!!banks.length && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    void act(() => customerApi("financial/banks", Object.fromEntries(form)));
                  }}
                >
                  <label>
                    {say("Bank")}
                    <select name="bankCode">
                      {banks.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {say("Account number")}
                    <input
                      name="accountNumber"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      minLength={10}
                      maxLength={10}
                    />
                  </label>
                  <button disabled={busy}>{say("Verify bank account")}</button>
                </form>
              )}
              {data.destinations.map((b: any) => (
                <p key={b.id}>
                  {b.bankName} · ****{b.accountLastFour} · {b.accountName} ·{" "}
                  {say(b.usable ? "Ready" : "Under review")}
                </p>
              ))}
            </>
          )}
          {data.account?.ready && data.destinations.some((d: any) => d.usable) && (
            <>
              <h2>{say("Withdraw earnings")}</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const value = withdrawalAmount;
                  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) {
                    setNotice(say("Enter a price in naira with at most two decimal places."));
                    return;
                  }
                  const [whole, fraction = ""] = value.split(".");
                  const amountMinor = (
                    BigInt(whole) * 100n +
                    BigInt(fraction.padEnd(2, "0"))
                  ).toString();
                  const withdrawalForm = e.currentTarget;
                  const inputKey = JSON.stringify([
                    form.get("destinationId"),
                    amountMinor,
                    data.payoutFeeMinor,
                  ]);
                  if (withdrawalKey.current.input !== inputKey)
                    withdrawalKey.current = { input: inputKey, key: crypto.randomUUID() };
                  void act(async () => {
                    await customerApi("financial/withdrawals", {
                      destinationId: form.get("destinationId"),
                      amountMinor,
                      feeMinor: data.payoutFeeMinor,
                      mutationKey: withdrawalKey.current.key,
                    });
                    withdrawalForm.reset();
                    setWithdrawalAmount("");
                    withdrawalKey.current = { input: "", key: "" };
                  });
                }}
              >
                <label>
                  {say("Bank account")}
                  <select name="destinationId">
                    {data.destinations
                      .filter((d: any) => d.usable)
                      .map((d: any) => (
                        <option key={d.id} value={d.id}>
                          {d.bankName} · ****{d.accountLastFour}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {say("Amount to receive (NGN)")}
                  <MoneyInput
                    name="amount"
                    value={withdrawalAmount}
                    onChange={setWithdrawalAmount}
                    required
                  />
                </label>
                <p>
                  {say("Withdrawal fee")}:{" "}
                  {data.payoutFeeMinor === null ? say("Not available") : money(data.payoutFeeMinor)}
                </p>
                <label>
                  <input type="checkbox" required />
                  {say(
                    "Review the bank account, amount and fee before requesting your withdrawal.",
                  )}
                </label>
                <button disabled={busy || data.payoutFeeMinor === null}>
                  {say("Request withdrawal")}
                </button>
              </form>
            </>
          )}
          <h2>{say("Payment activity")}</h2>
          {data.operations.map((op: any) => (
            <p key={op.id}>
              {status(op.kind)} · {status(op.status)} · {money(op.amountMinor)}
            </p>
          ))}
        </>
      )}
      <p role="status">{notice}</p>
    </section>
  );
}
