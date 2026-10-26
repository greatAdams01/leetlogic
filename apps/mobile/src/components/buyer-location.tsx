import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, View } from "react-native";
import { useApp } from "../state";
import { Select } from "./Select";
import { Button, Card, Label, Notice, colors } from "./ui";
import { captureFarmPosition } from "../lib/device-location";
import { localGovernments, nigeriaStates } from "../lib/locations";
export type BuyerArea = {
  state: string;
  lga: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
};
const empty = (): BuyerArea => ({ state: "", lga: "" });
type LocationState = {
  area: BuyerArea;
  ready: boolean;
  busy: boolean;
  error: string;
  manual: boolean;
  setManual: React.Dispatch<React.SetStateAction<boolean>>;
  locate: () => Promise<void>;
  choose: (area: BuyerArea) => void;
  setRadius: (value: number) => void;
};
const LocationContext = createContext<LocationState | null>(null);
export function useBuyerLocation() {
  const value = useContext(LocationContext);
  if (!value) throw new Error("Buyer location provider is missing");
  return value;
}
export function BuyerLocationProvider({
  children,
  enabled: override,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const a = useApp();
  const key = `buyer-area:${a.user?.id || "guest"}`;
  const entry =
    a.role === "BUYER" && ["home", "search", "shoppingLocation"].includes(a.route?.name);
  const [activatedKey, setActivatedKey] = useState("");
  useEffect(() => {
    if (entry) setActivatedKey(key);
  }, [entry, key]);
  const enabled = override ?? (activatedKey === key && a.role === "BUYER");
  const [area, setArea] = useState<BuyerArea>(empty);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);
  const mode = useRef("device");
  const radius = useRef(50);
  const generation = useRef(0);
  const running = useRef(false);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const persist = (value: unknown) => {
    writes.current = writes.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, JSON.stringify(value)));
    void writes.current.catch(() => {});
  };
  const locate = async () => {
    if (running.current) return;
    const request = ++generation.current;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const captured = await captureFarmPosition("buyer");
      if (request !== generation.current) return;
      const next = { ...empty(), ...captured.point, radiusKm: radius.current };
      mode.current = "device";
      setArea(next);
      setManual(false);
      // Save the mode and radius, never precise device coordinates.
      persist({ mode: "device", radiusKm: radius.current });
    } catch (e) {
      if (request === generation.current) {
        setError(a.error(e));
        if (mode.current === "device") {
          setArea(empty());
        }
        setManual(true);
      }
    } finally {
      if (request === generation.current) {
        running.current = false;
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    if (!enabled) return;
    const request = ++generation.current;
    let initialized = false;
    running.current = false;
    setBusy(false);
    setReady(false);
    setError("");
    setArea(empty());
    void (async () => {
      let saved: any;
      try {
        const value = await AsyncStorage.getItem(key);
        saved = value ? JSON.parse(value) : null;
      } catch {
        /* Location remains optional. */
      }
      if (request !== generation.current) return;
      radius.current = [25, 50, 100, 200].includes(saved?.radiusKm) ? saved.radiusKm : 50;
      initialized = true;
      setReady(true);
      if (
        saved &&
        saved.mode !== "device" &&
        (saved.state === "" || nigeriaStates.includes(saved.state))
      ) {
        mode.current = "manual";
        const restored = {
          state: saved.state,
          lga: localGovernments(saved.state).includes(saved.lga) ? saved.lga : "",
        };
        setArea(restored);
        setManual(true);
      } else {
        mode.current = "device";
        await locate();
      }
    })();
    const sub = AppState.addEventListener("change", (state) => {
      if (initialized && state === "active" && mode.current === "device") void locate();
    });
    return () => {
      generation.current++;
      running.current = false;
      sub.remove();
    };
  }, [key, enabled]);
  const choose = (next: BuyerArea) => {
    generation.current++;
    running.current = false;
    setBusy(false);
    setError("");
    mode.current = "manual";
    setArea(next);
    persist(next);
  };
  const setRadius = (value: number) => {
    radius.current = value;
    setArea((current) => ({ ...current, radiusKm: value }));
    persist({ mode: "device", radiusKm: value });
  };
  return (
    <LocationContext.Provider
      value={{ area, ready, busy, error, manual, setManual, locate, choose, setRadius }}
    >
      {children}
    </LocationContext.Provider>
  );
}
export function BuyerLocation({ onChange }: { onChange?: (area: BuyerArea) => void }) {
  const a = useApp();
  const { area, ready, busy, error, manual, setManual, locate, choose, setRadius } =
    useBuyerLocation();
  useEffect(() => {
    onChange?.(area);
  }, [area, onChange]);
  const located = area.latitude !== undefined && area.longitude !== undefined;
  return (
    <Card>
      <Label style={{ fontFamily: "NotoBold", color: colors.green }}>Shop near you</Label>
      <Label muted>
        {located
          ? "Showing farmers near your current location."
          : "Use your device location to find nearby farmers."}
      </Label>
      <Button
        title={located ? "Refresh my location" : "Use my current location"}
        loading={busy}
        disabled={!ready || busy}
        onPress={() => void locate()}
      />
      {located && (
        <Select
          label="Search distance"
          value={String(area.radiusKm || 50)}
          options={[25, 50, 100, 200].map((km) => ({
            value: String(km),
            label: a.ui("Within {distance} km", { distance: km }),
          }))}
          onChange={(value) => setRadius(Number(value))}
        />
      )}
      {!!error && <Notice text={error} error />}
      <Button
        title={manual ? "Hide area filters" : "Choose a different area"}
        secondary
        disabled={!ready}
        onPress={() => setManual((value) => !value)}
      />
      {manual && (
        <View style={{ gap: 12 }}>
          <Select
            label="State"
            value={area.state}
            disabled={!ready}
            options={[{ value: "", label: "All Nigeria" }, ...nigeriaStates]}
            onChange={(state) => choose({ state, lga: "" })}
          />
          {!!area.state && (
            <Select
              label="Local government"
              value={area.lga}
              options={[
                { value: "", label: "All local governments" },
                ...localGovernments(area.state),
              ]}
              onChange={(lga) => choose({ state: area.state, lga })}
            />
          )}
        </View>
      )}
    </Card>
  );
}
