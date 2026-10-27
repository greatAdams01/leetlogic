import React, { useEffect, useRef, useState } from "react";
import { AppState, Image } from "react-native";
import { useApp, useResource } from "../state";
import { File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { api } from "../lib/api";
import { choosePhoto, photoBody } from "../lib/produce-photo";
import { AppSheet } from "./app-sheet";
import { Select } from "./Select";
import { Button, Card, Field, Heading, Label, Notice } from "./ui";
type Dispute = {
  id: string;
  subject: string;
  status: string;
  resolution: string | null;
  messages: { id: string; body: string }[];
  evidence: { id: string }[];
};
function EvidencePhoto({ path }: { path: string }) {
  const [uri, setUri] = useState<string | null>(null),
    [error, setError] = useState("");
  const a = useApp();
  useEffect(() => {
    let cancelled = false;
    let file: File | undefined;
    void api<{ bytes: Uint8Array; mime: string }>(path, { imageResponse: true })
      .then((result) => {
        if (cancelled) return;
        file = new File(
          Paths.cache,
          `dispute-${randomUUID()}.${result.mime === "image/png" ? "png" : "jpg"}`,
        );
        file.create();
        file.write(result.bytes);
        setUri(file.uri);
      })
      .catch((e) => {
        if (!cancelled) setError(a.error(e));
      });
    return () => {
      cancelled = true;
      try {
        if (file?.exists) file.delete();
      } catch {
        /* OS cache cleanup. */
      }
    };
  }, [path]);
  return error ? (
    <Notice text={error} error />
  ) : uri ? (
    <Image
      source={{ uri }}
      style={{ width: "100%", height: 180, borderRadius: 12 }}
      resizeMode="contain"
    />
  ) : (
    <Label>Loading…</Label>
  );
}
const reasons = [
  { value: "NOT_RECEIVED", label: "Order not received" },
  { value: "QUALITY", label: "Produce quality" },
  { value: "WRONG_ITEM", label: "Wrong produce" },
  { value: "QUANTITY", label: "Incorrect quantity" },
  { value: "OTHER", label: "Other issue" },
];
export function OrderDisputes({ orderId }: { orderId: string }) {
  const a = useApp(),
    r = useResource<{ items: Dispute[]; canOpen: boolean }>(`/orders/${orderId}/disputes`);
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState("NOT_RECEIVED"),
    [description, setDescription] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<string | null>(null);
  const running = useRef(false);
  const active = r.data?.items.some((item) => item.status !== "RESOLVED");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void r.reload();
    });
    const timer = setInterval(() => void r.reload(), 30000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [r.reload]);
  const submit = async () => {
    if (running.current) return;
    if (description.trim().length < 10) {
      setError(a.ui("Describe what went wrong in at least 10 characters."));
      return;
    }
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`/orders/${orderId}/disputes`, {
        method: "POST",
        body: { reason, description: description.trim(), sourceLocale: a.locale },
      });
      setOpen(false);
      setDescription("");
      await r.reload();
    } catch (e) {
      setError(a.error(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const attach = async (ticketId: string) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const photo = await choosePhoto(false);
      if (!photo) return;
      await api(`/orders/${orderId}/disputes/${ticketId}/evidence`, {
        method: "POST",
        binary: await photoBody(photo.uri, photo.mimeType),
      });
      await r.reload();
    } catch (e) {
      setError(a.error(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  if (r.data && !r.data.canOpen && !r.data.items.length && !r.error) return null;
  return (
    <>
      <Card>
        <Heading>Help with this order</Heading>
        <Label muted>
          Open a dispute if something is wrong with your order. Unresolved disputes block release of
          held produce payments.
        </Label>
        {r.error && <Notice text={r.error} error />}
        {!open && error && <Notice text={error} error />}
        {r.data?.items.map((item) => (
          <Card key={item.id}>
            <Label>
              {a.ui(
                reasons.find(
                  (reason) => reason.value === item.subject || reason.label === item.subject,
                )?.label || item.subject,
              )}
            </Label>
            <Label style={{ fontFamily: "NotoBold" }}>
              {a.ui(
                item.status === "RESOLVED"
                  ? "Resolved"
                  : item.status === "IN_PROGRESS"
                    ? "Under review"
                    : "Dispute submitted",
              )}
            </Label>
            {item.messages.map((message) => (
              <Label key={message.id}>{message.body}</Label>
            ))}
            {item.resolution && <Label>{item.resolution}</Label>}
            <Label>
              {a.ui("{count} evidence photos attached", { count: item.evidence.length })}
            </Label>
            {item.evidence.map((photo, index) => (
              <React.Fragment key={photo.id}>
                <Button
                  title={a.ui("View evidence photo {number}", { number: index + 1 })}
                  secondary
                  onPress={() => setPreview(preview === photo.id ? null : photo.id)}
                />
                {preview === photo.id && (
                  <EvidencePhoto
                    path={`/orders/${orderId}/disputes/${item.id}/evidence/${photo.id}`}
                  />
                )}
              </React.Fragment>
            ))}
            {item.status !== "RESOLVED" && item.evidence.length < 5 && (
              <Button
                title="Add evidence photo"
                secondary
                loading={busy}
                onPress={() => void attach(item.id)}
              />
            )}
          </Card>
        ))}
        {!active && r.data?.canOpen && (
          <Button
            title="Open Dispute"
            onPress={() => {
              setError("");
              setOpen(true);
            }}
          />
        )}
        <Button
          title="Refresh dispute status"
          secondary
          loading={r.loading}
          onPress={() => void r.reload()}
        />
      </Card>
      <AppSheet
        visible={open}
        title="Open Dispute"
        busy={busy}
        onClose={() => setOpen(false)}
        footer={
          <Button
            title="Submit dispute"
            loading={busy}
            disabled={description.trim().length < 10}
            onPress={() => void submit()}
          />
        }
      >
        {error && <Notice text={error} error />}
        <Select label="Reason" value={reason} options={reasons} onChange={setReason} />
        <Field
          label="Describe the issue"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={5000}
        />
        <Label muted>
          You can attach up to five evidence photos after submitting your dispute.
        </Label>
      </AppSheet>
    </>
  );
}
