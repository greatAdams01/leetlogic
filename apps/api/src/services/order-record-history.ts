import { prisma, Prisma, type OrderRecordHistory } from "@leetlogic/database";
import type { OrderHistoryPage } from "@leetlogic/contracts";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { lastOrderHistoryId } from "./admin-order-management.js";

const sequence = z.string().regex(/^(0|[1-9]\d{0,18})$/).refine(value => BigInt(value) <= 9223372036854775807n);
const querySchema = z.object({ cursor: sequence.optional(), through: sequence.optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }).strict();

/** Newest page is chronological; earlier pages prepend. Cursor timestamps stay in PostgreSQL,
 * where their microseconds are exact, and a high-water mark excludes newer activity mid-review. */
export async function readOrderHistory(orderId: string, query: unknown = {}, tx: Prisma.TransactionClient = prisma): Promise<OrderHistoryPage> {
  const input = querySchema.parse(query), through = input.through ? BigInt(input.through) : await lastOrderHistoryId(orderId, tx);
  const cursor = input.cursor ? BigInt(input.cursor) : null;
  if (cursor && !(await tx.orderRecordHistory.findFirst({ where: { id: cursor, orderId, AND: { id: { lte: through } } }, select: { id: true } })))
    throw new AppError(422, "INVALID_HISTORY_CURSOR", "Refresh this record’s Activity History before loading earlier entries.");
  const rows = await tx.$queryRaw<OrderRecordHistory[]>(Prisma.sql`SELECT h.id, h.order_id AS "orderId", h.entity_type AS "entityType", h.entity_id AS "entityId",
    h.kind, h.action, h.actor_type AS "actorType", h.actor_id AS "actorId", h.actor_name AS "actorName", h.reason, h."before", h."after",
    h.occurred_at AS "occurredAt", h.request_id AS "requestId"
    FROM order_record_history h WHERE h.order_id = ${orderId}::uuid AND h.id <= ${through}
    ${cursor ? Prisma.sql`AND (h.occurred_at, h.id) < (SELECT occurred_at, id FROM order_record_history WHERE id = ${cursor} AND order_id = ${orderId}::uuid)` : Prisma.empty}
    -- A row version already carries the action, reason and identity; avoid repeating its audit envelope.
    AND NOT (h.kind = 'ACTION' AND EXISTS (SELECT 1 FROM order_record_history v WHERE v.audit_id = h.audit_id AND v.kind IN ('INSERT','UPDATE','DELETE')))
    ORDER BY h.occurred_at DESC, h.id DESC LIMIT ${input.limit + 1}`);
  const hasMore = rows.length > input.limit, page = rows.slice(0, input.limit);
  const baseline = await tx.orderRecordHistory.aggregate({ where: { orderId, kind: "BASELINE" }, _min: { occurredAt: true } });
  return { through: through.toString(), hasMore, nextCursor: hasMore ? page.at(-1)!.id.toString() : null,
    completeFrom: baseline._min.occurredAt?.toISOString() || null,
    items: page.reverse().map(row => ({ id: row.id.toString(), orderId: row.orderId, entityType: row.entityType, entityId: row.entityId,
      kind: row.kind, action: row.action, actorType: row.actorType, actorId: row.actorId, actorName: row.actorName, reason: row.reason,
      before: row.before, after: row.after, occurredAt: row.occurredAt.toISOString(), requestId: row.requestId })) };
}
