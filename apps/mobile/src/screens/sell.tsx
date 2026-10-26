import { ListingVoiceNote } from "../components/listing-voice-note";
import { AppSheet } from "../components/app-sheet";
import { Select } from "../components/Select";
import { ListingPage, ListingProgress } from "../components/listing-layout";
import { listingCategories } from "../lib/listing-art";
import {
  emptyListing,
  restoreListing,
  listingDetailsError,
  listingPayload,
  moveCover,
  type ListingForm,
  type ListingUnit,
} from "../lib/listing-form";
import { farmLocation } from "../lib/farm-location";
import { Confirmation } from "../components/feedback";
import { LocalizedText as Text } from "../localization";
import React, { useState, useEffect, useRef } from "react";
import { View, Pressable, Image, StyleSheet, BackHandler } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { choosePhoto, photoBody } from "../lib/produce-photo";
import { useApp, useResource } from "../state";
import { Page, Label, Field, Button, Card, Icon, Notice, s, colors } from "../components/ui";
import { api, API_URL, authHeaders } from "../lib/api";
import { money, toMinor, type Listing, type Address } from "../lib/domain";
import { ListingPhoto } from "./market";
import { ListingControls } from "../components/seller-listing-controls";
export { choosePhoto, photoBody } from "../lib/produce-photo";
type Category = { id: string; slug: string; translations: { locale: string; name: string }[] };
type Catalogue = {
  categories: Category[];
  categoryAliases?: Record<string, string>;
  units: ListingUnit[];
  addresses: Address[];
  primaryAddressId?: string;
  verificationStatus: string;
};
export function Sell() {
  const a = useApp(),
    r = useResource<Catalogue>("/listing-drafts/catalogue");
  const [form, setForm] = useState<ListingForm>(emptyListing),
    [step, setStep] = useState<1 | 2 | 3>(1);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const voiceActive = useRef(false);
  const voiceActivity = (active: boolean) => {
    voiceActive.current = active;
    setVoiceBusy(active);
  };
  const [photoChoice, setPhotoChoice] = useState<number | null>(null);
  const running = useRef(false),
    writes = useRef(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const storage = `listing-draft:${a.user!.id}${a.route.id ? `:${a.route.id}` : ""}`;
  const saveLocal = (next = form, nextStep = step) => {
    writes.current = writes.current
      .catch(() => {})
      .then(() =>
        AsyncStorage.setItem(
          storage,
          JSON.stringify({ ...next, step: nextStep, photoId: next.photos[0]?.id }),
        ),
      );
    return writes.current;
  };
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const cached = await AsyncStorage.getItem(storage);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (active) {
            setForm(restoreListing(parsed));
            setStep([1, 2, 3].includes(parsed.step) ? parsed.step : a.route.id ? 2 : 1);
          }
        } else if (a.route.id) {
          const draft = await api<{ fields: any; listingId: string | null }>(
            `/listing-drafts/${a.route.id}`,
          );
          if (draft.listingId) throw new Error("This draft has already been submitted.");
          if (active) {
            setForm(restoreListing(draft.fields));
            setStep(2);
          }
        }
        if (active) setReady(true);
      } catch (e) {
        if (active) {
          setError(a.error(e));
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
      clearTimeout(timer.current);
    };
  }, [storage]);
  useEffect(() => {
    if (!ready) return;
    timer.current = setTimeout(() => {
      void saveLocal().catch(() => setError(a.ui("Could not save this draft on your device.")));
    }, 400);
    return () => clearTimeout(timer.current);
  }, [ready, form, step, storage]);
  const farm = farmLocation(r.data?.addresses || [], r.data?.primaryAddressId);
  const address = r.data?.addresses.find((item) => item.id === form.addressId) || farm;
  useEffect(() => {
    if (ready && farm)
      setForm((current) =>
        r.data?.addresses.some((item) => item.id === current.addressId)
          ? current
          : { ...current, addressId: farm.id },
      );
  }, [ready, farm?.id]);
  useEffect(() => {
    const target = r.data?.categoryAliases?.[form.categoryId];
    if (ready && target) setForm((current) => ({ ...current, categoryId: target }));
  }, [ready, form.categoryId, r.data?.categoryAliases]);
  const category = r.data?.categories.find((item) => item.id === form.categoryId);
  const categoryName = (item: Category) =>
    item.translations.find((text) => text.locale === a.locale)?.name ||
    item.translations.find((text) => text.locale === "en")?.name ||
    item.slug;
  const goStep = (next: 1 | 2 | 3) => {
    if (!running.current && !voiceActive.current) {
      setError("");
      setStep(next);
    }
  };
  const close = async () => {
    if (running.current || voiceActive.current) return;
    try {
      clearTimeout(timer.current);
      await saveLocal();
      a.reset("myListings");
    } catch (e) {
      setError(a.error(e));
    }
  };
  const back = () => {
    if (running.current || voiceActive.current) return;
    if (step > 1) goStep((step - 1) as 1 | 2);
    else void close();
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => subscription.remove();
  }, [step, form]);
  const field = (key: keyof ListingForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const upload = async (camera: boolean) => {
    if (running.current || photoChoice === null) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const photo = await choosePhoto(camera);
      if (!photo) return;
      const result = await api<{ id: string }>("/listing-photos", {
        method: "POST",
        binary: await photoBody(photo.uri, photo.mimeType),
      });
      setForm((current) => {
        const photos = [...current.photos];
        if (photoChoice < 0 && photos.length < 4) photos.push({ id: result.id, uri: photo.uri });
        else if (photoChoice >= 0) photos[photoChoice] = { id: result.id, uri: photo.uri };
        return { ...current, photos };
      });
      setPhotoChoice(null);
    } catch (e) {
      setError(a.error(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const next = async () => {
    if (running.current || voiceActive.current || !ready) return;
    setError("");
    if (step === 1) {
      if (category) goStep(2);
      return;
    }
    const invalid = listingDetailsError(form, r.data?.units || []);
    if (invalid) {
      setError(a.ui(invalid));
      return;
    }
    if (step === 2) {
      goStep(3);
      return;
    }
    if (!form.photos.length) {
      setError(a.ui("Add at least one photo of your produce before submitting."));
      return;
    }
    running.current = true;
    setBusy(true);
    try {
      clearTimeout(timer.current);
      await saveLocal();
      const draft = await api<{ id: string }>(
        a.route.id ? `/listing-drafts/${a.route.id}` : "/listing-drafts",
        { method: a.route.id ? "PATCH" : "POST", body: listingPayload(form, a.locale) },
      );
      await writes.current;
      if (!a.route.id) {
        const voiceKey = `listing-voice:${a.user!.id}:new`;
        const voice = await AsyncStorage.getItem(voiceKey);
        if (voice) {
          await AsyncStorage.setItem(`listing-voice:${a.user!.id}:${draft.id}`, voice);
          await AsyncStorage.removeItem(voiceKey);
        }
      }
      await AsyncStorage.removeItem(storage);
      a.go("review", draft.id);
    } catch (e) {
      setError(a.error(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const categories = r.data?.categories || [];
  return (
    <ListingPage
      step={step}
      onBack={busy || voiceBusy ? undefined : back}
      onClose={() => void close()}
      loading={r.loading || !ready}
      contentKey={String(step)}
      footer={
        <>
          {error && <Notice text={error} error />}
          {step === 1 && category && (
            <Label>{a.ui("Selected: {category}", { category: categoryName(category) })}</Label>
          )}
          <Button
            title={
              busy
                ? "Saving…"
                : step === 1
                  ? "Continue"
                  : step === 2
                    ? "Continue to photos"
                    : "Review listing"
            }
            loading={busy}
            disabled={
              busy ||
              voiceBusy ||
              !ready ||
              r.loading ||
              !!r.error ||
              !category ||
              (step === 3 && !form.photos.length)
            }
            icon="listingForward"
            iconNativeSize={{ width: 13, height: 13 }}
            onPress={() => void next()}
          />
        </>
      }
    >
      {r.error && <Notice text={r.error} error />}
      {step === 1 ? (
        <>
          <ListingProgress step={1} label="Classification" />
          <View style={{ gap: 6 }}>
            <Text style={listingStyles.title}>Choose a category</Text>
            <Label muted>Select the produce category</Label>
          </View>
          {!r.loading && !categories.length && (
            <Notice text="No produce categories are available yet. Please try again later." />
          )}
          <View style={listingStyles.grid}>
            {categories.map((item) => {
              const examples = listingCategories[item.slug],
                selected = item.id === form.categoryId;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityLabel={categoryName(item)}
                  accessibilityState={{ selected }}
                  onPress={() => field("categoryId", item.id)}
                  style={[listingStyles.category, selected && listingStyles.selected]}
                >
                  <View
                    style={[
                      listingStyles.choice,
                      selected && { backgroundColor: colors.green, borderColor: colors.green },
                    ]}
                  >
                    {selected && (
                      <Icon name="check" nativeSize={{ width: 16.381, height: 16.381 }} />
                    )}
                  </View>
                  <View style={listingStyles.categoryLabel}>
                    <Label
                      style={{
                        fontFamily: selected ? "NotoBold" : "Noto",
                        color: selected ? colors.green : colors.ink,
                        flexShrink: 1,
                      }}
                    >
                      {categoryName(item)}
                    </Label>
                    {examples && (
                      <Label muted style={{ fontSize: 13 }}>
                        {examples}
                      </Label>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : step === 2 ? (
        <>
          <View style={{ alignItems: "flex-start" }}>
            <Text style={s.badge}>Draft · saved on this device</Text>
          </View>
          <Text style={listingStyles.title}>Describe your produce.</Text>
          <Label muted>
            {a.ui("Category: {category}. Required fields are marked *.", {
              category: category ? categoryName(category) : "",
            })}
          </Label>
          {r.data?.verificationStatus !== "APPROVED" && (
            <Notice text="You can save and review drafts while your seller application is in progress. Approval is required before submitting produce for sale." />
          )}
          <ListingVoiceNote
            draftId={a.route.id || "new"}
            disabled={busy}
            onActivityChange={voiceActivity}
          />
          <Card style={{ borderRadius: 16 }}>
            <Field
              label="Product title *"
              value={form.title}
              maxLength={160}
              onChangeText={(value) => field("title", value)}
            />
            <Field
              label="Description *"
              value={form.description}
              multiline
              maxLength={5000}
              onChangeText={(value) => field("description", value)}
            />
            <Label muted style={listingStyles.help}>
              Describe freshness, variety and package size.
            </Label>
            <Select
              label="Selling unit *"
              value={form.unitCode}
              options={(r.data?.units || []).map((unit) => ({
                value: unit.code,
                label: a.unit(unit.code),
              }))}
              onChange={(value) => field("unitCode", value)}
            />
            <Label muted style={listingStyles.help}>
              {r.data?.units.find((unit) => unit.code === form.unitCode)?.allowsDecimal
                ? "Decimals are allowed for this unit."
                : "Whole units only. Enter the number of complete packs or pieces."}
            </Label>
            <Field
              label={a.ui("Price per {unit} · NGN *", { unit: a.unit(form.unitCode) })}
              value={form.price}
              keyboardType="decimal-pad"
              onChangeText={(value) => field("price", value)}
            />
            <Field
              label="Available quantity *"
              value={form.quantity}
              keyboardType="decimal-pad"
              onChangeText={(value) => field("quantity", value)}
            />
          </Card>
          <Text style={listingStyles.section}>Location and delivery</Text>
          <Card style={{ borderRadius: 16 }}>
            <Label style={{ fontFamily: "NotoBold" }}>Farm location</Label>
            <Label>
              {address
                ? `${address.line1}, ${address.city}, ${address.lga}, ${address.state}`
                : a.ui("Complete your farm address before listing produce.")}
            </Label>
            <Label muted style={listingStyles.help}>
              Your farm is the default pickup location. You can choose a different address when
              arranging an order’s delivery.
            </Label>
            {!address && <Button title="Farm location" secondary onPress={() => a.go("seller")} />}
          </Card>
          <Label style={{ fontFamily: "NotoBold" }}>Delivery scope *</Label>
          {(
            [
              { value: "LOCAL", title: "Local", text: "Within your farm’s state" },
              {
                value: "NATIONWIDE",
                title: "Nigeria",
                text: "Offer delivery to supported areas in Nigeria",
              },
            ] as const
          ).map((scope) => (
            <Pressable
              key={scope.value}
              accessibilityRole="radio"
              accessibilityLabel={a.ui(scope.title)}
              accessibilityState={{ selected: form.shippingScope === scope.value }}
              onPress={() => field("shippingScope", scope.value)}
              style={[
                listingStyles.scope,
                form.shippingScope === scope.value && listingStyles.selected,
              ]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Label style={{ fontFamily: "NotoBold" }}>{scope.title}</Label>
                <Label muted style={listingStyles.help}>
                  {scope.text}
                </Label>
              </View>
              <View
                style={[
                  listingStyles.radio,
                  form.shippingScope === scope.value && {
                    backgroundColor: colors.green,
                    borderColor: colors.green,
                  },
                ]}
              >
                {form.shippingScope === scope.value && (
                  <Icon name="check" nativeSize={{ width: 16.381, height: 16.381 }} />
                )}
              </View>
            </Pressable>
          ))}
          <Label muted style={listingStyles.help}>
            Delivery coverage and package eligibility are checked before payment. Bulk and
            cold-chain orders need staff review.
          </Label>
        </>
      ) : (
        <>
          <View style={s.between}>
            <Label>Step 3 of 4</Label>
            <View style={s.row}>
              <Text style={s.badge}>
                {a.ui("{count} of 4 photos", { count: form.photos.length })}
              </Text>
              <Icon name="listingMeter" nativeSize={{ width: 24, height: 24 }} />
            </View>
          </View>
          <View style={{ gap: 12 }}>
            <Text style={listingStyles.title}>Review your photos</Text>
            <Label>
              Buyers trust listings with 3 or more photos showing different angles and real harvest
              quality.
            </Label>
          </View>
          <View style={listingStyles.grid}>
            {form.photos.map((photo, index) => (
              <View key={photo.id} style={listingStyles.photoTile}>
                <Pressable
                  style={{ flex: 1 }}
                  accessibilityRole="button"
                  accessibilityLabel={a.ui("Edit photo {number}", { number: index + 1 })}
                  disabled={busy}
                  onPress={() => setPhotoChoice(index)}
                >
                  <Image
                    source={
                      photo.uri
                        ? { uri: photo.uri }
                        : {
                            uri: `${API_URL}/v1/listing-photos/${photo.id}`,
                            headers: authHeaders(),
                          }
                    }
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                  <Text style={listingStyles.photoBadge}>
                    {index === 0 ? a.ui("Cover") : a.ui("Photo {number}", { number: index + 1 })}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={a.ui("Remove photo {number}", { number: index + 1 })}
                  disabled={busy}
                  onPress={() =>
                    setForm((current) => ({
                      ...current,
                      photos: current.photos.filter((item) => item.id !== photo.id),
                    }))
                  }
                  style={listingStyles.remove}
                >
                  <Icon name="listingTrash" nativeSize={{ width: 24, height: 24 }} />
                </Pressable>
              </View>
            ))}
            {form.photos.length < 4 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={a.ui("Add photo")}
                disabled={busy}
                onPress={() => setPhotoChoice(-1)}
                style={[listingStyles.photoTile, listingStyles.addPhoto]}
              >
                <Icon name="listingCamera" nativeSize={{ width: 40, height: 40 }} />
                <Label style={{ color: colors.green, fontFamily: "NotoBold" }}>Add photo</Label>
                <Label muted style={listingStyles.help}>
                  Tap to snap or upload
                </Label>
              </Pressable>
            )}
            {Array.from({ length: Math.max(0, 3 - form.photos.length) }, (_, index) => (
              <View
                key={`empty-${index}`}
                style={[listingStyles.photoTile, listingStyles.emptyPhoto]}
              >
                <Icon name="listingEmptyPhoto" nativeSize={{ width: 24, height: 24 }} />
                <Label muted>
                  {a.ui("Photo {number}", { number: form.photos.length + index + 2 })}
                </Label>
                <Label muted style={listingStyles.help}>
                  Another angle or pack size
                </Label>
              </View>
            ))}
          </View>
          <Card style={{ backgroundColor: "#eaf4ed" }}>
            <Label style={{ fontFamily: "NotoBold" }}>Show your produce clearly</Label>
            <Label muted>
              Use good lighting and show the produce you are selling. Choose your clearest photo as
              the cover.
            </Label>
          </Card>
        </>
      )}
      <AppSheet
        visible={photoChoice !== null}
        title="Listing photo"
        onClose={() => {
          if (!running.current) setPhotoChoice(null);
        }}
        busy={busy}
        footer={
          <>
            <Button
              title="Choose from library"
              secondary
              disabled={busy}
              loading={busy}
              onPress={() => void upload(false)}
            />
            <Button title="Take a photo" disabled={busy} onPress={() => void upload(true)} />
            {photoChoice !== null && photoChoice >= 0 && (
              <Button
                title="Make cover photo"
                secondary
                disabled={busy}
                onPress={() => {
                  setForm((current) => ({
                    ...current,
                    photos: moveCover(current.photos, current.photos[photoChoice]!.id),
                  }));
                  setPhotoChoice(null);
                }}
              />
            )}
          </>
        }
      >
        <Label>Use a photo of your actual produce. JPEG or PNG, up to 10 MB.</Label>
        {error && <Notice text={error} error />}
      </AppSheet>
    </ListingPage>
  );
}
export function Review() {
  const a = useApp(),
    r = useResource<{ id: string; fields: any; listingId: string | null }>(
      `/listing-drafts/${a.route.id}`,
    );
  const catalogue = useResource<Catalogue>("/listing-drafts/catalogue");
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{ id: string; title: string; status: string } | null>(
    null,
  );
  const running = useRef(false);
  const form = r.data ? restoreListing(r.data.fields) : null;
  const selectedCategory = catalogue.data?.categories.find((item) => item.id === form?.categoryId);
  const categoryLabel =
    selectedCategory?.translations.find((item) => item.locale === a.locale)?.name ||
    selectedCategory?.translations.find((item) => item.locale === "en")?.name;
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => busy);
    return () => subscription.remove();
  }, [busy]);
  const canSubmit = a.user?.farmerProfile?.verificationStatus === "APPROVED";
  const address = a.user?.addresses.find((item) => item.id === form?.addressId);
  const submit = async () => {
    if (!confirmed || !canSubmit || !form || running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ listing: { id: string; title: string; status: string } }>(
        `/listing-drafts/${a.route.id}/submit`,
        { method: "POST", body: { confirmed: true } },
      );
      setSubmitted(result.listing);
      // Submission is authoritative even if device cleanup fails.
      await AsyncStorage.removeItem(`listing-draft:${a.user!.id}:${a.route.id}`).catch(() => {});
    } catch (e) {
      setError(a.error(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const image = form?.photos[0] ? (
    <Image
      source={{ uri: `${API_URL}/v1/listing-photos/${form.photos[0].id}`, headers: authHeaders() }}
      accessibilityLabel={a.ui("Cover photo")}
      resizeMode="cover"
      style={{ width: "100%", height: 184, borderRadius: 16 }}
    />
  ) : null;
  if (submitted)
    return (
      <ListingPage
        step={4}
        complete
        onClose={() => a.reset("myListings")}
        footer={
          <>
            <Button title="My listings" onPress={() => a.reset("myListings")} />
            <Button title="Create another listing" secondary onPress={() => a.reset("sell")} />
          </>
        }
      >
        <View style={listingStyles.success}>
          <View style={listingStyles.successOuter}>
            <View style={listingStyles.successInner}>
              <Icon name="listingSuccess" nativeSize={{ width: 29.2233, height: 29.2233 }} />
            </View>
          </View>
          <Text style={[listingStyles.title, { textAlign: "center" }]}>
            Your listing is submitted.
          </Text>
          <Label muted>
            Your produce is awaiting moderation. It becomes visible to buyers after approval.
          </Label>
        </View>
        <Card
          style={{
            ...listingStyles.reviewCard,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          {form?.photos[0] && (
            <Image
              source={{
                uri: `${API_URL}/v1/listing-photos/${form.photos[0].id}`,
                headers: authHeaders(),
              }}
              style={{ width: 67, height: 67, borderRadius: 10 }}
              resizeMode="cover"
            />
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <View style={s.between}>
              <Label style={{ fontFamily: "NotoBold", flex: 1 }}>{submitted.title}</Label>
              <Text style={s.badge}>{a.status(submitted.status)}</Text>
            </View>
            <Label>
              {form?.quantity} {a.unit(form?.unitCode || "")}
            </Label>
            <Label style={{ fontFamily: "NotoBold" }}>
              {form ? money(toMinor(form.price)) : ""} / {a.unit(form?.unitCode || "")}
            </Label>
          </View>
        </Card>
      </ListingPage>
    );
  return (
    <ListingPage
      step={4}
      onBack={busy ? undefined : () => a.go("sell", a.route.id)}
      onClose={() => {
        if (!busy) a.reset("myListings");
      }}
      loading={r.loading}
      footer={
        <>
          {(error || r.error) && <Notice text={error || r.error} error />}
          <Button
            title={busy ? "Submitting…" : "Submit listing"}
            loading={busy}
            disabled={
              !confirmed ||
              busy ||
              !form ||
              !canSubmit ||
              !form.photos.length ||
              !!r.data?.listingId
            }
            icon="listingSubmit"
            iconNativeSize={{ width: 16.7, height: 16.7 }}
            onPress={() => void submit()}
          />
          <Button
            title="Save draft"
            secondary
            disabled={busy}
            onPress={() => a.reset("myListings")}
          />
        </>
      }
    >
      <View style={{ gap: 6 }}>
        <Text style={listingStyles.title}>Check this.</Text>
        <Label muted>Review your produce details before submitting.</Label>
      </View>
      <View style={{ gap: 8 }}>
        <Label style={{ fontFamily: "NotoBold" }}>Uploaded photos</Label>
        {image}
        {form && form.photos.length > 1 && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {form.photos.slice(1).map((photo, index) => (
              <Image
                key={photo.id}
                accessibilityLabel={a.ui("Photo {number}", { number: index + 2 })}
                source={{ uri: `${API_URL}/v1/listing-photos/${photo.id}`, headers: authHeaders() }}
                resizeMode="cover"
                style={{ width: 80, height: 76, borderRadius: 10 }}
              />
            ))}
          </View>
        )}
      </View>
      {form && (
        <Card style={listingStyles.reviewCard}>
          {[
            ["Produce", form.title],
            ...(categoryLabel ? [["Category", categoryLabel]] : []),
            ["Quantity", `${form.quantity} ${a.unit(form.unitCode)}`],
            ["Price", `${money(toMinor(form.price))} / ${a.unit(form.unitCode)}`],
            [
              "Farm location",
              address
                ? [address.line1, address.city, address.lga, address.state]
                    .filter(Boolean)
                    .join(", ")
                : a.ui("Saved pickup address"),
            ],
            ["Shipping scope", a.ui(form.shippingScope === "LOCAL" ? "Local" : "Sells in Nigeria")],
            ["Description", form.description],
          ].map(([label, value]) => (
            <View key={label} style={listingStyles.reviewRow}>
              <Label muted style={{ flex: 1 }}>
                {label}
              </Label>
              <View
                style={{
                  flex: 1.5,
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {label === "Farm location" && (
                  <Icon name="listingLocation" nativeSize={{ width: 14.61, height: 14.61 }} />
                )}
                <Label
                  style={{
                    flexShrink: 1,
                    textAlign: "right",
                    fontFamily: "NotoBold",
                    color: label === "Price" ? colors.gold : colors.ink,
                  }}
                >
                  {value}
                </Label>
              </View>
            </View>
          ))}
        </Card>
      )}
      {!canSubmit && (
        <>
          <Notice text="Your draft is saved. Complete seller approval before submitting it for sale." />
          <Button title="Seller application" secondary onPress={() => a.go("seller")} />
        </>
      )}
      <Confirmation
        checked={confirmed}
        onChange={() => setConfirmed(!confirmed)}
        disabled={busy}
        label={a.t("sell.confirm")}
      />
      <Label muted style={listingStyles.help}>
        Your listing will be reviewed before buyers can see it.
      </Label>
    </ListingPage>
  );
}
const listingStyles = StyleSheet.create({
  title: {
    fontFamily: "Montserrat",
    fontSize: 26,
    lineHeight: 34,
    color: colors.ink,
    letterSpacing: -0.65,
  },
  section: { fontFamily: "NotoBold", fontSize: 18, color: colors.ink },
  help: { fontSize: 14, lineHeight: 21 },
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: "4%", rowGap: 12 },
  category: {
    width: "48%",
    minHeight: 144,
    padding: 16,
    paddingTop: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    position: "relative",
    gap: 10,
  },
  selected: { borderWidth: 2, borderColor: colors.green, backgroundColor: "#f4f9f6" },
  categoryLabel: { gap: 8 },
  choice: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 29,
    height: 29,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  scope: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  photoTile: {
    width: "48%",
    height: 190,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#f1f0ec",
  },
  addPhoto: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.green,
    backgroundColor: "#eaf4ed",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyPhoto: { alignItems: "center", justifyContent: "center", gap: 10, padding: 12 },
  photoBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#eaf4ed",
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: colors.green,
    fontFamily: "NotoBold",
    fontSize: 12,
    overflow: "hidden",
  },
  remove: {
    position: "absolute",
    right: 4,
    top: 4,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00000033",
    borderRadius: 22,
  },
  reviewCard: { borderWidth: 1, borderColor: "#e7e5e4" },
  reviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#f5f5f4",
  },
  success: { alignItems: "center", gap: 16, paddingVertical: 20 },
  successOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#eef8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  successInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
});
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
