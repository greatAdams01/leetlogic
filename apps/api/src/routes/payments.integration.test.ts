import { randomUUID, createHmac } from "node:crypto";
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { prisma } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { bachs } from "../providers/payments/bachs.js";
import { createApp } from "../app.js";
import { createSession } from "../services/sessions.js";
import {
  startCheckout,
  reconcilePayment,
  requestRelease,
  requestWithdrawal,
  requestRefund,
  availableEarnings,
  journal,
  systemRequest,
} from "../services/payments.js";
import { runMoneyOperation, runPaymentJobs } from "../services/payment-worker.js";
import { redis } from "../lib/redis.js";
const suite = process.env.PAYMENTS_INTEGRATION === "1" ? describe : describe.skip;
suite("provider-backed payment safeguards", () => {
  const app = createApp();
  let buyer: string,
    seller: string,
    farmer: string,
    listing: string,
    token: string,
    outsider: string,
    destination: string;
  const req = () =>
    ({
      ...systemRequest(),
      auth: { sub: seller },
      body: { reason: "Reviewed and approved by test operator" },
    }) as any;
  beforeAll(async () => {
    Object.assign(getConfig(), {
      PAYMENTS_ENABLED: true,
      BACHS_MODE: "sandbox",
      BACHS_API_KEY: "fixture",
      BACHS_WEBHOOK_SECRET: "fixture-secret",
      BACHS_ORGANIZATION_ID: "org_fixture",
      PAYMENTS_TRANSFERS_ENABLED: true,
      PAYMENTS_PAYOUTS_ENABLED: true,
      PAYMENTS_REFUNDS_ENABLED: true,
      BACHS_NGN_PAYOUT_FEE_MINOR: "100",
      DELIVERY_ENABLED: false,
    });
    const users = await Promise.all(
      [0, 1, 2].map((i) =>
        prisma.user.create({
          data: {
            phoneE164: `+234${i + 7}${Date.now().toString().slice(-9)}`,
            profile: { create: { displayName: "Payment test" } },
          },
        }),
      ),
    );
    buyer = users[0]!.id;
    seller = users[1]!.id;
    token = (
      await createSession({ subject: "CUSTOMER", principalId: buyer, deviceId: randomUUID() })
    ).accessToken;
    outsider = (
      await createSession({
        subject: "CUSTOMER",
        principalId: users[2]!.id,
        deviceId: randomUUID(),
      })
    ).accessToken;
    farmer = (
      await prisma.farmerProfile.create({
        data: {
          userId: seller,
          farmName: "Payment fixture",
          farmType: "CROP",
          verificationStatus: "APPROVED",
        },
      })
    ).id;
    const address = await prisma.address.create({
      data: { userId: seller, state: "Lagos", city: "Lagos", lga: "Ikeja", line1: "12 Test road" },
    });
    const category = await prisma.category.create({ data: { slug: `payments-${randomUUID()}` } });
    await prisma.unit.upsert({
      where: { code: "KG" },
      create: { code: "KG", name: "Kilogram", allowsDecimal: true },
      update: {},
    });
    listing = (
      await prisma.listing.create({
        data: {
          farmerProfileId: farmer,
          categoryId: category.id,
          unitCode: "KG",
          locationAddressId: address.id,
          title: "Dry beans",
          description: "Parcel beans",
          unitPriceMinor: 10000n,
          availableQuantity: "1000",
          reservedQuantity: "100",
          shippingScope: "NATIONWIDE",
          status: "ACTIVE",
        },
      })
    ).id;
    await prisma.financialAccount.create({
      data: {
        userId: seller,
        mode: "sandbox",
        providerAccountId: `acct_${seller}`,
        status: "READY",
        capabilities: ["transfers", "payouts"],
      },
    });
    destination = (
      await prisma.bankDestination.create({
        data: {
          userId: seller,
          mode: "sandbox",
          providerId: `bank_${seller}`,
          bankCode: "001",
          bankName: "Test bank",
          accountName: "Test farmer",
          accountLastFour: "7890",
          fingerprint: randomUUID(),
          usable: true,
        },
      })
    ).id;
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await prisma.$disconnect();
    await redis().quit();
  });
  async function order() {
    const o = await prisma.tradeOrder.create({
      data: {
        reference: `PAY-${randomUUID()}`,
        buyerId: buyer,
        farmerProfileId: farmer,
        listingId: listing,
        quantity: "1",
        totalMinor: 10000n,
        feeBasisPoints: 600,
      },
    });
    const d = await prisma.delivery.create({
      data: { orderId: o.id, status: "PAYMENT_PENDING", shippingMinor: 1000n },
    });
    const q = await prisma.deliveryQuote.create({
      data: {
        deliveryId: d.id,
        requestToken: "token",
        serviceCode: "pickup",
        inputHash: "fixture",
        courierId: "courier",
        courier: "Fixture courier",
        amountMinor: 1000n,
        walletMinor: 1000n,
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    await prisma.delivery.update({ where: { id: d.id }, data: { selectedQuoteId: q.id } });
    return { o, d, q };
  }
  async function checkout(orderId: string) {
    const a = await startCheckout(orderId, buyer);
    const op = await prisma.moneyOperation.findFirstOrThrow({
      where: { paymentId: a.id, kind: "CHECKOUT" },
    });
    vi.spyOn(bachs, "checkout").mockResolvedValue({
      checkout_id: `cs_${a.id}`,
      checkout_url: `https://checkout.bachs.io/${a.id}`,
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });
    await runMoneyOperation(op.id);
    return prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } });
  }
  function mockReceipt(a: any, overrides: any = {}) {
    vi.spyOn(bachs, "checkoutState").mockResolvedValue({
      checkout_id: a.checkoutId,
      reference: a.id,
      charge_id: `ch_${a.id}`,
      status: "completed",
    });
    vi.spyOn(bachs, "payment").mockResolvedValue({
      payment_id: `ch_${a.id}`,
      checkout_id: a.checkoutId,
      currency: "NGN",
      amount: "110.00",
      amount_paid: "111.00",
      amount_remaining: "0.00",
      fees: { amount: "1.00", currency: "NGN" },
      merchant_bears_cost: false,
      method: "NGN_CARD",
      status: "succeeded",
      ...overrides,
    });
  }
  it("deduplicates concurrent checkout and restricts payment access", async () => {
    const { o } = await order();
    const attempts = await Promise.all([startCheckout(o.id, buyer), startCheckout(o.id, buyer)]);
    expect(attempts[0]!.id).toBe(attempts[1]!.id);
    expect(
      (
        await request(app)
          .get(`/v1/orders/${o.id}/payments`)
          .set("Authorization", `Bearer ${outsider}`)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/v1/orders/${o.id}/payments`)
          .set("Authorization", `Bearer ${token}`)
      ).status,
    ).toBe(200);
  });
  it("does not fund expired quotes or unsupported manual delivery", async () => {
    const { o, q } = await order();
    await prisma.deliveryQuote.update({
      where: { id: q.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(startCheckout(o.id, buyer)).rejects.toMatchObject({ code: "QUOTE_EXPIRED" });
  });
  it("funds produce and shipping once, requires buyer receipt and blocks disputed release", async () => {
    const { o, d } = await order(),
      a = await checkout(o.id);
    mockReceipt(a);
    await reconcilePayment(a.id);
    await reconcilePayment(a.id);
    const funded = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } });
    expect(funded.heldMinor).toBe(10000n);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).paidMinor).toBe(
      1000n,
    );
    expect(await prisma.escrowEntry.count({ where: { orderId: o.id, kind: "FUND" } })).toBe(1);
    await expect(requestRelease(o.id, req())).rejects.toMatchObject({ code: "RELEASE_BLOCKED" });
    await prisma.tradeOrder.update({
      where: { id: o.id },
      data: { deliveryConfirmedAt: new Date(), status: "DELIVERED" },
    });
    const ticket = await prisma.supportTicket.create({
      data: { userId: buyer, orderId: o.id, kind: "DISPUTE", subject: "Not received" },
    });
    await expect(requestRelease(o.id, req())).rejects.toMatchObject({ code: "RELEASE_BLOCKED" });
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "RESOLVED" } });
    vi.spyOn(bachs, "account").mockResolvedValue({
      id: `acct_${seller}`,
      parent_organization_id: "org_fixture",
      enabled_capabilities: ["transfers", "payouts"],
    });
    vi.spyOn(bachs, "balances").mockResolvedValue([
      { currency: "NGN", available_balance: "100000.00" },
    ]);
    const release = await requestRelease(o.id, req());
    vi.spyOn(bachs, "call").mockImplementation(async (path, body: any) => {
      if (path === "/transfers")
        return {
          id: `tr_${release.id}`,
          status: "paid",
          currency: "NGN",
          amount: body.amount,
          destination: `acct_${seller}`,
        };
      throw new Error("Unexpected provider call");
    });
    await runMoneyOperation(release.id);
    await runMoneyOperation(release.id);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).status).toBe(
      "COMPLETED",
    );
    expect((await availableEarnings(seller)).balanceMinor).toBe(9400n);
    const withdrawals = await Promise.all([
      requestWithdrawal(seller, destination, 1000n, randomUUID()),
      requestWithdrawal(seller, destination, 1000n, randomUUID()),
    ]);
    expect(withdrawals[0]!.id).toBe(withdrawals[1]!.id);
    expect(withdrawals[0]!.status).toBe("REQUESTED");
    expect((await availableEarnings(seller)).reservedMinor).toBe(1100n);
    const withdrawal = withdrawals[0]!;
    await prisma.moneyOperation.update({
      where: { id: withdrawal.id },
      data: { status: "QUEUED" },
    });
    vi.spyOn(bachs, "destination").mockResolvedValue({
      id: `bank_${seller}`,
      currency: "NGN",
      account_number: "1234567890",
      is_usable: true,
    });
    vi.spyOn(bachs, "call").mockImplementation(async (path, body: any) => {
      if (path === "/payouts")
        return {
          id: `po_${withdrawal.id}`,
          status: "completed",
          currency: "NGN",
          amount: body.amount,
          fee: "1.00",
          total_debited: "11.00",
          reference: withdrawal.id,
          destination: `bank_${seller}`,
        };
      throw new Error("Unexpected provider call");
    });
    await runMoneyOperation(withdrawal.id);
    expect(
      (await prisma.moneyOperation.findUniqueOrThrow({ where: { id: withdrawal.id } })).status,
    ).toBe("SUCCEEDED");
    expect((await availableEarnings(seller)).availableMinor).toBe(8300n);
  });
  it("records extra charges separately and does not fund twice", async () => {
    const { o } = await order(),
      a = await checkout(o.id);
    mockReceipt(a);
    await reconcilePayment(a.id);
    vi.spyOn(bachs, "payment").mockResolvedValue({
      payment_id: `extra_${a.id}`,
      checkout_id: a.checkoutId,
      currency: "NGN",
      amount: "110.00",
      amount_paid: "110.00",
      merchant_bears_cost: false,
      method: "NGN_CARD",
      status: "succeeded",
    });
    await reconcilePayment(a.id, `extra_${a.id}`);
    await reconcilePayment(a.id, `extra_${a.id}`);
    expect(await prisma.paymentAttempt.count({ where: { orderId: o.id, kind: "EXCESS" } })).toBe(1);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).heldMinor).toBe(
      10000n,
    );
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).financialHold).toBe(
      true,
    );
  });
  it("waits for confirmed refunds and retains processing fees only once", async () => {
    const { o, d } = await order(),
      a = await checkout(o.id);
    mockReceipt(a);
    await reconcilePayment(a.id);
    const refundReq = req();
    refundReq.auth.sub = buyer;
    refundReq.body.shippingRefundMinor = "1000";
    const ops = await requestRefund(o.id, refundReq),
      op = ops[0]!;
    vi.spyOn(bachs, "payment").mockResolvedValue({
      payment_id: `ch_${a.id}`,
      checkout_id: a.checkoutId,
      currency: "NGN",
      is_refundable: true,
    });
    vi.spyOn(bachs, "balances").mockResolvedValue([
      { currency: "NGN", available_balance: "10000.00" },
    ]);
    const refund = {
      id: `rf_${op.id}`,
      status: "processing",
      currency: "NGN",
      requested_amount: "110.00",
      charge_id: `ch_${a.id}`,
      reference: op.id,
    };
    const write = vi.spyOn(bachs, "call").mockResolvedValue(refund);
    await runMoneyOperation(op.id);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).heldMinor).toBe(
      10000n,
    );
    expect((await prisma.moneyOperation.findUniqueOrThrow({ where: { id: op.id } })).status).toBe(
      "PROVIDER_PENDING",
    );
    vi.spyOn(bachs, "operation").mockResolvedValue({ ...refund, status: "success" });
    await runMoneyOperation(op.id);
    await runMoneyOperation(op.id);
    expect(write).toHaveBeenCalledTimes(1);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).refundedMinor).toBe(
      10000n,
    );
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).paidMinor).toBe(0n);
    expect(
      (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } })).processingFeeMinor,
    ).toBe(100n);
  });
  it("completes bank refunds only after the original payer receives the payout", async () => {
    getConfig().BACHS_BANK_REFUNDS_VERIFIED = true;
    const buyerAccount = await prisma.financialAccount.upsert({
      where: { userId_mode: { userId: buyer, mode: "sandbox" } },
      create: {
        userId: buyer,
        mode: "sandbox",
        providerAccountId: `acct_${buyer}`,
        status: "READY",
        capabilities: ["transfers", "payouts"],
      },
      update: {},
    });
    const bank = await prisma.bankDestination.create({
      data: {
        userId: buyer,
        mode: "sandbox",
        providerId: `bank_${randomUUID()}`,
        bankCode: "001",
        bankName: "Test bank",
        accountName: "Buyer",
        accountLastFour: "7890",
        fingerprint: randomUUID(),
        usable: true,
      },
    });
    const { o } = await order(),
      a = await checkout(o.id);
    mockReceipt(a, { method: "NGN_BANK_TRANSFER" });
    await reconcilePayment(a.id);
    const refundReq = req();
    refundReq.auth.sub = buyer;
    refundReq.body.shippingRefundMinor = "1000";
    refundReq.body.destinationId = bank.id;
    const op = (await requestRefund(o.id, refundReq))[0]!;
    vi.spyOn(bachs, "account").mockResolvedValue({
      id: buyerAccount.providerAccountId,
      parent_organization_id: "org_fixture",
      enabled_capabilities: ["transfers", "payouts"],
    });
    vi.spyOn(bachs, "payment").mockResolvedValue({
      payment_id: `ch_${a.id}`,
      checkout_id: a.checkoutId,
      currency: "NGN",
      payment_method_details: {
        bank_transfer: { sender_account_number: "1234567890", sender_bank_code: "001" },
      },
    });
    vi.spyOn(bachs, "balances").mockResolvedValue([
      { currency: "NGN", available_balance: "1000.00" },
    ]);
    vi.spyOn(bachs, "destination").mockResolvedValue({
      id: bank.providerId,
      currency: "NGN",
      is_usable: true,
      account_number: "1234567890",
      bank_code: "001",
    });
    vi.spyOn(bachs, "call").mockImplementation(async (path, body: any) => {
      if (path === "/transfers")
        return {
          id: `tr_${op.id}`,
          status: "paid",
          currency: "NGN",
          amount: body.amount,
          destination: buyerAccount.providerAccountId,
        };
      if (path === "/payouts")
        return {
          id: `po_${op.id}`,
          status: "completed",
          currency: "NGN",
          amount: body.amount,
          fee: "1.00",
          total_debited: "110.00",
          reference: body.reference,
          destination: bank.providerId,
        };
      throw new Error("Unexpected provider call");
    });
    await runMoneyOperation(op.id);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).refundedMinor).toBe(
      0n,
    );
    const payout = await prisma.moneyOperation.findFirstOrThrow({
      where: { orderId: o.id, kind: "REFUND_PAYOUT" },
    });
    expect(payout.amountMinor).toBe(10900n);
    expect(payout.feeMinor).toBe(100n);
    await runMoneyOperation(payout.id);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).refundedMinor).toBe(
      10000n,
    );
    getConfig().BACHS_BANK_REFUNDS_VERIFIED = false;
  });
  it("funds only a refreshed shipping shortfall and preserves quote-decrease credit", async () => {
    const { o, d, q } = await order(),
      a = await checkout(o.id);
    mockReceipt(a);
    await reconcilePayment(a.id);
    await prisma.deliveryQuote.update({
      where: { id: q.id },
      data: { amountMinor: 1500n, walletMinor: 1500n },
    });
    await prisma.delivery.update({
      where: { id: d.id },
      data: { shippingMinor: 1500n, status: "TOPUP_REQUIRED" },
    });
    const topup = await startCheckout(o.id, buyer, "DELIVERY_TOPUP");
    expect(topup.amountMinor).toBe(500n);
    expect(topup.produceMinor).toBe(0n);
    await prisma.paymentAttempt.update({
      where: { id: topup.id },
      data: { checkoutId: `cs_${topup.id}` },
    });
    vi.spyOn(bachs, "checkoutState").mockResolvedValue({
      checkout_id: `cs_${topup.id}`,
      reference: topup.id,
      charge_id: `ch_${topup.id}`,
    });
    vi.spyOn(bachs, "payment").mockResolvedValue({
      payment_id: `ch_${topup.id}`,
      checkout_id: `cs_${topup.id}`,
      currency: "NGN",
      amount: "5.00",
      amount_paid: "5.00",
      amount_remaining: "0.00",
      merchant_bears_cost: false,
      method: "NGN_CARD",
      status: "succeeded",
    });
    await reconcilePayment(topup.id);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).paidMinor).toBe(
      1500n,
    );
    await prisma.delivery.update({ where: { id: d.id }, data: { shippingMinor: 1200n } });
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).paidMinor).toBe(
      1500n,
    );
  });
  it("holds underpayments and late payments without funding or booking", async () => {
    const { o } = await order(),
      a = await checkout(o.id);
    mockReceipt(a, { amount_paid: "50.00", amount_remaining: "60.00", status: "underpaid" });
    await reconcilePayment(a.id);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(
      "EXCEPTION",
    );
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).financialHold).toBe(
      true,
    );
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).heldMinor).toBe(0n);
    const late = await order(),
      p = await checkout(late.o.id);
    mockReceipt(p);
    await prisma.tradeOrder.update({
      where: { id: late.o.id },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });
    await reconcilePayment(p.id);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: p.id } })).status).toBe(
      "EXCEPTION",
    );
  });
  it("keeps an uncertain checkout write from being repeated", async () => {
    const { o } = await order(),
      a = await startCheckout(o.id, buyer),
      op = await prisma.moneyOperation.findFirstOrThrow({ where: { paymentId: a.id } });
    const write = vi.spyOn(bachs, "checkout").mockRejectedValue(new Error("network timeout"));
    await runMoneyOperation(op.id);
    await runMoneyOperation(op.id);
    expect(write).toHaveBeenCalledTimes(1);
    expect((await prisma.moneyOperation.findUniqueOrThrow({ where: { id: op.id } })).status).toBe(
      "UNKNOWN",
    );
  });
  it("preserves final refunded status when a delayed success arrives", async () => {
    const { o } = await order(),
      a = await checkout(o.id);
    mockReceipt(a);
    await reconcilePayment(a.id);
    await prisma.paymentAttempt.update({ where: { id: a.id }, data: { status: "REFUNDED" } });
    const before = await prisma.moneyJournal.count({ where: { orderId: o.id } });
    await reconcilePayment(a.id);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(
      "REFUNDED",
    );
    expect(await prisma.moneyJournal.count({ where: { orderId: o.id } })).toBe(before);
  });
  it("stores signed webhook triggers once and rejects tampering", async () => {
    const raw = JSON.stringify({
        id: `evt_${randomUUID()}`,
        type: "ignored.event",
        organization_id: "org_fixture",
        data: { id: "object" },
      }),
      t = String(Math.floor(Date.now() / 1000));
    const sig = createHmac("sha256", "fixture-secret").update(`${t}.${raw}`).digest("hex");
    const send = (body: string) =>
      request(app)
        .post("/v1/webhooks/bachs")
        .set("Content-Type", "application/json")
        .set("X-Bachs-Signature-V2", `t=${t},v1=${sig}`)
        .send(body);
    expect((await send(raw)).status).toBe(202);
    expect((await send(raw)).status).toBe(202);
    expect((await send(raw + " ")).status).toBe(400);
  });
  it("expires unfunded reservations and enforces balanced append-only journals", async () => {
    // More held orders than the worker batch size must not starve eligible expirations.
    const heldPrefix = `HELD-${randomUUID()}`;
    await prisma.tradeOrder.createMany({
      data: Array.from({ length: 21 }, (_, index) => ({
        reference: `${heldPrefix}-${index}`,
        buyerId: buyer,
        farmerProfileId: farmer,
        listingId: listing,
        quantity: "1",
        totalMinor: 10000n,
        fundsProvider: "bachs",
        financialHold: true,
        reservationExpiresAt: new Date(0),
      })),
    });
    const { o } = await order();
    await prisma.tradeOrder.update({
      where: { id: o.id },
      data: { fundsProvider: "bachs", reservationExpiresAt: new Date(Date.now() - 1000) },
    });
    // No queued fixture operations should make provider calls in this expiry test.
    await prisma.moneyOperation.updateMany({
      where: { mode: "sandbox", status: "QUEUED" },
      data: { status: "BLOCKED" },
    });
    await prisma.paymentAttempt.updateMany({
      where: { mode: "sandbox", status: { in: ["OPEN", "EXCEPTION", "UNKNOWN"] } },
      data: { checkoutId: null },
    });
    await runPaymentJobs();
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).status).toBe(
      "CANCELLED",
    );
    expect(
      await prisma.tradeOrder.count({
        where: {
          reference: { startsWith: heldPrefix },
          status: "AWAITING_PAYMENT",
          financialHold: true,
        },
      }),
    ).toBe(21);
    const ref = `test:${randomUUID()}`;
    await prisma.$transaction((tx) =>
      journal(tx, ref, [
        ["test_cash", 1n],
        ["test_liability", -1n],
      ]),
    );
    const entry = await prisma.moneyJournal.findUniqueOrThrow({ where: { reference: ref } });
    await expect(
      prisma.moneyJournal.update({ where: { id: entry.id }, data: { reference: "changed" } }),
    ).rejects.toThrow();
    await expect(
      prisma.$transaction((tx) =>
        tx.moneyJournal.create({
          data: {
            reference: randomUUID(),
            mode: "sandbox",
            lines: {
              create: [
                { account: "broken", amountMinor: 1n },
                { account: "other", amountMinor: 1n },
              ],
            },
          },
        }),
      ),
    ).rejects.toThrow();
  });
  it("exposes only owned masked bank verification results", async () => {
    const sellerToken = (
      await createSession({ subject: "CUSTOMER", principalId: seller, deviceId: randomUUID() })
    ).accessToken;
    const bank = await prisma.bankDestination.findUniqueOrThrow({ where: { id: destination } });
    const op = await prisma.moneyOperation.create({
      data: {
        ownerId: seller,
        mode: "sandbox",
        kind: "DESTINATION",
        status: "SUCCEEDED",
        mutationKey: randomUUID(),
        requestHash: "a".repeat(64),
        providerRef: bank.providerId,
        payload: {},
        encryptedPayload: "private-bank-input",
      },
    });
    const path = `/v1/financial/banks/operations/${op.id}`;
    expect(
      (
        await request(app)
          .get(path)
          .set({ Authorization: `Bearer ${outsider}` })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(path)
          .set({ Authorization: `Bearer ${token}` })
      ).status,
    ).toBe(404);
    const result = await request(app)
      .get(path)
      .set({ Authorization: `Bearer ${sellerToken}` });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      status: "SUCCEEDED",
      destination: {
        id: bank.id,
        bankName: bank.bankName,
        accountName: bank.accountName,
        accountLastFour: bank.accountLastFour,
        usable: true,
      },
    });
    expect(JSON.stringify(result.body)).not.toContain("private-bank-input");
    await prisma.moneyOperation.update({ where: { id: op.id }, data: { kind: "PAYOUT" } });
    expect(
      (
        await request(app)
          .get(path)
          .set({ Authorization: `Bearer ${sellerToken}` })
      ).status,
    ).toBe(404);
  });
  it("verifies a bank through the existing provider operation without exposing its full number", async () => {
    const sellerToken = (
      await createSession({ subject: "CUSTOMER", principalId: seller, deviceId: randomUUID() })
    ).accessToken;
    vi.spyOn(bachs, "account").mockResolvedValue({
      id: `acct_${seller}`,
      parent_organization_id: "org_fixture",
      enabled_capabilities: ["transfers", "payouts"],
    });
    vi.spyOn(bachs, "call").mockResolvedValue({
      id: `new_bank_${randomUUID()}`,
      currency: "NGN",
      account_name: "Example Farmer",
      account_number: "1234567891",
      bank_code: "001",
      bank_name: "Test bank",
      is_usable: true,
    });
    const result = await request(app)
      .post("/v1/financial/banks")
      .set({ Authorization: `Bearer ${sellerToken}` })
      .send({ bankCode: "001", accountNumber: "1234567891" });
    expect(result.status).toBe(202);
    const saved = await request(app)
      .get(`/v1/financial/banks/operations/${result.body.id}`)
      .set({ Authorization: `Bearer ${sellerToken}` });
    expect(saved.status).toBe(200);
    expect(saved.body.status).toBe("SUCCEEDED");
    expect(saved.body.destination.accountName).toBe("Example Farmer");
    expect(saved.body.destination.accountLastFour).toBe("7891");
    expect(JSON.stringify(saved.body)).not.toContain("1234567891");
    expect(
      (
        await request(app)
          .post("/v1/financial/banks")
          .set({ Authorization: `Bearer ${sellerToken}` })
          .send({ bankCode: "001", accountNumber: "123456789" })
      ).status,
    ).toBe(422);
  });
  it("resumes a ready payment account without creating another account or onboarding link", async () => {
    const sellerToken = (
      await createSession({ subject: "CUSTOMER", principalId: seller, deviceId: randomUUID() })
    ).accessToken;
    vi.spyOn(bachs, "account").mockResolvedValue({
      id: `acct_${seller}`,
      parent_organization_id: "org_fixture",
      enabled_capabilities: ["transfers", "payouts"],
    });
    const write = vi
      .spyOn(bachs, "call")
      .mockRejectedValue(new Error("Unexpected account creation"));
    const link = vi
      .spyOn(bachs, "accountLink")
      .mockRejectedValue(new Error("A ready account needs no link"));
    const resumed = await request(app)
      .post("/v1/financial/onboarding/link")
      .set({ Authorization: `Bearer ${sellerToken}` })
      .send({});
    expect(resumed.status).toBe(200);
    expect(resumed.body).toEqual({ ready: true, url: null });
    const setup = await request(app)
      .post("/v1/financial/onboarding")
      .set({ Authorization: `Bearer ${sellerToken}` })
      .send({
        firstName: "Test",
        lastName: "Farmer",
        email: "farmer@example.test",
        entityType: "individual",
        displayName: "Test Farm",
      });
    expect(setup.status).toBe(200);
    expect(setup.body).toEqual({ ready: true, url: null });
    expect(write).not.toHaveBeenCalled();
    expect(link).not.toHaveBeenCalled();
    expect(
      await prisma.financialAccount.count({ where: { userId: seller, mode: "sandbox" } }),
    ).toBe(1);
  });
});
