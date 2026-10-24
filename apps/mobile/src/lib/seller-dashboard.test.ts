import { describe, expect, it } from "vitest";
import { hasDeviceDraft, sellerGreeting, sellerSummary } from "./seller-dashboard";
import { bottomTabs, showsBottomTabs, tabGeometry } from "./bottom-tabs";
import type { Listing, Order } from "./domain";
const listing = (status: string, stock: string, reserved = "0") =>
  ({ status, availableQuantity: stock, reservedQuantity: reserved }) as Listing;
const order = (status: string, delivery?: string) =>
  ({ status, delivery: delivery ? { status: delivery } : null }) as Order;
describe("seller dashboard and navigation", () => {
  it("uses the seller's five destinations and keeps buyer browsing separate", () => {
    expect(bottomTabs("SELLER").map((tab) => tab.name)).toEqual([
      "home",
      "myListings",
      "sell",
      "orders",
      "profile",
    ]);
    expect(bottomTabs("BUYER").map((tab) => tab.name)).toEqual([
      "home",
      "search",
      "orders",
      "profile",
    ]);
    expect(showsBottomTabs("SELLER", "sell", true)).toBe(true);
    expect(showsBottomTabs("SELLER", "review", true)).toBe(false);
    expect(showsBottomTabs("SELLER", "seller", true)).toBe(false);
    expect(showsBottomTabs("SELLER", "profile", false)).toBe(false);
  });
  it("counts active produce and excludes stock already reserved from low-stock alerts", () => {
    const result = sellerSummary(
      [
        listing("ACTIVE", "20", "19"),
        listing("ACTIVE", "2", "2"),
        listing("PAUSED", "1"),
        listing("ACTIVE", "10"),
      ],
      [],
    );
    expect(result.active).toHaveLength(3);
    expect(result.lowStock).toHaveLength(1);
  });
  it("never counts unpaid, completed or dispatched orders as ready to pack", () => {
    const result = sellerSummary(
      [],
      [
        order("AWAITING_PAYMENT"),
        order("COMPLETED"),
        order("CANCELLED"),
        order("FUNDED", "IN_TRANSIT"),
        order("FUNDED", "RETURNED"),
        order("FUNDED", "BOOKED"),
        order("FUNDED"),
      ],
    );
    expect(result.toPack).toHaveLength(2);
  });
  it("shows only real local drafts and uses the time-appropriate greeting", () => {
    expect(hasDeviceDraft(null)).toBe(false);
    expect(hasDeviceDraft({ title: " ", quantity: "" })).toBe(false);
    expect(hasDeviceDraft({ title: "Yam" })).toBe(true);
    expect(sellerGreeting(9)).toBe("Good morning, {name}");
    expect(sellerGreeting(14)).toBe("Good afternoon, {name}");
    expect(sellerGreeting(20)).toBe("Good evening, {name}");
  });
  it("keeps the active pill within the bar and all seller tabs tappable on narrow devices", () => {
    for (const width of [280, 335, 390])
      for (let selected = 0; selected < 5; selected++) {
        const items = tabGeometry(width, 5, selected, 130);
        expect(items[0]!.left).toBe(0);
        expect(items.at(-1)!.left + items.at(-1)!.width).toBeCloseTo(width);
        items.forEach((item, index) => {
          expect(item.width).toBeGreaterThanOrEqual(48);
          if (index)
            expect(item.left).toBeCloseTo(items[index - 1]!.left + items[index - 1]!.width);
        });
      }
  });
});
