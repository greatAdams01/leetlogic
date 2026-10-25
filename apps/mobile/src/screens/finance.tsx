import React, { useState, useRef, useEffect } from "react";
import { Linking, AppState, ScrollView, AccessibilityInfo, Modal } from "react-native";
import * as Crypto from "expo-crypto";
import { Page, Card, Heading, Label, Field, Button, Notice } from "../components/ui";
import { Select } from "../components/Select";
import { useApp, useResource } from "../state";
import { api } from "../lib/api";
import { money, toMinor } from "../lib/domain";
import { isHostedPaymentUrl } from "../../../../packages/contracts/src/payment-urls";
import { withdrawalAmounts, type FinancialSummary } from "../lib/finance";
export function Finance() {
  const a = useApp(),
    r = useResource<FinancialSummary>("/financial");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errorScope, setErrorScope] = useState<"setup" | "withdraw">("setup"),
    [task, setTask] = useState<"setup" | "check" | "withdraw" | null>(null),
    [setupNotice, setSetupNotice] = useState(""),
    [showWithdrawal, setShowWithdrawal] = useState(false);
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
      if (scope === "setup")
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
  const withdrawal = withdrawalAmounts(
    data?.earnings.availableMinor || "0",
    data?.payoutFeeMinor ?? null,
    amount,
  );
  const closeWithdrawal = () => {
    if (!running.current) {
      setShowWithdrawal(false);
      setError("");
    }
  };
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
            <Label>Available to withdraw</Label>
            <Heading>{money(data.earnings.availableMinor)}</Heading>
            <Label>{a.ui("Awaiting release: {amount}", { amount: money(data.heldMinor) })}</Label>
            <Label>
              {a.ui("Withdrawals in progress: {amount}", {
                amount: money(data.earnings.reservedMinor),
              })}
            </Label>
            {data.account?.ready && data.destinations.some((bank) => bank.usable) && (
              <Button
                title="Withdraw earnings"
                onPress={() => {
                  setError("");
                  setAmount("");
                  setDestination(
                    data.destinations.filter((bank) => bank.usable).length === 1
                      ? data.destinations.find((bank) => bank.usable)!.id
                      : "",
                  );
                  setShowWithdrawal(true);
                }}
              />
            )}
          </Card>
          {!data.account?.ready && (
            <Card
              onLayout={(event) => {
                sectionY.current.setup = event.nativeEvent.layout.y;
              }}
            >
              <Heading>Set up payments</Heading>
              {error && errorScope === "setup" && <Notice text={error} error />}
              {setupNotice && <Notice text={setupNotice} />}
              <Label>Confirm your details securely before adding a bank account.</Label>
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
              {data.account && (
                <Button
                  title={task === "check" ? "Checking payment setup…" : "Check payment setup"}
                  loading={task === "check"}
                  secondary
                  disabled={busy}
                  onPress={() =>
                    void run(
                      () => api("/financial/refresh", { method: "POST", body: {} }),
                      "setup",
                      "check",
                    )
                  }
                />
              )}
            </Card>
          )}
          <Card>
            <Heading>Bank accounts</Heading>
            <Label>
              {data.account?.ready
                ? "Payment setup complete"
                : "Complete payment setup to receive earnings."}
            </Label>
            {data.destinations.length === 0 ? (
              <Label>No bank accounts added yet.</Label>
            ) : (
              data.destinations.map((bank) => (
                <Label key={bank.id}>
                  {bank.bankName} · ****{bank.accountLastFour} · {bank.accountName}
                </Label>
              ))
            )}
            <Button
              title={data.destinations.length ? "Manage bank accounts" : "Add bank account"}
              secondary
              onPress={() => a.go("banks")}
            />
          </Card>
          {showWithdrawal &&
            data.account?.ready &&
            data.destinations.some((bank) => bank.usable) && (
              <Modal
                visible
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={closeWithdrawal}
              >
                <Page title="Withdraw earnings" back={busy ? undefined : closeWithdrawal}>
                  <Card>
                    <Label>Available to withdraw</Label>
                    <Heading>{money(data.earnings.availableMinor)}</Heading>
                    <Label>
                      {a.ui("Maximum you can receive: {amount}", {
                        amount: money(withdrawal.maximum),
                      })}
                    </Label>
                  </Card>
                  <Card>
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
                      disabled={busy}
                    />
                    <Field
                      label="Amount to receive (NGN)"
                      editable={!busy}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                    />
                    <Button
                      title="Use full amount"
                      secondary
                      disabled={busy || withdrawal.maximum === "0"}
                      onPress={() => setAmount(withdrawal.fullAmount)}
                    />
                    {data.payoutFeeMinor === null && (
                      <Notice text="Withdrawal fees are being updated. Please try again later." />
                    )}
                    {withdrawal.maximum === "0" && data.payoutFeeMinor !== null && (
                      <Notice text="You have no earnings available to withdraw after the fee." />
                    )}
                    {!!amount && !withdrawal.valid && (
                      <Notice
                        text="Enter an amount within your available earnings after the fee."
                        error
                      />
                    )}
                    {data.payoutFeeMinor !== null && (
                      <Label>
                        {a.ui("Withdrawal fee: {amount}", { amount: money(data.payoutFeeMinor) })}
                      </Label>
                    )}
                    {withdrawal.valid && (
                      <Label>
                        {a.ui("Total deducted: {amount}", { amount: money(withdrawal.total) })}
                      </Label>
                    )}
                    <Button
                      title={task === "withdraw" ? "Requesting withdrawal…" : "Request withdrawal"}
                      loading={task === "withdraw"}
                      disabled={busy || !destination || !withdrawal.valid}
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
                                    withdrawalKey.current = {
                                      input: inputKey,
                                      key: Crypto.randomUUID(),
                                    };
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
                                  setShowWithdrawal(false);
                                  setSetupNotice(
                                    "Withdrawal requested. You can follow its progress in payment history.",
                                  );
                                  withdrawalKey.current = { input: "", key: "" };
                                }, "withdraw"),
                            },
                          ],
                        )
                      }
                    />
                  </Card>
                  <Button title="Cancel" secondary disabled={busy} onPress={closeWithdrawal} />
                </Page>
              </Modal>
            )}
          {setupNotice && data.account?.ready && <Notice text={setupNotice} success />}
          <Card>
            <Heading>Payment history</Heading>
            {data.operations.filter((op) =>
              ["RELEASE", "PAYOUT", "REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT"].includes(op.kind),
            ).length === 0 && (
              <Label>No payments yet. Your sales earnings and withdrawals will appear here.</Label>
            )}
            {data.operations
              .filter((op) =>
                ["RELEASE", "PAYOUT", "REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT"].includes(
                  op.kind,
                ),
              )
              .map((op) => (
                <React.Fragment key={op.id}>
                  <Label>
                    {a.status(op.kind)} · {money(op.amountMinor)}
                  </Label>
                  <Label muted>
                    {a.status(op.status)}
                    {op.createdAt ? ` · ${a.date(op.createdAt)}` : ""}
                  </Label>
                </React.Fragment>
              ))}
          </Card>
        </>
      )}
    </Page>
  );
}
