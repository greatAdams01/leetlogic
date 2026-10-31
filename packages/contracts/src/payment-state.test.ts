import { describe, expect, it } from "vitest";
import { paymentActions, pendingPaymentStatuses } from "./payment-state.js";
import { isHostedPaymentUrl } from "./payment-urls.js";
const base = { orderStatus: "AWAITING_PAYMENT", heldMinor: "0", releasedMinor: "0", refundedMinor: "0", checkoutReady: true, payableMinor: "100", checkoutActive: false };
const attempt = { id: "one", kind: "ORDER", status: "OPEN", amountMinor: "100", checkoutUrl: "https://sandbox-checkout.bachs.io/c/test" };
describe("payment actions", () => {
  it.each(pendingPaymentStatuses)("never offers a new payment for %s", (status) => {
    expect(paymentActions({ ...base, items: [{ ...attempt, status }] }).canPay).toBe(false);
  });
  it("blocks funded, successful, reviewed and cancelled orders", () => {
    for (const state of [{ heldMinor: "100" }, { financialHold: true }, { orderStatus: "CANCELLED" }, { items: [{ ...attempt, status: "SUCCEEDED" }] }])
      expect(paymentActions({ ...base, ...state }).canPay).toBe(false);
  });
  it("lets a definitely failed attempt retry and resumes only a current open session", () => {
    expect(paymentActions({ ...base, items: [{ ...attempt, status: "FAILED" }] }).canPay).toBe(true);
    expect(paymentActions({ ...base, items: [attempt] }).canResume).toBe(true);
    expect(paymentActions({ ...base, items: [{ ...attempt, expiresAt: "2000-01-01" }] }).canResume).toBe(false);
  });
  it("uses the delivery topup rather than the successful produce payment", () => {
    const state = paymentActions({ ...base, heldMinor: "100", orderStatus: "FUNDED", items: [{ ...attempt, kind: "DELIVERY_TOPUP" }, { ...attempt, id: "produce", status: "SUCCEEDED" }] }, true);
    expect(state.pending?.kind).toBe("DELIVERY_TOPUP");
    expect(state.canPay).toBe(false);
  });
  it("requires explicit server readiness, a positive payable amount and an unexpired quote", () => {
    const withoutReadiness = { orderStatus: base.orderStatus, payableMinor: base.payableMinor };
    expect(paymentActions(withoutReadiness).canPay).toBe(false);
    expect(paymentActions({ ...withoutReadiness, items: [attempt] }).canResume).toBe(false);
    for (const state of [
      { checkoutReady: false }, { payableMinor: null },
      { payableMinor: "0" }, { payableMinor: "-100" }, { payableMinor: "1.5" },
      { quoteExpiresAt: "2000-01-01" }, { quoteExpiresAt: "invalid" },
    ]) {
      expect(paymentActions({ ...base, ...state }).canPay).toBe(false);
      expect(paymentActions({ ...base, ...state, items: [attempt] }).canResume).toBe(false);
    }
    expect(paymentActions(base).canPay).toBe(true);
  });
  it("never resumes an amount that differs from the server total or replaces an active blocked session", () => {
    expect(paymentActions({ ...base, payableMinor: "200", items: [attempt] }).canResume).toBe(false);
    const state = paymentActions({ ...base, checkoutActive: true, items: [{ ...attempt, status: "BLOCKED" }] });
    expect(state.pending?.status).toBe("BLOCKED");
    expect(state.canPay).toBe(false);
    expect(state.canResume).toBe(false);
  });
  it("permits only exact HTTPS sandbox hosts outside live mode", () => {
    expect(isHostedPaymentUrl(attempt.checkoutUrl, "checkout", "sandbox")).toBe(true);
    expect(isHostedPaymentUrl(attempt.checkoutUrl, "checkout", "live")).toBe(false);
    for (const url of ["https://sandbox-checkout.bachs.io.evil.test/c/a", "http://sandbox-checkout.bachs.io/c/a", "https://user@sandbox-checkout.bachs.io/c/a"])
      expect(isHostedPaymentUrl(url, "checkout")).toBe(false);
  });
});
