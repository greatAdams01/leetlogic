import { prisma, type MoneyOperation } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { bachs, minor, decimal, paymentReady } from "../providers/payments/bachs.js";
import { AppError } from "../lib/errors.js";
import { decryptSecret } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";
import {
  journal,
  mode,
  accountLock,
  paymentAccount,
  refreshAccount,
  assertRelease,
  reconcilePayment,
  systemRequest,
  createOperation,
} from "./payments.js";
import { audit } from "./audit.js";
import { shippingProvider } from "./delivery.js";
function providerId(value: any) {
  const id = value.id || value.transfer_id || value.payout_id || value.refund_id;
  if (typeof id !== "string" || !id) throw new Error("MISSING_PROVIDER_ID");
  return id;
}
export function balanceOf(data: any): bigint {
  const rows = Array.isArray(data) ? data : data.balances || data.data || [];
  const balance = Array.isArray(rows) ? rows.find((row: any) => row.currency === "NGN") : undefined;
  if (!balance || typeof balance.available_balance !== "string")
    throw new AppError(
      503,
      "PAYMENT_BALANCE_UNAVAILABLE",
      "We couldn’t confirm available funds. Please try again.",
    );
  return minor(balance.available_balance);
}
async function checkFunds(amount: bigint, account?: string) {
  if (balanceOf(await bachs.balances(account)) < amount)
    throw new AppError(
      409,
      "PROVIDER_BALANCE_LOW",
      "Available payment funds are not ready yet. Please try again later.",
    );
}
async function complete(op: MoneyOperation, result: any) {
  const payload = op.payload as any;
  const status = String(result.status || "").toLowerCase();
  const failed = status === "failed";
  const success =
    op.kind === "RELEASE" || op.kind === "REFUND_TRANSFER"
      ? status === "paid"
      : ["completed", "success", "paid"].includes(status);
  if (!success && !failed) {
    await prisma.moneyOperation.update({
      where: { id: op.id },
      data: {
        status: "PROVIDER_PENDING",
        providerRef: providerId(result),
        nextRunAt: new Date(Date.now() + 60000),
        leaseUntil: null,
      },
    });
    return;
  }
  if (result.currency && result.currency !== "NGN") throw new Error("OPERATION_CURRENCY_MISMATCH");
  const amount = op.kind === "REFUND" ? result.requested_amount : result.amount;
  if (typeof amount !== "string" || minor(amount) !== op.amountMinor)
    throw new Error("OPERATION_AMOUNT_MISMATCH");
  if (["PAYOUT", "REFUND_PAYOUT"].includes(op.kind) && result.reference !== op.id)
    throw new Error("PAYOUT_REFERENCE_MISMATCH");
  if (op.kind === "REFUND") {
    const payment = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: op.paymentId! } });
    if (result.charge_id !== payment.chargeId || result.reference !== op.id)
      throw new Error("REFUND_REFERENCE_MISMATCH");
  }
  if (["RELEASE", "REFUND_TRANSFER"].includes(op.kind)) {
    const account = await paymentAccount(op.ownerId);
    const destination =
      typeof result.destination === "object" ? result.destination?.id : result.destination;
    if (destination !== account.providerAccountId) throw new Error("TRANSFER_DESTINATION_MISMATCH");
  }
  if (op.kind === "PAYOUT" || op.kind === "REFUND_PAYOUT") {
    const destination = await prisma.bankDestination.findUniqueOrThrow({
      where: { id: payload.destinationId },
    });
    const returned =
      typeof result.destination === "object" ? result.destination.id : result.destination;
    if (returned !== destination.providerId) throw new Error("PAYOUT_DESTINATION_MISMATCH");
    if (
      typeof result.fee !== "string" ||
      minor(result.fee) !== op.feeMinor ||
      (result.total_debited && minor(result.total_debited) !== op.amountMinor + op.feeMinor)
    )
      throw new Error("PAYOUT_FEE_MISMATCH");
  }
  await prisma.$transaction(async (tx) => {
    if (op.orderId)
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${op.orderId}::uuid FOR UPDATE`;
    await accountLock(tx, op.ownerId);
    const current = await tx.moneyOperation.findUniqueOrThrow({ where: { id: op.id } });
    if (["SUCCEEDED", "FAILED"].includes(current.status)) return;
    await tx.moneyOperation.update({
      where: { id: op.id },
      data: {
        status: failed ? "FAILED" : "SUCCEEDED",
        providerRef: providerId(result),
        leaseUntil: null,
        failureCode: failed ? "PROVIDER_OPERATION_FAILED" : null,
        encryptedPayload: null,
      },
    });
    if (failed) return;
    if (op.kind === "RELEASE") {
      const order = await tx.tradeOrder.findUniqueOrThrow({ where: { id: op.orderId! } });
      if (order.heldMinor !== op.amountMinor + op.feeMinor) throw new Error("HELD_FUNDS_CHANGED");
      await journal(
        tx,
        `release:${op.id}`,
        [
          [`held_produce:${order.id}`, order.heldMinor],
          ["commission_income", -op.feeMinor],
          ["platform_cash", -op.amountMinor],
          [`seller_cash:${op.ownerId}`, op.amountMinor],
          [`seller_available:${op.ownerId}`, -op.amountMinor],
        ],
        order.id,
        op.id,
      );
      await tx.tradeOrder.update({
        where: { id: order.id },
        data: { heldMinor: 0n, releasedMinor: { increment: order.heldMinor }, status: "COMPLETED" },
      });
      await tx.escrowEntry.create({
        data: {
          orderId: order.id,
          kind: "RELEASE",
          amountMinor: order.heldMinor,
          feeMinor: op.feeMinor,
          externalRef: providerId(result),
          mutationKey: `bachs:${op.id}`,
          actorId: op.actorId!,
          reason: "Provider-confirmed seller transfer",
        },
      });
      await tx.farmerWallet.upsert({
        where: { farmerProfileId: order.farmerProfileId },
        create: { farmerProfileId: order.farmerProfileId, balanceMinor: op.amountMinor },
        update: { balanceMinor: { increment: op.amountMinor } },
      });
      await tx.inventoryMovement.create({
        data: {
          listingId: order.listingId,
          type: "SALE",
          quantity: order.quantity,
          referenceType: "order",
          referenceId: order.id,
        },
      });
      await tx.listing.update({
        where: { id: order.listingId },
        data: {
          availableQuantity: { decrement: order.quantity },
          reservedQuantity: { decrement: order.quantity },
        },
      });
    } else if (op.kind === "PAYOUT") {
      const total = op.amountMinor + op.feeMinor;
      await journal(
        tx,
        `payout:${op.id}`,
        [
          [`seller_available:${op.ownerId}`, total],
          [`seller_cash:${op.ownerId}`, -total],
        ],
        undefined,
        op.id,
      );
      const farmer = await tx.farmerProfile.findUnique({ where: { userId: op.ownerId } });
      if (farmer)
        await tx.farmerWallet.updateMany({
          where: { farmerProfileId: farmer.id },
          data: { balanceMinor: { decrement: total } },
        });
    } else if (op.kind === "REFUND_TRANSFER") {
      await journal(
        tx,
        `refund-transfer:${op.id}`,
        [
          [`buyer_refund_cash:${op.ownerId}`, op.amountMinor],
          ["platform_cash", -op.amountMinor],
        ],
        op.orderId!,
        op.id,
      );
      // The transfer moves money between Bachs balances, not to the buyer's bank.
      // Keep the original refund pending until the second operation completes.
      await createOperation(tx, {
        ownerId: op.ownerId,
        actorId: op.actorId || undefined,
        orderId: op.orderId!,
        paymentId: op.paymentId!,
        kind: "REFUND_PAYOUT",
        key: op.id,
        amountMinor: op.amountMinor - op.feeMinor,
        feeMinor: op.feeMinor,
        payload: { ...payload, parentId: op.id },
      });
    } else if (op.kind === "REFUND" || op.kind === "REFUND_PAYOUT") {
      const fullAmount = op.amountMinor + (op.kind === "REFUND_PAYOUT" ? op.feeMinor : 0n);
      const source = payload.exception
        ? `unallocated:${op.paymentId}`
        : `held_produce:${op.orderId}`;
      const produce = BigInt(payload.produceMinor || "0"),
        shipping = BigInt(payload.shippingMinor || "0");
      const lines: Array<[string, bigint]> = payload.exception
        ? [[source, fullAmount]]
        : [
            [source, produce],
            [`held_shipping:${op.orderId}`, shipping],
          ];
      lines.push([
        op.kind === "REFUND_PAYOUT" ? `buyer_refund_cash:${op.ownerId}` : "platform_cash",
        -fullAmount,
      ]);
      await journal(tx, `refund:${op.id}`, lines, op.orderId!, op.id);
      const payment = await tx.paymentAttempt.update({
        where: { id: op.paymentId! },
        data: { status: "REFUNDED" },
      });
      if (!payload.exception) {
        const order = await tx.tradeOrder.findUniqueOrThrow({ where: { id: op.orderId! } });
        if (produce > 0n) {
          await tx.tradeOrder.update({
            where: { id: order.id },
            data: {
              heldMinor: { decrement: produce },
              refundedMinor: { increment: produce },
              status: "REFUNDED",
            },
          });
          await tx.escrowEntry.create({
            data: {
              orderId: order.id,
              kind: "REFUND",
              amountMinor: produce,
              externalRef: providerId(result),
              mutationKey: `bachs:${op.id}`,
              actorId: op.actorId!,
              reason: "Provider-confirmed customer refund",
            },
          });
          await tx.listing.update({
            where: { id: order.listingId },
            data: { reservedQuantity: { decrement: order.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              listingId: order.listingId,
              type: "RELEASE",
              quantity: order.quantity,
              referenceType: "order",
              referenceId: order.id,
            },
          });
        }
        // Shipping refunds remain separate from produce; no automatic carrier refund claim.
        if (shipping > 0n)
          await tx.delivery.updateMany({
            where: { orderId: order.id },
            data: { paidMinor: { decrement: shipping } },
          });
      }
      void payment;
    }
    await audit(
      systemRequest(),
      {
        action: `money.${op.kind.toLowerCase()}.confirmed`,
        entityType: "money_operation",
        entityId: op.id,
        after: { amountMinor: op.amountMinor.toString(), status: "SUCCEEDED" },
      },
      tx,
    );
  });
}
export async function runMoneyOperation(id: string) {
  const c = getConfig();
  const claimed = await prisma.moneyOperation.updateMany({
    where: {
      id,
      mode: mode(),
      AND: [
        {
          OR: [
            { status: { in: ["QUEUED", "PROVIDER_PENDING"] } },
            { status: "UNKNOWN", providerRef: { not: null } },
          ],
        },
        { OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
      ],
    },
    data: {
      status: "PROCESSING",
      leaseUntil: new Date(Date.now() + 90000),
      attempts: { increment: 1 },
    },
  });
  if (!claimed.count) return;
  const op = await prisma.moneyOperation.findUniqueOrThrow({ where: { id } });
  const payload = op.payload as any;
  try {
    paymentReady(op.kind);
    if (op.kind === "CHECKOUT") {
      const payment = await prisma.paymentAttempt.findUniqueOrThrow({
        where: { id: op.paymentId! },
      });
      const order = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: payment.orderId } });
      if (
        !op.providerRef &&
        (order.financialHold ||
          (payment.kind === "ORDER" && order.status !== "AWAITING_PAYMENT") ||
          payment.expiresAt <= new Date())
      )
        throw new AppError(409, "QUOTE_EXPIRED", "Refresh your delivery quote before paying.");
      const checkout = op.providerRef
        ? await bachs.checkoutState(op.providerRef)
        : await bachs.checkout({
            id: payment.id,
            orderId: payment.orderId,
            amountMinor: payment.amountMinor,
          });
      if (checkout.reference && checkout.reference !== payment.id)
        throw new Error("CHECKOUT_REFERENCE_MISMATCH");
      await prisma.$transaction(async (tx) => {
        await tx.paymentAttempt.update({
          where: { id: payment.id },
          data: {
            checkoutId: checkout.checkout_id,
            checkoutUrl: checkout.checkout_url,
            status: "OPEN",
          },
        });
        await tx.moneyOperation.update({
          where: { id },
          data: { status: "SUCCEEDED", providerRef: checkout.checkout_id, leaseUntil: null },
        });
      });
      return;
    }
    if (op.kind === "ACCOUNT") {
      const account = await prisma.financialAccount.findUniqueOrThrow({
        where: { userId_mode: { userId: op.ownerId, mode: mode() } },
      });
      const input = op.encryptedPayload ? JSON.parse(decryptSecret(op.encryptedPayload)) : null;
      const knownAccount = account.providerAccountId || op.providerRef;
      const data = knownAccount
        ? await bachs.account(knownAccount)
        : await bachs.call(
            "/accounts",
            {
              contact_email: input.email,
              display_name: input.displayName,
              first_name: input.firstName,
              last_name: input.lastName,
              country: "NG",
              entity_type: input.entityType,
              configuration: {
                recipient: {
                  capabilities: { transfers: { requested: true }, payouts: { requested: true } },
                },
              },
              responsibilities: { fees: { collector: "bachs" } },
            },
            op.id,
          );
      if (data.parent_organization_id !== c.BACHS_ORGANIZATION_ID)
        throw new Error("ACCOUNT_PARENT_MISMATCH");
      await prisma.financialAccount.update({
        where: { id: account.id },
        data: { providerAccountId: data.id },
      });
      await refreshAccount(op.ownerId);
      await prisma.moneyOperation.update({
        where: { id },
        data: {
          status: "SUCCEEDED",
          providerRef: data.id,
          leaseUntil: null,
          encryptedPayload: null,
        },
      });
      return;
    }
    const account =
      op.kind === "REFUND"
        ? { status: "READY", providerAccountId: null }
        : await refreshAccount(op.ownerId);
    if (op.kind === "DESTINATION") {
      const bank = op.encryptedPayload ? JSON.parse(decryptSecret(op.encryptedPayload)) : null;
      const result = op.providerRef
        ? await bachs.destination(op.providerRef, account.providerAccountId!)
        : await bachs.call(
            "/payouts/destinations",
            {
              type: "bank_account",
              currency: "NGN",
              bank_code: bank.bankCode,
              account_number: bank.accountNumber,
              name: "LeetLogic bank account",
            },
            op.id,
            account.providerAccountId!,
          );
      if (
        typeof result.id !== "string" ||
        result.currency !== "NGN" ||
        typeof result.account_name !== "string" ||
        !/^\d{10}$/.test(result.account_number || "")
      )
        throw new Error("BANK_RESULT_INVALID");
      await prisma.bankDestination.upsert({
        where: {
          userId_mode_fingerprint: {
            userId: op.ownerId,
            mode: mode(),
            fingerprint: payload.fingerprint,
          },
        },
        create: {
          userId: op.ownerId,
          mode: mode(),
          providerId: result.id,
          bankCode: result.bank_code,
          bankName: result.bank_name || "Bank",
          accountName: result.account_name,
          accountLastFour: result.account_number.slice(-4),
          fingerprint: payload.fingerprint,
          usable: result.is_usable === true,
        },
        update: { usable: result.is_usable === true },
      });
      await prisma.moneyOperation.update({
        where: { id },
        data: {
          status: result.is_usable ? "SUCCEEDED" : "PROVIDER_PENDING",
          providerRef: result.id,
          leaseUntil: null,
          nextRunAt: new Date(Date.now() + 60000),
          encryptedPayload: null,
        },
      });
      return;
    }
    if (account.status !== "READY")
      throw new AppError(
        409,
        "PAYMENT_SETUP_REQUIRED",
        "Complete your payment setup before continuing.",
      );
    if (op.providerRef) {
      await complete(
        op,
        await bachs.operation(
          op.kind,
          op.providerRef,
          ["PAYOUT", "REFUND_PAYOUT"].includes(op.kind) ? account.providerAccountId! : undefined,
        ),
      );
      return;
    }
    if (op.kind === "RELEASE") {
      await prisma.$transaction((tx) => assertRelease(tx, op.orderId!));
      await checkFunds(op.amountMinor);
      const result = await bachs.call(
        "/transfers",
        {
          destination: account.providerAccountId,
          amount: decimal(op.amountMinor),
          currency: "NGN",
          transfer_group: op.orderId,
          description: `LeetLogic ${op.id}`,
        },
        op.id,
      );
      await prisma.moneyOperation.update({
        where: { id },
        data: { providerRef: providerId(result) },
      });
      await complete(op, result);
    } else if (op.kind === "PAYOUT" || op.kind === "REFUND_PAYOUT") {
      const destination = await prisma.bankDestination.findFirst({
        where: { id: payload.destinationId, userId: op.ownerId, mode: mode(), usable: true },
      });
      if (!destination)
        throw new AppError(409, "BANK_NOT_READY", "Choose an approved bank account.");
      if (
        await prisma.tradeOrder.count({
          where: {
            farmerProfile: { userId: op.ownerId },
            fundsProvider: "bachs",
            OR: [
              { financialHold: true },
              { tickets: { some: { kind: "DISPUTE", status: { not: "RESOLVED" } } } },
            ],
          },
        })
      )
        throw new AppError(
          409,
          "PAYOUT_BLOCKED",
          "Withdrawals are paused while an order is being reviewed.",
        );
      if (
        getConfig().BACHS_NGN_PAYOUT_FEE_MINOR === undefined ||
        BigInt(getConfig().BACHS_NGN_PAYOUT_FEE_MINOR!) !== op.feeMinor
      )
        throw new AppError(
          409,
          "PAYOUT_FEE_CHANGED",
          "The withdrawal fee changed. Please review it again.",
        );
      const verified = await bachs.destination(destination.providerId, account.providerAccountId!);
      if (!verified.is_usable || verified.account_number?.slice(-4) !== destination.accountLastFour)
        throw new AppError(
          409,
          "BANK_NOT_READY",
          "Your bank account is not ready for this payment.",
        );
      await checkFunds(op.amountMinor + op.feeMinor, account.providerAccountId!);
      const result = await bachs.call(
        "/payouts",
        { destination: destination.providerId, amount: decimal(op.amountMinor), reference: op.id },
        op.id,
        account.providerAccountId!,
      );
      await prisma.moneyOperation.update({
        where: { id },
        data: { providerRef: providerId(result) },
      });
      await complete(op, result);
    } else if (op.kind === "REFUND" || op.kind === "REFUND_TRANSFER") {
      const payment = await prisma.paymentAttempt.findUniqueOrThrow({
        where: { id: op.paymentId! },
      });
      const original = await bachs.payment(payment.chargeId!);
      const matchedCheckout =
        original.checkout_id === payment.checkoutId ||
        (payment.kind === "EXCESS" &&
          (await prisma.paymentAttempt.count({
            where: {
              orderId: payment.orderId,
              buyerId: payment.buyerId,
              mode: mode(),
              checkoutId: original.checkout_id,
            },
          })) > 0);
      if (
        original.payment_id !== payment.chargeId ||
        !matchedCheckout ||
        original.currency !== "NGN"
      )
        throw new Error("REFUND_PAYMENT_MISMATCH");
      await checkFunds(op.amountMinor);
      if (op.kind === "REFUND") {
        if (!original.is_refundable)
          throw new AppError(
            409,
            "REFUND_RECONCILIATION_REQUIRED",
            "This payment needs a refund review. Contact support.",
          );
        const result = await bachs.call(
          "/refunds",
          {
            charge_id: payment.chargeId,
            amount: decimal(op.amountMinor),
            reference: op.id,
            reason: "Order cancellation",
            fee_bearer: "customer",
          },
          op.id,
        );
        await prisma.moneyOperation.update({
          where: { id },
          data: { providerRef: providerId(result) },
        });
        await complete(op, result);
      } else {
        if (!c.BACHS_BANK_REFUNDS_VERIFIED)
          throw new AppError(409, "BANK_REFUND_UNAVAILABLE", "Bank refunds are not available yet.");
        const destination = await prisma.bankDestination.findFirst({
          where: {
            id: payload.destinationId || "00000000-0000-0000-0000-000000000000",
            userId: op.ownerId,
            mode: mode(),
            usable: true,
          },
        });
        if (!destination)
          throw new AppError(
            409,
            "BUYER_BANK_REQUIRED",
            "Add an approved bank account to receive your refund.",
          );
        const originalBank = original.payment_method_details?.bank_transfer;
        const details = await bachs.destination(destination.providerId, account.providerAccountId!);
        const matches =
          originalBank?.sender_account_number &&
          originalBank.sender_account_number === details.account_number &&
          originalBank.sender_bank_code === details.bank_code;
        if (!matches && !payload.payerVerifiedAt)
          throw new AppError(
            409,
            "REFUND_BANK_REVIEW",
            "Your refund bank account needs a support review.",
          );
        if (c.BACHS_NGN_PAYOUT_FEE_MINOR === undefined)
          throw new AppError(
            409,
            "PAYOUT_FEE_UNAVAILABLE",
            "Refund fees are being reviewed. Please try again later.",
          );
        const fee = BigInt(c.BACHS_NGN_PAYOUT_FEE_MINOR);
        if (fee >= op.amountMinor)
          throw new AppError(
            409,
            "REFUND_FEE_EXCEEDS_AMOUNT",
            "This refund needs a support review.",
          );
        await prisma.moneyOperation.update({ where: { id }, data: { feeMinor: fee } });
        const result = await bachs.call(
          "/transfers",
          {
            destination: account.providerAccountId,
            amount: decimal(op.amountMinor),
            currency: "NGN",
            transfer_group: op.orderId,
            description: `LeetLogic ${op.id}`,
          },
          op.id,
        );
        await prisma.moneyOperation.update({
          where: { id },
          data: { providerRef: providerId(result) },
        });
        await complete({ ...op, feeMinor: fee }, result);
      }
    }
  } catch (error) {
    const code = error instanceof AppError ? error.code : "PAYMENT_RECONCILIATION_REQUIRED";
    const blocked =
      error instanceof AppError &&
      [409, 503].includes(error.status) &&
      !["PAYMENT_RESULT_UNKNOWN"].includes(error.code);
    const definite = error instanceof AppError && error.code === "PAYMENT_PROVIDER_REJECTED";
    // No automatic re-submission after an uncertain write. Reads with a known
    // provider reference can safely reconcile on the next worker pass.
    const current = await prisma.moneyOperation.findUniqueOrThrow({ where: { id } });
    await prisma.moneyOperation.update({
      where: { id },
      data: {
        status: definite
          ? "FAILED"
          : blocked
            ? "BLOCKED"
            : current.providerRef
              ? "PROVIDER_PENDING"
              : "UNKNOWN",
        failureCode: code,
        leaseUntil: null,
        nextRunAt: new Date(Date.now() + 60000),
      },
    });
    if (op.kind === "CHECKOUT")
      await prisma.paymentAttempt.update({
        where: { id: op.paymentId! },
        data: {
          status: definite ? "FAILED" : blocked ? "BLOCKED" : "UNKNOWN",
          exceptionCode: code,
        },
      });
    logger.warn({ operationId: id, code }, "Payment operation needs attention");
  }
}
async function processWebhook(event: any) {
  const id = event.resourceId;
  if (!id) return;
  if (event.eventType.startsWith("collection.") || event.eventType.startsWith("checkout.")) {
    let payment = await prisma.paymentAttempt.findFirst({
      where: { mode: mode(), OR: [{ chargeId: id }, { checkoutId: id }] },
    });
    if (!payment && event.eventType.startsWith("checkout.")) {
      const remote = await bachs.checkoutState(id);
      if (typeof remote.reference === "string") {
        const existing = await prisma.paymentAttempt.findFirst({
          where: { id: remote.reference, mode: mode() },
        });
        if (existing) {
          await prisma.paymentAttempt.update({
            where: { id: existing.id },
            data: { checkoutId: id },
          });
          payment = existing;
        }
      }
    }
    if (!payment && event.eventType.startsWith("collection.")) {
      const remote = await bachs.payment(id);
      if (remote.checkout_id) {
        payment = await prisma.paymentAttempt.findFirst({
          where: { checkoutId: remote.checkout_id, mode: mode() },
        });
        if (!payment) {
          const checkout = await bachs.checkoutState(remote.checkout_id);
          if (typeof checkout.reference === "string") {
            const owned = await prisma.paymentAttempt.findFirst({
              where: { id: checkout.reference, mode: mode() },
            });
            if (owned) {
              await prisma.paymentAttempt.update({
                where: { id: owned.id },
                data: { checkoutId: remote.checkout_id },
              });
              payment = { ...owned, checkoutId: remote.checkout_id };
            }
          }
        }
      }
    }
    if (payment)
      await reconcilePayment(
        payment.id,
        event.eventType.startsWith("collection.") ? id : undefined,
      );
    else throw new Error("UNMATCHED_PAYMENT_EVENT");
  } else if (event.eventType.startsWith("dispute.")) {
    const dispute = await bachs.call(`/disputes/${encodeURIComponent(id)}`);
    const payment = await prisma.paymentAttempt.findFirst({
      where: { chargeId: dispute.charge_id, mode: mode() },
    });
    if (!payment) throw new Error("UNMATCHED_DISPUTE");
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${payment.orderId}::uuid FOR UPDATE`;
      await tx.tradeOrder.update({ where: { id: payment.orderId }, data: { financialHold: true } });
      await createOperation(tx, {
        ownerId: payment.buyerId,
        orderId: payment.orderId,
        paymentId: payment.id,
        kind: "DISPUTE",
        key: id,
        payload: { providerDisputeId: id },
        status: "BLOCKED",
      });
      if (dispute.status === "lost") {
        const amount = minor(dispute.amount);
        await journal(
          tx,
          `dispute-lost:${mode()}:${id}`,
          [
            ["chargeback_loss", amount],
            ["platform_cash", -amount],
          ],
          payment.orderId,
        );
      }
    });
  } else if (event.eventType.startsWith("account.") || event.eventType.startsWith("capability.")) {
    const account = await prisma.financialAccount.findFirst({
      where: { providerAccountId: event.accountId || id, mode: mode() },
    });
    if (account) await refreshAccount(account.userId);
  } else {
    const operation = await prisma.moneyOperation.findFirst({
      where: { mode: mode(), providerRef: id },
    });
    if (operation && !["SUCCEEDED", "FAILED"].includes(operation.status)) {
      await prisma.moneyOperation.update({
        where: { id: operation.id },
        data: { status: "PROVIDER_PENDING", nextRunAt: new Date(), leaseUntil: null },
      });
      await runMoneyOperation(operation.id);
    } else if (!operation) throw new Error("UNMATCHED_MONEY_EVENT");
  }
}
async function expireOrders() {
  const orders = await prisma.tradeOrder.findMany({
    where: {
      status: "AWAITING_PAYMENT",
      fundsProvider: "bachs",
      reservationExpiresAt: { lt: new Date() },
    },
    take: 20,
  });
  for (const item of orders)
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${item.id}::uuid FOR UPDATE`;
      const order = await tx.tradeOrder.findUniqueOrThrow({ where: { id: item.id } });
      if (order.status !== "AWAITING_PAYMENT" || order.financialHold) return;
      await tx.$queryRaw`SELECT id FROM listings WHERE id=${order.listingId}::uuid FOR UPDATE`;
      await tx.listing.update({
        where: { id: order.listingId },
        data: { reservedQuantity: { decrement: order.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          listingId: order.listingId,
          type: "RELEASE",
          quantity: order.quantity,
          referenceType: "order",
          referenceId: order.id,
        },
      });
      await tx.tradeOrder.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      await tx.paymentAttempt.updateMany({
        where: { orderId: order.id, status: "OPEN" },
        data: { status: "EXPIRED" },
      });
    });
}
export async function runPaymentJobs() {
  if (!getConfig().PAYMENTS_ENABLED) return;
  await prisma.moneyOperation.updateMany({
    where: { mode: mode(), status: "PROCESSING", leaseUntil: { lt: new Date() } },
    data: { status: "UNKNOWN", failureCode: "WORKER_INTERRUPTED", leaseUntil: null },
  });
  const operations = await prisma.moneyOperation.findMany({
    where: {
      mode: mode(),
      OR: [
        { status: { in: ["QUEUED", "PROVIDER_PENDING"] } },
        { status: "UNKNOWN", providerRef: { not: null } },
      ],
      nextRunAt: { lte: new Date() },
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });
  for (const operation of operations) await runMoneyOperation(operation.id);
  const events = await prisma.moneyWebhook.findMany({
    where: { mode: mode(), status: { in: ["QUEUED", "RETRY"] }, nextRunAt: { lte: new Date() } },
    take: 20,
  });
  for (const event of events) {
    const claim = await prisma.moneyWebhook.updateMany({
      where: { id: event.id, status: { in: ["QUEUED", "RETRY"] } },
      data: { status: "PROCESSING", nextRunAt: new Date(Date.now() + 120000) },
    });
    if (!claim.count) continue;
    try {
      await processWebhook(event);
      await prisma.moneyWebhook.update({
        where: { id: event.id },
        data: { status: "PROCESSED", failureCode: null },
      });
    } catch {
      await prisma.moneyWebhook.update({
        where: { id: event.id },
        data: {
          status: "RETRY",
          failureCode: "EVENT_RECONCILIATION_REQUIRED",
          nextRunAt: new Date(Date.now() + 60000),
        },
      });
    }
  }
  await prisma.moneyWebhook.updateMany({
    where: { mode: mode(), status: "PROCESSING", nextRunAt: { lt: new Date() } },
    data: { status: "RETRY" },
  });
  const pending = await prisma.paymentAttempt.findMany({
    where: {
      mode: mode(),
      status: { in: ["OPEN", "UNKNOWN", "EXCEPTION"] },
      checkoutId: { not: null },
      updatedAt: { lt: new Date(Date.now() - 60000) },
    },
    take: 10,
  });
  for (const payment of pending) await reconcilePayment(payment.id).catch(() => {});
  await expireOrders();
}
export async function reconcileBalances() {
  const available = balanceOf(await bachs.balances());
  const held = await prisma.tradeOrder.aggregate({
    where: {
      fundsProvider: "bachs",
      id: {
        in: (
          await prisma.paymentAttempt.findMany({
            where: { mode: mode(), kind: "ORDER", status: "SUCCEEDED" },
            select: { orderId: true },
          })
        ).map((p) => p.orderId),
      },
    },
    _sum: { heldMinor: true },
  });
  let wallet: bigint | undefined;
  try {
    wallet = await shippingProvider.wallet();
  } catch {
    /* reported as unknown, never assumed funded */
  }
  return prisma.moneyReconciliation.create({
    data: {
      mode: mode(),
      platformAvailableMinor: available,
      heldProduceMinor: held._sum.heldMinor || 0n,
      pendingOperations: await prisma.moneyOperation.count({
        where: { mode: mode(), status: { in: ["UNKNOWN", "PROVIDER_PENDING", "BLOCKED"] } },
      }),
      exceptionCount: await prisma.paymentAttempt.count({
        where: { mode: mode(), status: "EXCEPTION" },
      }),
      shippingWalletMinor: wallet,
    },
  });
}
export function startPaymentWorker() {
  let running = false,
    lastReconciliation = 0;
  const timer = setInterval(() => {
    if (running || !getConfig().PAYMENTS_ENABLED) return;
    running = true;
    runPaymentJobs()
      .then(async () => {
        if (Date.now() - lastReconciliation > 86400000) {
          await reconcileBalances();
          lastReconciliation = Date.now();
        }
      })
      .catch(() => logger.error("Payment worker needs attention"))
      .finally(() => {
        running = false;
      });
  }, 15000);
  timer.unref();
  return () => clearInterval(timer);
}
