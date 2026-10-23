import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, View } from "react-native";
import { api } from "../lib/api";
import { useApp } from "../state";
import { Button, Heading, Label, Notice } from "./ui";
import { Confirmation } from "./feedback";
type IdentityData = {
  available: boolean;
  consentVersion: string;
  passed: boolean;
  check: null | { status: string; mode: string };
};
export function DojahIdentity({ onStatus }: { onStatus: (passed: boolean) => void }) {
  const a = useApp();
  const [data, setData] = useState<IdentityData | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  const inFlight = useRef(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const load = async (reconcile = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (reconcile) await api("/seller/verification/identity/refresh", { method: "POST" });
      const next = await api<IdentityData>("/seller/verification/identity");
      if (active.current) {
        setData(next);
        onStatusRef.current(next.passed);
      }
    } catch (e) {
      if (active.current) setError(a.error(e));
    } finally {
      inFlight.current = false;
      if (active.current) setBusy(false);
    }
  };
  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && data?.check?.status === "PENDING") void load(true);
    });
    // Webhooks update our server; these reads never initiate another identity lookup.
    const timer =
      data?.check?.status === "PENDING"
        ? setInterval(() => {
            if (AppState.currentState === "active") void load();
          }, 10000)
        : undefined;
    return () => {
      sub.remove();
      if (timer) clearInterval(timer);
    };
  }, [data?.check?.status]);
  const launch = async () => {
    if (inFlight.current || !data || !consent) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    let started = false;
    try {
      const result = await api<{ url: string | null; check: IdentityData["check"] }>(
        "/seller/verification/identity/start",
        {
          method: "POST",
          body: { consent: true, consentVersion: data.consentVersion },
        },
      );
      if (active.current) setData((prior) => (prior ? { ...prior, check: result.check } : prior));
      // Session URLs are server-issued and must stay on Dojah's HTTPS origin.
      if (result.url) {
        const url = new URL(result.url);
        if (url.origin !== "https://identity.dojah.io")
          throw new Error(
            "The identity provider returned an unexpected result. Please contact support.",
          );
        await Linking.openURL(result.url);
      }
      started = true;
    } catch (e) {
      if (active.current) setError(a.error(e));
    } finally {
      inFlight.current = false;
      if (active.current) {
        setBusy(false);
        if (started) void load();
      }
    }
  };
  const retry =
    data?.check && ["FAILED", "ABANDONED", "EXPIRED", "REVIEW"].includes(data.check.status);
  return (
    <View style={{ gap: 20 }}>
      <Heading>Verify your identity</Heading>
      <Label>Dojah will check your ID and selfie. Return to LeetLogic when you finish.</Label>
      {data?.check?.mode === "sandbox" && (
        <Notice text="Test verification only. This does not verify a real identity." />
      )}
      {data?.passed ? (
        <Notice text="Identity verified. You can continue to farm evidence." success />
      ) : (
        <>
          {data && !data.available && (
            <Notice text="Identity verification is not available yet. Please try again later." />
          )}
          {data?.check?.status === "PENDING" && (
            <Notice text="Your identity check is in progress. Finish with Dojah, then check your result." />
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
            title={busy ? "Loading…" : "Verify with Dojah"}
            disabled={busy || !data?.available || !consent}
            onPress={() => void launch()}
          />
        </>
      )}
      <Button
        title="Check verification result"
        secondary
        disabled={busy}
        onPress={() => void load(!!data?.check && data.check.status === "PENDING")}
      />
      {error && <Notice text={error} error />}
    </View>
  );
}
