import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, AppState, Linking, View } from "react-native";
import { api } from "../lib/api";
import { useApp } from "../state";
import { Button, Heading, Label, Notice, colors } from "./ui";
import { Confirmation } from "./feedback";
import { createIdentityFlow, type IdentityData } from "../lib/identity-flow";
export function DojahIdentity({ onStatus }: { onStatus: (passed: boolean) => void }) {
  const a = useApp();
  const [consent, setConsent] = useState(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const [flow] = useState(() =>
    createIdentityFlow({
      read: () => api<IdentityData>("/seller/verification/identity"),
      reconcile: () => api("/seller/verification/identity/refresh", { method: "POST" }),
      start: (consentVersion) =>
        api("/seller/verification/identity/start", {
          method: "POST",
          body: { consent: true, consentVersion },
        }),
      open: (url) => Linking.openURL(url),
      onStatus: (passed) => onStatusRef.current(passed),
    }),
  );
  const { data, operation, error } = useSyncExternalStore(
    flow.subscribe,
    flow.getSnapshot,
    flow.getSnapshot,
  );
  const busy = operation !== "idle";
  useEffect(() => {
    flow.activate();
    void flow.load();
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      const returning = next === "active" && previous !== "active";
      previous = next;
      if (returning) flow.returned();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void flow.poll();
    }, 10000);
    return () => {
      subscription.remove();
      clearInterval(timer);
      flow.dispose();
    };
  }, [flow]);
  const retry =
    data?.check && ["FAILED", "ABANDONED", "EXPIRED", "REVIEW"].includes(data.check.status);
  return (
    <View style={{ gap: 20 }}>
      <Heading>Verify your identity</Heading>
      {operation === "loading" && <ActivityIndicator color={colors.green} />}
      {!data?.passed && (
        <Label>Dojah will check your ID and selfie. Return to LeetLogic when you finish.</Label>
      )}
      {data?.passed ? (
        <Notice text="Your identity is verified. You can continue." success />
      ) : (
        <>
          {data && !data.available && (
            <Notice text={a.error({ code: data.unavailableCode || "IDENTITY_UNAVAILABLE" })} />
          )}
          {data?.check?.status === "PENDING" && (
            <Notice text="Your verification is in progress. Return here when you finish to continue." />
          )}
          {retry && (
            <Notice text="Your identity check needs another attempt. Check your details and try again." />
          )}
          <Confirmation
            checked={consent}
            disabled={busy}
            onChange={() => setConsent((value) => !value)}
            label="I consent to Dojah checking my identity and selfie for seller verification."
          />
          <Button
            title={
              operation === "launching"
                ? "Opening…"
                : data?.check?.status === "PENDING"
                  ? "Resume verification"
                  : "Verify with Dojah"
            }
            secondary={!!data?.check}
            loading={operation === "launching"}
            disabled={busy || !data || !consent}
            onPress={() => void flow.launch(consent)}
          />
        </>
      )}
      {!data?.passed && (
        <Button
          title={operation === "checking" ? "Checking…" : "Check verification result"}
          loading={operation === "checking"}
          secondary={!data?.check || data.passed}
          disabled={busy}
          onPress={() => void flow.check()}
        />
      )}
      {error != null && <Notice text={a.error(error)} error />}
    </View>
  );
}
