import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../state";
import { api } from "../lib/api";
import { quantity, type Listing } from "../lib/domain";
import { Button, Field, Heading, Label, Notice, colors } from "./ui";

export function SmallAction({
  title,
  onPress,
  muted = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, muted && styles.muted, disabled && { opacity: 0.5 }]}
    >
      <Label
        style={{ fontSize: 14, fontFamily: "NotoBold", color: muted ? "#78716c" : colors.green }}
      >
        {title}
      </Label>
    </Pressable>
  );
}
export function ListingControls({
  item,
  onUpdated,
}: {
  item: Listing;
  onUpdated: () => Promise<void>;
}) {
  const a = useApp();
  const [editing, setEditing] = useState(false),
    [stock, setStock] = useState(item.availableQuantity);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = async (body: { availableQuantity?: string; status?: "ACTIVE" | "PAUSED" }) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/marketplace/my-listings/${item.id}/inventory`, { method: "PATCH", body });
      await onUpdated();
      setEditing(false);
    } catch (e) {
      setError(a.error(e));
    } finally {
      setBusy(false);
    }
  };
  if (!["ACTIVE", "PAUSED", "SOLD_OUT"].includes(item.status)) return null;
  return (
    <>
      <View style={styles.actions}>
        <SmallAction
          title="Restock"
          disabled={busy}
          onPress={() => {
            setStock(item.availableQuantity);
            setError("");
            setEditing(true);
          }}
        />
        <SmallAction
          title={item.status === "PAUSED" ? "Resume" : "Pause"}
          muted
          disabled={busy}
          onPress={() => void change({ status: item.status === "PAUSED" ? "ACTIVE" : "PAUSED" })}
        />
        {busy && !editing && <ActivityIndicator color={colors.green} />}
      </View>
      {error && !editing && <Notice text={error} error />}
      <Modal
        visible={editing}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setEditing(false);
        }}
      >
        <View style={styles.overlay}>
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <Heading>Update stock</Heading>
            <Label>{item.title}</Label>
            <Label>
              Enter the total stock you have, including quantities reserved for existing orders.
            </Label>
            <Field
              label="Total stock"
              value={stock}
              keyboardType="decimal-pad"
              onChangeText={setStock}
            />
            <Label>
              {a.ui("Reserved for orders: {quantity} {unit}", {
                quantity: item.reservedQuantity,
                unit: a.unit(item.unitCode),
              })}
            </Label>
            {error && <Notice text={error} error />}
            <Button
              title="Save stock"
              loading={busy}
              disabled={busy}
              onPress={() => {
                try {
                  quantity(stock);
                  void change({ availableQuantity: stock });
                } catch (e) {
                  setError(a.error(e));
                }
              }}
            />
            <Button title="Cancel" secondary disabled={busy} onPress={() => setEditing(false)} />
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  action: {
    backgroundColor: "#ecfdf5",
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: "center",
  },
  muted: { backgroundColor: "#f2f0ec" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
});
