import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { prisma } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { createApp } from "../app.js";
import { createSession } from "../services/sessions.js";
import { identityConsentVersion } from "../providers/identity/dojah.js";
const suite = process.env.IDENTITY_INTEGRATION === "1" ? describe : describe.skip;
suite("Dojah identity, account access and farm approval", () => {
  const app = createApp();
  const secret = "integration-subscription-secret";
  let userId: string,
    farmerId: string,
    caseId: string,
    outsiderId: string,
    outsiderCase: string,
    adminId: string,
    roleId: string;
  let access: string, otherAccess: string, adminAccess: string, reference: string;
  let previous: ReturnType<typeof getConfig>;
  const auth = () => ({ Authorization: `Bearer ${access}` });
  const consent = { consent: true, consentVersion: identityConsentVersion };
  const pending = () => ({
    reference_id: reference,
    widget_id: "test-widget",
    verification_status: "Pending",
  });
  const passed = () => ({
    ...pending(),
    verification_status: "Completed",
    status: true,
    data: {
      government_data: { status: true },
      user_data: { status: true },
      selfie: { status: true },
    },
  });
  const event = (body: unknown, signature?: string) => {
    const raw = JSON.stringify(body);
    return request(app)
      .post("/v1/webhooks/dojah")
      .set("Content-Type", "application/json")
      .set("x-dojah-signature", signature ?? createHmac("sha256", secret).update(raw).digest("hex"))
      .send(raw);
  };
  beforeAll(async () => {
    const c = getConfig();
    previous = { ...c };
    Object.assign(c, {
      IDENTITY_PROVIDER: "dojah",
      DOJAH_ENABLED: true,
      DOJAH_MODE: "sandbox",
      DOJAH_APP_ID: "test-app",
      DOJAH_SECRET_KEY: "test-api-secret",
      DOJAH_WEBHOOK_SECRET: secret,
      DOJAH_WIDGET_ID: "test-widget",
      DOJAH_FLOW_POLICY_CONFIRMED: true,
    });
    const suffix = String(Date.now()).slice(-8);
    const seller = await prisma.user.create({
      data: {
        phoneE164: `+23480${suffix}`,
        farmerProfile: {
          create: {
            farmName: "Identity Integration Farm",
            farmType: "CROP",
            verificationCases: { create: { identityRequired: true } },
          },
        },
      },
      include: { farmerProfile: { include: { verificationCases: true } } },
    });
    userId = seller.id;
    farmerId = seller.farmerProfile!.id;
    caseId = seller.farmerProfile!.verificationCases[0]!.id;
    const address = await prisma.address.create({
      data: { userId, state: "Lagos", lga: "Ikeja", city: "Ikeja", line1: "Test farm address" },
    });
    await prisma.farmerProfile.update({
      where: { id: farmerId },
      data: { primaryAddressId: address.id },
    });
    await prisma.farmEvidence.create({
      data: { verificationCaseId: caseId, note: "Test farm evidence" },
    });
    const outsider = await prisma.user.create({
      data: {
        phoneE164: `+23481${suffix}`,
        farmerProfile: {
          create: {
            farmName: "Other Farm",
            farmType: "CROP",
            verificationCases: { create: {} },
          },
        },
      },
      include: { farmerProfile: { include: { verificationCases: true } } },
    });
    outsiderId = outsider.id;
    outsiderCase = outsider.farmerProfile!.verificationCases[0]!.id;
    access = (
      await createSession({ subject: "CUSTOMER", principalId: userId, deviceId: randomUUID() })
    ).accessToken;
    otherAccess = (
      await createSession({ subject: "CUSTOMER", principalId: outsiderId, deviceId: randomUUID() })
    ).accessToken;
    const role = await prisma.adminRole.create({
      data: { code: `IDENTITY_TEST_${randomUUID()}`, name: "Identity test role" },
    });
    roleId = role.id;
    for (const code of ["verification.read", "verification.decide"]) {
      const permission = await prisma.permission.upsert({
        where: { code },
        create: { code, description: code },
        update: {},
      });
      await prisma.rolePermission.create({ data: { roleId, permissionId: permission.id } });
    }
    const admin = await prisma.adminAccount.create({
      data: {
        email: `identity-${randomUUID()}@example.test`,
        fullName: "Identity Test Admin",
        status: "ACTIVE",
        roles: { create: { roleId } },
      },
    });
    adminId = admin.id;
    adminAccess = (
      await createSession({ subject: "ADMIN", principalId: adminId, deviceId: randomUUID() })
    ).accessToken;
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    Object.assign(getConfig(), previous);
    // Audit records remain append-only, including in the isolated test schema.
    await prisma.verificationReview.deleteMany({ where: { verificationCaseId: caseId } });
    await prisma.verificationCase.deleteMany({ where: { id: { in: [caseId, outsiderCase] } } });
    await prisma.farmerProfile.deleteMany({ where: { userId: { in: [userId, outsiderId] } } });
    await prisma.session.deleteMany({
      where: { OR: [{ userId: { in: [userId, outsiderId] } }, { adminId }] },
    });
    await prisma.address.deleteMany({ where: { userId: { in: [userId, outsiderId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, outsiderId] } } });
    await prisma.adminRoleAssignment.deleteMany({ where: { adminId } });
    await prisma.adminAccount.delete({ where: { id: adminId } });
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    await prisma.adminRole.delete({ where: { id: roleId } });
    await prisma.$disconnect();
  });
  it("requires authentication and explicit versioned consent", async () => {
    expect((await request(app).get("/v1/seller/verification/identity")).status).toBe(401);
    expect(
      (
        await request(app)
          .post("/v1/seller/verification/identity/start")
          .set(auth())
          .send({ ...consent, consent: false })
      ).status,
    ).toBe(422);
    getConfig().DOJAH_ENABLED = false;
    expect(
      (await request(app).post("/v1/seller/verification/identity/start").set(auth()).send(consent))
        .status,
    ).toBe(503);
    getConfig().DOJAH_ENABLED = true;
  });
  it("reports incomplete server setup while allowing sandbox validation before live policy confirmation", async () => {
    const c = getConfig();
    const saved = c.DOJAH_SECRET_KEY;
    c.DOJAH_SECRET_KEY = "";
    const state = await request(app).get("/v1/seller/verification/identity").set(auth());
    expect(state.body.available).toBe(false);
    expect(state.body.unavailableCode).toBe("IDENTITY_NOT_CONFIGURED");
    const launch = await request(app)
      .post("/v1/seller/verification/identity/start")
      .set(auth())
      .send(consent);
    expect(launch.status).toBe(503);
    expect(launch.body.error.code).toBe("IDENTITY_NOT_CONFIGURED");
    expect(JSON.stringify(launch.body)).not.toContain("test-api-secret");
    c.DOJAH_SECRET_KEY = saved;
    c.DOJAH_FLOW_POLICY_CONFIRMED = false;
    expect(
      (await request(app).get("/v1/seller/verification/identity").set(auth())).body.available,
    ).toBe(true);
  });
  it("deduplicates concurrent starts and binds the random reference to this account", async () => {
    const [a, b] = await Promise.all([
      request(app).post("/v1/seller/verification/identity/start").set(auth()).send(consent),
      request(app).post("/v1/seller/verification/identity/start").set(auth()).send(consent),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.check.id).toBe(b.body.check.id);
    reference = a.body.check.id;
    expect(new URL(a.body.url).searchParams.get("reference_id")).toBe(reference);
    expect(await prisma.identityCheck.count({ where: { verificationCaseId: caseId } })).toBe(1);
    expect(
      (
        await request(app)
          .get("/v1/seller/verification/identity")
          .set("Authorization", `Bearer ${otherAccess}`)
      ).body.check,
    ).toBeNull();
    const injection = await request(app)
      .post("/v1/seller/verification/identity/start")
      .set(auth())
      .send({ ...consent, reference_id: randomUUID() });
    expect(injection.status).toBe(422);
  });
  it("blocks application submission before identity verification even with legacy uploaded IDs", async () => {
    const result = await request(app)
      .post("/v1/seller/verification/submit")
      .set(auth())
      .send({ declarationAccepted: true });
    expect(result.status).toBe(422);
    expect(result.body.error.code).toBe("IDENTITY_REQUIRED");
  });
  it("rejects unsigned, changed and mismatched-widget notifications", async () => {
    expect((await event(passed(), "0".repeat(64))).status).toBe(401);
    expect((await event({ ...passed(), widget_id: "other-widget" })).status).toBe(422);
    expect(await prisma.identityCheckEvent.count({ where: { identityCheckId: reference } })).toBe(
      0,
    );
  });
  it("deduplicates authenticated pending events without declaring success", async () => {
    expect((await event(pending())).status).toBe(200);
    expect((await event(pending())).status).toBe(200);
    expect(await prisma.identityCheckEvent.count({ where: { identityCheckId: reference } })).toBe(
      1,
    );
    expect(
      (await request(app).get("/v1/seller/verification/identity").set(auth())).body.passed,
    ).toBe(false);
  });
  it("reconciles only the account's reference, throttles repeated reads and handles timeouts", async () => {
    await prisma.identityCheck.update({ where: { id: reference }, data: { lastCheckedAt: null } });
    const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("timeout"));
    const failed = await request(app).post("/v1/seller/verification/identity/refresh").set(auth());
    expect(failed.status).toBe(503);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]![0])).toContain(`reference_id=${reference}`);
    expect(
      (await request(app).post("/v1/seller/verification/identity/refresh").set(auth())).status,
    ).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      (
        await request(app)
          .post("/v1/seller/verification/identity/refresh")
          .set("Authorization", `Bearer ${otherAccess}`)
      ).status,
    ).toBe(404);
    fetcher.mockRestore();
  });
  it("retries expired sessions with a new reference and ignores the old result", async () => {
    const old = reference;
    await prisma.identityCheck.update({
      where: { id: old },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (await request(app).get("/v1/seller/verification/identity").set(auth())).body.check.status,
    ).toBe("EXPIRED");
    const next = await request(app)
      .post("/v1/seller/verification/identity/start")
      .set(auth())
      .send(consent);
    expect(next.status).toBe(200);
    reference = next.body.check.id;
    expect(reference).not.toBe(old);
    expect((await event({ ...passed(), reference_id: old })).status).toBe(200);
    expect(
      (await request(app).get("/v1/seller/verification/identity").set(auth())).body.passed,
    ).toBe(false);
  });
  it("does not pass an unbound REST result or create a check from an unsolicited callback", async () => {
    const unbound: Record<string, unknown> = { ...passed() };
    delete unbound.widget_id;
    expect((await event(unbound)).status).toBe(200);
    expect(
      (await request(app).get("/v1/seller/verification/identity").set(auth())).body.passed,
    ).toBe(false);
    expect((await event({ ...passed(), reference_id: randomUUID() })).status).toBe(200);
  });
  it("recovers a completed card check from its existing provider reference, without creating a session", async () => {
    const card = { ...passed(), data: { index: { status: true }, id: { status: true } } };
    expect((await event(card)).status).toBe(200);
    const original = await prisma.identityCheck.count({ where: { verificationCaseId: caseId } });
    const stored = await request(app).get("/v1/seller/verification/identity").set(auth());
    expect(stored.body.check.summary.documentPassed).toBe(true);
    expect(stored.body.passed).toBe(true);
    await prisma.identityCheck.update({ where: { id: reference }, data: { lastCheckedAt: null } });
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) =>
        String(url).includes(reference)
          ? Response.json({ entity: card })
          : new Response(null, { status: 404 }),
      );
    const recovered = await request(app)
      .post("/v1/seller/verification/identity/refresh")
      .set(auth());
    expect(recovered.status).toBe(200);
    expect(recovered.body.check.id).toBe(reference);
    expect(recovered.body.check.summary.missingRequiredSteps).toContain("selfie");
    expect(await prisma.identityCheck.count({ where: { verificationCaseId: caseId } })).toBe(
      original,
    );
    fetcher.mockRestore();
  });
  it("recovers REVIEW into VERIFIED from an authenticated complete result and reuses it on start", async () => {
    await prisma.identityCheck.update({
      where: { id: reference },
      data: { status: "REVIEW", lastCheckedAt: null },
    });
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) =>
        String(url).includes(reference)
          ? Response.json({ entity: { ...passed(), data: { id: { status: true } } } })
          : new Response(null, { status: 404 }),
      );
    const recovered = await request(app)
      .post("/v1/seller/verification/identity/refresh")
      .set(auth());
    expect(recovered.status).toBe(200);
    expect(recovered.body.passed).toBe(true);
    const existingCount = await prisma.identityCheck.count({
      where: { verificationCaseId: caseId },
    });
    const reused = await request(app)
      .post("/v1/seller/verification/identity/start")
      .set(auth())
      .send(consent);
    expect(reused.status).toBe(200);
    expect(reused.body.url).toBeNull();
    expect(reused.body.check.id).toBe(reference);
    expect(await prisma.identityCheck.count({ where: { verificationCaseId: caseId } })).toBe(
      existingCount,
    );
    fetcher.mockRestore();
  });
  it("records provider success without approving the farm, and ignores delayed regressions", async () => {
    expect((await event(passed())).status).toBe(200);
    expect((await event({ ...pending(), verification_status: "Ongoing" })).status).toBe(200);
    const state = await request(app).get("/v1/seller/verification/identity").set(auth());
    expect(state.body.passed).toBe(true);
    expect(state.body.check.status).toBe("VERIFIED");
    expect(
      (await prisma.farmerProfile.findUniqueOrThrow({ where: { id: farmerId } }))
        .verificationStatus,
    ).toBe("DRAFT");
    const evidence = await prisma.identityCheckEvent.findMany({
      where: { identityCheckId: reference },
    });
    expect(JSON.stringify(evidence)).not.toContain("selfie");
  });
  it("recovers an earlier success despite a newer failure, and reuses it during an outage", async () => {
    await prisma.identityCheck.update({
      where: { id: reference },
      data: { status: "EXPIRED", lastCheckedAt: null },
    });
    await prisma.identityCheck.create({
      data: {
        verificationCaseId: caseId,
        mode: "sandbox",
        widgetId: "test-widget",
        consentVersion: identityConsentVersion,
        status: "FAILED",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const count = await prisma.identityCheck.count({ where: { verificationCaseId: caseId } });
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes(reference)) return Response.json({ entity: passed() });
      throw new Error("Newer attempt unavailable");
    });
    const recovered = await request(app)
      .post("/v1/seller/verification/identity/refresh")
      .set(auth());
    expect(recovered.status).toBe(200);
    expect(recovered.body.passed).toBe(true);
    expect(recovered.body.check.id).toBe(reference);
    expect(recovered.body.attempts).toBeUndefined();
    fetcher.mockClear();
    const c = getConfig();
    c.DOJAH_ENABLED = false;
    try {
      const reused = await request(app)
        .post("/v1/seller/verification/identity/start")
        .set(auth())
        .send(consent);
      expect(reused.status).toBe(200);
      expect(reused.body.url).toBeNull();
      expect(reused.body.check.id).toBe(reference);
      const state = await request(app).get("/v1/seller/verification/identity").set(auth());
      expect(state.body.passed).toBe(true);
      const other = await request(app)
        .get("/v1/seller/verification/identity")
        .set("Authorization", `Bearer ${otherAccess}`);
      expect(other.body.passed).toBe(false);
      expect(other.body.attempts).toBeUndefined();
      expect(fetcher).not.toHaveBeenCalled();
      expect(await prisma.identityCheck.count({ where: { verificationCaseId: caseId } })).toBe(
        count,
      );
    } finally {
      c.DOJAH_ENABLED = true;
      fetcher.mockRestore();
    }
  });
  it("accepts provider-verified applications without demanding another ID-photo upload", async () => {
    const result = await request(app)
      .post("/v1/seller/verification/submit")
      .set(auth())
      .send({ declarationAccepted: true });
    expect(result.status).toBe(200);
    expect(result.body.verification.status).toBe("SUBMITTED");
    expect(
      (await request(app).post("/v1/seller/verification/identity/start").set(auth()).send(consent))
        .status,
    ).toBe(409);
  });
  it("caps new attempts per account and retains failed and abandoned outcomes", async () => {
    await prisma.identityCheck.createMany({
      data: Array.from({ length: 3 }, (_, i) => ({
        verificationCaseId: outsiderCase,
        mode: "sandbox",
        widgetId: "test-widget",
        consentVersion: identityConsentVersion,
        status: i === 0 ? ("ABANDONED" as const) : ("FAILED" as const),
        expiresAt: new Date(Date.now() + 86400000),
      })),
    });
    const result = await request(app)
      .post("/v1/seller/verification/identity/start")
      .set("Authorization", `Bearer ${otherAccess}`)
      .send(consent);
    expect(result.status).toBe(429);
  });
  it("keeps admin approval guarded by provider verification and excludes sandbox approval in production", async () => {
    const header = { Authorization: `Bearer ${adminAccess}` };
    const detail = await request(app).get(`/v1/admin/verifications/${caseId}`).set(header);
    expect(detail.body.verification.identity.status).toBe("VERIFIED");
    getConfig().NODE_ENV = "production";
    const rejected = await request(app)
      .post(`/v1/admin/verifications/${caseId}/approve`)
      .set(header)
      .send({ reason: "Farm evidence reviewed" });
    expect(rejected.status).toBe(422);
    getConfig().NODE_ENV = "test";
    const approved = await request(app)
      .post(`/v1/admin/verifications/${caseId}/approve`)
      .set(header)
      .send({ reason: "Farm evidence reviewed" });
    expect(approved.status).toBe(200);
  });
});
