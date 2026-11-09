// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ params: new URLSearchParams(), request: vi.fn(), record: null as any }));
vi.mock("next/navigation", () => ({ useSearchParams: () => h.params }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));
vi.mock("../components/language-provider", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("../components/admin/finance-ui", async () => ({ ...(await vi.importActual<any>("../components/admin/finance-ui")), financeRequest: h.request }));
import { deliveryVisibility } from "../../../packages/contracts/src/delivery-visibility";
import { OrderReview } from "../components/admin/order-review";
import { orderCommandAvailable } from "../components/admin/use-order-record";
import { adminOrderFixture, orderId, otherOrderId, parcelId, staffPermissions } from "./admin-order-fixtures";

const posts = () => h.request.mock.calls.filter(([, body]) => body !== undefined);
const reads = () => h.request.mock.calls.filter(([, body]) => body === undefined);
const openForm = (label: string) => {
  const summary = screen.getByText(label, { selector: "summary" });
  fireEvent.click(summary);
  return screen.getByRole("form", { name: label });
};
const enter = (form: HTMLElement, name: string, value: string) => fireEvent.change(form.querySelector(`[name="${name}"]`)!, { target: { value } });
const submit = async (form: HTMLElement) => { await act(async () => { fireEvent.submit(form); }); };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };

