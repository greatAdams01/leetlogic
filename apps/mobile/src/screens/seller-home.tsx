import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp, useResource } from "../state";
import { Card, Icon, Label, Notice, colors } from "../components/ui";
import { ListingControls, SmallAction } from "../components/seller-listing-controls";
import { api } from "../lib/api";
import { localizedError } from "../lib/localization";
import { money, type Listing, type Order } from "../lib/domain";
import {
  hasDeviceDraft,
  sellerGreeting,
  sellerSummary,
  type SavedListingDraft,
} from "../lib/seller-dashboard";
import { sellerPaymentAction, type FinancialSummary } from "../lib/finance";
import { sellerMenuState } from "../lib/seller-menu";
import { ListingPhoto } from "./market";

export function SellerHome() {
  const a = useApp();
  const listings = useResource<{ items: Listing[] }>("/marketplace/my-listings");
  const orders = useResource<{ items: Order[] }>("/orders?view=seller");
  const drafts = useResource<{ items: SavedListingDraft[] }>("/listing-drafts");
  const financial = useResource<FinancialSummary>("/financial");
  const verification = useResource<{ verification: { identityPassed?: boolean } }>(
    "/seller/verification",
    !!a.user?.farmerProfile,
  );
  const [deviceDraft, setDeviceDraft] = useState<{ title?: string } | null>(null);
  const [error, setError] = useState(""),
    [deleting, setDeleting] = useState("");
  const paymentAction = sellerPaymentAction(financial.data);
  const state = sellerMenuState(a.user?.farmerProfile, "SELLER");
  const approved = state === "approved";
  const { active, lowStock, toPack } = sellerSummary(
    listings.data?.items || [],
    orders.data?.items || [],
  );
  const name =
    a.user?.profile?.displayName ||
    a.user?.profile?.fullName ||
    a.user?.farmerProfile?.farmName ||
    "";
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const draftKey = `listing-draft:${a.user!.id}`;
  const readDraft = useCallback(async () => {
    const saved = await AsyncStorage.getItem(draftKey);
    try {
      const value: unknown = saved ? JSON.parse(saved) : null;
      setDeviceDraft(hasDeviceDraft(value) ? value : null);
    } catch {
      setDeviceDraft(null);
    }
  }, [draftKey]);
  const refresh = useCallback(async () => {
    await Promise.all([
      listings.reload(),
      orders.reload(),
      drafts.reload(),
      financial.reload(),
      verification.reload(),
      readDraft(),
      a.loadUser(),
    ]);
  }, [
    listings.reload,
    orders.reload,
    drafts.reload,
    financial.reload,
    verification.reload,
    readDraft,
    a.loadUser,
  ]);
  useEffect(() => {
    void readDraft().catch((e) => setError(localizedError(a.locale, e)));
    void a.loadUser().catch((e) => setError(localizedError(a.locale, e)));
    const sub = AppState.addEventListener("change", (value) => {
      if (value === "active") void refresh().catch((e) => setError(localizedError(a.locale, e)));
    });
    return () => sub.remove();
  }, [readDraft, a.loadUser, refresh, a.locale]);
  const deleteDraft = (draft?: SavedListingDraft) =>
    a.alert(
      "Delete draft?",
      "This removes the saved draft. Published listings will not be affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeleting(draft?.id || "device");
              setError("");
              try {
                if (draft) await api(`/listing-drafts/${draft.id}`, { method: "DELETE" });
                else {
                  await AsyncStorage.removeItem(draftKey);
                  setDeviceDraft(null);
                }
                await drafts.reload();
              } catch (e) {
                setError(localizedError(a.locale, e));
              } finally {
                setDeleting("");
              }
            })();
          },
        },
      ],
    );
  const status = approved
    ? "Verified seller"
    : state === "pending"
      ? "Awaiting approval"
      : state === "rejected"
        ? "Application rejected"
        : state === "changes"
          ? "Changes needed"
          : "Complete your seller profile";
  const loading = listings.loading || orders.loading || drafts.loading || financial.loading;
  const draftCount = (drafts.data?.items.length || 0) + (deviceDraft ? 1 : 0);
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh().catch((e) => setError(localizedError(a.locale, e)))}
            tintColor="white"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.between}>
            <View style={styles.logo} accessibilityLabel="LeetLogic logo">
              <Icon name="sellerLogo" nativeSize={{ width: 28.019, height: 28.019 }} />
              <Icon name="sellerWordmark" nativeSize={{ width: 106.501, height: 21.0094 }} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menu"
              onPress={() => a.reset("profile")}
              style={styles.avatar}
            >
              <Label style={{ color: "white", fontFamily: "NotoBold", fontSize: 14 }}>
                {initials || "●"}
              </Label>
            </Pressable>
          </View>
          <View style={{ gap: 8 }}>
            <Label style={styles.greeting}>
              {a.ui(sellerGreeting(new Date().getHours()), { name })}
            </Label>
            <View style={styles.status}>
              {approved && <Icon name="sellerVerified" nativeSize={{ width: 16, height: 16 }} />}
              <Label style={{ color: "white", fontSize: 13, lineHeight: 16 }}>{status}</Label>
            </View>
            <Label style={styles.subtitle}>Here is your daily farm trade summary.</Label>
          </View>
        </View>
        <View style={styles.body}>
          <Card style={styles.earningsCard}>
            <View style={styles.earningsHeader}>
              <Label style={[styles.muted, { flexGrow: 1, flexBasis: 130 }]}>
                Available earnings
              </Label>
              <SmallAction title={paymentAction.title} onPress={() => a.go(paymentAction.route)} />
            </View>
            <Label numberOfLines={1} adjustsFontSizeToFit style={styles.balance}>
              {financial.data ? money(financial.data.earnings.availableMinor) : "—"}
            </Label>
            <View style={styles.earningsBreakdown}>
              <View style={styles.earningsColumn}>
                <Label style={styles.caption}>Awaiting release</Label>
                <Label numberOfLines={1} adjustsFontSizeToFit style={styles.secondaryBalance}>
                  {financial.data ? money(financial.data.heldMinor) : "—"}
                </Label>
              </View>
              <View style={styles.earningsColumn}>
                <Label style={styles.caption}>Pending withdrawals</Label>
                <Label numberOfLines={1} adjustsFontSizeToFit style={styles.secondaryBalance}>
                  {financial.data ? money(financial.data.earnings.reservedMinor) : "—"}
                </Label>
              </View>
            </View>
            {financial.error && <Notice text={financial.error} error />}
          </Card>
          <View style={styles.stats}>
            <Pressable
              accessibilityRole="button"
              onPress={() => a.reset("myListings")}
              style={styles.stat}
            >
              <View style={[styles.statIcon, { backgroundColor: "#d1fae5" }]}>
                <Icon name="sellerListings" nativeSize={{ width: 20, height: 20 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Label style={styles.statNumber}>{listings.data ? active.length : "—"}</Label>
                <Label style={styles.caption}>Active listings</Label>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => a.reset("orders")}
              style={styles.stat}
            >
              <View style={[styles.statIcon, { backgroundColor: "#fef3c7" }]}>
                <Icon name="sellerPack" nativeSize={{ width: 20, height: 20 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Label style={styles.statNumber}>{orders.data ? toPack.length : "—"}</Label>
                <Label style={styles.caption}>Orders to pack</Label>
              </View>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => a.reset("sell")}
            style={styles.primary}
          >
            <Icon name="sellerPlus" nativeSize={{ width: 20, height: 20 }} />
            <Label style={styles.primaryLabel}>List produce</Label>
          </Pressable>
          {loading && <ActivityIndicator color={colors.green} />}
          {(error || listings.error || orders.error || drafts.error) && (
            <Notice text={error || listings.error || orders.error || drafts.error} error />
          )}
          <Section
            title="My produce listings"
            action={
              listings.data
                ? a.ui("View all ({count})", { count: listings.data.items.length })
                : undefined
            }
            onPress={() => a.reset("myListings")}
          >
            {!listings.loading && listings.data?.items.length === 0 && (
              <Empty text="You haven’t listed any produce yet." />
            )}
            {listings.data?.items.slice(0, 2).map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => a.reset("myListings")}
              >
                <Card style={styles.listingCard}>
                  <View style={styles.photo}>
                    <ListingPhoto item={item} height={80} />
                  </View>
                  <View style={styles.details}>
                    <View style={styles.between}>
                      <Label numberOfLines={1} style={styles.itemTitle}>
                        {item.title}
                      </Label>
                      <Label style={styles.badge}>{a.status(item.status)}</Label>
                    </View>
                    <Label style={styles.price}>
                      {money(item.unitPriceMinor)} / {a.unit(item.unitCode)}
                    </Label>
                    <Label style={styles.caption}>
                      {a.ui("{quantity} {unit} left · {location}", {
                        quantity: Math.max(
                          0,
                          Number(item.availableQuantity) - Number(item.reservedQuantity),
                        ),
                        unit: a.unit(item.unitCode),
                        location: item.locationAddress.city || item.locationAddress.state,
                      })}
                    </Label>
                  </View>
                </Card>
              </Pressable>
            ))}
          </Section>
          <Section title="Verification status">
            <Card style={styles.card}>
              <View style={styles.between}>
                <View style={styles.details}>
                  <Label style={styles.itemTitle}>{status}</Label>
                  <Label style={styles.muted}>
                    {approved
                      ? "Your profile is fully verified and ready for sales."
                      : state === "pending"
                        ? "Your farmer profile is awaiting approval. We’ll notify you when the review is complete."
                        : "Review your seller profile for the next steps."}
                  </Label>
                </View>
                {approved && <Label style={styles.badge}>Verified</Label>}
              </View>
              {verification.data?.verification.identityPassed && <Check text="Identity verified" />}
              {approved && <Check text="Farm location confirmed" />}
              {financial.data?.account?.ready &&
              financial.data.destinations.some((bank) => bank.usable) ? (
                <Check text="Bank account linked" />
              ) : (
                <SmallAction
                  title={paymentAction.title}
                  onPress={() => a.go(paymentAction.route)}
                />
              )}
              {!approved && (
                <SmallAction
                  title={state === "pending" ? "View application" : "Seller application"}
                  onPress={() => a.go("seller")}
                />
              )}
            </Card>
          </Section>
          <Section title="Draft listings" action={a.ui("{count} drafts", { count: draftCount })}>
            {!drafts.loading && draftCount === 0 && <Empty text="No saved drafts yet." />}
            {deviceDraft && (
              <DraftCard
                title={deviceDraft.title || a.ui("Untitled produce")}
                subtitle="Saved on this device"
                busy={!!deleting}
                onResume={() => a.reset("sell")}
                onDelete={() => deleteDraft()}
              />
            )}
            {drafts.data?.items.map((draft) => (
              <DraftCard
                key={draft.id}
                title={draft.fields.title}
                subtitle={
                  draft.fields.photoId
                    ? "Draft saved · review before publishing"
                    : "Draft saved · add a produce photo"
                }
                busy={!!deleting}
                onResume={() => a.go("sell", draft.id)}
                onDelete={() => deleteDraft(draft)}
              />
            ))}
          </Section>
          <Section
            title="Low stock items"
            action={a.ui("{count} items", { count: lowStock.length })}
          >
            {!listings.loading && lowStock.length === 0 && (
              <Empty text="No low stock alerts right now." />
            )}
            {lowStock.map((item) => (
              <Card key={item.id} style={styles.listingCard}>
                <View style={[styles.placeholder, styles.warning]}>
                  <Icon name="sellerAlert" nativeSize={{ width: 28, height: 28 }} />
                </View>
                <View style={styles.details}>
                  <Label style={styles.itemTitle}>{item.title}</Label>
                  <Label style={styles.muted}>
                    {a.ui("{quantity} {unit} remaining · restock recommended", {
                      quantity: Number(item.availableQuantity) - Number(item.reservedQuantity),
                      unit: a.unit(item.unitCode),
                    })}
                  </Label>
                  <ListingControls item={item} onUpdated={listings.reload} />
                </View>
              </Card>
            ))}
          </Section>
          <Section
            title="New orders"
            action={a.ui("{count} ready to pack", { count: toPack.length })}
            onPress={() => a.reset("orders")}
          >
            {!orders.loading && toPack.length === 0 && (
              <Empty text="No paid orders waiting to be packed." />
            )}
            {toPack.slice(0, 3).map((order) => (
              <Card key={order.id} style={styles.card}>
                <View style={styles.between}>
                  <Label style={styles.itemTitle}>{order.reference}</Label>
                  <Label style={[styles.badge, { backgroundColor: "#fef3c7", color: "#8a5b00" }]}>
                    {a.status(order.status)}
                  </Label>
                </View>
                <Label style={styles.muted}>
                  {order.listing.title} · {money(order.totalMinor)}
                </Label>
                <SmallAction title="Review order" onPress={() => a.go("delivery", order.id)} />
              </Card>
            ))}
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function Section({
  title,
  action,
  onPress,
  children,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 12, paddingTop: 8 }}>
      <View style={styles.between}>
        <Label style={styles.sectionTitle}>{title}</Label>
        {action &&
          (onPress ? (
            <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
              <Label style={styles.link}>{action}</Label>
            </Pressable>
          ) : (
            <Label style={styles.link}>{action}</Label>
          ))}
      </View>
      {children}
    </View>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <Card style={styles.card}>
      <Label style={styles.muted}>{text}</Label>
    </Card>
  );
}
function Check({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Icon name="sellerCheck" nativeSize={{ width: 16, height: 16 }} />
      <Label style={{ flex: 1, fontSize: 14 }}>{text}</Label>
    </View>
  );
}
function DraftCard({
  title,
  subtitle,
  busy,
  onResume,
  onDelete,
}: {
  title: string;
  subtitle: string;
  busy: boolean;
  onResume: () => void;
  onDelete: () => void;
}) {
  return (
    <Card style={styles.listingCard}>
      <View style={styles.placeholder}>
        <Icon name="sellerDraft" nativeSize={{ width: 28, height: 28 }} />
      </View>
      <View style={styles.details}>
        <Label style={styles.itemTitle}>{title}</Label>
        <Label style={styles.muted}>{subtitle}</Label>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <SmallAction title="Resume" disabled={busy} onPress={onResume} />
          <SmallAction title="Delete" muted disabled={busy} onPress={onDelete} />
        </View>
      </View>
    </Card>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.green },
  scroll: { flex: 1, backgroundColor: colors.paper },
  header: {
    backgroundColor: colors.green,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  logo: { flexDirection: "row", alignItems: "flex-end", gap: 4.483 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#185940",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    fontFamily: "Montserrat",
    fontWeight: "700",
    color: "white",
    fontSize: 24,
    lineHeight: 30,
  },
  status: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  subtitle: { color: "#d1fae5", fontSize: 14, lineHeight: 20, paddingTop: 5 },
  body: { marginTop: -16, paddingHorizontal: 20, gap: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(231,229,228,0.7)",
    padding: 16,
    gap: 12,
    boxShadow: "0px 2px 5px rgba(0,0,0,0.04)",
  },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  muted: { fontSize: 14, lineHeight: 20, color: "#78716c" },
  caption: { fontSize: 12, lineHeight: 17, color: "#78716c" },
  earningsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(231,229,228,0.7)",
    padding: 20,
    gap: 20,
  },
  earningsHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  earningsBreakdown: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: "#f0efeb",
  },
  earningsColumn: { flexGrow: 1, flexBasis: 120, minWidth: 0, gap: 6 },
  secondaryBalance: { fontSize: 18, lineHeight: 26, fontFamily: "NotoBold" },
  balance: {
    fontFamily: "Montserrat",
    fontWeight: "700",
    fontSize: 30,
    lineHeight: 36,
    color: colors.ink,
  },
  stats: {
    flexDirection: "row",
    gap: 12,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#fafaf9",
    borderWidth: 1,
    borderColor: "#e7e5e4",
  },
  statIcon: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  statNumber: { fontSize: 18, fontFamily: "NotoBold" },
  primary: {
    backgroundColor: colors.action,
    borderRadius: 12,
    minHeight: 52,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryLabel: { color: "white", fontSize: 16, fontFamily: "NotoBold" },
  sectionTitle: { fontFamily: "NotoBold", fontSize: 18, lineHeight: 28, flexShrink: 1 },
  link: { fontSize: 14, fontFamily: "NotoBold", color: colors.green },
  listingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(231,229,228,0.7)",
    padding: 14,
  },
  photo: { width: 80, height: 80, borderRadius: 12, overflow: "hidden" },
  details: { flex: 1, gap: 4, minWidth: 0 },
  itemTitle: { fontSize: 16, lineHeight: 24, fontFamily: "NotoBold", flexShrink: 1 },
  price: { fontSize: 14, lineHeight: 20, fontFamily: "NotoBold", color: "#e0a526" },
  badge: {
    fontSize: 12,
    lineHeight: 16,
    color: "#137333",
    backgroundColor: "#ecfdf5",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  placeholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fef3c7",
    backgroundColor: "#fef9ee",
    alignItems: "center",
    justifyContent: "center",
  },
  warning: { backgroundColor: "#fff7ed", borderColor: "#fedf89" },
});
