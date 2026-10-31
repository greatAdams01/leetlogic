import { registerOrderPush } from "../lib/push-notifications";
import { FarmPin } from "../components/farm-pin";
import { savedFarmPoint, type FarmPoint } from "../lib/farm-location";
import { farmLocation } from "../lib/farm-location";
import { LocalizedText as Text } from "../localization";
import React, { useState, useEffect, useRef } from "react";
import { View, Pressable, AppState } from "react-native";
import { useApp, useResource } from "../state";
import { Page, Heading, Label, Field, Button, Card, Notice, Icon, s } from "../components/ui";
import { Select } from "../components/Select";
import { changeState, localGovernments, nigeriaStates, postcodeLocation } from "../lib/locations";
import { PostcodeEntry } from "../components/postcode-entry";
import { postcodeStatus, type PostcodeLookup } from "../../../../packages/contracts/src/addresses";
import type { Address } from "../lib/domain";
import { api, uuid } from "../lib/api";
import { sellerMenuState } from "../lib/seller-menu";
import { colors } from "../components/ui";
import { whenIdle } from "../lib/idle";
import { localizedError } from "../lib/localization";
export function Profile() {
  const a = useApp(),
    [error, setError] = useState("");
  const state = a.role === "BUYER" ? "buyer" : sellerMenuState(a.user?.farmerProfile, a.role);
  // Refresh on entering Menu, returning to the foreground and while approval is pending.
  // Keep the current account visible during refresh; never display a guessed status.
  useEffect(() => {
    let active = true,
      running = false;
    const refresh = async () => {
      if (!active || running || AppState.currentState !== "active") return;
      running = true;
      try {
        await a.loadUser();
        if (active) setError("");
      } catch (e) {
        if (active) setError(localizedError(a.locale, e));
      } finally {
        running = false;
      }
    };
    const cancelInitialRefresh = whenIdle(() => void refresh());
    const sub = AppState.addEventListener("change", (value) => {
      if (value === "active") void refresh();
    });
    const timer = state === "pending" ? setInterval(() => void refresh(), 30000) : undefined;
    return () => {
      active = false;
      cancelInitialRefresh();
      sub.remove();
      if (timer) clearInterval(timer);
    };
  }, [a.loadUser, state, a.locale]);
  const phoneVerified = !!a.user?.phoneVerifiedAt;
  const seller = a.role === "SELLER";
  return (
    <Page title="Menu">
      <Heading>
        {a.user?.profile?.fullName || a.user?.profile?.displayName || "Your account"}
      </Heading>
      <View style={[s.row, { flexWrap: "wrap", gap: 8 }]}>
        <Label muted>{a.user?.phoneE164}</Label>
        <View
          accessible
          accessibilityLabel={a.ui(
            phoneVerified ? "Phone number verified" : "Phone number not verified",
          )}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          {phoneVerified && <Text style={{ color: colors.green, fontFamily: "NotoBold" }}>✓</Text>}
          <Label style={{ fontSize: 12, color: phoneVerified ? colors.green : colors.muted }}>
            {phoneVerified ? "Verified" : "Not verified"}
          </Label>
        </View>
      </View>
      <Card>
        {state === "approved" ? (
          <>
            <Label style={{ color: colors.green, fontFamily: "NotoBold" }}>Verified farmer</Label>
            <Heading>{a.user?.farmerProfile?.farmName}</Heading>
            <Label>Manage your produce, listings and earnings.</Label>
            <Button title="Create listing" onPress={() => a.go("sell")} />
          </>
        ) : state === "pending" ? (
          <>
            <Heading>Application under review</Heading>
            <Label>
              Your seller application is awaiting approval. You can keep shopping while we review
              it.
            </Label>
            <Button title="View application" secondary onPress={() => a.go("seller")} />
          </>
        ) : state === "rejected" ? (
          <>
            <Heading>Application not approved</Heading>
            <Label>Review the decision and contact support for help with your application.</Label>
            <Button title="View decision" secondary onPress={() => a.go("seller")} />
            <Button title="Help and support" secondary onPress={() => a.go("help")} />
          </>
        ) : state === "changes" ? (
          <>
            <Heading>Changes requested</Heading>
            <Label>Update your application using the review feedback, then submit it again.</Label>
            <Button title="Update application" onPress={() => a.go("seller")} />
          </>
        ) : state === "incomplete" ? (
          <>
            <Heading>Complete your seller profile</Heading>
            <Label>
              Add your farm details, verify your identity and upload farm evidence to finish your
              application.
            </Label>
            <Button title="Continue application" onPress={() => a.go("seller")} />
          </>
        ) : state === "buyer" ? (
          <>
            <Heading>Start selling</Heading>
            <Label>
              Your account is registered as a Buyer. Contact support if your account role needs correction.
            </Label>

          </>
        ) : (
          <>
            <Heading>Seller profile</Heading>
            <Label>Open your seller profile to view its current status.</Label>
            <Button title="Seller profile" secondary onPress={() => a.go("seller")} />
          </>
        )}
      </Card>
      <Text style={s.sectionTitle}>Settings</Text>
      <Card>
        {[
          ...(seller
            ? [
                {
                  label: "Security settings",
                  sub: "Manage your PIN and biometric unlock",
                  route: "securitySettings",
                },
              ]
            : []),
          {
            label: "Notifications",
            sub: seller ? "Paid orders and delivery updates" : "Delivery updates",
            route: "notifications",
          },
          {
            label: "Payments and earnings",
            sub: "Manage payments, bank accounts and withdrawals",
            route: "finance",
          },
          { label: "Bank accounts", sub: "Manage bank accounts for your earnings", route: "banks" },
          ...(!seller
            ? [
                {
                  label: "Shopping location",
                  sub: "Current location and nearby farmers",
                  route: "shoppingLocation",
                },
              ]
            : []),
          { label: "Personal details", sub: "Name, display name and email", route: "details" },
          {
            label: seller ? "Farm location" : "Delivery addresses",
            sub: seller
              ? "Manage where you farm and where produce is collected"
              : "Manage where your orders are delivered",
            route: "addresses",
          },
          {
            label: "Language",
            sub: a.ui("{locale} · Change app language", { locale: a.locale }),
            route: "language",
          },
          { label: "My listings", sub: "Produce and moderation status", route: "myListings" },
          { label: "Help and support", sub: "Frequently asked questions", route: "help" },
        ]
          .filter(
            (item) =>
              (item.route !== "myListings" || state === "approved") &&
              (!["finance", "banks"].includes(item.route) || a.role === "SELLER"),
          )
          .map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              onPress={() =>
                item.route === "language" ? a.openLanguage() : a.go(item.route as any)
              }
              style={[s.between, { paddingVertical: 10 }]}
            >
              <View style={{ flex: 1 }}>
                <Label style={{ fontFamily: "NotoBold" }}>{item.label}</Label>
                <Label muted style={s.small}>
                  {item.sub}
                </Label>
              </View>
              <Icon name="chevron" size={20} />
            </Pressable>
          ))}
      </Card>
      {seller && (
        <Button
          title="Enable farmer notifications"
          secondary
          onPress={() =>
            void registerOrderPush(true)
              .then(() => a.notify("Listing approval and paid-order notifications are enabled."))
              .catch((e) => setError(a.error(e)))
          }
        />
      )}
      <Button
        title={a.t("auth.signout")}
        secondary
        onPress={() =>
          a.alert("Sign out?", "Your account and submitted listings remain saved.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", onPress: () => a.signOut().catch((e) => setError(a.error(e))) },
          ])
        }
      />
      {error && <Notice text={error} error />}
    </Page>
  );
}
export function Details() {
  const a = useApp(),
    [fullName, setFullName] = useState(a.user?.profile?.fullName || ""),
    [displayName, setDisplayName] = useState(a.user?.profile?.displayName || ""),
    [email, setEmail] = useState(a.user?.profile?.email || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Page
      title="Personal details"
      back={a.back}
      footer={
        <Button
          title={busy ? "Saving…" : "Save details"}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await api("/me", {
                method: "PATCH",
                body: {
                  ...(fullName ? { fullName } : {}),
                  ...(displayName ? { displayName } : {}),
                  email: email || null,
                },
              });
              await a.loadUser();
              a.back();
            } catch (e) {
              setError(a.error(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <Heading>Your details</Heading>
      <Card>
        <Field
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          textContentType="name"
        />
        <Field label="Display name" value={displayName} onChangeText={setDisplayName} />
        <Field
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Card>
      {error && <Notice text={error} error />}
    </Page>
  );
}
export function Addresses() {
  const emptyForm = { label: "", line1: "", line2: "", landmark: "", postalCode: "", state: "", lga: "", city: "" };
  const a = useApp(),
    [form, setForm] = useState(emptyForm),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [coordinates, setCoordinates] = useState<FarmPoint | undefined>(),
    [editingId, setEditingId] = useState<string>(),
    [proof, setProof] = useState<string | null>(),
    [check, setCheck] = useState<PostcodeLookup | null>(null);
  const submitting = useRef(false);
  const saveKey = useRef<string | undefined>(undefined);
  const seller = a.role === "SELLER" || !!a.user?.farmerProfile;
  const addingPickup = seller && a.route.id === "pickup";
  const defaultDelivery = a.user?.addresses.find((address) => address.isDefaultDelivery);
  const farmAddress = farmLocation(
    a.user?.addresses || [],
    a.user?.farmerProfile?.primaryAddressId,
  );
  const clearCheck = () => { setProof(null); setCheck(null); };
  const editField = (key: keyof typeof emptyForm, value: string) => {
    saveKey.current = undefined;
    if (key !== "label") clearCheck();
    if (["line1", "city", "state", "lga"].includes(key)) setCoordinates(undefined);
    setForm((f) => key === "state" ? changeState(f, value) : { ...f, [key]: value });
  };
  const editAddress = (address: Address) => {
    saveKey.current = undefined;
    setEditingId(address.id); setProof(undefined); setCheck(null); setSaved(false); setError("");
    setCoordinates(savedFarmPoint(address));
    setForm({ label: address.label || "Farm location", line1: address.line1, line2: address.line2 || "", landmark: address.landmark || "",
      postalCode: address.postalCode || "", state: address.state, lga: address.lga, city: address.city });
  };
  const save = async () => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setSaved(false); setError("");
    try {
      await api(editingId ? `/me/addresses/${editingId}` : "/me/addresses", {
        method: editingId ? "PATCH" : "POST",
        ...(!editingId ? { key: saveKey.current ??= uuid() } : {}),
        body: { ...form, label: form.label || (seller ? "Pickup address" : "Delivery address"),
          postalCode: form.postalCode || null, verificationToken: proof,
          isDefaultDelivery: !seller, coordinates: coordinates || null },
      });
      setForm(emptyForm); setEditingId(undefined); setProof(undefined); setCheck(null);
      saveKey.current = undefined;
      setSaved(true); setCoordinates(undefined);
      await a.loadUser();
      if (addingPickup) a.back();
      else if (!seller) a.alert("Delivery address saved.", "Return to continue your order.", [{ text: "Go back", onPress: a.back }]);
    } catch (e) { setError(a.error(e)); }
    finally { submitting.current = false; setBusy(false); }
  };
  return (
    <Page
      title={
        addingPickup ? "Different pickup address" : seller ? "Farm location" : "Saved addresses"
      }
      back={a.back}
    >
      <Heading>
        {addingPickup
          ? "Different pickup address"
          : seller
            ? "Farm location"
            : "Where should your orders be delivered?"}
      </Heading>
      <Label muted>
        {seller
          ? "Your farm address is used for pickup. Choose a different pickup address only when arranging an order’s delivery."
          : "Save the addresses where you want to receive your orders."}
      </Label>
      {saved && (
        <View style={{ gap: 8 }}>
          <Notice text={seller ? "Pickup location saved." : "Delivery address saved."} />
          {!seller && <Button title="Go back" onPress={a.back} />}
        </View>
      )}
      {(seller && !addingPickup ? (farmAddress ? [farmAddress] : []) : a.user?.addresses)?.map(
        (ad) => (
          <Card key={ad.id}>
            <Label style={{ fontFamily: "NotoBold" }}>
              {ad.id === farmAddress?.id ? a.ui("Farm location") : ad.label}
            </Label>
            {!seller && ad.isDefaultDelivery && (
              <Text style={s.badge}>Primary delivery location</Text>
            )}
            <Label>
              {ad.line1}, {ad.city}, {ad.lga}, {ad.state}
            </Label>
            {ad.landmark && <Label muted>{ad.landmark}</Label>}
            {ad.postalCode && <Label>{ad.postalCode}</Label>}
            <Label muted>{a.ui(postcodeStatus(ad))}</Label>
            <Button title="Edit saved address" secondary disabled={busy} onPress={() => editAddress(ad)} />
          </Card>
        ),
      )}
      {seller && !addingPickup && farmAddress && !editingId && (
        <FarmPin
          value={savedFarmPoint(farmAddress)}
          onConfirm={async (point) => {
            await api("/me/farm-location", { method: "PATCH", body: point });
            await a.loadUser();
          }}
        />
      )}
      {(!seller || addingPickup || editingId) && (
        <>
          <Text style={s.sectionTitle}>
            {editingId ? "Edit saved address" : seller ? "Different pickup address" : "Add a delivery address"}
          </Text>
          <PostcodeEntry value={form.postalCode} revision={JSON.stringify([a.user?.id, editingId, form.state, form.lga, form.city, form.line1])}
            coordinates={coordinates} disabled={busy}
            onChange={(value) => editField("postalCode", value)}
            onManual={() => { saveKey.current = undefined; clearCheck(); }}
            onVerified={(lookup) => {
              const next = postcodeLocation(form, lookup.fields);
              saveKey.current = undefined;
              if (["state", "lga", "city", "line1"].some((key) => next[key as keyof typeof next] !== form[key as keyof typeof form])) setCoordinates(undefined);
              setForm({ ...next, postalCode: lookup.postcode }); setProof(lookup.verificationToken); setCheck(lookup);
            }} />
          {check && <Notice text={a.ui(postcodeStatus({ postalCode: check.postcode, postcodeVerifiedAt: "checked", postcodeVerificationMode: check.mode, postcodeVerificationLevel: check.level }))} />}
          <FarmPin
            value={coordinates}
            context={seller ? "farm" : "buyer"}
            autoLocate={!seller && !defaultDelivery}
            disabled={busy}
            onConfirm={async (point) => {
              clearCheck();
              saveKey.current = undefined;
              setCoordinates(point);
              if (!seller) {
                const place = await import("../lib/device-location")
                  .then(({ describePosition }) => describePosition(point))
                  .catch(() => null);
                 if (place) setForm((current) => ({ ...current, ...place, label: current.label || "Current location" }));
              }
            }}
          />
          {coordinates && !seller && (
            <Notice text="Location selected. Review your address below, then tap Save address to continue." />
          )}
          <Card>
            {(["label", "line1", "city"] as const).map((k) => (
              <Field
                key={k}
                label={
                  {
                    label: "Address label",
                    line1: "Full street address",
                    state: "State",
                    lga: "Local government area",
                    city: "City / town",
                  }[k]
                }
                value={form[k]}
                 editable={!busy}
                 onChangeText={(v) => editField(k, v)}
              />
            ))}
            <Select
              label="State"
              value={form.state}
              options={nigeriaStates}
               disabled={busy}
               onChange={(state) => editField("state", state)}
            />
            <Select
              label="Local government area"
              value={form.lga}
              options={localGovernments(form.state)}
               disabled={busy || !form.state}
               onChange={(lga) => editField("lga", lga)}
            />
            <Field label="Additional directions (optional)" value={form.line2} maxLength={180} editable={!busy} onChangeText={(v) => editField("line2", v)} />
            <Field label="Landmark (optional)" value={form.landmark} maxLength={180} editable={!busy} onChangeText={(v) => editField("landmark", v)} />
          </Card>
          <Button
            title={busy ? "Saving…" : seller ? "Save pickup address" : "Save address"}
            disabled={busy || !form.state || form.lga.trim().length < 2 || form.city.trim().length < 2 || form.line1.trim().length < 5}
            onPress={() => void save()}
          />
          {editingId && <Button title="Cancel" secondary disabled={busy} onPress={() => { setEditingId(undefined); setForm(emptyForm); setCoordinates(undefined); clearCheck(); }} />}
        </>
      )}
      {seller && !addingPickup && !farmAddress && (
        <Button title="Complete farm details" onPress={() => a.go("seller")} />
      )}
      {error && <Notice text={error} error />}
    </Page>
  );
}
export function Notifications() {
  const a = useApp(),
    r = useResource<{
      items: { id: string; orderId?: string; listingId?: string; title?: string; messageKey: string; createdAt: string }[];
    }>(`/orders/notifications?view=${a.role === "SELLER" ? "seller" : "buyer"}`);
  return (
    <Page title="Notifications" back={a.back} loading={r.loading}>
      {r.error && <Notice text={r.error} error />}
      {!r.loading && !r.data?.items.length && (
        <Notice text="Listing approvals, paid orders and delivery updates will appear here." />
      )}
      {r.data?.items.map((i) => (
        <Pressable key={i.id} accessibilityRole="button" onPress={() => i.messageKey === "listing.approved" ? a.go("myListings") : i.orderId && a.go("delivery", i.orderId)}>
          <Card>
            <Label>
              {i.messageKey === "listing.approved"
                ? a.ui("Your listing “{title}” has been approved and is now live.", { title: i.title || "" })
                : i.messageKey === "order.paid"
                ? "New paid order. Review it and prepare your produce."
                : a.t(i.messageKey as any) || a.status(i.messageKey.split(".").pop() || "Update")}
            </Label>
            <Label muted style={s.small}>
              {a.date(i.createdAt)}
            </Label>
          </Card>
        </Pressable>
      ))}
      <Button title="Refresh" secondary onPress={() => void r.reload()} />
    </Page>
  );
}
export function Help() {
  const a = useApp(),
    r = useResource<{ items: { id: string; question: string; answer: string }[] }>(
      `/content/faq?locale=${a.locale}&audience=${a.role === "SELLER" ? "FARMERS" : "BUYERS"}`,
    );
  return (
    <Page title="Help and support" back={a.back} loading={r.loading}>
      <Heading>How can we help?</Heading>
      {r.error && <Notice text={r.error} error />}
      {!r.loading && !r.data?.items.length && (
        <Notice text="No published help articles are available in this language yet. You can change the app language in your account." />
      )}
      {r.data?.items.map((i) => (
        <Card key={i.id}>
          <Label style={{ fontFamily: "NotoBold" }}>{i.question}</Label>
          <Label>{i.answer}</Label>
        </Card>
      ))}
    </Page>
  );
}
export { Seller } from "./seller";
