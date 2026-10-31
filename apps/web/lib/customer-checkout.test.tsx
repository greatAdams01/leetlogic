// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, type RenderResult } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  api: vi.fn(), init: vi.fn(), refresh: vi.fn(), select: vi.fn(), quotes: vi.fn(), collection: vi.fn(),
  changed: vi.fn(), open: vi.fn(), payment: null as any, delivery: null as any,
}));
vi.mock("./customer-api", () => ({ customerApi: h.api }));
vi.mock("../components/language-provider", () => ({ useLanguage: () => ({ locale: "en", t: (key: string) => ({
  "delivery.title": "Delivery", "delivery.select": "Choose delivery", "delivery.expired": "Quote expired",
  "delivery.refresh": "Refresh delivery", "delivery.quotes": "Get delivery quotes", "delivery.date": "Pickup date",
  "delivery.pickup": "Pickup location", "delivery.destination": "Delivery destination",
}[key] || key) }) }));
vi.mock("../components/translated-text", () => ({ TranslatedText: () => null }));
vi.mock("next/link", () => ({ default: ({ href, children }: any) => <a href={href}>{children}</a> }));
vi.mock("../../mobile/src/lib/localization", () => ({
  ui: (_locale: string, text: string) => text,
  localizedError: (_locale: string, value: any) => value?.code || value?.message || "Request failed",
  localizedStatus: (_locale: string, status: string) => status,
}));
import { CustomerPayment } from "../components/customer-payments";
import { CustomerDelivery } from "../components/customer-delivery";

