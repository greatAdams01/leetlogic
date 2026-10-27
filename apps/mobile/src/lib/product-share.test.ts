import { expect, it } from "vitest";
import { productShareUrl, whatsappShareUrl } from "./product-share";
it("shares a public product route and safely encodes WhatsApp text", () => {
  const url = productShareUrl("https://example.com/", "11111111-1111-4111-8111-111111111111");
  expect(url).toBe("https://example.com/produce/11111111-1111-4111-8111-111111111111");
  const message = `Yam & beans\n₦8,000\n${url}`;
  expect(new URL(whatsappShareUrl(message)).searchParams.get("text")).toBe(message);
});
it("rejects non-web and credential-bearing share URLs", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  expect(() => productShareUrl("javascript:alert(1)", id)).toThrow();
  expect(() => productShareUrl("https://secret@example.com/", id)).toThrow();
});
