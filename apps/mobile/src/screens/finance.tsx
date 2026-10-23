import React, { useState, useRef } from "react";
import { Linking } from "react-native";
import * as Crypto from "expo-crypto";
import { Page, Card, Heading, Label, Field, Button, Notice } from "../components/ui";
import { Select } from "../components/Select";
import { useApp, useResource } from "../state";
import { api } from "../lib/api";
import { money, toMinor } from "../lib/domain";
export function Finance() {
  const a = useApp(),
    r = useResource<any>("/financial");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [firstName, setFirst] = useState(""),
    [lastName, setLast] = useState(""),
    [email, setEmail] = useState(a.user?.profile?.email || ""),
    [entity, setEntity] = useState("individual");
  const [banks, setBanks] = useState<Array<{ code: string; name: string }>>([]),
    [bankCode, setBankCode] = useState(""),
    [accountNumber, setAccountNumber] = useState("");
  const [destination, setDestination] = useState(""),
    [amount, setAmount] = useState("");
  const running = useRef(false);
  const withdrawalKey = useRef({ input: "", key: "" });
  const run = async (work: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
      await r.reload();
    } catch (e) {
      setError(a.error(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const open = async (url: string) => {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !["connect.bachs.io", "app.bachs.io", "checkout.bachs.io"].includes(parsed.hostname)
    )
      throw new Error("We couldn’t open the secure payment page. Please try again.");
    await Linking.openURL(url);
  };
  const data = r.data;
  return (
    <Page title="Payments and earnings" back={a.back} loading={r.loading}>
      {data && !data.enabled && (
        <Notice text="Payments are not available right now. Please try again later." />
      )}
      {data?.enabled && (
        <>
          <Card>
            <Heading>Your earnings</Heading>
            <Label>{a.ui("Held for delivery: {amount}", { amount: money(data.heldMinor) })}</Label>
            <Label>
              {a.ui("Available: {amount}", { amount: money(data.earnings.availableMinor) })}
            </Label>
            <Label>
              {a.ui("Withdrawal pending: {amount}", { amount: money(data.earnings.reservedMinor) })}
            </Label>
          </Card>
          <Card>
            <Heading>Payment account</Heading>
            <Label>Complete the secure account setup to receive payments and refunds.</Label>
            {!data.account && (
              <>
                <Field label="First name" value={firstName} onChangeText={setFirst} />
                <Field label="Last name" value={lastName} onChangeText={setLast} />
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Select
                  label="Account type"
                  value={entity}
                  options={[
                    { value: "individual", label: "Individual" },
                    { value: "company", label: "Registered business" },
                  ]}
                  onChange={setEntity}
                />
                <Button
                  title="Set up payments"
                  disabled={busy || !firstName || !lastName || !email}
                  onPress={() =>
                    void run(async () => {
                      const result = await api("/financial/onboarding", {
                        method: "POST",
                        body: {
                          email,
                          firstName,
                          lastName,
                          entityType: entity,
                          displayName:
                            a.user?.farmerProfile?.farmName || `${firstName} ${lastName}`,
                        },
                      });
                      if (result.url) await open(result.url);
                    })
                  }
                />
              </>
            )}
            {data.account && !data.account.ready && (
              <Button
                title="Continue payment setup"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    const result = await api("/financial/onboarding/link", {
                      method: "POST",
                      body: {},
                    });
                    await open(result.url);
                  })
                }
              />
            )}
            {data.account?.ready && <Notice text="Your payment account is ready." success />}
            {data.account && (
              <Button
                title="Check payment setup"
                secondary
                disabled={busy}
                onPress={() =>
                  void run(() => api("/financial/refresh", { method: "POST", body: {} }))
                }
              />
            )}
          </Card>
          {data.account && (
            <Card>
              <Heading>Bank account</Heading>
              <Button
                title="Choose bank"
                secondary
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    setBanks((await api("/financial/banks")).items);
                  })
                }
              />
              {!!banks.length && (
                <Select
                  label="Bank"
                  value={bankCode}
                  options={banks.map((b) => ({ value: b.code, label: b.name }))}
                  onChange={setBankCode}
                />
              )}
              <Field
                label="Account number"
                value={accountNumber}
                onChangeText={(v) => setAccountNumber(v.replace(/\D/g, ""))}
                keyboardType="number-pad"
                maxLength={10}
              />
              <Button
                title="Verify bank account"
                disabled={busy || !bankCode || accountNumber.length !== 10}
                onPress={() =>
                  void run(async () => {
                    await api("/financial/banks", {
                      method: "POST",
                      body: { bankCode, accountNumber },
                    });
                    setAccountNumber("");
                  })
                }
              />
              {data.destinations.map((bank: any) => (
                <Label key={bank.id}>
                  {bank.bankName} · ****{bank.accountLastFour} · {bank.accountName} ·{" "}
                  {a.ui(bank.usable ? "Ready" : "Under review")}
                </Label>
              ))}
            </Card>
          )}
          {data.account?.ready && (
            <Card>
              <Heading>Withdraw earnings</Heading>
              <Select
                label="Bank account"
                value={destination}
                options={data.destinations
                  .filter((d: any) => d.usable)
                  .map((d: any) => ({
                    value: d.id,
                    label: `${d.bankName} · ****${d.accountLastFour}`,
                  }))}
                onChange={setDestination}
              />
              <Field
                label="Amount to receive (NGN)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              {data.payoutFeeMinor !== null && (
                <Label>
                  {a.ui("Withdrawal fee: {amount}", { amount: money(data.payoutFeeMinor) })}
                </Label>
              )}
              <Label>
                Review the bank account, amount and fee before requesting your withdrawal.
              </Label>
              <Button
                title="Request withdrawal"
                disabled={busy || !destination || !amount || data.payoutFeeMinor === null}
                onPress={() =>
                  a.alert(
                    "Confirm withdrawal",
                    "The amount and withdrawal fee will be deducted from your available earnings.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Confirm",
                        onPress: () =>
                          void run(async () => {
                            const inputKey = JSON.stringify([
                              destination,
                              toMinor(amount),
                              data.payoutFeeMinor,
                            ]);
                            if (withdrawalKey.current.input !== inputKey)
                              withdrawalKey.current = { input: inputKey, key: Crypto.randomUUID() };
                            await api("/financial/withdrawals", {
                              method: "POST",
                              body: {
                                destinationId: destination,
                                amountMinor: toMinor(amount),
                                feeMinor: data.payoutFeeMinor,
                                mutationKey: withdrawalKey.current.key,
                              },
                            });
                            setAmount("");
                            withdrawalKey.current = { input: "", key: "" };
                          }),
                      },
                    ],
                  )
                }
              />
            </Card>
          )}
          <Card>
            <Heading>Payment activity</Heading>
            {data.operations.map((op: any) => (
              <Label key={op.id}>
                {a.status(op.kind)} · {a.status(op.status)} · {money(op.amountMinor)}
              </Label>
            ))}
          </Card>
        </>
      )}
      {(error || r.error) && <Notice text={error || r.error} error />}
    </Page>
  );
}
