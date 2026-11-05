import React, { useRef, useState } from "react";
import { Image, View } from "react-native";
import { useApp } from "../state";
import { choosePhoto, photoBody } from "../lib/produce-photo";
import { api } from "../lib/api";
import { AppSheet } from "./app-sheet";
import { Button, Icon, Label, Notice } from "./ui";
export function ReceiptConfirmation({
  orderId,
  visible,
  onClose,
  onConfirmed,
}: {
  orderId: string;
  visible: boolean;
  onClose: () => void;
  onConfirmed: () => Promise<unknown>;
}) {
  const a = useApp(),
    running = useRef(false);
  const [photo, setPhoto] = useState<Awaited<ReturnType<typeof choosePhoto>>>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pick = async (camera: boolean) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const selected = await choosePhoto(camera);
      if (selected) setPhoto(selected);
    } catch (e) {
      setError(a.error(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const submit = async () => {
    if (running.current || !photo) return;
    a.alert(
      "Confirm Receipt",
      "I have inspected all the goods. Confirming starts the farmer’s payment release after the required checks.",
      [
        { text: "Go back", style: "cancel" },
        {
          text: "Confirm Receipt",
          onPress: () => {
            void save();
          },
        },
      ],
    );
  };
  const save = async () => {
    if (running.current || !photo) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`/orders/${orderId}/delivery/receipt-photo`, {
        method: "POST",
        binary: await photoBody(photo.uri, photo.mimeType),
      });
      await api(`/orders/${orderId}/delivery/confirm`, {
        method: "POST",
        body: { acknowledged: true },
      });
      await onConfirmed();
      setPhoto(null);
      onClose();
    } catch (e) {
      setError(a.error(e));
      await onConfirmed().catch(() => {});
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <AppSheet
      visible={visible}
      title="Inspect your goods"
      busy={busy}
      onClose={onClose}
      footer={
        <Button
          title="Confirm Receipt"
          loading={busy}
          disabled={!photo || busy}
          onPress={() => void submit()}
        />
      }
    >
      <View style={{ alignItems: "center", padding: 16 }}>
        <View
          style={{
            width: 92,
            height: 92,
            borderRadius: 46,
            backgroundColor: "#14532d",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="receiptClipboard" nativeSize={{ width: 44, height: 44 }} />
        </View>
      </View>
      <Label>Check the quantity, produce and condition.</Label>
      <Label muted>
        Add a clear photo of the goods received. Your photo is saved privately with this order.
      </Label>
      {photo && (
        <Image
          accessibilityLabel="Receipt photo preview"
          source={{ uri: photo.uri }}
          style={{ width: "100%", height: 200, borderRadius: 16 }}
          resizeMode="contain"
        />
      )}
      <Button
        title={photo ? "Replace photo" : "Choose photo"}
        secondary
        disabled={busy}
        onPress={() => void pick(false)}
      />
      <Button title="Take photo" secondary disabled={busy} onPress={() => void pick(true)} />
      <Notice text="Confirming starts payment release to the farmer after the required checks. If anything is missing or damaged, go back and report a problem." />
      {!!error && <Notice text={error} error />}
    </AppSheet>
  );
}
