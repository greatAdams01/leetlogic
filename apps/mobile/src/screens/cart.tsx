import React, { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { useApp, useResource } from "../state";
import { api, uuid } from "../lib/api";
import { money, quantity as validateQuantity, type Listing } from "../lib/domain";
import { produceTotal } from "../lib/packaging";
import { Page, Card, Heading, Label, Button, Field, Notice, colors } from "../components/ui";
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
    <Card>
      <ListingPhoto item={item.listing} height={150} />
      <Heading>{item.listing.title}</Heading>
      <Label muted>{item.listing.farmerProfile.farmName}</Label>
      <Label muted>
        {a.ui("{quantity} {unit} available", {
          quantity: available,
          unit: a.unit(item.listing.unitCode),
        })}
      </Label>
      {Number(item.quantity) > available && (
        <Notice text="This produce is no longer available in that quantity." error />
      )}
      <Label>
        {money(item.listing.unitPriceMinor)} / {a.unit(item.listing.unitCode)}
      </Label>
      {item.listing.status !== "ACTIVE" && (
        <Notice text="This produce is no longer available." error />
      )}
      {changed && (
        <Notice text="The price changed. Update this item to accept the new price." error />
      )}
      <Field
        label="Order quantity"
        keyboardType="decimal-pad"
        value={quantity}
        onChangeText={setQuantity}
        editable={!busy}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Button
          title="Update cart"
          secondary
          disabled={busy}
          loading={saving}
          onPress={() => update(quantity)}
        />
        <Button title="Remove" secondary loading={removing} disabled={busy} onPress={remove} />
      </View>
      <Label style={{ color: colors.green, fontFamily: "NotoBold" }}>
        {money(produceTotal(item.quantity, item.listing.unitPriceMinor) || "0")}
      </Label>
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
      title="Cart"
      loading={r.loading}
      footer={
        items.length || attempt.current ? (
          <Button
            title={attempt.current ? "Retry checkout" : "Continue to delivery"}
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
                else a.go("orders");
              })
            }
          />
        ) : undefined
      }
    >
      {(error || r.error) && <Notice text={error || r.error} error />}
      <Label muted>
        Cart items are not reserved. Each produce item gets its own delivery quote and payment
        before checkout is complete.
      </Label>
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
        <Card>
          <Label>Produce subtotal</Label>
          <Heading>{money(total.toString())}</Heading>
          <Label muted>Delivery is quoted separately before payment.</Label>
        </Card>
      )}
      {!r.loading && !r.error && !items.length && !attempt.current && (
        <Notice text="Your cart is empty. Browse produce to add something." />
      )}
      <Button title="Continue shopping" secondary onPress={() => a.go("home")} />
      <Button title="Liked produce" secondary onPress={() => a.go("likes")} />
      <Button
        title="Refresh cart"
        secondary
        disabled={busy || !!attempt.current}
        onPress={() => void r.reload()}
      />
    </Page>
  );
}
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
