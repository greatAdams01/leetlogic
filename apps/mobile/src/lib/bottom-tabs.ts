import type { Route } from "./navigation";
export const buyerTabs = [
  { name: "home", label: "Home", icon: "home", active: "homeActive" },
  { name: "search", label: "Search", icon: "search", active: "searchActive" },
  { name: "orders", label: "Orders", icon: "orders", active: "ordersActive" },
  { name: "profile", label: "Menu", icon: "profile", active: "profileActive" },
] as const;
export const sellerTabs = [
  buyerTabs[0],
  { name: "myListings", label: "Listings", icon: "listings", active: "listingsActive" },
  { name: "sell", label: "Sell", icon: "sell", active: "sellActive" },
  buyerTabs[2],
  buyerTabs[3],
] as const;
export const bottomTabs = (role: "BUYER" | "SELLER") =>
  role === "SELLER" ? sellerTabs : buyerTabs;
export const showsBottomTabs = (
  role: "BUYER" | "SELLER",
  route: Route["name"],
  signedIn: boolean,
) =>
  route !== "sell" &&
  (signedIn || route === "home" || route === "search") &&
  (bottomTabs(role).some((tab) => tab.name === route) || (role === "BUYER" && route === "categories"));

// Reserve space for a compact icon-and-label pill, keeping every other tab tappable.
export function tabGeometry(width: number, count: number, selected: number, labelWidth: number) {
  const activeWidth = Math.min(
    Math.max(labelWidth + 50, 78),
    Math.max(48, width - (count - 1) * 48),
  );
  const otherWidth = Math.max(0, (width - activeWidth) / (count - 1));
  return Array.from({ length: count }, (_, index) => ({
    width: index === selected ? activeWidth : otherWidth,
    left:
      index < selected
        ? index * otherWidth
        : index === selected
          ? selected * otherWidth
          : (index - 1) * otherWidth + activeWidth,
  }));
}
