import React, { useEffect, useRef, useState } from "react";
import { Modal, View } from "react-native";
import MapView, { Marker, type MapPressEvent } from "react-native-maps";
import { useApp } from "../state";
import { Button, Card, Heading, Label, Notice, Page } from "./ui";
import { captureFarmPosition, type FarmPoint } from "../lib/device-location";

export function FarmPin({
  value,
  onConfirm,
  disabled = false,
}: {
  value?: FarmPoint;
  onConfirm: (point: FarmPoint) => void | Promise<void>;
  disabled?: boolean;
}) {
  const a = useApp();
  const [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const [candidate, setCandidate] = useState<FarmPoint | undefined>(value);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const active = useRef(true),
    running = useRef(false),
    confirming = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const locate = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const captured = await captureFarmPosition();
      if (active.current) {
        setCandidate(captured.point);
        setAccuracy(captured.accuracy);
        setOpen(true);
      }
    } catch (e) {
      if (active.current) setError(a.error(e));
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  };
  const select = (point: FarmPoint) => {
    setCandidate(point);
    setAccuracy(null);
  };
  const close = () => {
    if (!saving) {
      setOpen(false);
      setError("");
    }
  };
  return (
    <Card>
      <Heading>Map location</Heading>
      <Label>
        Use your current location at the pickup point, then confirm the pin. Your address is still
        needed for delivery.
      </Label>
      {value && <Notice text="Location pin confirmed." success />}
      <Button
        title={busy ? "Finding your location…" : "Use my current location"}
        loading={busy}
        disabled={disabled || busy}
        onPress={() => void locate()}
      />
      <Button
        title={value ? "View or adjust pin" : "Choose location on map"}
        secondary
        disabled={disabled || busy}
        onPress={() => {
          setError("");
          setCandidate(value);
          setAccuracy(null);
          setOpen(true);
        }}
      />
      {error && !open && <Notice text={error} error />}
      {open && (
        <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
          <Page
            title="Confirm map location"
            back={saving ? undefined : close}
            footer={
              <Button
                title={saving ? "Saving…" : "Confirm location pin"}
                loading={saving}
                disabled={!candidate || saving}
                onPress={async () => {
                  if (!candidate || confirming.current) return;
                  confirming.current = true;
                  setSaving(true);
                  setError("");
                  try {
                    await onConfirm({
                      latitude: Number(candidate.latitude.toFixed(6)),
                      longitude: Number(candidate.longitude.toFixed(6)),
                    });
                    if (active.current) setOpen(false);
                  } catch (e) {
                    if (active.current) setError(a.error(e));
                  } finally {
                    confirming.current = false;
                    if (active.current) setSaving(false);
                  }
                }}
              />
            }
          >
            <Label>Tap the map or drag the pin to the collection point.</Label>
            {accuracy !== null && (
              <Label>
                {a.ui("Location accuracy: about {meters} metres", {
                  meters: String(Math.ceil(accuracy)),
                })}
              </Label>
            )}
            {accuracy !== null && accuracy > 100 && (
              <Notice text="This location is approximate. Move outdoors and retry, or adjust the pin before confirming." />
            )}
            <View style={{ height: 360, borderRadius: 16, overflow: "hidden" }}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: candidate?.latitude ?? 9.08,
                  longitude: candidate?.longitude ?? 8.67,
                  latitudeDelta: candidate ? 0.006 : 10,
                  longitudeDelta: candidate ? 0.006 : 10,
                }}
                onPress={(event: MapPressEvent) => {
                  if (!saving) select(event.nativeEvent.coordinate);
                }}
              >
                {candidate && (
                  <Marker
                    coordinate={candidate}
                    draggable={!saving}
                    onDragEnd={(event) => select(event.nativeEvent.coordinate)}
                  />
                )}
              </MapView>
            </View>
            {error && <Notice text={error} error />}
            <Button title="Cancel" secondary disabled={saving} onPress={close} />
          </Page>
        </Modal>
      )}
    </Card>
  );
}
