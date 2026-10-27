import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppSheet } from "./app-sheet";
import MapView, { type Region } from "react-native-maps";
import { useApp } from "../state";
import { Button, Card, Heading, Label, Notice, colors } from "./ui";
import { captureFarmPosition, type FarmPoint } from "../lib/device-location";

const regionFor = (point: FarmPoint): Region => ({
  ...point,
  latitudeDelta: 0.006,
  longitudeDelta: 0.006,
});
export function FarmPin({
  value,
  onConfirm,
  disabled = false,
  context = "farm",
  autoLocate = false,
}: {
  value?: FarmPoint;
  onConfirm: (point: FarmPoint) => void | Promise<void>;
  disabled?: boolean;
  context?: "farm" | "buyer";
  autoLocate?: boolean;
}) {
  const a = useApp();
  const [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const [candidate, setCandidate] = useState<FarmPoint | undefined>(value);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const map = useRef<MapView>(null);
  const mapReady = useRef(false),
    pendingRegion = useRef<Region | null>(null);
  const active = useRef(true),
    running = useRef(false),
    confirming = useRef(false);
  const generation = useRef(0),
    gesture = useRef(false);
  const autoStarted = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      generation.current++;
    };
  }, []);
  const centreOn = (point: FarmPoint, precision: number | null = null) => {
    gesture.current = false;
    setMoving(false);
    setCandidate(point);
    setAccuracy(precision);
    pendingRegion.current = regionFor(point);
    if (mapReady.current) {
      map.current?.animateToRegion(pendingRegion.current, 350);
      pendingRegion.current = null;
    }
  };
  const locate = async () => {
    if (running.current || confirming.current) return;
    const request = ++generation.current;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const captured = await captureFarmPosition(context);
      if (active.current && request === generation.current) {
        centreOn(captured.point, captured.accuracy);
        setOpen(true);
      }
    } catch (e) {
      if (active.current && request === generation.current) setError(a.error(e));
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  };
  useEffect(() => {
    if (!autoLocate || value || autoStarted.current) return;
    autoStarted.current = true;
    void locate();
  }, [autoLocate, value]);
  const close = () => {
    if (confirming.current) return;
    generation.current++;
    mapReady.current = false;
    pendingRegion.current = null;
    setOpen(false);
    setError("");
    setMoving(false);
    gesture.current = false;
  };
  const confirm = async () => {
    if (!candidate || busy || moving || confirming.current) return;
    confirming.current = true;
    setSaving(true);
    setError("");
    try {
      await onConfirm({
        latitude: Number(candidate.latitude.toFixed(6)),
        longitude: Number(candidate.longitude.toFixed(6)),
      });
      if (active.current) {
        mapReady.current = false;
        pendingRegion.current = null;
        setOpen(false);
      }
    } catch (e) {
      if (active.current) setError(a.error(e));
    } finally {
      confirming.current = false;
      if (active.current) setSaving(false);
    }
  };
  return (
    <Card>
      <Heading>{context === "buyer" ? "Delivery location" : "Map location"}</Heading>
      <Label>
        {context === "buyer"
          ? "Your current location is selected by default. Confirm the pin or move it to the exact delivery point."
          : "Use your current location at the pickup point, then confirm the pin. Your address is still needed for delivery."}
      </Label>
      {value && <Notice text="Location pin confirmed." success />}
      <Button
        title={busy ? "Finding your location…" : "Use my current location"}
        loading={busy}
        disabled={disabled || busy}
        onPress={() => void locate()}
      />
      <Button
        title={value ? "View or adjust pin" : context === "buyer" ? "Choose delivery point on map" : "Choose location on map"}
        secondary
        disabled={disabled || busy}
        onPress={() => {
          mapReady.current = false;
          pendingRegion.current = null;
          setError("");
          setCandidate(value);
          setAccuracy(null);
          setMoving(false);
          gesture.current = false;
          setOpen(true);
        }}
      />
      {error && !open && <Notice text={error} error />}
      <AppSheet
        visible={open}
        title="Confirm map location"
        subtitle={context === "buyer" ? "Move the map to place the pin on your delivery point." : "Move the map to place the pin on your pickup point."}
        onClose={close}
        busy={saving}
        scroll={false}
        testID="farm-pin"
        closeLabel="Close map"
        footer={
          <>
            {accuracy !== null && (
              <Label muted>
                {a.ui("Location accuracy: about {meters} metres", {
                  meters: String(Math.ceil(accuracy)),
                })}
              </Label>
            )}
            {accuracy !== null && accuracy > 100 && (
              <Notice text="This location is approximate. Move outdoors and retry, or adjust the pin before confirming." />
            )}
            {error && <Notice text={error} error />}
            <Button
              title={busy ? "Finding your location…" : "Use my current location"}
              secondary
              loading={busy}
              disabled={busy || saving}
              onPress={() => void locate()}
            />
            <Button
              title={saving ? "Saving…" : "Confirm location pin"}
              loading={saving}
              disabled={!candidate || saving || busy || moving}
              onPress={() => void confirm()}
            />
          </>
        }
      >
        <View style={styles.map}>
          <MapView
            ref={map}
            style={StyleSheet.absoluteFill}
            loadingEnabled
            onMapReady={() => {
              mapReady.current = true;
              if (pendingRegion.current) {
                map.current?.animateToRegion(pendingRegion.current, 350);
                pendingRegion.current = null;
              }
            }}
            initialRegion={
              candidate
                ? regionFor(candidate)
                : { latitude: 9.08, longitude: 8.67, latitudeDelta: 10, longitudeDelta: 10 }
            }
            scrollEnabled={!saving && !busy}
            zoomEnabled={!saving && !busy}
            rotateEnabled={false}
            pitchEnabled={false}
            onTouchStart={() => {
              if (!saving && !busy) gesture.current = true;
            }}
            onPanDrag={() => {
              if (!saving && !busy) {
                gesture.current = true;
                setMoving(true);
              }
            }}
            onRegionChange={(_region, details) => {
              if (gesture.current || details?.isGesture) {
                gesture.current = true;
                setMoving(true);
              }
            }}
            onRegionChangeComplete={(region, details) => {
              if (!saving && !busy && (gesture.current || details?.isGesture)) {
                setCandidate({ latitude: region.latitude, longitude: region.longitude });
                setAccuracy(null);
              }
              gesture.current = false;
              setMoving(false);
            }}
            onPress={(event) => {
              if (!saving && !busy) centreOn(event.nativeEvent.coordinate);
            }}
            onPoiClick={(event) => {
              if (!saving && !busy) centreOn(event.nativeEvent.coordinate);
            }}
          />
          <View pointerEvents="none" style={styles.pinAnchor}>
            <View style={[styles.pinHead, !candidate && { backgroundColor: colors.muted }]}>
              <View style={styles.pinDot} />
            </View>
            <View style={[styles.pinTip, !candidate && { borderTopColor: colors.muted }]} />
          </View>
        </View>
      </AppSheet>
    </Card>
  );
}
const styles = StyleSheet.create({
  map: { flex: 1, minHeight: 80 },
  pinAnchor: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 34,
    height: 44,
    marginLeft: -17,
    marginTop: -44,
    alignItems: "center",
  },
  pinHead: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
    zIndex: 1,
  },
  pinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
  pinTip: {
    marginTop: -3,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 13,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.green,
  },
});
