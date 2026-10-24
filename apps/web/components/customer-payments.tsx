"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { isHostedPaymentUrl } from "../../../packages/contracts/src/payment-urls";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { ui, localizedError, localizedStatus } from "../../mobile/src/lib/localization";
const money = (v: string) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Number(v) / 100);
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
}: {
  orderId: string;
  isBuyer: boolean;
  topup?: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const { say, error, status } = useCopy();
  const [data, setData] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const load = useCallback(
    async () => setData(await customerApi(`orders/${orderId}/payments`)),
    [orderId],
  );
  useEffect(() => {
    void load().catch(() => {});
    const focus = () => void load().catch(() => {});
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [load]);
  const latest = data?.items?.[0];
  const act = async (kind: string) => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      if (kind === "refresh") {
        if (latest) await customerApi(`orders/${orderId}/payments/${latest.id}/refresh`, {});
        await load();
        await onChanged();
      } else {
        const result = await customerApi(`orders/${orderId}/checkout`, { kind });
        if (result.checkoutUrl) {
          const url = new URL(result.checkoutUrl);
          if (url.protocol !== "https:" || url.hostname !== "checkout.bachs.io")
            throw new Error("We couldn’t open the secure payment page. Please try again.");
          location.assign(result.checkoutUrl);
        } else await load();
      }
    } catch (e) {
      setNotice(error(e));
    } finally {
      setBusy(false);
    }
  };
  if (!data?.enabled) return null;
  return (
    <section>
      <h2>{say("Payment")}</h2>
      <p>
        {say(
          "Payment-processing fees are shown before you pay. Non-returnable fees are deducted from refunds.",
        )}
      </p>
      {data.financialHold && (
        <p role="status">
          {say("Your payment is being reviewed. Please contact support for help.")}
        </p>
      )}
      {latest && (
        <p>
          {status(latest.status)} · {money(latest.amountMinor)}
        </p>
      )}
      {isBuyer &&
        !data.financialHold &&
        data.heldMinor === "0" &&
        data.releasedMinor === "0" &&
        data.refundedMinor === "0" && (
          <button disabled={busy} onClick={() => void act("ORDER")}>
            {say("Pay securely")}
          </button>
        )}
      {isBuyer && topup && (
        <button disabled={busy} onClick={() => void act("DELIVERY_TOPUP")}>
          {say("Pay delivery difference")}
        </button>
      )}
      {isBuyer && latest && (
        <button disabled={busy} onClick={() => void act("refresh")}>
          {say("Check payment status")}
        </button>
      )}
      <p role="status">{notice}</p>
    </section>
  );
}
export function CustomerFinance() {
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
                  const value = String(form.get("amount"));
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
                  <input name="amount" required inputMode="decimal" />
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
