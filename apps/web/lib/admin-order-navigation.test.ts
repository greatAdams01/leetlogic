import { describe, expect, it } from "vitest";
import { adminRecordReturnPath, operationsDetailLink, operationsDetailRoute, operationsQueuePath, operationsReturnQueue } from "./admin-order-navigation";
const id = "11111111-1111-4111-8111-111111111111";

describe("order and delivery detail navigation", () => {
  it("accepts only complete dedicated record routes", () => {
    expect(operationsDetailRoute(`orders/${id}`)).toEqual({ area: "orders", id });
    expect(operationsDetailRoute(`logistics/${id}`)).toEqual({ area: "logistics", id });
    expect(operationsDetailRoute("orders/ABCDEF12-ABCD-4ABC-8ABC-ABCDEF123456")).toEqual({ area: "orders", id: "abcdef12-abcd-4abc-8abc-abcdef123456" });
    for (const route of ["orders", "logistics/not-an-id", `orders/${id}/edit`, `orders/${id}?legacy=1`, `ORDERS/${id}`, "orders/../../users"])
      expect(operationsDetailRoute(route)).toBeNull();
  });
  it("preserves queue filters without carrying inline review parameters", () => {
    const path = operationsQueuePath("orders", new URLSearchParams(`search=tomatoes&status=FUNDED&farmer=PENDING&view=ATTENTION&page=2&id=${id}&returnTo=https://outside.test`));
    expect(path).toBe("/admin/orders?search=tomatoes&status=FUNDED&farmer=PENDING&view=ATTENTION&page=2");
    const detail = new URL(operationsDetailLink("orders", id, path), "https://admin.invalid");
    expect(detail.pathname).toBe(`/admin/orders/${id}`);
    expect(detail.searchParams.get("returnTo")).toBe(path);
  });
  it("allows known internal workspaces and rejects unsafe or unrelated return links", () => {
    for (const path of ["/admin/orders?search=tomatoes&page=2", `/admin/logistics/${id}`, `/admin/reconciliation/orders/${id}?finTab=payments`, `/admin/reconciliation/records/payments/${id}`])
      expect(adminRecordReturnPath(path, "/admin/orders")).toBe(path);
    for (const path of [null, "https://outside.test/admin/orders", "//outside.test/admin/orders", "/admin/../../outside", "/admin/\\outside.test/orders", "/admin/users", "/admin/orders/not-an-id", `/admin/orders/${id}/edit`])
      expect(adminRecordReturnPath(path, "/admin/orders")).toBe("/admin/orders");
  });
  it("keeps the originating queue when moving repeatedly between related records", () => {
    const queue = "/admin/orders?search=tomatoes&status=FUNDED&page=2";
    let back = queue;
    for (let visit = 0; visit < 8; visit++) {
      const area = visit % 2 ? "orders" : "logistics";
      const current = operationsDetailLink(area, id, operationsReturnQueue(back, area));
      const related = operationsDetailLink(area === "orders" ? "logistics" : "orders", id, current);
      back = new URL(related, "https://admin.invalid").searchParams.get("returnTo")!;
      expect(operationsReturnQueue(back, area)).toBe(queue);
      expect(related.length).toBeLessThan(350);
    }
    expect(operationsReturnQueue(`/admin/orders/${id}?returnTo=${encodeURIComponent("https://outside.test/admin/orders")}`, "logistics")).toBe("/admin/logistics");
  });
});
