import React, { useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { useApp, useResource } from "../state";
import { api, uuid } from "../lib/api";
import { money, quantity as validateQuantity, type Listing } from "../lib/domain";
import { produceTotal } from "../lib/packaging";
import { Page, Card, Heading, Label, Button, Notice, Icon, colors } from "../components/ui";
import { ListingPhoto } from "../components/listing-photo";
type CartLine = { listingId: string; quantity: string; unitPriceMinor: string; listing: Listing };
function CartRow({
  item,
  busy,
  saving,
  removing,
  update,
  remove,
}: {
  item: CartLine;
  busy: boolean;
  saving: boolean;
  removing: boolean;
  update: (quantity: string) => void;
  remove: () => void;
}) {
  const a = useApp(),
    [quantity, setQuantity] = useState(item.quantity);
  useEffect(() => setQuantity(item.quantity), [item.quantity]);
  const changed = item.unitPriceMinor !== item.listing.unitPriceMinor;
  const available = Math.max(
    0,
    Number(item.listing.availableQuantity) - Number(item.listing.reservedQuantity),
  );
  return (
    <Card style={cartStyles.itemCard}>
      <View style={cartStyles.produceRow}>
        <View style={cartStyles.photo}>
          <ListingPhoto item={item.listing} height={80} radius={10} />
        </View>
        <View style={cartStyles.itemDetails}>
          <Label style={cartStyles.itemTitle}>{item.listing.title}</Label>
          <Label muted style={cartStyles.itemMeta} numberOfLines={1}>
            {item.listing.farmerProfile.farmName} · {item.listing.locationAddress?.city || item.listing.locationAddress?.state}
          </Label>
          {item.listing.farmerProfile.verificationStatus === "VERIFIED" && (
            <Label style={cartStyles.verified}>✓ Verified farmer</Label>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a.ui("Remove")}
          disabled={busy}
          hitSlop={12}
          onPress={remove}
          style={cartStyles.remove}
        >
          <Icon name="cartRemove" size={18} />
        </Pressable>
      </View>
      {Number(item.quantity) > available && (
        <Notice text="This produce is no longer available in that quantity." error />
      )}
      {item.listing.status !== "ACTIVE" && (
        <Notice text="This produce is no longer available." error />
      )}
      {changed && (
        <Notice text="The price changed. Update this item to accept the new price." error />
      )}
      <View style={cartStyles.divider} />
      <View style={cartStyles.quantityRow}>
        <View>
          <Label muted style={cartStyles.quantityLabel}>
            {quantity} {a.unit(item.listing.unitCode).toLowerCase()}
          </Label>
          <Label style={cartStyles.price}>
            {money(produceTotal(quantity, item.listing.unitPriceMinor) || "0")}
          </Label>
        </View>
        <View style={cartStyles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui("Decrease quantity")}
            disabled={busy || Number(quantity) <= 1}
            onPress={() => setQuantity(String(Math.max(1, Number(quantity) - 1)))}
          >
            <Icon name="cartMinus" size={20} />
          </Pressable>
          <Label style={cartStyles.stepperValue}>{quantity}</Label>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui("Increase quantity")}
            disabled={busy || Number(quantity) >= available}
            onPress={() => setQuantity(String(Number(quantity) + 1))}
          >
            <Icon name="cartPlus" size={20} />
          </Pressable>
        </View>
      </View>
      {quantity !== item.quantity && (
        <Button
          title="Update cart"
          secondary
          disabled={busy}
          loading={saving}
          onPress={() => update(quantity)}
        />
      )}
      {removing && <Label muted>Removing…</Label>}
    </Card>
  );
}
export function Cart() {
  const a = useApp(),
    r = useResource<{ items: CartLine[] }>("/shopping/cart"),
    [busy, setBusy] = useState(false),
    [activeRow, setActiveRow] = useState<string | null>(null),
    [error, setError] = useState("");
  const running = useRef(false),
    attempt = useRef<{
      key: string;
      body: { items: { listingId: string; quantity: string; unitPriceMinor: string }[] };
    } | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !running.current) void r.reload();
    });
    return () => sub.remove();
  }, [r.reload]);
  const items = r.data?.items || [];
  const total = items.reduce(
    (sum, item) => sum + BigInt(produceTotal(item.quantity, item.listing.unitPriceMinor) || "0"),
    0n,
  );
  const run = async (action: () => Promise<void>, row: string | null = null) => {
    if (running.current) return;
    running.current = true;
    setActiveRow(row);
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(a.error(e));
    } finally {
      running.current = false;
      setActiveRow(null);
      setBusy(false);
    }
  };
  return (
    <Page
      loading={r.loading}
      header={
        <View style={cartStyles.header}>
          <Heading>My cart</Heading>
          {!!items.length && (
            <Label style={cartStyles.count}>{items.length} {items.length === 1 ? "item" : "items"}</Label>
          )}
        </View>
      }
      contentStyle={cartStyles.body}
      footer={
        items.length || attempt.current ? (
          <View style={cartStyles.checkout}>
            <View style={cartStyles.subtotalRow}>
              <Label muted>Subtotal ({items.reduce((sum, item) => sum + Number(item.quantity), 0)} units)</Label>
              <Label style={cartStyles.subtotal}>{money(total.toString())}</Label>
            </View>
            <Label muted style={cartStyles.deliveryNext}>Delivery calculated next</Label>
            <Button
              title={attempt.current ? "Retry checkout" : "Checkout"}
              loading={busy && activeRow === null}
              disabled={busy || !!r.error}
              onPress={() =>
                void run(async () => {
                attempt.current ??= {
                  key: uuid(),
                  body: {
                    items: items.map(({ listingId, quantity, unitPriceMinor }) => ({
                      listingId,
                      quantity,
                      unitPriceMinor,
                    })),
                  },
                };
                let result: { orders: { id: string }[] };
                try {
                  result = await api("/shopping/cart/checkout", {
                    method: "POST",
                    key: attempt.current.key,
                    body: attempt.current.body,
                  });
                } catch (e) {
                  const status = (e as { status?: number }).status;
                  if (status && status >= 400 && status < 500 && status !== 408) {
                    attempt.current = null;
                    await r.reload();
                  }
                  throw e;
                }
                attempt.current = null;
                if (result.orders.length === 1) a.go("delivery", result.orders[0]!.id);
                else a.go("orders", undefined, "checkout");
                })
              }
            />
          </View>
        ) : undefined
      }
    >
      {(error || r.error) && <Notice text={error || r.error} error />}
      {items.map((item) => (
        <CartRow
          key={item.listingId}
          item={item}
          busy={busy || !!attempt.current}
          saving={busy && activeRow === item.listingId}
          removing={busy && activeRow === `remove:${item.listingId}`}
          update={(quantity) =>
            void run(async () => {
              validateQuantity(quantity);
              if (
                item.listing.unit &&
                !item.listing.unit.allowsDecimal &&
                !Number.isInteger(Number(quantity))
              )
                throw new Error("Enter a whole quantity for this selling unit.");
              await api(`/shopping/cart/${item.listingId}`, {
                method: "PUT",
                body: { quantity, unitPriceMinor: item.listing.unitPriceMinor },
              });
              await r.reload();
            }, item.listingId)
          }
          remove={() =>
            void run(async () => {
              await api(`/shopping/cart/${item.listingId}`, { method: "DELETE" });
              await r.reload();
            }, `remove:${item.listingId}`)
          }
        />
      ))}
      {!!items.length && (
        <Card style={cartStyles.guarantee}>
          <Icon name="cartShield" size={22} />
          <View style={{ flex: 1, gap: 4 }}>
            <Label style={cartStyles.guaranteeTitle}>Direct from farmer depot</Label>
            <Label muted style={cartStyles.guaranteeCopy}>
              Escrow protected. Farmer is paid after arrival verification.
            </Label>
          </View>
        </Card>
      )}
      {!r.loading && !r.error && !items.length && !attempt.current && (
        <Notice text="Your cart is empty. Browse produce to add something." />
      )}
      {!items.length && <Button title="Continue shopping" onPress={() => a.go("home")} />}
    </Page>
  );
}

