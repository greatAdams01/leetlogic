import { describe, it, expect } from "vitest";
import {
  openLanguageScreen,
  finishLanguageSelection,
  backStack,
  returnToScreen,
  type Route,
} from "./navigation";
describe("language navigation", () => {
  it("continues first-time language selection into onboarding", () => {
    expect(finishLanguageSelection([{ name: "language" }])).toEqual([
      { name: "language" },
      { name: "intro" },
    ]);
  });
  it("returns to the exact intro slide after changing language", () => {
    for (let step = 0; step < 3; step++) {
      const opened = openLanguageScreen([{ name: "language" }, { name: "intro" }], step);
      expect(opened.at(-1)?.name).toBe("language");
      expect(finishLanguageSelection(opened).at(-1)).toEqual({ name: "intro", id: String(step) });
    }
  });
  it("returns guests to role selection without replaying onboarding", () => {
    expect(finishLanguageSelection(openLanguageScreen([{ name: "role" }]))).toEqual([
      { name: "role" },
    ]);
  });
  it("returns authenticated users to account settings", () => {
    const history: Route[] = [{ name: "home" }, { name: "profile" }];
    expect(finishLanguageSelection(openLanguageScreen(history))).toEqual(history);
  });
  it("does not stack duplicate language screens or mutate existing history", () => {
    const history: Route[] = [{ name: "intro", id: "1" }];
    const opened = openLanguageScreen(history, 2);
    expect(history).toEqual([{ name: "intro", id: "1" }]);
    expect(openLanguageScreen(opened)).toBe(opened);
  });
});

describe("leaving guest sign-in prompts", () => {
  it("returns to the exact public screen before Orders or Menu", () => {
    for (const name of ["orders", "profile"] as const) {
      const history: Route[] = [{ name: "search", id: "tomatoes" }, { name }];
      expect(backStack(history, false)).toEqual([{ name: "search", id: "tomatoes" }]);
    }
  });
  it("recovers a protected root created by a tab reset", () => {
    expect(backStack([{ name: "orders" }], false)).toEqual([{ name: "home" }]);
    expect(backStack([{ name: "profile" }], false)).toEqual([{ name: "home" }]);
  });
  it("takes a seller phone-entry root back to account selection", () => {
    expect(backStack([{ name: "phone" }], false)).toEqual([{ name: "role" }]);
  });
  it("takes OTP Back to the phone prompt before returning to browsing", () => {
    const history: Route[] = [
      { name: "home" },
      { name: "orders" },
      { name: "otp", id: "08012345678" },
    ];
    expect(backStack(history, false)).toEqual(history.slice(0, 2));
    expect(backStack(backStack(history, false), false)).toEqual([{ name: "home" }]);
  });
  it("preserves signed-in tab roots and public landing screens", () => {
    const orders: Route[] = [{ name: "orders" }];
    const home: Route[] = [{ name: "home" }];
    expect(backStack(orders, true)).toBe(orders);
    expect(backStack(home, false)).toBe(home);
  });
});

describe("delivery pricing return", () => {
  it("returns to the owning order with its next step and removes the pricing form", () => {
    const history: Route[] = [
      { name: "orders" },
      { name: "delivery", id: "order" },
      { name: "quotes", id: "order" },
    ];
    const next = returnToScreen(history, {
      name: "delivery",
      id: "order",
      query: "delivery-carriers",
    });
    expect(next).toEqual([
      { name: "orders" },
      { name: "delivery", id: "order", query: "delivery-carriers" },
    ]);
    expect(backStack(next, true)).toEqual([{ name: "orders" }]);
    expect(history).toHaveLength(3);
  });
});
