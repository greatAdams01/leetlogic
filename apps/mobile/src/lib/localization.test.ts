import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, it, expect } from "vitest";
import rows from "../locales/ui.json";
import {
  catalogue,
  localeOrder,
  ui,
  localizedError,
  unitLabel,
  dateLabel,
  localizedStatus,
} from "./localization";
import { en } from "../../../../packages/localization/src/customer-messages";
describe("complete mobile interface localization", () => {
  it("distinguishes verification failures and preserves support references and cooldown details", () => {
    const invalid = localizedError("en", { code: "OTP_INVALID" });
    const expired = localizedError("en", { code: "OTP_EXPIRED" });
    expect(invalid).toContain("incorrect");
    expect(expired).toContain("expired");
    expect(invalid).not.toBe(expired);
    expect(localizedError("en", { code: "OTP_DELIVERY_FAILED" })).toContain("SMS provider");
    expect(
      localizedError("en", { code: "DATABASE_UNAVAILABLE", requestId: "support-ref" }),
    ).toContain("account database");
    expect(
      localizedError("ig", { code: "DATABASE_UNAVAILABLE", requestId: "support-ref" }),
    ).toContain("support-ref");
    expect(localizedError("yo", { code: "OTP_RESEND_TOO_SOON", retryAfterSeconds: 23 })).toContain(
      "23",
    );
    for (const locale of localeOrder) {
      for (const code of [
        "NETWORK_ERROR",
        "REQUEST_TIMEOUT",
        "INVALID_SERVER_RESPONSE",
        "DEVICE_STORAGE_UNAVAILABLE",
        "REDIS_UNAVAILABLE",
      ])
        expect(localizedError(locale, { code })).not.toBe(
          ui(locale, "Request failed. Please try again."),
        );
    }
  });
  it("has an explicit translation for every phrase in every language", () => {
    expect(new Set(rows.map((row) => row[0])).size).toBe(rows.length);
    for (const row of rows) {
      expect(row).toHaveLength(5);
      for (const translation of row) expect(translation.trim()).not.toBe("");
    }
  });
  it("preserves every interpolation placeholder and its values", () => {
    for (const row of rows) {
      const placeholders = (s: string) => [...s.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();
      for (const target of row.slice(1))
        expect(placeholders(target)).toEqual(placeholders(row[0]!));
    }
    for (const locale of localeOrder) {
      const text = ui(locale, "Sent to {phone} · Valid for 5 minutes", { phone: "•••123" });
      expect(text).toContain("•••123");
      expect(text).not.toContain("{phone}");
    }
  });
  it("translates all three slides and common navigation immediately without a network provider", () => {
    for (const locale of ["ha", "ig", "yo"] as const)
      for (const source of [
        "Buy Fresh\nProduce",
        "Sell Your\nProduce",
        "Order with\nConfidence",
        "Next",
        "Skip",
        "Search",
        "My account",
      ])
        expect(ui(locale, source)).not.toBe(source.replace(/\s+/g, " "));
    expect(ui("ig", "Buy Fresh\nProduce")).toBe("Zụta Ihe Ubi Ọhụrụ");
    expect(ui("pcm", "Find farm produce from verified local farmers.")).toContain("wey");
  });
  it("keeps amounts, references and user-entered names intact and localizes units and errors", () => {
    expect(ui("ig", "Ada Okafor")).toBe("Ada Okafor");
    expect(ui("yo", "₦12,345.67")).toBe("₦12,345.67");
    expect(ui("ha", "LL-123")).toBe("LL-123");
    expect(unitLabel("ig", "BASKET")).toBe("Nkata");
    expect(ui("yo", "Full name *")).toBe("Orúkọ kíkún *");
    expect(
      localizedError("ig", { code: "OTP_INVALID", message: "English backend error" }),
    ).toContain("Koodu");
    expect(localizedError("ha", new Error("Unexpected English provider error"))).toBe(
      catalogue["Request failed. Please try again."]!.ha,
    );
    expect(dateLabel("ig", "2026-10-16T12:00:00Z")).not.toMatch(/October|Friday|AM|PM/);
  });
  it("covers visible copy, alerts, local validation, shared keys and UI lookup tables across all mobile screens", () => {
    const missing = new Set<string>();
    const brandOrAutonym = new Set([
      "LeetLogic",
      "LeetLogic logo",
      "Leetlogic Farmlink",
      "Asụsụ Igbo",
      "Naijá Pidgin",
      "Harshen Hausa",
      "Èdè Yorùbá",
    ]);
    const check = (s: string) => {
      const key = s.replace(/\s+/g, " ").trim().replace(/ \*$/, "");
      if (/[A-Za-zÀ-ž]/.test(key) && !brandOrAutonym.has(key) && !catalogue[key]) missing.add(key);
    };
    for (const file of readdirSync(resolve("src/screens")).filter((f) => f.endsWith(".tsx"))) {
      const tree = ts.createSourceFile(
        file,
        readFileSync(resolve("src/screens", file), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const visit = (n: ts.Node) => {
        if (ts.isJsxText(n)) check(n.text);
        if (
          ts.isJsxAttribute(n) &&
          ["title", "label", "text", "placeholder", "accessibilityLabel"].includes(
            n.name.getText(tree),
          ) &&
          n.initializer &&
          ts.isStringLiteral(n.initializer)
        )
          check(n.initializer.text);
        if (
          ts.isPropertyAssignment(n) &&
          ["label", "sub", "title", "body"].includes(n.name.getText(tree)) &&
          ts.isStringLiteral(n.initializer)
        )
          check(n.initializer.text);
        if (
          ts.isCallExpression(n) &&
          ts.isPropertyAccessExpression(n.expression) &&
          n.expression.name.text === "ui" &&
          n.arguments[0] &&
          ts.isStringLiteral(n.arguments[0])
        )
          check(n.arguments[0].text);
        if (
          ts.isCallExpression(n) &&
          ts.isPropertyAccessExpression(n.expression) &&
          n.expression.name.text === "t" &&
          n.arguments[0] &&
          ts.isStringLiteral(n.arguments[0])
        )
          check(en[n.arguments[0].text as keyof typeof en]);
        ts.forEachChild(n, visit);
      };
      visit(tree);
    }
    expect([...missing].sort()).toEqual([]);
  });
  it("uses bundled branding before fonts/session readiness and configures the native splash", () => {
    const app = readFileSync(resolve("App.tsx"), "utf8"),
      config = JSON.parse(readFileSync(resolve("app.json"), "utf8"));
    expect(app).toContain("return <Startup");
    expect(app).toContain("!brandShown");
    const plugin = config.expo.plugins.find(
      (p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen",
    );
    expect(plugin[1].image).toBe("./assets/brand-logo.png");
    expect(readFileSync(resolve("assets/brand-logo.png")).length).toBeGreaterThan(1000);
  });
  it("covers every current verification/listing state and every seeded selling unit", () => {
    for (const status of [
      "NOT_STARTED",
      "DRAFT",
      "SUBMITTED",
      "UNDER_REVIEW",
      "APPROVED",
      "REJECTED",
      "RESUBMISSION_REQUIRED",
      "ACTIVE",
      "PAUSED",
      "SOLD_OUT",
      "ARCHIVED",
      "AWAITING_PAYMENT",
      "FUNDED",
      "COMPLETED",
      "REFUNDED",
      "QUOTED",
      "PAYMENT_PENDING",
      "BOOKING",
      "BOOKING_UNCERTAIN",
      "BOOKED",
      "IN_TRANSIT",
      "DELIVERED",
      "CANCELLED",
    ]) {
      const label = status
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/^./, (x) => x.toUpperCase());
      expect(catalogue[label], status).toBeDefined();
      for (const locale of localeOrder)
        expect(localizedStatus(locale, status)).toBe(catalogue[label]![locale]);
    }
    for (const code of ["KG", "BAG", "BASKET", "CRATE", "TONNE", "PIECE"])
      for (const locale of ["ha", "ig", "yo"] as const)
        expect(unitLabel(locale, code)).not.toBe(code);
    expect(localizedStatus("yo", "UNKNOWN_PROVIDER_STATUS")).toBe(catalogue.Update!.yo);
  });
});
