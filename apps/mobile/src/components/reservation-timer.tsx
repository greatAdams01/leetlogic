import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { Label, colors } from "./ui";

export function ReservationTimer({ expiresAt }: { expiresAt?: string | null }) {
  const a = useApp();
  const [now, setNow] = useState(Date.now());
  const deadline = expiresAt ? new Date(expiresAt).getTime() : NaN;
  useEffect(() => {
    setNow(Date.now());
    if (!Number.isFinite(deadline) || deadline <= Date.now()) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= deadline) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  if (!Number.isFinite(deadline)) return null;
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const urgent = seconds <= 180;
  return (
    <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5,
      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
      backgroundColor: urgent ? "#fff2df" : colors.mint }}>
      <Label style={{ fontSize: 13, color: urgent ? "#8a4b08" : colors.green }}>◷</Label>
      <Label style={{ fontSize: 12, color: urgent ? "#8a4b08" : colors.green, fontVariant: ["tabular-nums"] }}>
        {seconds > 0
          ? a.ui("Pay within {time} · stock reserved", { time })
          : a.ui("Checkout time expired")}
      </Label>
    </View>
  );
}
