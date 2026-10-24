import { LocalizedText as Text } from "../localization";
import React, { useState } from "react";
import { View, Pressable, Image } from "react-native";
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
import { api, uuid, API_URL, authHeaders } from "../lib/api";
import { money, quantity, type Listing, type Order } from "../lib/domain";
export function ListingPhoto({ item, height = 200 }: { item: Listing; height?: number }) {
  const photo = item.media.find((m) => /^produce\/[a-f0-9-]{36}$/.test(m.objectKey));
  return photo ? (
    <Image
      accessibilityLabel={item.title}
      source={{
        headers: authHeaders(),
        uri: `${API_URL}/v1/listing-photos/${photo.objectKey.split("/")[1]}`,
      }}
      style={{ height, width: "100%", borderRadius: 14 }}
    />
  ) : (
    <View
      style={{
        height,
        borderRadius: 14,
        backgroundColor: colors.mint,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Icon name="leaf" size={48} />
      <Label muted>Photo unavailable</Label>
    </View>
  );
}
export function Market() {
  const a = useApp(),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("");
  const r = useResource<{ items: Listing[] }>(
      `/marketplace/listings?search=${encodeURIComponent(query)}${category ? "&categoryId=" + category : ""}`,
    ),
    c = useResource<{
      items: { id: string; slug: string; translations: { locale: string; name: string }[] }[];
    }>("/marketplace/categories");
  return (
    <Page loading={r.loading}>
      <View style={s.between}>
        <View style={s.row}>
          <Icon name="leaf" size={32} />
          <View>
            <Label muted>Leetlogic Farmlink</Label>
            <Label style={{ color: colors.green, fontFamily: "NotoBold" }}>● Direct trade</Label>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Notifications"
          accessibilityRole="button"
          onPress={() => a.go("notifications")}
        >
          <Icon name="bell" />
        </Pressable>
      </View>
      {a.route.name === "home" && (
        <>
          <Heading>
            {a.ui("Hello, {name}.", {
              name:
                a.user?.profile?.displayName ||
                a.user?.profile?.fullName?.split(" ")[0] ||
                a.ui("there"),
            })}
          </Heading>
          <Label muted>Nigeria · Direct from verified farmers</Label>
        </>
      )}
      <Field
        label="Search produce"
        value={search}
        onChangeText={setSearch}
        placeholder="Produce, farmer, state..."
        returnKeyType="search"
        onSubmitEditing={() => setQuery(search)}
      />
      <Button title="Search" secondary onPress={() => setQuery(search)} />
      <View style={s.between}>
        <Text style={s.sectionTitle}>Categories</Text>
        {category && (
          <Pressable onPress={() => setCategory("")}>
            <Text style={s.link}>Show all</Text>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {c.data?.items.map((i) => (
          <Pressable
            accessibilityRole="button"
            key={i.id}
            onPress={() => setCategory(i.id)}
            style={{
              padding: 10,
              borderRadius: 14,
              backgroundColor: category === i.id ? colors.green : colors.mint,
            }}
          >
            <Label style={{ fontSize: 13, color: category === i.id ? "white" : colors.green }}>
              {i.translations.find((t) => t.locale === a.locale)?.name ||
                i.translations.find((t) => t.locale === "en")?.name ||
                i.slug}
            </Label>
          </Pressable>
        ))}
      </View>
      <Text style={s.sectionTitle}>Fresh from the farm</Text>
      {r.error && (
        <>
          <Notice text={r.error} error />
          <Button title="Try again" secondary onPress={() => void r.reload()} />
        </>
      )}
      {!r.loading && !r.error && !r.data?.items.length && (
        <Notice text="No produce matches this search yet. Try another category or check back soon." />
      )}
      {r.data?.items.map((item) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a.ui("View {title}", { title: item.title })}
          key={item.id}
          onPress={() => a.go("product", item.id)}
        >
          <Card>
            <ListingPhoto item={item} />
            <View style={s.between}>
              <Label style={{ fontFamily: "NotoBold", flex: 1 }}>{item.title}</Label>
              <Text style={s.badge}>Direct</Text>
            </View>
            <Label style={{ color: colors.green }}>
              {money(item.unitPriceMinor)} / {a.unit(item.unitCode)}
            </Label>
            <Label muted style={s.small}>
              {item.farmerProfile.farmName} · {item.locationAddress.state}
            </Label>
            <Label muted style={s.small}>
              {a.ui("{quantity} {unit} available", {
                quantity: Number(item.availableQuantity) - Number(item.reservedQuantity),
                unit: a.unit(item.unitCode),
              })}
            </Label>
          </Card>
        </Pressable>
      ))}
      {a.role === "SELLER" && (
        <Button title="My produce listings" onPress={() => a.go("myListings")} />
      )}
    </Page>
  );
}
export function Product() {
  const a = useApp(),
    r = useResource<{ item: Listing }>(`/marketplace/listings/${a.route.id}`),
    [qty, setQty] = useState("1"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [key, setKey] = useState(uuid),
    [translation, setTranslation] = useState("");
  const item = r.data?.item;
  return (
    <Page
      title="Produce"
      back={a.back}
      loading={r.loading}
      footer={
        item && (
          <Button
            title={busy ? "Creating order…" : "Start order"}
            disabled={busy}
            onPress={async () => {
              if (!a.user) {
                a.go("phone");
                return;
              }
              setBusy(true);
              try {
                quantity(qty);
                const result = await api<{ order: { id: string } }>("/marketplace/orders", {
                  method: "POST",
                  body: { listingId: item.id, quantity: qty },
                  key,
                });
                a.go("delivery", result.order.id);
              } catch (e) {
                setError(a.error(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        )
      }
    >
      {r.error && <Notice text={r.error} error />}
      {item && (
        <>
          <ListingPhoto item={item} height={270} />
          <Card>
            <Heading>{item.title}</Heading>
            <Label>{translation || item.description || ""}</Label>
            <Label style={{ color: colors.green, fontFamily: "NotoBold", fontSize: 20 }}>
              {money(item.unitPriceMinor)} / {a.unit(item.unitCode)}
            </Label>
            <Label muted>
              {a.ui("{quantity} {unit} available", {
                quantity: Number(item.availableQuantity) - Number(item.reservedQuantity),
                unit: a.unit(item.unitCode),
              })}
            </Label>
          </Card>
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
          <Card>
            <Field
              label="Order quantity"
              value={qty}
              keyboardType="decimal-pad"
              onChangeText={(v) => {
                setQty(v);
                setKey(uuid());
              }}
            />
            <Label muted style={s.small}>
              Delivery is quoted separately before payment.
            </Label>
          </Card>
          <Card>
            <Label style={{ fontFamily: "NotoBold" }}>{item.farmerProfile.farmName}</Label>
            <Label muted>
              {item.locationAddress.city}, {item.locationAddress.state}
            </Label>
            <Text style={s.badge}>Verified farmer</Text>
          </Card>
          <Notice text="This creates an order awaiting payment. No money is collected in the app; staff verify funding before dispatch." />
        </>
      )}
      {error && <Notice text={error} error />}
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
  return (
    <Page loading={r.loading}>
      <Label muted>{a.role === "SELLER" ? "SELLER PORTAL" : "BUYER PORTAL"}</Label>
      <Heading>{a.t("orders.title")}</Heading>
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
      {items?.map((i) => (
        <Card key={i.id}>
          <Text style={s.badge}>{a.status(i.delivery?.status || i.status)}</Text>
          <Label style={{ fontFamily: "NotoBold", fontSize: 18 }}>{i.listing.title}</Label>
          <Label muted style={s.small}>
            {i.reference}
          </Label>
          <Label style={{ fontSize: 24, color: "#8a5b00", fontFamily: "NotoBold" }}>
            {money(i.totalMinor)}
          </Label>
          {i.delivery && <Label muted>Delivery: {money(i.delivery.shippingMinor)}</Label>}
          <Button title="View order & tracking" onPress={() => a.go("delivery", i.id)} />
        </Card>
      ))}
      <Button title="Refresh orders" secondary onPress={() => void r.reload()} />
    </Page>
  );
}
