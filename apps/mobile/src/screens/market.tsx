import { saleUnitLabel } from "../../../../packages/contracts/src/sale-packaging";
import { ReservationTimer } from "../components/reservation-timer";
import { ProductActions } from "../components/product-actions";
import { BuyerSearch } from "../components/buyer-search";
import { BuyerEscrow } from "../components/buyer-escrow";
import {
  CategoryTiles,
  ProduceGrid,
  FeaturedProduce,
  categoryTitle,
  type BuyerCategory,
} from "../components/buyer-discovery";
import { useBuyerLocation } from "../components/buyer-location";
import { ListingGallery } from "../components/listing-gallery";
import { LocalizedText as Text } from "../localization";
import React, { useEffect, useRef, useState } from "react";
import { AppState, View, Pressable } from "react-native";
import { useApp, useResource } from "../state";
import {
  Page,
  Heading,
  Label,
  Field,
  Button,
  Card,
  Icon,
  Notice,
  s,
  colors,
} from "../components/ui";
import { estimatedPacking, produceTotal } from "../lib/packaging";
import { Select } from "../components/Select";
import { api } from "../lib/api";
import { money, quantity, type Listing, type Order } from "../lib/domain";
export { ListingPhoto } from "../components/listing-photo";
export function Market() {
  const a = useApp(),
    [query, setQuery] = useState(a.route.query || ""),
    [category, setCategory] = useState(a.route.id || ""),
    [maxPrice, setMaxPrice] = useState("");
  const { area, busy: locating } = useBuyerLocation();
  const r = useResource<{ items: Listing[] }>(
      `/marketplace/listings?search=${encodeURIComponent(query)}${category ? "&categoryId=" + category : ""}${maxPrice ? "&maxPriceMinor=" + (BigInt(maxPrice) * 100n).toString() : ""}${area.state ? "&state=" + encodeURIComponent(area.state) : ""}${area.lga ? "&lga=" + encodeURIComponent(area.lga) : ""}${area.latitude !== undefined && area.longitude !== undefined ? `&latitude=${area.latitude}&longitude=${area.longitude}&radiusKm=${area.radiusKm || 50}` : ""}`,
    ),
    c = useResource<{
      items: BuyerCategory[];
    }>("/marketplace/categories");
  useEffect(() => {
    setCategory(a.route.id || "");
    setQuery(a.route.query || "");
  }, [a.route.name, a.route.id, a.route.query]);
  const searchProduce = (value: string) => {
    setQuery(value);
    if (a.route.name === "home") a.go("search", category || undefined, value);
  };
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void c.reload();
        void r.reload();
      }
    });
    return () => sub.remove();
  }, [c.reload, r.reload]);
  useEffect(() => {
    if (c.data && category && !c.data.items.some((item) => item.id === category)) setCategory("");
  }, [c.data, category]);
  return (
    <Page loading={r.loading} contentStyle={{ paddingHorizontal: 24, paddingTop: 16, gap: 24 }}>
      {a.route.name !== "home" ? (
        <View style={s.between}>
          <View style={s.row}>
            <Icon name="buyerLogo" nativeSize={{ width: 28, height: 28 }} />
            <Label style={{ fontFamily: "Montserrat", fontSize: 23, color: colors.green }}>
              LeetLogic
            </Label>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui("My account")}
            onPress={() => a.go("profile")}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.green,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="buyerAccount" nativeSize={{ width: 20, height: 20 }} />
          </Pressable>
        </View>
      ) : (
        <View style={s.between}>
          <View style={s.row}>
            <Icon name="leaf" nativeSize={{ width: 36, height: 36 }} />
            <View>
              <Label muted>Leetlogic Farmlink</Label>
              <Label style={{ color: colors.green, fontFamily: "NotoBold" }}>
                ● Direct trade live
              </Label>
            </View>
          </View>
          <Pressable
            accessibilityLabel="Notifications"
            accessibilityRole="button"
            onPress={() => a.go("notifications")}
          >
            <Icon name="bell" nativeSize={{ width: 22, height: 22 }} />
          </Pressable>
        </View>
      )}
      {a.route.name === "search" && (
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui("Go back")}
            onPress={() => (a.canGoBack ? a.back() : a.reset("home"))}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "#f2f0ec",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="buyerBack" nativeSize={{ width: 20, height: 20 }} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Label style={{ fontFamily: "Montserrat", fontSize: 22 }}>
              {query ||
                (category
                  ? categoryTitle(
                      c.data?.items.find((item) => item.id === category) || {
                        id: category,
                        slug: "",
                        translations: [],
                      },
                      a.locale,
                    )
                  : a.ui("Fresh from the farm"))}
            </Label>
          </View>
          <BuyerSearch compact value={query} onSearch={searchProduce} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui("Change shopping location")}
            onPress={() => a.go("shoppingLocation")}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.green,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="buyerFilterActive" nativeSize={{ width: 20, height: 20 }} />
          </Pressable>
        </View>
      )}
      {a.route.name === "home" && (
        <>
          <View style={{ gap: 6 }}>
            <Label style={{ fontFamily: "Montserrat", fontSize: 21, lineHeight: 30 }}>
              {a.ui("Hello, {name}.", {
                name:
                  a.user?.profile?.displayName ||
                  a.user?.profile?.fullName?.split(" ")[0] ||
                  a.ui("there"),
              })}
            </Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={a.ui("Change shopping location")}
                onPress={() => a.go("shoppingLocation")}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32 }}
              >
                <Icon name="pin" nativeSize={{ width: 22, height: 22 }} />
                <Label>
                  {locating
                    ? "Finding your location…"
                    : area.latitude !== undefined
                      ? "Using current location"
                      : area.state
                        ? [area.lga, area.state].filter(Boolean).join(", ")
                        : "Set shopping location"}
                </Label>
              </Pressable>
              {a.user?.phoneVerifiedAt && (
                <View
                  style={{
                    backgroundColor: "#fff0ce",
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Label style={{ color: "#6b4a2f", fontSize: 14 }}>Verified buyer</Label>
                </View>
              )}
            </View>
          </View>
          <BuyerSearch value={query} onSearch={searchProduce} />
          <BuyerEscrow />
        </>
      )}
      <View style={{ gap: 16 }}>
        <View style={s.between}>
          <Text style={s.sectionTitle}>Categories</Text>
          <Pressable accessibilityRole="button" onPress={() => a.go("categories")}>
            <Label style={s.link}>See all</Label>
          </Pressable>
        </View>
        <CategoryTiles
          items={a.route.name === "home" ? (c.data?.items || []).slice(0, 4) : c.data?.items || []}
          selected={category}
          compact
          chips={a.route.name === "search"}
          onChoose={(id) => {
            if (a.route.name === "home") a.go("search", id);
            else setCategory(id);
          }}
        />
      </View>
      {a.route.name === "search" && (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Select
              label="Maximum price per selling unit"
              value={maxPrice}
              options={[
                { value: "", label: "Any price" },
                ...[1000, 5000, 10000, 50000].map((value) => ({
                  value: String(value),
                  label: money(value * 100),
                })),
              ]}
              onChange={setMaxPrice}
            />
          </View>
        </>
      )}
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Text style={{ ...s.sectionTitle, fontSize: 21 }}>Fresh from the farm</Text>
          {a.route.name === "home" && (
            <View
              style={{
                backgroundColor: colors.mint,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Label style={{ color: colors.green, fontSize: 14 }}>Direct</Label>
            </View>
          )}
        </View>
        {r.error && (
          <>
            <Notice text={r.error} error />
            <Button title="Try again" secondary onPress={() => void r.reload()} />
          </>
        )}
        {!r.loading && !r.error && !r.data?.items.length && (
          <Notice
            text={
              area.latitude !== undefined
                ? "No produce found within this distance. Try a wider distance or choose another area."
                : "No produce matches this search yet. Try another category or check back soon."
            }
          />
        )}
        {!r.loading &&
          (a.route.name === "home" ? (
            <FeaturedProduce items={r.data?.items || []} />
          ) : (
            <ProduceGrid items={r.data?.items || []} />
          ))}
      </View>
      {a.role === "SELLER" && (
        <Button title="My produce listings" onPress={() => a.go("myListings")} />
      )}
    </Page>
  );
}
export function Product() {
  const a = useApp();
  const r = useResource<{ item: Listing }>(`/marketplace/listings/${a.route.id}`);
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shopping = useResource<{ liked: boolean; cartQuantity: string | null }>(
    `/shopping/listings/${a.route.id}`,
    !!a.user,
  );
  const [liking, setLiking] = useState(false);
  const likingNow = useRef(false);
  const [translation, setTranslation] = useState("");
  const submitting = useRef(false);
  const item = r.data?.item;
  const available = item
    ? Math.max(0, Number(item.availableQuantity) - Number(item.reservedQuantity))
    : 0;
  const total = item ? produceTotal(qty, item.unitPriceMinor) : null;
  const estimate = item ? estimatedPacking(item.packaging, qty) : null;
  const changeQuantity = (value: string) => {
    setQty(value);
    setError("");
  };
  const minimum = item?.unit?.allowsDecimal ? 0.001 : 1;
  const quantityIssue =
    !item || !qty
      ? ""
      : !/^\d+(\.\d{1,3})?$/.test(qty) || Number(qty) <= 0
        ? "Enter a positive quantity with at most three decimal places."
        : item.unit && !item.unit.allowsDecimal && !Number.isInteger(Number(qty))
          ? "Enter a whole quantity for this selling unit."
          : total === null
            ? "Choose a quantity that produces a whole kobo total."
            : Number(qty) > available
              ? "This produce is no longer available in that quantity."
              : "";
  return (
    <Page
      loading={r.loading}
      header={
        <View
          style={{
            paddingHorizontal: 24,
            height: 76,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui("Go back")}
            onPress={a.back}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "#f2f0ec",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="productBack" nativeSize={{ width: 22, height: 22 }} />
          </Pressable>
          {item && (
            <ProductActions
              item={item}
              liked={!!shopping.data?.liked}
              busy={liking || (!!a.user && (shopping.loading || !!shopping.error))}
              onLike={() => {
                if (!a.user) {
                  a.go("phone");
                  return;
                }
                if (likingNow.current) return;
                likingNow.current = true;
                setLiking(true);
                setError("");
                void api(`/shopping/likes/${item.id}`, {
                  method: "PUT",
                  body: { liked: !shopping.data?.liked },
                })
                  .then(() => shopping.reload())
                  .catch((e) => setError(a.error(e)))
                  .finally(() => {
                    likingNow.current = false;
                    setLiking(false);
                  });
              }}
            />
          )}
        </View>
      }
    >
      {!!r.error && <Notice text={r.error} error />}
      {!!error && <Notice text={error} error />}
      {!!shopping.error && (
        <>
          <Notice text={shopping.error} error />
          <Button title="Try again" secondary onPress={() => void shopping.reload()} />
        </>
      )}
      {item && (
        <>
          <ListingGallery key={item.id} item={item} />
          <Card style={{ borderRadius: 16, boxShadow: "0px 1px 1px rgba(0,0,0,0.05)" }}>
            <View style={{ flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Label>{item.title}</Label>
                {!!(translation || item.description) && (
                  <Label>{translation || item.description}</Label>
                )}
              </View>
              <Label muted style={{ flex: 1, textAlign: "right" }}>
                {a.ui("{quantity} {unit} available", {
                  quantity: available,
                  unit: (saleUnitLabel(item.salePackaging, a.ui) || a.unit(item.unitCode)),
                })}
              </Label>
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Label>
                {money(item.unitPriceMinor)} / {(saleUnitLabel(item.salePackaging, a.ui) || a.unit(item.unitCode))}
              </Label>
              {item.packaging && (
                <Label style={{ color: colors.green }}>
                  {a.ui("{weight} kg per parcel", { weight: item.packaging.weightKg })}
                </Label>
              )}
            </View>
          </Card>
          <Card style={{ borderRadius: 16, boxShadow: "0px 1px 1px rgba(0,0,0,0.05)" }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Label>Order quantity</Label>
                <Label muted style={{ fontSize: 12 }}>
                  {(saleUnitLabel(item.salePackaging, a.ui) || a.unit(item.unitCode))}
                </Label>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={a.ui("Decrease quantity")}
                disabled={busy || Number(qty) <= minimum}
                onPress={() =>
                  changeQuantity(String(Math.max(minimum, Number((Number(qty) - 1).toFixed(3)))))
                }
                style={{
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: Number(qty) <= minimum ? 0.4 : 1,
                }}
              >
                <Label style={{ fontSize: 24 }}>−</Label>
              </Pressable>
              <View style={{ width: 76 }}>
                <Field
                  label="Order quantity"
                  hideLabel
                  value={qty}
                  editable={!busy}
                  keyboardType="decimal-pad"
                  style={{
                    textAlign: "center",
                    backgroundColor: "transparent",
                    borderWidth: 0,
                    paddingHorizontal: 0,
                  }}
                  onChangeText={changeQuantity}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={a.ui("Increase quantity")}
                disabled={busy || Number(qty) >= available}
                onPress={() =>
                  changeQuantity(
                    String(Math.min(available, Number((Number(qty || "0") + 1).toFixed(3)))),
                  )
                }
                style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
              >
                <Label style={{ fontSize: 24 }}>+</Label>
              </Pressable>
            </View>
            {!!quantityIssue && <Notice text={a.ui(quantityIssue)} error />}
            <Label muted style={s.small}>
              Delivery is quoted separately before payment.
            </Label>
          </Card>
          <Card style={{ borderRadius: 16, boxShadow: "0px 1px 1px rgba(0,0,0,0.05)" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="buyerVerified" nativeSize={{ width: 14, height: 14 }} />
              <Label style={{ fontFamily: "NotoBold" }}>{item.farmerProfile.farmName}</Label>
            </View>
            <Label muted>
              {item.locationAddress.city}, {item.locationAddress.state}
            </Label>
            <Label>Verified farmer</Label>
            <Label>{item.shippingScope === "LOCAL" ? "Local delivery" : "Nigeria delivery"}</Label>
          </Card>
          <Button
            icon={false}
            title={
              busy
                ? "Saving cart…"
                : total
                  ? a.ui(
                      shopping.data?.cartQuantity
                        ? "Update cart · {amount}"
                        : "Add to cart · {amount}",
                      { amount: money(total) },
                    )
                  : a.ui("Add to cart")
            }
            loading={busy}
            disabled={
              busy ||
              !total ||
              Number(qty) > available ||
              Number(qty) < minimum ||
              (!!item.unit && !item.unit.allowsDecimal && !Number.isInteger(Number(qty)))
            }
            onPress={async () => {
              if (submitting.current) return;
              if (!a.user) {
                a.go("phone");
                return;
              }
              submitting.current = true;
              setBusy(true);
              setError("");
              try {
                quantity(qty);
                await api(`/shopping/cart/${item.id}`, {
                  method: "PUT",
                  body: { quantity: qty, unitPriceMinor: item.unitPriceMinor },
                });
                await shopping.reload();
                a.notify(a.ui("Cart updated"));
                a.go("cart");
              } catch (e) {
                setError(a.error(e));
              } finally {
                submitting.current = false;
                setBusy(false);
              }
            }}
          />
          {item.packaging && (
            <Card style={{ borderRadius: 16, boxShadow: "0px 1px 1px rgba(0,0,0,0.05)" }}>
              <Label style={{ fontFamily: "NotoBold" }}>Packing and handling</Label>
              <Label>
                {a.ui("{units} selling units per parcel", {
                  units: item.packaging.unitsPerPackage,
                })}
              </Label>
              <Label>
                {a.ui("Package size: {length} × {width} × {height} cm", {
                  length: item.packaging.length,
                  width: item.packaging.width,
                  height: item.packaging.height,
                })}
              </Label>
              {!!estimate && (
                <Label style={{ color: colors.green }}>
                  {a.ui("{count} parcels · estimated packed weight {weight} kg", {
                    count: estimate.count,
                    weight: estimate.weightKg,
                  })}
                </Label>
              )}
              <Label>{a.status(item.packaging.handling)}</Label>
              {!!item.packaging.notes && <Label muted>{item.packaging.notes}</Label>}
              <Label muted style={s.small}>
                Confirm final weight, dimensions and handling when requesting delivery.
              </Label>
            </Card>
          )}
          {a.user && a.locale !== "en" && (
            <Button
              title="Translate description"
              secondary
              onPress={async () => {
                try {
                  const t = await api<any>(`/translations/listings/${item.id}?locale=${a.locale}`);
                  setTranslation(t.text || "");
                  if (!t.translated) setError(a.ui("Translation unavailable; showing original."));
                } catch (e) {
                  setError(a.error(e));
                }
              }}
            />
          )}
          <Notice text="Delivery coverage and package eligibility are checked before payment. Bulk and cold-chain orders need staff review." />
        </>
      )}
    </Page>
  );
}
export function Orders() {
  const a = useApp(),
    r = useResource<{ items: Order[] }>(`/orders?view=${a.role === "SELLER" ? "seller" : "buyer"}`),
    [filter, setFilter] = useState("All");
  const items = r.data?.items.filter(
    (i) =>
      filter === "All" ||
      (filter === "Completed"
        ? ["DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"].includes(i.status)
        : !["DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"].includes(i.status)),
  );
  const nextAction = (order: Order) => {
    if (a.role === "SELLER") return { title: "View order & tracking", hint: "Review fulfilment and delivery status" };
    if (order.status === "FUNDED" && order.delivery?.status === "PICKUP_READY")
      return { title: "View pickup details", hint: "Arrange collection and confirm receipt" };
    if (order.status === "AWAITING_PAYMENT") {
      if (!order.delivery) return { title: "Continue checkout", hint: "Confirm delivery address and choose shipping" };
      if (["QUOTE_REQUIRED", "MANUAL_REVIEW"].includes(order.delivery.status))
        return { title: "Continue checkout", hint: "Get or review the delivery fee before payment" };
      if (["QUOTED", "PAYMENT_PENDING", "TOPUP_REQUIRED"].includes(order.delivery.status))
        return { title: "Continue checkout", hint: "Confirm the combined produce and delivery total" };
      return { title: "Continue checkout", hint: "Complete delivery and pay once on the order summary" };
    }
    if (order.status === "FUNDED" && order.delivery?.status === "PAYMENT_PENDING")
      return { title: "Book delivery", hint: "Payment received—dispatch is ready" };
    if (["BOOKED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(order.delivery?.status || ""))
      return { title: "Track delivery", hint: "Follow the courier and arrival status" };
    return { title: "View order details", hint: "See payment, delivery, and support details" };
  };
  return (
    <Page loading={r.loading} contentStyle={{ gap: 18 }}>
      <Label muted>{a.role === "SELLER" ? "SELLER PORTAL" : "BUYER PORTAL"}</Label>
      <Heading>{a.t("orders.title")}</Heading>
      {a.role === "BUYER" && a.route.query === "checkout" && (
        <Card style={{ backgroundColor: "#e4f3e9", flexDirection: "row", gap: 12 }}>
          <Icon name="cartShield" size={22} />
          <View style={{ flex: 1, gap: 4 }}>
            <Label style={{ fontFamily: "NotoBold" }}>Your cart is now ready for delivery</Label>
            <Label muted style={s.small}>
              Each farmer shipment is checked out separately. Start with any order below, then return here for the next one.
            </Label>
          </View>
        </Card>
      )}
      <View style={s.row}>
        {["All", "Active", "Completed"].map((v) => (
          <Pressable key={v} accessibilityRole="button" onPress={() => setFilter(v)}>
            <Text
              style={[s.badge, filter === v && { backgroundColor: colors.green, color: "white" }]}
            >
              {v}
            </Text>
          </Pressable>
        ))}
      </View>
      {r.error && <Notice text={r.error} error />}
      {!r.loading && !r.error && !items?.length && <Notice text={a.t("orders.empty")} />}
      {items?.map((i) => {
        const action = nextAction(i);
        const checkout = a.role === "BUYER" && i.status === "AWAITING_PAYMENT";
        return (
          <Card key={i.id} style={{ borderWidth: checkout ? 2 : 0, borderColor: checkout ? colors.green : colors.line, gap: 14 }}>
            <View style={s.between}>
              <Text style={[s.badge, checkout && { backgroundColor: colors.mint }]}> {checkout ? "Checkout in progress" : a.status(i.delivery?.status || i.status)} </Text>
              <Label muted style={s.small}>{i.reference.slice(-8)}</Label>
            </View>
            {checkout && <ReservationTimer expiresAt={i.reservationExpiresAt} />}
            <View style={{ gap: 3 }}>
              <Label style={{ fontFamily: "NotoBold", fontSize: 20 }}>{i.listing.title}</Label>
              <Label muted>{i.quantity || 1} {(saleUnitLabel(i.listing.salePackaging, a.ui) || a.unit(i.listing.unitCode || "UNIT"))}</Label>
            </View>
            <View style={s.between}>
              <View><Label muted style={s.small}>Produce</Label><Label style={{ fontSize: 22, color: "#6b4a2f", fontFamily: "NotoBold" }}>{money(i.totalMinor)}</Label></View>
              {i.delivery && <View style={{ alignItems: "flex-end" }}><Label muted style={s.small}>Delivery</Label><Label style={{ fontFamily: "NotoBold" }}>{money(i.delivery.shippingMinor)}</Label></View>}
            </View>
            {checkout && (
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {[0, 1, 2].map((step) => <View key={step} style={{ height: 5, flex: 1, borderRadius: 99, backgroundColor: step === 0 || i.delivery ? colors.green : colors.line }} />)}
                </View>
                <Label muted style={s.small}>{action.hint}</Label>
              </View>
            )}
            <Button title={action.title} onPress={() => a.go("delivery", i.id)} />
          </Card>
        );
      })}
      <Button title="Refresh orders" secondary onPress={() => void r.reload()} />
    </Page>
  );
}
