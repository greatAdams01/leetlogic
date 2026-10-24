import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useApp, useResource } from "../state";
import { Page, Card, Heading, Label, Field, Button, Notice } from "../components/ui";
import { Select } from "../components/Select";
import { api } from "../lib/api";
import { bankVerificationPending, type BankAccount, type FinancialSummary } from "../lib/finance";

type Verification = { status: string; destination: BankAccount | null };
export function BankAccounts() {
  const a = useApp();
  const financial = useResource<FinancialSummary>("/financial");
  const ready = !!financial.data?.enabled && !!financial.data.account?.ready;
  const catalogue = useResource<{ items: { code: string; name: string }[] }>(
    "/financial/banks",
    ready,
  );
  const [step, setStep] = useState<"list" | "details" | "review" | "result">("list");
  const [bankCode, setBankCode] = useState(""),
    [number, setNumber] = useState("");
  const [operation, setOperation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const verification = useResource<Verification>(
    `/financial/banks/operations/${operation}`,
    !!operation,
  );
  const running = useRef(false),
    polls = useRef(0);
  const selected = catalogue.data?.items.find((bank) => bank.code === bankCode);
  useEffect(() => {
    if (operation || !financial.data) return;
    const pending = financial.data.operations.find(
      (item) =>
        item.kind === "DESTINATION" &&
        (bankVerificationPending(item.status) || item.status === "UNKNOWN"),
    );
    if (pending) {
      setOperation(pending.id);
      setStep("result");
    }
  }, [financial.data, operation]);
  useEffect(() => {
    if (
      !operation ||
      !verification.data ||
      !bankVerificationPending(verification.data.status) ||
      polls.current >= 10
    )
      return;
    const timer = setTimeout(() => {
      polls.current++;
      void verification.reload();
    }, 3000);
    return () => clearTimeout(timer);
  }, [operation, verification.data, verification.reload]);
  const save = async () => {
    if (running.current || !selected || !/^\d{10}$/.test(number)) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id: string }>("/financial/banks", {
        method: "POST",
        body: { bankCode, accountNumber: number },
      });
      polls.current = 0;
      setOperation(result.id);
      setStep("result");
      setNumber("");
    } catch (e) {
      setError(a.error(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const result = verification.data;
  const verified = result?.status === "SUCCEEDED" && !!result.destination?.usable;
  return (
    <Page title="Bank accounts" back={busy ? undefined : a.back} loading={financial.loading}>
      <Label>Add a verified Nigerian bank account to receive your earnings.</Label>
      {financial.data && !financial.data.enabled && (
        <Notice text="Payments are not available right now. Please try again later." />
      )}
      {financial.data?.enabled && !financial.data.account?.ready && (
        <Card>
          <Heading>Complete payment setup</Heading>
          <Label>
            First connect your seller profile to Bachs. Then add the bank account where you want to
            receive your earnings.
          </Label>
          <Button title="Set up payments" onPress={() => a.go("finance")} />
        </Card>
      )}
      {step === "list" && (
        <>
          {financial.data?.destinations.map((bank) => (
            <Card key={bank.id}>
              <BankDetails bank={bank} />
              <Notice
                text={
                  bank.usable ? "Ready to receive earnings" : "Bank verification is under review."
                }
                success={bank.usable}
              />
            </Card>
          ))}
          {financial.data?.enabled && !financial.data.destinations.length && (
            <Notice text="You haven’t added a bank account yet." />
          )}
          {ready && (
            <Button
              title="Add bank account"
              onPress={() => {
                setError("");
                setBankCode("");
                setNumber("");
                setStep("details");
              }}
            />
          )}
        </>
      )}
      {ready && step === "details" && (
        <Card>
          <Label>Step 1 of 2 · Bank details</Label>
          <Select
            label="Bank"
            value={bankCode}
            options={(catalogue.data?.items || []).map((bank) => ({
              value: bank.code,
              label: bank.name,
            }))}
            onChange={setBankCode}
            disabled={catalogue.loading}
          />
          <Field
            label="Account number"
            value={number}
            onChangeText={(value) => setNumber(value.replace(/\D/g, "").slice(0, 10))}
            maxLength={10}
            keyboardType="number-pad"
          />
          <Button
            title="Review bank details"
            disabled={!selected || number.length !== 10 || catalogue.loading}
            onPress={() => setStep("review")}
          />
          <Button title="Cancel" secondary onPress={() => setStep("list")} />
        </Card>
      )}
      {ready && step === "review" && (
        <Card>
          <Label>Step 2 of 2 · Review bank details</Label>
          <Heading>{selected?.name}</Heading>
          <Label>{number}</Label>
          <Label>
            Check these details carefully. Bachs will verify the account and return its registered
            name.
          </Label>
          <Button
            title="Verify and save bank account"
            loading={busy}
            disabled={busy}
            onPress={() => void save()}
          />
          <Button
            title="Edit bank details"
            secondary
            disabled={busy}
            onPress={() => setStep("details")}
          />
        </Card>
      )}
      {step === "result" && (
        <Card>
          <Heading>{verified ? "Bank account added" : "Bank verification"}</Heading>
          {result?.destination && <BankDetails bank={result.destination} />}
          {verified ? (
            <>
              <Notice text="This bank account is ready to receive your earnings." success />
              <Button
                title="Done"
                onPress={() =>
                  void (async () => {
                    await financial.reload();
                    setOperation("");
                    setStep("list");
                  })()
                }
              />
            </>
          ) : (
            <>
              <Notice
                text={
                  result?.status === "FAILED"
                    ? "We couldn’t verify this bank account. Contact support before trying again."
                    : "Your bank details are being checked. You can leave this screen and return later."
                }
              />
              <Button
                title="Check bank verification"
                loading={verification.loading}
                disabled={verification.loading}
                onPress={() => void verification.reload()}
              />
              {result?.status === "FAILED" && (
                <Button title="Help and support" secondary onPress={() => a.go("help")} />
              )}
            </>
          )}
        </Card>
      )}
      {(error || financial.error || catalogue.error || verification.error) && (
        <Notice text={error || financial.error || catalogue.error || verification.error} error />
      )}
      {catalogue.error && step === "details" && (
        <Button title="Choose bank" secondary onPress={() => void catalogue.reload()} />
      )}
    </Page>
  );
}
function BankDetails({ bank }: { bank: BankAccount }) {
  return (
    <View style={{ gap: 6 }}>
      <Heading>{bank.bankName}</Heading>
      <Label>{bank.accountName}</Label>
      <Label>****{bank.accountLastFour}</Label>
    </View>
  );
}
