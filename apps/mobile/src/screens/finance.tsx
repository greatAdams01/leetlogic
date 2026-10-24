import React, { useState, useRef, useEffect } from "react";
import { Linking, AppState, ScrollView, AccessibilityInfo } from "react-native";
import * as Crypto from "expo-crypto";
import { Page, Card, Heading, Label, Field, Button, Notice } from "../components/ui";
import { Select } from "../components/Select";
import { useApp, useResource } from "../state";
import { api } from "../lib/api";
import { money, toMinor } from "../lib/domain";
import { isHostedPaymentUrl } from "../../../../packages/contracts/src/payment-urls";
import type { FinancialSummary } from "../lib/finance";
export function Finance() {
  const a = useApp(),
    r = useResource<FinancialSummary>("/financial");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errorScope, setErrorScope] = useState<"setup" | "withdraw">("setup"),
    [task, setTask] = useState<"setup" | "check" | "withdraw" | null>(null),
    [setupNotice, setSetupNotice] = useState("");
  const [firstName, setFirst] = useState(""),
    [lastName, setLast] = useState(""),
    [email, setEmail] = useState(a.user?.profile?.email || ""),
    [entity, setEntity] = useState("individual");
  const [destination, setDestination] = useState(""),
    [amount, setAmount] = useState("");
  const running = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef({ setup: 0, withdraw: 0 });
  const withdrawalKey = useRef({ input: "", key: "" });
  const run = async (
    work: () => Promise<unknown>,
    scope: "setup" | "withdraw" = "setup",
    action: "setup" | "check" | "withdraw" = scope,
  ) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setTask(action);
    setError("");
    setSetupNotice("");
    try {
      await work();
    } catch (e) {
      const message = a.error(e);
      setErrorScope(scope);
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({
          y: Math.max(0, sectionY.current[scope] - 16),
          animated: true,
        }),
      );
    } finally {
      // Account creation may succeed even if opening its hosted link fails.
      await r.reload();
      running.current = false;
      setBusy(false);
      setTask(null);
    }
  };
  const open = async (url: string) => {
    if (!isHostedPaymentUrl(url, "onboarding"))
      throw new Error("We couldn’t open the secure payment page. Please try again.");
    await Linking.openURL(url);
  };
  const finishSetup = async (result: { ready?: boolean; url?: string | null }) => {
    if (result.ready) {
      a.go("banks");
      return;
    }
    if (result.url) await open(result.url);
    else setSetupNotice("Your payment setup is being prepared. Check its status shortly.");
  };
  const data = r.data;
  useEffect(() => {
    if (!data?.enabled || !data.account || data.account.ready) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void run(() => api("/financial/refresh", { method: "POST", body: {} }), "setup", "check");
    });
    return () => sub.remove();
  }, [data?.enabled, data?.account?.ready]);
  return (
    <Page
      title="Payments and earnings"
      back={a.back}
      loading={r.loading && !data}
      scrollRef={scrollRef}
    >
      {r.error && <Notice text={r.error} error />}
      {data && !data.enabled && (
        <Notice text="Payments are not available right now. Please try again later." />
      )}
      {data?.enabled && (
        <>
          <Card>
            <Heading>Your earnings</Heading>
            <Label>
              Earnings come from your produce sales. Funds become available after an order is
              released and platform fees are deducted.
            </Label>
            <Label>{a.ui("Held for delivery: {amount}", { amount: money(data.heldMinor) })}</Label>
            <Label>
              {a.ui("Available: {amount}", { amount: money(data.earnings.availableMinor) })}
            </Label>
            <Label>
              {a.ui("Reserved for withdrawals and fees: {amount}", {
                amount: money(data.earnings.reservedMinor),
              })}
            </Label>
          </Card>
          <Card
            onLayout={(event) => {
              sectionY.current.setup = event.nativeEvent.layout.y;
            }}
          >
            <Heading>Payment account</Heading>
            {error && errorScope === "setup" && <Notice text={error} error />}
            {setupNotice && <Notice text={setupNotice} />}
            <Label>
              Complete the secure Bachs setup, then add your bank account to receive earnings.
            </Label>
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
                  title={task === "setup" ? "Setting up payments…" : "Set up payments"}
                  loading={task === "setup"}
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
                      await finishSetup(result);
                    })
                  }
                />
              </>
            )}
            {data.account && !data.account.ready && (
              <Button
                title={task === "setup" ? "Opening payment setup…" : "Continue payment setup"}
                loading={task === "setup"}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    const result = await api("/financial/onboarding/link", {
                      method: "POST",
                      body: {},
                    });
                    await finishSetup(result);
                  })
                }
              />
            )}
            {data.account?.ready && <Notice text="Your payment account is ready." success />}
            {data.account && (
              <Button
                title={task === "check" ? "Checking payment setup…" : "Check payment setup"}
                loading={task === "check"}
                secondary
                disabled={busy}
                onPress={() =>
                  void run(() => api("/financial/refresh", { method: "POST", body: {} }))
                }
              />
            )}
          </Card>
          <Card>
            <Heading>Bank accounts</Heading>
            <Label>
              Choose where your earnings are paid. Only verified bank accounts can receive payouts.
            </Label>
            <Button
              title={data.destinations.length ? "Manage bank accounts" : "Add bank account"}
              onPress={() => a.go("banks")}
            />
          </Card>
          {data.account?.ready && data.destinations.some((bank) => bank.usable) && (
            <Card
              onLayout={(event) => {
                sectionY.current.withdraw = event.nativeEvent.layout.y;
              }}
            >
              <Heading>Withdraw earnings</Heading>
              {error && errorScope === "withdraw" && <Notice text={error} error />}
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
                title={task === "withdraw" ? "Requesting withdrawal…" : "Request withdrawal"}
                loading={task === "withdraw"}
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
                          }, "withdraw"),
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
    </Page>
  );
}