beforeEach(() => {
  h.params = new URLSearchParams(); h.record = adminOrderFixture(); h.request.mockReset();
  h.request.mockImplementation(async (_path: string, body?: unknown) => body === undefined ? structuredClone(h.record) : {});
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("dedicated order and delivery details", () => {
  it("organizes order, contacts, payments, fulfillment and activity without a modal", async () => {
    h.params = new URLSearchParams({ returnTo: "/admin/orders?search=tomatoes&page=2" });
    const view = render(<OrderReview id={orderId} area="orders" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    for (const heading of ["Order & produce", "Buyer & farmer", "Payment summary", "Fulfillment", "Activity History"])
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    expect(screen.getByRole("link", { name: "← Back to Orders" }).getAttribute("href")).toBe("/admin/orders?search=tomatoes&page=2");
    expect(screen.getAllByText("Bola Buyer").length).toBeGreaterThan(0);
    expect(screen.getByText("Ada’s farm")).toBeTruthy();
    expect(screen.getByRole("link", { name: "+2348011111111" }).getAttribute("href")).toBe("tel:+2348011111111");
    expect(screen.getByText("Produce funds held")).toBeTruthy();
    expect(screen.getByText("Order placed", { selector: "strong" })).toBeTruthy();
    expect(view.container.querySelector("dialog, .customer-panel, .dispatch-review")).toBeNull();
    expect(h.request.mock.calls[0][0]).toBe(`delivery-orders/${orderId}/delivery`);
    const related = new URL(screen.getByRole("link", { name: "View delivery details →" }).getAttribute("href")!, "https://admin.invalid");
    expect(related.pathname).toBe(`/admin/logistics/${orderId}`);
    expect(related.searchParams.get("returnTo")).toContain(`/admin/orders/${orderId}`);
    const payment = new URL(screen.getByRole("link", { name: "Review payments →" }).getAttribute("href")!, "https://admin.invalid");
    expect(payment.pathname).toBe(`/admin/reconciliation/orders/${orderId}`);
    expect(payment.searchParams.get("returnTo")).toContain(`/admin/orders/${orderId}`);
  });
  it("focuses delivery details on route contacts, rider, progress and dispatch actions", async () => {
    render(<OrderReview id={orderId} area="logistics" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    expect(screen.getByRole("heading", { name: "Pickup" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Drop-off" })).toBeTruthy();
    expect(screen.getByText("12 Farm Road, Benue")).toBeTruthy();
    expect(screen.getByText("24 Market Road, Lagos")).toBeTruthy();
    expect(screen.getByText(/Rider Chidi/)).toBeTruthy();
    expect(screen.getByText("Refresh courier tracking", { selector: "summary" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View related order →" }).getAttribute("href")).toContain(`/admin/orders/${orderId}`);
    expect(screen.getByRole("link", { name: "View order payments →" }).getAttribute("href")).toContain("#order-payment");
    expect(screen.queryByRole("heading", { name: "Payment summary" })).toBeNull();
    expect(screen.queryByText("Manage manually recorded funds")).toBeNull();
    expect(screen.getByText("Status updates, not live rider tracking.")).toBeTruthy();
  });
  it("does not mistake a partially delivered split for receipt confirmation", async () => {
    const d = h.record.delivery;
    d.status = "DELIVERED"; d.providerShipmentId = "split:record"; d.package.packageCount = 2;
    d.parcels = [
      { id: parcelId, parcelIndex: 0, quoteId: d.selectedQuoteId, providerShipmentId: "part-1", status: "DELIVERED", trackingUrl: "javascript:alert(1)" },
      { id: "part-2", parcelIndex: 1, quoteId: d.selectedQuoteId, providerShipmentId: "part-2", status: "IN_TRANSIT" },
    ];
    h.record.tracking = deliveryVisibility({ ...d, orderStatus: "FUNDED" });
    render(<OrderReview id={orderId} area="logistics" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    expect(screen.getAllByText("Delivery completion needs review").length).toBeGreaterThan(0);
    expect(screen.getByText("1 of 2 packages delivered")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirm.*receipt|Release.*funds/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open provider tracking" })).toBeNull();
    expect(posts()).toEqual([]);
  });
  it("labels manually recorded funds without implying provider verification", async () => {
    h.record.staffContext.fundsProvider = null; h.record.staffContext.manualFundingRecorded = true;
    h.record.staffContext.manualEscrowKinds = ["REFUND"];
    h.record.staffContext.ledger = [{ id: "manual-fund", kind: "FUND", amountMinor: "100000", feeMinor: "0", externalRef: "EXT-1042", reason: "Verified manual payment", createdAt: h.record.staffContext.createdAt }];
    h.record.staffContext.activity.items.push({ ...h.record.staffContext.activity.items[0], id: "2", entityType: "escrow", kind: "LEDGER", action: "escrow.fund", actorType: "admin", actorName: "Test Operator", reason: "Verified manual payment", after: { externalRef: "EXT-1042", amountMinor: "100000" } });
    render(<OrderReview id={orderId} area="orders" permissions={staffPermissions} />);
    await screen.findByText("Manually recorded payment");
    expect(screen.getByText("Manually recorded funds are not a verified payment-provider transaction.")).toBeTruthy();
    expect(screen.getByText("Reason: Verified manual payment")).toBeTruthy();
    expect(screen.getByText("EXT-1042")).toBeTruthy();
    expect(screen.queryByText("Payment Secured")).toBeNull();
  });
  it("preserves earlier staff receipt semantics and the existing manual update endpoint", async () => {
    h.record.delivery = null;
    h.record.legacyShipment = { id: parcelId, carrier: "Local carrier", trackingRef: "LOCAL-1042", status: "IN_TRANSIT", evidence: "Driver confirmed collection", createdAt: h.record.staffContext.createdAt, updatedAt: h.record.observedAt };
    h.record.tracking = deliveryVisibility({ status: "IN_TRANSIT", courier: "Local carrier", trackingRef: "LOCAL-1042", receiptSource: "legacy-staff" });
    render(<OrderReview id={orderId} area="logistics" permissions={staffPermissions} />);
    await screen.findByText("Earlier manual shipment");
    const form = openForm("Update earlier shipment");
    expect(within(form).getByRole("option", { name: "Delivered" }).getAttribute("value")).toBe("DELIVERED");
    enter(form, "evidence", "Verified arrival with the buyer");
    enter(form, "reason", "Checked the signed manual delivery record");
    await submit(form);
    expect(posts()).toEqual([]); await submit(form);
    expect(h.request).toHaveBeenCalledWith(`logistics/${parcelId}/status`, { status: "DELIVERED", evidence: "Verified arrival with the buyer", reason: "Checked the signed manual delivery record", expectedRevision: "a".repeat(64), mutationKey: expect.any(String) });
    expect(posts().some(([path]) => path.includes("/confirm"))).toBe(false);
  });
  it("shows collection fulfillment in Orders without sending staff to courier tracking", async () => {
    h.record.progress.method = "Pickup"; h.record.tracking = null; h.record.delivery.status = "PICKUP_READY";
    render(<OrderReview id={orderId} area="orders" permissions={staffPermissions} />);
    await screen.findByLabelText("Collection location");
    await screen.findByText("LL-1042");
    expect(screen.getByText("12 Farm Road, Benue")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "View delivery details →" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open dispatch & tracking →" })).toBeNull();
    expect(posts()).toEqual([]);
  });
});

describe("authorized record actions", () => {
  it("cancels an unpaid order with a reason and reloads its details", async () => {
    h.record.order.status = "AWAITING_PAYMENT"; h.record.order.checkoutActive = false;
    h.request.mockImplementation(async (path: string, body?: unknown) => {
      if (path === `orders/${orderId}/cancel` && body) h.record.order.status = "CANCELLED";
      return body === undefined ? structuredClone(h.record) : {};
    });
    render(<OrderReview id={orderId} area="orders" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    const form = openForm("Cancel unpaid order");
    enter(form, "reason", "Buyer requested cancellation");
    await submit(form);
    expect(posts()).toEqual([]); await submit(form);
    expect(h.request).toHaveBeenCalledWith(`orders/${orderId}/cancel`, { reason: "Buyer requested cancellation", expectedRevision: "a".repeat(64), mutationKey: expect.any(String) });
    await screen.findByText("Cancelled");
    expect(screen.queryByText("Cancel unpaid order", { selector: "summary" })).toBeNull();
    expect(reads()).toHaveLength(2);
  });
  it("keeps the same escrow request identifier when retrying a failed response", async () => {
    h.record.order.status = "AWAITING_PAYMENT"; h.record.staffContext.fundsProvider = null;
    h.record.delivery = null; h.record.tracking = null; h.record.money.heldMinor = "0";
    h.record.staffContext.manualEscrowKinds = ["FUND"];
    let fail = true;
    h.request.mockImplementation(async (path: string, body?: unknown) => {
      if (path.endsWith("/escrow") && fail) { fail = false; throw new Error("Connection failed. Please retry."); }
      return body === undefined ? structuredClone(h.record) : {};
    });
    render(<OrderReview id={orderId} area="orders" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    const form = openForm("Manage manually recorded funds");
    enter(form, "reason", "Verified payment received externally"); enter(form, "externalRef", "EXT-1042");
    await submit(form); expect(posts()).toEqual([]); enter(form, "code", "123456");
    await submit(form);
    const first = h.request.mock.calls.find(([path]) => path.endsWith("/escrow"))![1];
    expect(first).toMatchObject({ kind: "FUND", amountMinor: "100000", externalRef: "EXT-1042", mutationKey: expect.any(String) });
    expect((await screen.findByRole("alert")).textContent).toContain("Connection failed");
    enter(form, "code", "654321"); await submit(form);
    const attempts = h.request.mock.calls.filter(([path]) => path.endsWith("/escrow"));
    expect(attempts).toHaveLength(2);
    expect(attempts[1]![1].mutationKey).toBe(first.mutationKey);
    expect(posts()[0]).toEqual(["auth/totp/step-up", { code: "123456" }]);
  });
  it("never exposes manual financial controls for provider-funded orders", async () => {
    h.record.staffContext.manualEscrowKinds = ["FUND", "RELEASE", "REFUND"];
    h.record.delivery.status = "PAYMENT_PENDING"; h.record.delivery.paidMinor = "0";
    render(<OrderReview id={orderId} area="orders" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    expect(screen.queryByText("Manage manually recorded funds", { selector: "summary" })).toBeNull();
    expect(screen.queryByText("Record delivery payment", { selector: "summary" })).toBeNull();
    expect(screen.getByRole("link", { name: "Review payments →" })).toBeTruthy();
  });
  it("keeps read-only staff out of mutation controls and payment workspaces", async () => {
    render(<OrderReview id={orderId} area="logistics" permissions={["orders.read"]} />);
    await screen.findByText("LL-1042");
    expect(screen.queryByRole("heading", { name: "Dispatch actions" })).toBeNull();
    expect(screen.queryByText("Refresh courier tracking", { selector: "summary" })).toBeNull();
    expect(posts()).toEqual([]);
    cleanup();
    render(<OrderReview id={orderId} area="orders" permissions={["orders.read"]} />);
    await screen.findByText("LL-1042");
    expect(screen.queryByRole("link", { name: "Review payments →" })).toBeNull();
  });
  it("links only an unresolved split package after authenticator verification, without rebooking", async () => {
    h.record.delivery.status = "BOOKING_UNCERTAIN"; h.record.delivery.providerShipmentId = null;
    h.record.delivery.parcels = [{ id: parcelId, parcelIndex: 0, status: "BOOKING_UNCERTAIN", providerShipmentId: null }, { id: "already-linked", parcelIndex: 1, status: "BOOKED", providerShipmentId: "SB-existing" }];
    h.record.tracking = deliveryVisibility(h.record.delivery);
    render(<OrderReview id={orderId} area="logistics" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    expect(screen.queryByText("Link package 2 booking", { selector: "summary" })).toBeNull();
    expect(screen.queryByText("Arrange courier pickup", { selector: "summary" })).toBeNull();
    const form = openForm("Link package 1 booking");
    enter(form, "providerShipmentId", "SB-found"); enter(form, "reason", "Matched the courier route and price");
    await submit(form); expect(posts()).toEqual([]); enter(form, "code", "123456");
    await submit(form);
    expect(posts()).toEqual([["auth/totp/step-up", { code: "123456" }], [`delivery-orders/${orderId}/delivery/parcels/${parcelId}/link`, { providerShipmentId: "SB-found", reason: "Matched the courier route and price", expectedRevision: "a".repeat(64), mutationKey: expect.any(String) }]]);
  });
  it("shows only server-projected valid manual status changes", async () => {
    h.record.delivery.providerShipmentId = null; h.record.delivery.status = "MANUAL_ASSIGNED";
    h.record.staffContext.manualDeliveryStatuses = ["PICKED_UP", "IN_TRANSIT"];
    render(<OrderReview id={orderId} area="logistics" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    const form = openForm("Update manual delivery");
    expect(within(form).queryByRole("option", { name: "Delivered" })).toBeNull();
    enter(form, "status", "IN_TRANSIT"); enter(form, "evidence", "Courier confirmed the goods are in transit"); enter(form, "reason", "Verified courier update by telephone"); await submit(form); await submit(form);
    expect(h.request).toHaveBeenCalledWith(`delivery-orders/${orderId}/delivery/manual-status`, { status: "IN_TRANSIT", evidence: "Courier confirmed the goods are in transit", reason: "Verified courier update by telephone", expectedRevision: "a".repeat(64), mutationKey: expect.any(String) });
  });
  it("blocks repeat cancellation while the courier request is pending", async () => {
    h.record.delivery.cancelRequestedAt = h.record.observedAt;
    render(<OrderReview id={orderId} area="logistics" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    expect(screen.getByText(/Wait for courier confirmation; no refund is implied/)).toBeTruthy();
    expect(screen.queryByText("Request delivery cancellation", { selector: "summary" })).toBeNull();
  });
  it("does not request details without order-read permission", async () => {
    render(<OrderReview id={orderId} area="orders" permissions={["payments.manage"]} />);
    expect(screen.getByRole("alert").textContent).toContain("permission");
    await act(async () => {});
    expect(h.request).not.toHaveBeenCalled();
  });
});

describe("freshness and action safety", () => {
  it("reviews order corrections and retains the draft for comparison after a concurrent edit", async () => {
    h.record.staffContext.fulfillmentNotes = "Original instructions";
    render(<OrderReview id={orderId} area="orders" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    const form = openForm("Edit order information");
    enter(form, "fulfillmentNotes", "Keep produce shaded");
    enter(form, "reason", "Buyer confirmed the handling instructions");
    await submit(form);
    expect(posts()).toEqual([]);
    expect(within(form).getByRole("table", { name: "Proposed changes" }).textContent).toContain("Original instructions");
    expect(within(form).getByRole("table", { name: "Proposed changes" }).textContent).toContain("Keep produce shaded");
    h.record.staffContext.revision = "b".repeat(64);
    h.record.staffContext.fulfillmentNotes = "Another administrator’s correction";
    fireEvent.click(screen.getByRole("button", { name: "Refresh details" }));
    const rereview = await within(form).findByRole("button", { name: "Re-review latest record" });
    await submit(form);
    expect(posts()).toEqual([]);
    fireEvent.click(rereview);
    expect(within(form).getByRole("table", { name: "Proposed changes" }).textContent).toContain("Another administrator’s correction");
    expect(within(form).getByRole("table", { name: "Proposed changes" }).textContent).toContain("Keep produce shaded");
    await submit(form);
    expect(posts()).toHaveLength(1);
    expect(posts()[0]).toEqual([`orders/${orderId}/corrections`, {
      changes: { fulfillmentNotes: "Keep produce shaded" }, reason: "Buyer confirmed the handling instructions",
      expectedRevision: "b".repeat(64), mutationKey: expect.any(String),
    }]);
  });

  it("preserves a clearly marked record after a failed refresh and disables writes until retry succeeds", async () => {
    render(<OrderReview id={orderId} area="logistics" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    const form = openForm("Refresh courier tracking"); enter(form, "reason", "Courier requested a current tracking check");
    h.request.mockRejectedValue(new Error("Connection failed. Please retry."));
    fireEvent.click(screen.getByRole("button", { name: "Refresh details" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Actions are paused");
    const tracking = within(form).getByRole("button", { name: "Review changes" }) as HTMLButtonElement;
    expect(tracking.disabled).toBe(true); fireEvent.click(tracking); expect(posts()).toEqual([]);
    h.request.mockImplementation(async (_path: string, body?: unknown) => body === undefined ? structuredClone(h.record) : { message: "Tracking refresh queued." });
    fireEvent.click(screen.getByRole("button", { name: "Refresh details" }));
    await waitFor(() => expect(tracking.disabled).toBe(false));
    fireEvent.click(tracking);
    await submit(form);
    await screen.findByText("Tracking refresh queued.");
    expect(h.request).toHaveBeenCalledWith(`delivery-orders/${orderId}/delivery/reconcile`, { reason: "Courier requested a current tracking check", expectedRevision: "a".repeat(64), mutationKey: expect.any(String) });
  });
  it("ignores an older detail response after navigating to another order", async () => {
    const first = deferred<any>(); const old = structuredClone(h.record);
    h.request.mockImplementation(async (path: string) => path.includes(orderId) ? first.promise : { ...h.record, order: { ...h.record.order, id: otherOrderId, reference: "LL-OTHER" } });
    const view = render(<OrderReview id={orderId} area="orders" permissions={staffPermissions} />);
    view.rerender(<OrderReview id={otherOrderId} area="orders" permissions={staffPermissions} />);
    await screen.findByText("LL-OTHER");
    await act(async () => first.resolve(old));
    expect(screen.queryByText("LL-1042")).toBeNull();
  });
  it("stops a sensitive action if the record changes during authenticator verification", async () => {
    h.record.delivery.status = "BOOKING_UNCERTAIN"; h.record.delivery.providerShipmentId = null; h.record.tracking = deliveryVisibility(h.record.delivery);
    const authorization = deferred<any>();
    h.request.mockImplementation(async (path: string, body?: unknown) => path === "auth/totp/step-up" ? authorization.promise : body === undefined ? structuredClone(h.record) : {});
    const view = render(<OrderReview id={orderId} area="logistics" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    const form = openForm("Link existing courier booking"); enter(form, "providerShipmentId", "SB-found"); enter(form, "reason", "Matched the existing booking details"); await submit(form); enter(form, "code", "123456");
    fireEvent.submit(form);
    await waitFor(() => expect(h.request).toHaveBeenCalledWith("auth/totp/step-up", { code: "123456" }));
    h.record.order.id = otherOrderId; h.record.order.reference = "LL-OTHER";
    view.rerender(<OrderReview id={otherOrderId} area="logistics" permissions={staffPermissions} />);
    await screen.findByText("LL-OTHER"); await act(async () => authorization.resolve({}));
    expect(posts().filter(([path]) => path.endsWith("/link"))).toEqual([]);
  });
  it("prevents duplicate submissions while a request is in flight", async () => {
    const mutation = deferred<any>();
    h.request.mockImplementation(async (_path: string, body?: unknown) => body === undefined ? structuredClone(h.record) : mutation.promise);
    render(<OrderReview id={orderId} area="logistics" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    const form = openForm("Refresh courier tracking"); enter(form, "reason", "Courier requested a current tracking check"); await submit(form);
    const button = within(form).getByRole("button", { name: "Confirm and save" });
    fireEvent.click(button); fireEvent.click(button);
    expect(posts()).toHaveLength(1);
    await act(async () => mutation.resolve({}));
  });
  it("keeps an edited destination across background refreshes and requires fresh quotes", async () => {
    h.record.order.status = "AWAITING_PAYMENT"; h.record.delivery.status = "PAYMENT_PENDING"; h.record.delivery.providerShipmentId = null;
    h.record.delivery.bookingStartedAt = null; h.record.delivery.paidMinor = "0"; h.record.delivery.selectedQuoteId = null;
    render(<OrderReview id={orderId} area="logistics" permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    const form = screen.getByRole("form", { name: "Get delivery quotes" });
    enter(form, "destination.address", "Updated buyer address");
    await screen.findByText(/You have unsaved delivery details/);
    const selection = openForm("Select Test Courier");
    expect((within(selection).getByRole("button", { name: "Review changes" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Refresh details" }));
    await waitFor(() => expect(reads()).toHaveLength(2));
    expect((form.querySelector('[name="destination.address"]') as HTMLInputElement).value).toBe("Updated buyer address");
    enter(form, "reason", "Buyer verified a corrected delivery address"); await submit(form); expect(posts()).toEqual([]); await submit(form);
    const call = posts().find(([path]) => path.endsWith("/quotes"));
    expect(call![1].destination.address).toBe("Updated buyer address");
    expect(call![1].parcel).toEqual({ pickupDate: expect.any(String) });
    expect(call![1].parcel.weightKg).toBeUndefined();
  });
  it("exposes safe state-appropriate controls, including farmer preparation checks", () => {
    const data = adminOrderFixture();
    data.delivery!.status = "PAID"; data.delivery!.providerShipmentId = null; data.delivery!.bookingStartedAt = null;
    expect(orderCommandAvailable("book", data, staffPermissions)).toBe(true);
    data.delivery!.events = [];
    expect(orderCommandAvailable("book", data, staffPermissions)).toBe(false);
    data.order.status = "AWAITING_PAYMENT"; data.staffContext.financialHold = true;
    expect(orderCommandAvailable("cancel-order", data, staffPermissions)).toBe(false);
    expect(orderCommandAvailable("quotes", data, staffPermissions)).toBe(false);
  });
});