const cartStyles = StyleSheet.create({
  header: { minHeight: 83, paddingHorizontal: 24, paddingVertical: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { color: colors.green, backgroundColor: colors.mint, borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 4, fontFamily: "NotoBold", fontSize: 14, lineHeight: 20 },
  body: { paddingHorizontal: 24, paddingTop: 16, gap: 20 },
  itemCard: { borderRadius: 16, padding: 16, gap: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  produceRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  photo: { width: 80, height: 80 },
  itemDetails: { flex: 1, gap: 4, minWidth: 0 },
  itemTitle: { fontFamily: "Montserrat", fontSize: 18, lineHeight: 26 },
  itemMeta: { fontSize: 14, lineHeight: 20 },
  verified: { alignSelf: "flex-start", color: colors.green, backgroundColor: colors.mint, borderRadius: 999, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 4, fontFamily: "NotoBold", fontSize: 14, lineHeight: 20 },
  remove: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  divider: { height: 1, backgroundColor: colors.line },
  quantityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  quantityLabel: { fontSize: 14, lineHeight: 20 },
  price: { color: "#6b4a2f", fontFamily: "Montserrat", fontSize: 24, lineHeight: 35 },
  stepper: { height: 40, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 16 },
  stepperValue: { minWidth: 12, textAlign: "center", fontFamily: "NotoBold" },
  guarantee: { backgroundColor: "#f2f0ec", borderRadius: 16, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  guaranteeTitle: { fontFamily: "NotoBold", fontSize: 16, lineHeight: 23 },
  guaranteeCopy: { fontSize: 14, lineHeight: 20 },
  checkout: { gap: 10 },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  subtotal: { fontFamily: "NotoBold" },
  deliveryNext: { fontSize: 14, lineHeight: 20 },
});
export function LikedProduce() {
  const a = useApp(),
    r = useResource<{ items: { listing: Listing }[] }>("/shopping/likes");
  return (
    <Page title="Liked produce" back={a.back} loading={r.loading}>
      {r.error && <Notice text={r.error} error />}
      {!r.loading && !r.error && !r.data?.items.length && (
        <Notice text="No liked produce yet. Tap the heart on a product to save it." />
      )}
      {r.data?.items.map(({ listing }) => (
        <Card key={listing.id}>
          <ListingPhoto item={listing} height={180} />
          <Heading>{listing.title}</Heading>
          <Button title="View produce" onPress={() => a.go("product", listing.id)} />
        </Card>
      ))}
    </Page>
  );
}
