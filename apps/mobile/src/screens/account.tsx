import { LocalizedText as Text } from "../localization";
import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useApp, useResource } from "../state";
import { Page, Heading, Label, Field, Button, Card, Notice, Icon, s } from "../components/ui";
import { Select } from "../components/Select";
import { changeState, farmTypes, localGovernments, nigeriaStates } from "../lib/locations";
import { api } from "../lib/api";
import { Navigation } from "./market";
import { choosePhoto, photoBlob } from "./sell";
export function Profile() {
  const a = useApp(),
    [error, setError] = useState("");
  return (
    <Page title="My account" footer={<Navigation />}>
      <Text style={s.badge}>Phone verified</Text>
      <Heading>
        {a.user?.profile?.fullName || a.user?.profile?.displayName || "Your account"}
      </Heading>
      <Label muted>{a.user?.phoneE164}</Label>
      <Card>
        <Heading>Start selling</Heading>
        <Label>
          Use the same account to sell produce. Your farmer profile must be approved before listing.
        </Label>
        <Button
          title={a.user?.farmerProfile ? "Seller profile" : "Start selling"}
          onPress={() => a.go("seller")}
        />
      </Card>
      <Text style={s.sectionTitle}>Settings</Text>
      <Card>
        {[
          { label: "Personal details", sub: "Name, display name and email", route: "details" },
          {
            label: "Delivery addresses",
            sub: "Manage produce delivery and pickup locations",
            route: "addresses",
          },
          {
            label: "Language",
            sub: a.ui("{locale} · Change app language", { locale: a.locale }),
            route: "language",
          },
          { label: "My listings", sub: "Produce and moderation status", route: "myListings" },
          { label: "Help and support", sub: "Frequently asked questions", route: "help" },
        ].map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            onPress={() => (item.route === "language" ? a.openLanguage() : a.go(item.route as any))}
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
  const a = useApp(),
    [form, setForm] = useState({ label: "", line1: "", state: "", lga: "", city: "" }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Page title="Saved addresses" back={a.back}>
      <Heading>Where should produce go?</Heading>
      {a.user?.addresses.map((ad) => (
        <Card key={ad.id}>
          <Label style={{ fontFamily: "NotoBold" }}>{ad.label}</Label>
          <Label>
            {ad.line1}, {ad.city}, {ad.lga}, {ad.state}
          </Label>
        </Card>
      ))}
      <Text style={s.sectionTitle}>Add a Nigerian address</Text>
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
            onChangeText={(v) => setForm((f) => ({ ...f, [k]: v }))}
          />
        ))}
        <Select
          label="State"
          value={form.state}
          options={nigeriaStates}
          onChange={(state) => setForm((f) => changeState(f, state))}
        />
        <Select
          label="Local government area"
          value={form.lga}
          options={localGovernments(form.state)}
          disabled={!form.state}
          onChange={(lga) => setForm((f) => ({ ...f, lga }))}
        />
      </Card>
      <Button
        title={busy ? "Saving…" : "Save address"}
        disabled={busy || !form.state || !form.lga}
        onPress={async () => {
          setBusy(true);
          try {
            await api("/me/addresses", { method: "POST", body: form });
            await a.loadUser();
            setForm({ label: "", line1: "", state: "", lga: "", city: "" });
          } catch (e) {
            setError(a.error(e));
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && <Notice text={error} error />}
    </Page>
  );
}
export function Notifications() {
  const a = useApp(),
    r = useResource<{
      items: { id: string; orderId: string; messageKey: string; createdAt: string }[];
    }>("/orders/notifications");
  return (
    <Page title="Notifications" back={a.back} loading={r.loading}>
      {r.error && <Notice text={r.error} error />}
      {!r.loading && !r.data?.items.length && (
        <Notice text="Delivery updates will appear here when your shipment changes." />
      )}
      {r.data?.items.map((i) => (
        <Pressable key={i.id} onPress={() => a.go("delivery", i.orderId)}>
          <Card>
            <Label>
              {a.t(i.messageKey as any) || a.status(i.messageKey.split(".").pop() || "Update")}
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
export function Seller() {
  const a = useApp(),
    [form, setForm] = useState({
      farmName: a.user?.farmerProfile?.farmName || "",
      farmType: "Crop farming",
      line1: "",
      description: "",
      state: "",
      lga: "",
      city: "",
    }),
    [saved, setSaved] = useState(!!a.user?.farmerProfile),
    [doc, setDoc] = useState(false),
    [declaration, setDeclaration] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [documentType, setDocumentType] = useState("NIN_SLIP");
  const status = a.user?.farmerProfile?.verificationStatus;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(a.error(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="Seller profile · Farm details" back={a.back}>
      <Heading>Tell us about your farm.</Heading>
      {status && <Text style={s.badge}>{a.status(status)}</Text>}
      {status === "APPROVED" ? (
        <>
          <Notice text="Your farmer profile is approved. You can create produce listings for moderation." />
          <Button title="Create listing" onPress={() => a.go("sell")} />
        </>
      ) : ["SUBMITTED", "IN_REVIEW"].includes(status || "") ? (
        <Notice text="Your application is being reviewed. You can keep buying while you wait." />
      ) : (
        <>
          <Card>
            {(["farmName", "line1", "description", "city"] as const).map((k) => (
              <Field
                key={k}
                label={
                  {
                    farmName: "Farm / business name *",
                    farmType: "Farm type *",
                    line1: "Full farm address *",
                    description: "Description (optional)",
                    state: "State *",
                    lga: "Local government area *",
                    city: "City / town *",
                  }[k]
                }
                value={form[k]}
                onChangeText={(v) => setForm((f) => ({ ...f, [k]: v }))}
              />
            ))}
            <Select
              label="Farm type *"
              value={form.farmType}
              options={farmTypes}
              onChange={(farmType) => setForm((f) => ({ ...f, farmType }))}
            />
            <Select
              label="State *"
              value={form.state}
              options={nigeriaStates}
              onChange={(state) => setForm((f) => changeState(f, state))}
            />
            <Select
              label="Local government area *"
              value={form.lga}
              options={localGovernments(form.state)}
              disabled={!form.state}
              onChange={(lga) => setForm((f) => ({ ...f, lga }))}
            />
          </Card>
          <Button
            title={busy ? "Saving…" : "Save farm profile"}
            disabled={busy || !form.state || !form.lga || !form.farmType}
            onPress={() =>
              void run(async () => {
                await api("/me/seller-profile", { method: "POST", body: form });
                await a.loadUser();
                setSaved(true);
              })
            }
          />
          {saved && (
            <>
              <Text style={s.sectionTitle}>Identity document</Text>
              <Label muted style={s.small}>
                Upload a clear JPEG or PNG of your own document. It stays private for authorized
                verification staff.
              </Label>
              {["NIN_SLIP", "VOTER_CARD", "DRIVERS_LICENSE", "PASSPORT"].map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setDocumentType(v)}
                  style={[s.choice, documentType === v && s.selected]}
                >
                  <Label>{a.status(v)}</Label>
                </Pressable>
              ))}
              <Button
                title={doc ? "Replace identity photo" : "Choose identity photo"}
                secondary
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    const p = await choosePhoto();
                    if (p) {
                      await api(`/seller/verification/uploads?documentType=${documentType}`, {
                        method: "POST",
                        blob: await photoBlob(p.uri, p.mimeType),
                      });
                      setDoc(true);
                    }
                  })
                }
              />
              {doc && <Notice text="Identity document uploaded privately." />}
              <Field
                label="Farm / business evidence note"
                value={note}
                multiline
                onChangeText={setNote}
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: declaration }}
                style={[s.choice, declaration && s.selected]}
                onPress={() => setDeclaration(!declaration)}
              >
                <Label style={{ flex: 1 }}>
                  {declaration ? "☑" : "□"}{" "}
                  {a.ui(
                    "I confirm that these details and identity documents are mine and accurate.",
                  )}
                </Label>
              </Pressable>
              <Button
                title="Submit seller application"
                disabled={busy || !doc || !declaration}
                onPress={() =>
                  void run(async () => {
                    if (note)
                      await api("/seller/verification/evidence", {
                        method: "POST",
                        body: { note },
                      });
                    await api("/seller/verification/submit", {
                      method: "POST",
                      body: { declarationAccepted: true },
                    });
                    await a.loadUser();
                    a.reset("profile");
                  })
                }
              />
            </>
          )}
        </>
      )}
      {error && <Notice text={error} error />}
    </Page>
  );
}
