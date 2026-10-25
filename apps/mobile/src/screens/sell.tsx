import { farmLocation } from "../lib/farm-location";
import { Confirmation } from "../components/feedback";
import { LocalizedText as Text } from "../localization";
import React, { useState, useEffect } from "react";
import { View, Pressable, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useApp, useResource } from "../state";
import { Page, Heading, Label, Field, Button, Card, Notice, s, colors } from "../components/ui";
import { api, API_URL, authHeaders } from "../lib/api";
import { money, toMinor, quantity, type Listing, type Address } from "../lib/domain";
import { ListingPhoto } from "./market";
import { ListingControls } from "../components/seller-listing-controls";
export async function choosePhoto(camera = false) {
  const permission = camera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      camera
        ? "Camera permission was denied. Choose a photo from your library or enable camera access in Settings."
        : "Photo access was denied. Enable it in Settings to attach produce.",
    );
  const result = await (
    camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync
  )({ mediaTypes: ["images"], quality: 0.8, allowsEditing: false });
  if (result.canceled) return null;
  const photo = result.assets[0]!;
  if (photo.fileSize && photo.fileSize > 10 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 10 MB.");
  if (photo.mimeType && !["image/jpeg", "image/png"].includes(photo.mimeType))
    throw new Error("Choose a JPEG or PNG image.");
  return photo;
}
export async function photoBlob(uri: string, mime?: string) {
  const response = await fetch(uri);
  const data = await response.blob();
  if (!data.size || data.size > 10 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 10 MB.");
  return new Blob([data], { type: mime || data.type || "image/jpeg" });
}
type Form = {
  title: string;
  description: string;
  categoryId: string;
  unitCode: string;
  quantity: string;
  price: string;
  addressId: string;
  photoId?: string;
  photoUri?: string;
};
const initial: Form = {
  title: "",
  description: "",
  categoryId: "",
  unitCode: "",
  quantity: "",
  price: "",
  addressId: "",
};
export function Sell() {
  const a = useApp(),
    r = useResource<{
      categories: { id: string; slug: string; translations: { locale: string; name: string }[] }[];
      units: { code: string }[];
      addresses: Address[];
      primaryAddressId?: string;
      verificationStatus: string;
    }>("/listing-drafts/catalogue"),
    [form, setForm] = useState<Form>(initial),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const storage = `listing-draft:${a.user!.id}${a.route.id ? `:${a.route.id}` : ""}`;
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (a.route.id) {
          const draft = await api<{
            fields: Omit<Form, "price"> & { unitPriceMinor: string };
            listingId: string | null;
          }>(`/listing-drafts/${a.route.id}`);
          if (draft.listingId) throw new Error("This draft has already been submitted.");
          const { unitPriceMinor, ...fields } = draft.fields;
          const minor = BigInt(unitPriceMinor);
          const cached = await AsyncStorage.getItem(storage);
          if (active)
            setForm(
              cached
                ? { ...initial, ...JSON.parse(cached) }
                : {
                    ...initial,
                    ...fields,
                    price: `${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`,
                  },
            );
        } else {
          const saved = await AsyncStorage.getItem(storage);
          if (saved && active) setForm({ ...initial, ...JSON.parse(saved) });
        }
        if (active) setReady(true);
      } catch (e) {
        if (active) setError(a.error(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [storage, a.route.id]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(storage, JSON.stringify(form)).catch(() =>
        setError("Could not save this draft on your device."),
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [form, ready, storage]);
  const farmAddress = farmLocation(r.data?.addresses || [], r.data?.primaryAddressId);
  const listingAddress =
    r.data?.addresses.find((address) => address.id === form.addressId) || farmAddress;
  useEffect(() => {
    if (!ready || !farmAddress) return;
    setForm((current) =>
      r.data?.addresses.some((address) => address.id === current.addressId)
        ? current
        : { ...current, addressId: farmAddress.id },
    );
  }, [ready, farmAddress?.id]);
  const field = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const upload = async (camera: boolean) => {
    setBusy(true);
    setError("");
    try {
      const p = await choosePhoto(camera);
      if (p) {
        const r = await api<{ id: string }>("/listing-photos", {
          method: "POST",
          blob: await photoBlob(p.uri, p.mimeType),
        });
        setForm((f) => ({ ...f, photoId: r.id, photoUri: p.uri }));
      }
    } catch (e) {
      setError(a.error(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Create listing"
      back={a.canGoBack ? a.back : undefined}
      footerSafeArea={a.role !== "SELLER"}
      loading={r.loading}
      footer={
        <Button
          title={busy ? "Saving…" : a.t("sell.review")}
          disabled={busy || !ready || r.loading || !!r.error}
          onPress={async () => {
            setBusy(true);
            setError("");
            try {
              quantity(form.quantity);
              const { photoUri, price, ...fields } = form;
              void photoUri;
              const draft = await api<{ id: string }>(
                a.route.id ? `/listing-drafts/${a.route.id}` : "/listing-drafts",
                {
                  method: a.route.id ? "PATCH" : "POST",
                  body: { ...fields, sourceLocale: a.locale, unitPriceMinor: toMinor(price) },
                },
              );
              await AsyncStorage.removeItem(storage);
              a.go("review", draft.id);
            } catch (e) {
              setError(a.error(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <Text style={s.badge}>Draft · saved on this device</Text>
      <Heading>Describe your produce.</Heading>
      <Label muted>Required fields are marked *. Review every detail before submitting.</Label>
      {r.data?.verificationStatus !== "APPROVED" && (
        <>
          <Notice text="You can save and review drafts while your seller application is in progress. Approval is required before submitting produce for sale." />
          <Button title="Seller application" secondary onPress={() => a.go("seller")} />
        </>
      )}
      <Card>
        <Field
          label={`${a.t("sell.product")} *`}
          value={form.title}
          onChangeText={(v) => field("title", v)}
        />
        <Field
          label={a.t("sell.description")}
          multiline
          value={form.description}
          onChangeText={(v) => field("description", v)}
        />
        <Label style={s.fieldLabel}>Category *</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {r.data?.categories.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => field("categoryId", c.id)}
              style={{
                padding: 10,
                borderRadius: 12,
                backgroundColor: form.categoryId === c.id ? colors.green : colors.mint,
              }}
            >
              <Label
                style={{ fontSize: 13, color: form.categoryId === c.id ? "white" : colors.green }}
              >
                {c.translations.find((t) => t.locale === a.locale)?.name ||
                  c.translations.find((t) => t.locale === "en")?.name ||
                  c.slug}
              </Label>
            </Pressable>
          ))}
        </View>
        <Label style={s.fieldLabel}>{a.t("sell.unit")} *</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {r.data?.units.map((u) => (
            <Pressable key={u.code} onPress={() => field("unitCode", u.code)}>
              <Text
                style={[
                  s.badge,
                  form.unitCode === u.code && { backgroundColor: colors.green, color: "white" },
                ]}
              >
                {a.unit(u.code)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field
          label={`${a.t("sell.price")} *`}
          value={form.price}
          keyboardType="decimal-pad"
          onChangeText={(v) => field("price", v)}
        />
        <Field
          label={`${a.t("sell.quantity")} *`}
          value={form.quantity}
          keyboardType="decimal-pad"
          onChangeText={(v) => field("quantity", v)}
        />
      </Card>
      <Text style={s.sectionTitle}>Farm location</Text>
      {listingAddress ? (
        <Card>
          <Label>
            {listingAddress.line1}, {listingAddress.city}, {listingAddress.state}
          </Label>
          <Label muted>
            Your farm is the default pickup location. You can choose a different address when
            arranging an order’s delivery.
          </Label>
        </Card>
      ) : (
        <>
          <Notice text="Complete your farm address before listing produce." />
          <Button title="Farm location" secondary onPress={() => a.go("seller")} />
        </>
      )}
      <Notice text="Delivery coverage and package eligibility are checked before payment. Bulk and cold-chain orders need staff review." />
      <Text style={s.sectionTitle}>{a.t("sell.photo")}</Text>
      {(form.photoUri || form.photoId) && (
        <Image
          source={
            form.photoUri
              ? { uri: form.photoUri }
              : { uri: `${API_URL}/v1/listing-photos/${form.photoId}`, headers: authHeaders() }
          }
          style={{ width: "100%", height: 200, borderRadius: 16 }}
        />
      )}
      <View style={{ gap: 8 }}>
        <Button title="Take a photo" secondary disabled={busy} onPress={() => void upload(true)} />
        <Button
          title="Choose from library"
          secondary
          disabled={busy}
          onPress={() => void upload(false)}
        />
      </View>
      <Notice text={a.t("sell.voiceBlocked")} />
      {(error || r.error) && <Notice text={error || r.error} error />}
    </Page>
  );
}
export function Review() {
  const a = useApp(),
    r = useResource<{
      id: string;
      fields: Omit<Form, "price"> & { unitPriceMinor: string };
      listingId: string | null;
    }>(`/listing-drafts/${a.route.id}`),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  const f = r.data?.fields;
  const canPublish = a.user?.farmerProfile?.verificationStatus === "APPROVED";
  return (
    <Page
      title="Review listing"
      back={a.back}
      loading={r.loading}
      footer={
        done ? (
          <Button title="My listings" onPress={() => a.reset("myListings")} />
        ) : (
          <Button
            title={busy ? "Submitting…" : a.t("sell.submit")}
            disabled={!confirmed || busy || !f || !canPublish}
            onPress={async () => {
              setBusy(true);
              try {
                await api(`/listing-drafts/${a.route.id}/submit`, {
                  method: "POST",
                  body: { confirmed: true },
                });
                await AsyncStorage.removeItem(`listing-draft:${a.user!.id}:${a.route.id}`);
                setDone(true);
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
      {!canPublish && !done && (
        <>
          <Notice text="Your draft is saved. Complete seller approval before submitting it for sale." />
          <Button title="Seller application" secondary onPress={() => a.go("seller")} />
        </>
      )}
      {done ? (
        <>
          <Heading>Submitted for review</Heading>
          <Notice text="Your produce is awaiting moderation. It becomes visible to buyers after approval." />
        </>
      ) : (
        <>
          <Heading>Check this.</Heading>
          <Label muted>Review your produce details before submitting.</Label>
          {f?.photoId && (
            <Image
              source={{ uri: `${API_URL}/v1/listing-photos/${f.photoId}`, headers: authHeaders() }}
              style={{ width: "100%", height: 200, borderRadius: 16 }}
            />
          )}
          {f && (
            <Card>
              {[
                ["Produce", f.title],
                ["Description", f.description],
                ["Quantity", `${f.quantity} ${a.unit(f.unitCode)}`],
                ["Price", `${money(f.unitPriceMinor)} / ${a.unit(f.unitCode)}`],
                [
                  "Farm location",
                  a.user?.addresses.find((ad) => ad.id === f.addressId)?.line1 ||
                    "Saved pickup address",
                ],
              ].map(([k, v]) => (
                <View
                  key={k}
                  style={[
                    s.between,
                    { paddingVertical: 8, borderBottomWidth: 1, borderColor: "#f4f4f3" },
                  ]}
                >
                  <Label muted style={{ flex: 1 }}>
                    {k}
                  </Label>
                  <Label style={{ flex: 1, textAlign: "right", fontFamily: "NotoBold" }}>{v}</Label>
                </View>
              ))}
            </Card>
          )}
          <Confirmation
            checked={confirmed}
            onChange={() => setConfirmed(!confirmed)}
            label={a.t("sell.confirm")}
          />
          <Notice text="Submission follows the existing moderation rules. Voice and automatic photo identification are not enabled." />
        </>
      )}
      {(error || r.error) && <Notice text={error || r.error} error />}
    </Page>
  );
}
export function MyListings() {
  const a = useApp(),
    r = useResource<{ items: Listing[] }>("/marketplace/my-listings");
  return (
    <Page
      title="My listings"
      back={a.canGoBack ? a.back : undefined}
      loading={r.loading}
      footerSafeArea={a.role !== "SELLER"}
      footer={<Button title="Create listing" onPress={() => a.reset("sell")} />}
    >
      {r.error && <Notice text={r.error} error />}
      {!r.loading && !r.data?.items.length && <Notice text="You haven’t listed any produce yet." />}
      {r.data?.items.map((i) => (
        <Card key={i.id}>
          <ListingPhoto item={i} />
          <Label style={{ fontFamily: "NotoBold" }}>{i.title}</Label>
          <Text style={s.badge}>{a.status(i.status)}</Text>
          <Label>
            {money(i.unitPriceMinor)} / {a.unit(i.unitCode)}
          </Label>
          <ListingControls item={i} onUpdated={r.reload} />
        </Card>
      ))}
    </Page>
  );
}