const pending = (status = "OPEN", amountMinor = "11000", kind = "ORDER") => ({
  id: "payment", kind, status, amountMinor,
  checkoutUrl: status === "OPEN" ? "https://sandbox-checkout.bachs.io/c/existing" : null,
  expiresAt: new Date(Date.now() + 60000).toISOString(),
});
const copy = (value: any) => JSON.parse(JSON.stringify(value));
const button = (name: string) => screen.queryByRole("button", { name }) as HTMLButtonElement | null;
const click = async (name: string) => { await act(async () => { fireEvent.click(button(name)!); }); };
const mountPayment = async () => {
  let view!: RenderResult;
  await act(async () => { view = render(<CustomerPayment orderId="order" isBuyer onChanged={h.changed} />); });
  return view;
};
const mountDelivery = async () => {
  let view!: RenderResult;
  await act(async () => { view = render(<CustomerDelivery id="order" />); });
  return view;
};
function selected(id = "second") {
  const quote = h.delivery.delivery.quotes.find((item: any) => item.id === id);
  const total = (10000n + BigInt(quote.amountMinor)).toString();
  h.delivery.delivery.selectedQuoteId = id;
  h.delivery.delivery.shippingMinor = quote.amountMinor;
  h.delivery.delivery.status = "PAYMENT_PENDING";
  Object.assign(h.delivery.order, { checkoutReady: true, payableMinor: total, totalWithDeliveryMinor: total });
  Object.assign(h.payment, { checkoutReady: true, payableMinor: total });
}
function unselected() {
  h.delivery.delivery.selectedQuoteId = null;
  h.delivery.delivery.shippingMinor = "0";
  h.delivery.delivery.status = "QUOTE_REQUIRED";
  Object.assign(h.delivery.order, { checkoutReady: false, payableMinor: null, totalWithDeliveryMinor: null });
  Object.assign(h.payment, { checkoutReady: false, payableMinor: null });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("location", { assign: h.open });
  h.changed.mockResolvedValue(undefined);
  h.payment = {
    enabled: true, orderStatus: "AWAITING_PAYMENT", heldMinor: "0", releasedMinor: "0", refundedMinor: "0",
    checkoutReady: true, checkoutActive: false, payableMinor: "11000", items: [],
  };
  const pickup = { name: "Farmer", phone: "+2348012345678", email: "farmer@example.test", address: "12 Farm Road, Lagos, Ikeja", state: "Lagos", country: "NG" };
  const destination = { ...pickup, name: "Buyer", email: "buyer@example.test", address: "20 Buyer Street, Lagos, Ikeja" };
  h.delivery = {
    order: {
      id: "order", title: "Beans", reference: "LL-order", isBuyer: true, status: "AWAITING_PAYMENT",
      totalMinor: "10000", checkoutReady: true, checkoutActive: false, payableMinor: "11000", totalWithDeliveryMinor: "11000",
      suggestedPickup: pickup,
      packageSuggestion: { packageCount: 2, weightKg: 101, length: 50, width: 40, height: 30, handling: "STANDARD", notes: "Keep dry", pickupInstructions: "Call at the farm gate" },
    },
    delivery: {
      status: "PAYMENT_PENDING", selectedQuoteId: "first", shippingMinor: "1000", paidMinor: "0", courier: "First courier",
      pickup, destination, events: [], parcels: [], providerShipmentId: null, bookingStartedAt: null,
      package: { quoteRequestId: "request-one", pickupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
      quotes: ["first", "second"].map((id, index) => ({
        id, courier: `${id} courier`, amountMinor: index ? "1300" : "1000", available: true,
        expiresAt: new Date(Date.now() + 60000).toISOString(), recommended: !index,
      })),
    },
  };
  h.init.mockImplementation(async ({ kind }: any) => {
    const payment = pending("OPEN", h.payment.payableMinor, kind);
    h.payment.items = [payment];
    return payment;
  });
  h.refresh.mockResolvedValue({});
  h.select.mockImplementation(async ({ quoteId }: any) => { selected(quoteId); return { selected: true }; });
  h.quotes.mockImplementation(async (body: any) => {
    unselected();
    h.delivery.delivery.destination = body.destination;
    h.delivery.delivery.package.quoteRequestId = "request-two";
    return { items: h.delivery.delivery.quotes };
  });
  h.collection.mockImplementation(async () => {
    Object.assign(h.delivery.delivery, { status: "PICKUP_PENDING", selectedQuoteId: null, shippingMinor: "0", quotes: [] });
    Object.assign(h.delivery.order, { checkoutReady: true, payableMinor: "10000", totalWithDeliveryMinor: "10000" });
    Object.assign(h.payment, { checkoutReady: true, payableMinor: "10000" });
    return { selected: true };
  });
  h.api.mockImplementation(async (path: string, body: any) => {
    if (path.endsWith("/checkout")) return h.init(body);
    if (path.endsWith("/refresh")) return h.refresh();
    if (path.endsWith("/delivery/select")) return h.select(body);
    if (path.endsWith("/delivery/quotes")) return h.quotes(body);
    if (path.endsWith("/delivery/collection")) return h.collection(body);
    if (path.endsWith("/delivery")) return copy(h.delivery);
    return copy(h.payment);
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("web payment synchronization", () => {
  it("starts one checkout, reloads readiness, and resumes only the saved secure session", async () => {
    await mountPayment();
    await click("Make Payment");
    expect(h.init).toHaveBeenCalledOnce();
    expect(h.init).toHaveBeenCalledWith({ kind: "ORDER" });
    expect(h.open).toHaveBeenCalledWith("https://sandbox-checkout.bachs.io/c/existing");
    expect(button("Make Payment")).toBeNull();
    expect(button("Check Payment")).not.toBeNull();
    await click("Continue payment");
    expect(h.init).toHaveBeenCalledOnce();
    expect(h.open).toHaveBeenCalledTimes(2);
  });
  it("coalesces two initiation clicks before rerender", async () => {
    await mountPayment();
    const pay = button("Make Payment")!;
    await act(async () => { fireEvent.click(pay); fireEvent.click(pay); });
    expect(h.init).toHaveBeenCalledOnce();
  });
  it("keeps a lost checkout response on read-only status checks without a replacement write", async () => {
    h.init.mockImplementation(async () => {
      h.payment.items = [pending("UNKNOWN")];
      throw new Error("Response lost");
    });
    await mountPayment();
    await click("Make Payment");
    expect(button("Make Payment")).toBeNull();
    expect(button("Continue payment")).toBeNull();
    expect(button("Check Payment")).not.toBeNull();
    expect(h.open).not.toHaveBeenCalled();
    await click("Check Payment");
    expect(h.init).toHaveBeenCalledOnce();
  });
  it("never opens a new hosted URL if the follow-up server read is no longer payable", async () => {
    h.init.mockImplementation(async () => {
      const payment = pending();
      Object.assign(h.payment, { items: [payment], checkoutReady: false, payableMinor: null });
      return payment;
    });
    await mountPayment();
    await click("Make Payment");
    expect(h.open).not.toHaveBeenCalled();
    expect(button("Continue payment")).toBeNull();
    expect(button("Check Payment")).not.toBeNull();
  });
  it("expires a quote while mounted without disabling payment-status reconciliation", async () => {
    vi.useFakeTimers();
    h.payment.quoteExpiresAt = new Date(Date.now() + 1000).toISOString();
    h.payment.items = [pending()];
    await mountPayment();
    expect(button("Continue payment")).not.toBeNull();
    await act(async () => { vi.advanceTimersByTime(1001); });
    expect(button("Continue payment")).toBeNull();
    expect(button("Make Payment")).toBeNull();
    expect(button("Check Payment")).not.toBeNull();
  });
  it.each(["mismatched amount", "expired attempt"])("does not resume a checkout with %s", async (reason) => {
    h.payment.items = [pending()];
    if (reason === "mismatched amount") h.payment.payableMinor = "12000";
    else h.payment.items[0].expiresAt = new Date(Date.now() - 1).toISOString();
    await mountPayment();
    expect(button("Continue payment")).toBeNull();
    expect(button("Make Payment")).toBeNull();
    expect(button("Check Payment")).not.toBeNull();
  });
  it("reloads readiness when the selected delivery revision changes", async () => {
    Object.assign(h.payment, { checkoutReady: false, payableMinor: null });
    const view = await mountPayment();
    expect(button("Make Payment")).toBeNull();
    Object.assign(h.payment, { checkoutReady: true, payableMinor: "12000" });
    await act(async () => view.rerender(<CustomerPayment orderId="order" isBuyer onChanged={h.changed} revision="new-quote" />));
    expect(button("Make Payment")).not.toBeNull();
    expect(screen.getByText("Total: ₦120.00")).toBeDefined();
  });
  it("ignores an older read returned after a newer quote revision", async () => {
    let resolveOld!: (value: any) => void;
    h.api.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = await mountPayment();
    Object.assign(h.payment, { checkoutReady: false, payableMinor: null });
    await act(async () => view.rerender(<CustomerPayment orderId="order" isBuyer onChanged={h.changed} revision="new-quote" />));
    await act(async () => resolveOld({ ...h.payment, checkoutReady: true, payableMinor: "11000" }));
    expect(button("Make Payment")).toBeNull();
  });
  it("ignores a stale read failure after a newer foreground read succeeds", async () => {
    await mountPayment();
    let rejectOld!: (error: Error) => void;
    h.api.mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; }));
    await act(async () => { fireEvent(window, new Event("focus")); });
    await act(async () => { fireEvent(window, new Event("focus")); });
    await act(async () => rejectOld(new Error("Old read failed")));
    expect(screen.queryByText("Old read failed")).toBeNull();
    expect(button("Make Payment")).not.toBeNull();
  });
  it("does not open delayed checkout initialization after moving to another order", async () => {
    let resolveCheckout!: (value: any) => void;
    h.init.mockImplementation(() => new Promise((resolve) => { resolveCheckout = resolve; }));
    const view = await mountPayment();
    await click("Make Payment");
    await act(async () => view.rerender(<CustomerPayment orderId="other" isBuyer onChanged={h.changed} revision="new-quote" />));
    await act(async () => resolveCheckout(pending()));
    expect(h.open).not.toHaveBeenCalled();
    expect(h.changed).not.toHaveBeenCalled();
  });
  it("does not let an old failed recovery read clear a newer order's payment state", async () => {
    let rejectRecovery!: (error: Error) => void;
    h.init.mockRejectedValue(new Error("Response lost"));
    const view = await mountPayment();
    const normal = h.api.getMockImplementation()!;
    h.api.mockImplementation((path: string, body: any) => path === "orders/order/payments"
      ? new Promise((_, reject) => { rejectRecovery = reject; }) : normal(path, body));
    await click("Make Payment");
    await act(async () => view.rerender(<CustomerPayment orderId="other" isBuyer onChanged={h.changed} revision="new-quote" />));
    expect(button("Make Payment")).not.toBeNull();
    await act(async () => rejectRecovery(new Error("Old read failed")));
    expect(button("Make Payment")).not.toBeNull();
    expect(h.changed).not.toHaveBeenCalled();
  });
  it("does not open checkout if delivery edits disable payment while initialization is pending", async () => {
    let resolveCheckout!: (value: any) => void;
    h.init.mockImplementation(() => new Promise((resolve) => { resolveCheckout = resolve; }));
    const view = await mountPayment();
    await click("Make Payment");
    await act(async () => view.rerender(<CustomerPayment orderId="order" isBuyer onChanged={h.changed} disabled />));
    h.payment.items = [pending()];
    await act(async () => resolveCheckout(h.payment.items[0]));
    expect(h.open).not.toHaveBeenCalled();
    expect(button("Continue payment")?.disabled).toBe(true);
  });
  it("reconciles on focus and removes payment actions only after server confirmation", async () => {
    h.payment.items = [pending()];
    h.refresh.mockImplementation(async () => Object.assign(h.payment, {
      orderStatus: "FUNDED", heldMinor: "10000", items: [{ ...pending(), status: "SUCCEEDED" }],
    }));
    await mountPayment();
    await act(async () => { fireEvent(window, new Event("focus")); });
    expect(h.refresh).toHaveBeenCalledOnce();
    expect(h.changed).toHaveBeenCalledOnce();
    expect(button("Make Payment")).toBeNull();
    expect(button("Check Payment")).toBeNull();
    expect(screen.getByText("Payment confirmed")).toBeDefined();
  });
  it("requests only the server-calculated delivery difference for a funded order", async () => {
    Object.assign(h.payment, { orderStatus: "FUNDED", heldMinor: "10000", payableMinor: "2000" });
    await act(async () => { render(<CustomerPayment orderId="order" isBuyer topup onChanged={h.changed} />); });
    await click("Pay delivery difference");
    expect(h.init).toHaveBeenCalledWith({ kind: "DELIVERY_TOPUP" });
    expect(h.payment.items[0].amountMinor).toBe("2000");
    expect(button("Make Payment")).toBeNull();
  });
});

describe("web courier selection and delivery requirements", () => {
  it("shows read-only farmer packing and submits only the buyer's destination and pickup date", async () => {
    const view = await mountDelivery();
    for (const [name, value] of [["packageCount", "2"], ["weight", "101"], ["length", "50"], ["width", "40"], ["height", "30"]]) {
      const input = view.container.querySelector(`[name="${name}"]`) as HTMLInputElement;
      expect(input.readOnly).toBe(true);
      expect(input.value).toBe(value);
    }
    expect((view.container.querySelector('[name="pickup.address"]') as HTMLInputElement).readOnly).toBe(true);
    await act(async () => { fireEvent.submit(view.container.querySelector("form")!); });
    expect(h.quotes).toHaveBeenCalledWith(expect.objectContaining({
      pickup: expect.objectContaining({ address: "12 Farm Road, Lagos, Ikeja" }),
      destination: expect.objectContaining({ address: "20 Buyer Street, Lagos, Ikeja" }),
      parcel: { pickupDate: h.delivery.delivery.package.pickupDate },
    }));
  });
  it("requires seller measurements for quotes but keeps produce-only pickup available", async () => {
    unselected();
    h.delivery.order.packageSuggestion = null;
    await mountDelivery();
    expect(button("Get delivery quotes")).toBeNull();
    expect(screen.getByText("PACKING_REQUIRED")).toBeDefined();
    await click("Pickup");
    expect(h.collection).toHaveBeenCalledOnce();
    expect(button("Make Payment")?.disabled).toBe(false);
    await click("Make Payment");
    expect(h.payment.items[0].amountMinor).toBe("10000");
    expect(h.quotes).not.toHaveBeenCalled();
  });
  it("disables expired and unavailable services without selecting either one", async () => {
    unselected();
    h.delivery.delivery.quotes[0].expiresAt = new Date(Date.now() - 1).toISOString();
    h.delivery.delivery.quotes[1].available = false;
    await mountDelivery();
    expect(button("Quote expired")?.disabled).toBe(true);
    expect(button("Not available")?.disabled).toBe(true);
    await click("Quote expired");
    await click("Not available");
    expect(h.select).not.toHaveBeenCalled();
    expect(button("Make Payment")).toBeNull();
  });
  it("blocks selection, displayed totals and payment immediately after delivery address edits", async () => {
    const view = await mountDelivery();
    await act(async () => { fireEvent.change(view.container.querySelector('[name="destination.address"]')!, { target: { value: "Changed buyer address Lagos" } }); });
    expect(button("Choose delivery")?.disabled).toBe(true);
    expect(button("Make Payment")?.disabled).toBe(true);
    expect(screen.getByText("Not quoted")).toBeDefined();
    expect(screen.getByText("Not available")).toBeDefined();
    await click("Make Payment");
    await click("Choose delivery");
    expect(h.init).not.toHaveBeenCalled();
    expect(h.select).not.toHaveBeenCalled();
  });
  it("reloads the selected service and exact total from the server before payment", async () => {
    await mountDelivery();
    await click("Choose delivery");
    expect(h.select).toHaveBeenCalledWith({ quoteId: "second" });
    expect(button("Selected")?.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Total: ₦113.00")).toBeDefined();
    await click("Make Payment");
    expect(h.payment.items[0].amountMinor).toBe("11300");
  });
  it("guards concurrent selection clicks without optimistic local prices", async () => {
    unselected();
    let resolveSelection!: (value: any) => void;
    h.select.mockImplementation(() => new Promise((resolve) => { resolveSelection = resolve; }));
    await mountDelivery();
    const choices = screen.getAllByRole("button", { name: "Choose delivery" });
    await act(async () => { fireEvent.click(choices[0]!); fireEvent.click(choices[1]!); });
    expect(h.select).toHaveBeenCalledOnce();
    await act(async () => resolveSelection({ selected: true, shippingMinor: "1" }));
    expect(button("Selected")).toBeNull();
    expect(button("Make Payment")).toBeNull();
  });
  it("recovers a persisted selection after losing its response", async () => {
    h.select.mockImplementation(async () => { selected(); throw new Error("Response lost"); });
    await mountDelivery();
    await click("Choose delivery");
    expect(button("Selected")?.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Total: ₦113.00")).toBeDefined();
    expect(screen.getByText("Response lost")).toBeDefined();
    expect(h.select).toHaveBeenCalledOnce();
    expect(h.init).not.toHaveBeenCalled();
  });
  it("reloads failed requotes without retaining the previous payable shipping selection", async () => {
    h.quotes.mockImplementation(async () => {
      unselected();
      h.delivery.delivery.quotes.forEach((quote: any) => { quote.available = false; });
      throw new Error("Delivery provider unavailable");
    });
    const view = await mountDelivery();
    await act(async () => { fireEvent.change(view.container.querySelector('[name="destination.address"]')!, { target: { value: "Changed buyer address Lagos" } }); });
    await act(async () => { fireEvent.submit(view.container.querySelector("form")!); });
    expect(button("Make Payment")).toBeNull();
    expect(button("Selected")).toBeNull();
    expect(screen.getByText("Not quoted")).toBeDefined();
    expect(screen.getByText("Delivery provider unavailable")).toBeDefined();
    expect(button("Get delivery quotes")?.disabled).toBe(false);
    expect(screen.queryByText("Delivery review pending")).toBeNull();
  });
  it("updates authoritative packing on refresh without replacing unsaved destination edits", async () => {
    const view = await mountDelivery();
    const address = view.container.querySelector('[name="destination.address"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(address, { target: { value: "Changed buyer address Lagos" } }); });
    h.delivery.order.packageSuggestion.weightKg = 151.5;
    h.delivery.order.packageSuggestion.packageCount = 3;
    await click("Refresh delivery");
    expect((view.container.querySelector('[name="weight"]') as HTMLInputElement).value).toBe("151.5");
    expect((view.container.querySelector('[name="packageCount"]') as HTMLInputElement).value).toBe("3");
    expect((view.container.querySelector('[name="destination.address"]') as HTMLInputElement).value).toBe("Changed buyer address Lagos");
    expect(button("Make Payment")?.disabled).toBe(true);
  });
  it.each(["response", "error"])("ignores an out-of-order delivery %s after a newer reload", async (kind) => {
    await mountDelivery();
    const old = copy(h.delivery);
    let resolveOld!: (value: any) => void, rejectOld!: (error: Error) => void;
    h.api.mockImplementationOnce(() => new Promise((resolve, reject) => { resolveOld = resolve; rejectOld = reject; }));
    await click("Refresh delivery");
    h.delivery.order.title = "New server snapshot";
    await click("Refresh delivery");
    await act(async () => { if (kind === "response") resolveOld(old); else rejectOld(new Error("Old reload failed")); });
    expect(screen.getByRole("heading", { name: "New server snapshot" })).toBeDefined();
    expect(screen.queryByText("Old reload failed")).toBeNull();
  });
  it("does not apply a delayed selection response to a different order's edited form", async () => {
    let resolveSelection!: (value: any) => void;
    h.select.mockImplementation(() => new Promise((resolve) => { resolveSelection = resolve; }));
    const view = await mountDelivery();
    await click("Choose delivery");
    h.delivery.order.title = "Other order";
    await act(async () => view.rerender(<CustomerDelivery id="other" />));
    await act(async () => { fireEvent.change(view.container.querySelector('[name="destination.address"]')!, { target: { value: "Other buyer address Lagos" } }); });
    await act(async () => resolveSelection({ selected: true, message: "Old order saved" }));
    expect(screen.getByRole("heading", { name: "Other order" })).toBeDefined();
    expect(screen.queryByText("Old order saved")).toBeNull();
    expect(button("Make Payment")?.disabled).toBe(true);
    expect(h.api.mock.calls.filter(([path]) => path === "orders/order/delivery")).toHaveLength(1);
  });
  it("locks delivery edits during active checkout while preserving payment-status checks", async () => {
    h.delivery.order.checkoutActive = true;
    h.payment.checkoutActive = true;
    h.payment.items = [pending("UNKNOWN")];
    const view = await mountDelivery();
    expect(view.container.querySelector("form")).toBeNull();
    expect(button("Choose delivery")?.disabled).toBe(true);
    expect(button("Make Payment")).toBeNull();
    expect(button("Check Payment")).not.toBeNull();
  });
});
