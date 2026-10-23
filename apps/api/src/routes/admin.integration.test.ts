import { createSession } from "../services/sessions.js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { authenticator } from "otplib";
import { prisma } from "@leetlogic/database";
import { createApp } from "../app.js";
import { hashPassword } from "../services/admin-password.js";
import { encryptSecret, hashToken } from "../lib/crypto.js";
import { redis } from "../lib/redis.js";
const integration = process.env.ADMIN_INTEGRATION === "1" ? describe : describe.skip;
integration("admin PostgreSQL and Redis workflows", () => {
  const app = createApp();
  const secret = authenticator.generateSecret();
  const email = `test-${randomUUID()}@example.test`;
  const password = "an-integration-test-password";
  let adminId: string;
  let access: string;
  let refresh: string;
  let farmerId: string;
  let sellerId: string;
  let listingId: string;
  let buyerId: string;
  let orderId: string;
  let roleId: string;
  const auth = () => ({ Authorization: `Bearer ${access}` });
  beforeAll(async () => {
    const grants = [
      "orders.read",
      "orders.manage",
      "payments.read",
      "payments.manage",
      "content.manage",
      "support.manage",
      "settings.manage",
      "audit.read",
      "users.manage",
      "users.read",
      "catalog.manage",
      "disputes.manage",
      "admin.manage",
      "verification.read",
      "verification.decide",
      "risk.manage",
      "compliance.manage",
      "system.manage",
    ];
    roleId = (
      await prisma.adminRole.create({
        data: { code: `TEST_${randomUUID()}`, name: "Integration role" },
      })
    ).id;
    for (const code of grants) {
      const p = await prisma.permission.upsert({
        where: { code },
        create: { code, description: code },
        update: {},
      });
      await prisma.rolePermission.create({ data: { roleId, permissionId: p.id } });
    }
    adminId = (
      await prisma.adminAccount.create({
        data: {
          email,
          fullName: "Integration Admin",
          passwordHash: await hashPassword(password),
          status: "ACTIVE",
          totpSecretEncrypted: encryptSecret(secret),
          totpEnrolledAt: new Date(),
          roles: { create: { roleId } },
        },
      })
    ).id;
    const suffix = `${Date.now()}`.slice(-8);
    buyerId = (await prisma.user.create({ data: { phoneE164: `+23480${suffix}` } })).id;
    const seller = await prisma.user.create({
      data: {
        phoneE164: `+23481${suffix}`,
        farmerProfile: {
          create: {
            farmName: "Integration Farm",
            farmType: "CROP",
            verificationStatus: "APPROVED",
          },
        },
      },
      include: { farmerProfile: true },
    });
    farmerId = seller.farmerProfile!.id;
    sellerId = seller.id;
    const address = await prisma.address.create({
      data: { userId: seller.id, state: "Lagos", lga: "Ikeja", city: "Lagos", line1: "Test farm" },
    });
    const category = await prisma.category.create({ data: { slug: `test-${randomUUID()}` } });
    await prisma.unit.upsert({
      where: { code: "KG" },
      create: { code: "KG", name: "Kilogram", allowsDecimal: true },
      update: {},
    });
    listingId = (
      await prisma.listing.create({
        data: {
          farmerProfileId: farmerId,
          categoryId: category.id,
          unitCode: "KG",
          locationAddressId: address.id,
          title: "Integration Tomatoes",
          unitPriceMinor: 10000n,
          availableQuantity: "10",
          shippingScope: "LOCAL",
          status: "ACTIVE",
        },
      })
    ).id;
  }, 30000);
  afterAll(async () => {
    await redis().quit();
    await prisma.$disconnect();
  });
  it("requires email/password and a device-bound authenticator challenge", async () => {
    expect(
      (
        await request(app)
          .post("/v1/admin/auth/login")
          .send({ email, password: "wrong", deviceId: "test-device" })
      ).status,
    ).toBe(401);
    const login = await request(app)
      .post("/v1/admin/auth/login")
      .send({ email, password, deviceId: "test-device" });
    expect(login.status).toBe(200);
    expect(
      (
        await request(app)
          .post("/v1/admin/auth/totp/confirm")
          .send({
            preAuthToken: login.body.preAuthToken,
            code: authenticator.generate(secret),
            deviceId: "wrong-device",
          })
      ).status,
    ).toBe(401);
    const confirm = await request(app)
      .post("/v1/admin/auth/totp/confirm")
      .send({
        preAuthToken: login.body.preAuthToken,
        code: authenticator.generate(secret),
        deviceId: "test-device",
      });
    expect(confirm.status).toBe(200);
    access = confirm.body.accessToken;
    refresh = confirm.body.refreshToken;
    expect(
      (
        await request(app)
          .post("/v1/admin/auth/totp/confirm")
          .send({
            preAuthToken: login.body.preAuthToken,
            code: authenticator.generate(secret),
            deviceId: "test-device",
          })
      ).status,
    ).toBe(401);
    expect((await request(app).get("/v1/admin/me").set(auth())).body.email).toBe(email);
  });
  it("protects every operational resource and returns real queues", async () => {
    for (const path of [
      "users",
      "verifications",
      "listings",
      "orders",
      "logistics",
      "withdrawals",
      "support",
      "disputes",
      "faq",
      "translations",
      "risk",
      "compliance",
      "system",
      "reports",
      "roles",
      "audit-logs",
      "reconciliation",
      "dashboard",
    ]) {
      expect((await request(app).get(`/v1/admin/${path}`)).status, path).toBe(401);
      expect((await request(app).get(`/v1/admin/${path}`).set(auth())).status, path).toBe(200);
    }
  });
  it("consumes account setup links once and enrolls authenticators", async () => {
    const invited = await prisma.adminAccount.create({
      data: { email: `setup-${randomUUID()}@example.test`, fullName: "Invited Test" },
    });
    const token = randomUUID() + randomUUID();
    await prisma.adminInvitation.create({
      data: {
        adminId: invited.id,
        tokenHash: hashToken(token),
        purpose: "SETUP",
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    const setup = await request(app)
      .post("/v1/admin/auth/setup")
      .send({ token, password, deviceId: "setup-device" });
    expect(setup.status).toBe(200);
    expect(setup.body.next).toBe("TOTP_ENROLLMENT");
    expect(
      (
        await request(app)
          .post("/v1/admin/auth/setup")
          .send({ token, password, deviceId: "setup-device" })
      ).status,
    ).toBe(401);
    const enrollment = await request(app)
      .post("/v1/admin/auth/totp/enrol")
      .send({ preAuthToken: setup.body.preAuthToken });
    expect(enrollment.status).toBe(200);
    expect(enrollment.body.otpauthUrl).toContain("example.test");
    const confirm = await request(app)
      .post("/v1/admin/auth/totp/confirm")
      .send({
        preAuthToken: setup.body.preAuthToken,
        deviceId: "setup-device",
        code: authenticator.generate(enrollment.body.secret),
      });
    expect(confirm.status).toBe(200);
    expect(confirm.body.recoveryCodes).toHaveLength(10);
    const login = await request(app)
      .post("/v1/admin/auth/login")
      .send({ email: invited.email, password, deviceId: "setup-device" });
    const recover = await request(app).post("/v1/admin/auth/recovery").send({
      preAuthToken: login.body.preAuthToken,
      deviceId: "setup-device",
      recoveryCode: confirm.body.recoveryCodes[0],
    });
    expect(recover.status).toBe(200);
    expect(recover.body.next).toBe("TOTP_ENROLLMENT");
    expect(
      (
        await request(app)
          .get("/v1/admin/me")
          .set({ Authorization: `Bearer ${confirm.body.accessToken}` })
      ).status,
    ).toBe(401);
  });
  it("serves uploaded private documents and prevents a second verification decision", async () => {
    const verification = await prisma.verificationCase.create({
      data: { farmerProfileId: farmerId, status: "DRAFT" },
    });
    // Registry checks are now a separate prerequisite, even when testing legacy private uploads.
    await prisma.identityCheck.create({
      data: {
        verificationCaseId: verification.id,
        mode: "sandbox",
        widgetId: "admin-integration-fixture",
        status: "VERIFIED",
        consentVersion: "dojah-identity-v1",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const farmAddress = await prisma.address.findFirstOrThrow({ where: { userId: sellerId } });
    await prisma.farmerProfile.update({
      where: { id: farmerId },
      data: { primaryAddressId: farmAddress.id },
    });

    const customer = await createSession({
      subject: "CUSTOMER",
      principalId: sellerId,
      deviceId: "document-device",
    });
    const uploaded = await request(app)
      .post("/v1/seller/verification/uploads?documentType=NIN_SLIP")
      .set({ Authorization: `Bearer ${customer.accessToken}`, "Content-Type": "application/pdf" })
      .send(Buffer.from("%PDF-1.4\nTest private document\n%%EOF"));
    expect(uploaded.status).toBe(201);
    const customerAuth = { Authorization: `Bearer ${customer.accessToken}` };
    expect(
      (
        await request(app)
          .post("/v1/seller/verification/submit")
          .set(customerAuth)
          .send({ declarationAccepted: true })
      ).status,
    ).toBe(422);
    const noteOnly = await request(app)
      .post("/v1/seller/verification/evidence")
      .set(customerAuth)
      .send({ note: "This is only a note, not proof" });
    expect(noteOnly.status).toBe(422);
    expect(noteOnly.body.error.code).toBe("FARM_EVIDENCE_REQUIRED");
    const forged = await request(app)
      .post("/v1/seller/verification/evidence")
      .set(customerAuth)
      .send({ objectKey: "other-farm/not-uploaded", note: "Pretend upload" });
    expect(forged.status).toBe(422);
    // Old note-only records must not bypass submission validation.
    await prisma.farmEvidence.create({
      data: { verificationCaseId: verification.id, note: "Legacy note without an image" },
    });
    const noteSubmit = await request(app)
      .post("/v1/seller/verification/submit")
      .set(customerAuth)
      .send({ declarationAccepted: true });
    expect(noteSubmit.status).toBe(422);
    expect(noteSubmit.body.error.code).toBe("FARM_EVIDENCE_REQUIRED");
    const pdfProof = await request(app)
      .post("/v1/seller/verification/uploads?kind=evidence")
      .set({ ...customerAuth, "Content-Type": "application/pdf" })
      .send(Buffer.from("%PDF-1.4\nNot a farm photo\n%%EOF"));
    expect(pdfProof.status).toBe(422);
    expect(pdfProof.body.error.code).toBe("FARM_EVIDENCE_REQUIRED");
    const evidencePhoto = await request(app)
      .post("/v1/seller/verification/uploads?kind=evidence")
      .set({ ...customerAuth, "Content-Type": "image/png" })
      .send(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]));
    expect(evidencePhoto.status).toBe(201);
    expect(
      (
        await request(app)
          .post("/v1/seller/verification/evidence")
          .set(customerAuth)
          .send({ note: "Produce grown on our farm" })
      ).status,
    ).toBe(201);
    const video = Buffer.concat([
      Buffer.from([0, 0, 0, 20]),
      Buffer.from("ftypisom"),
      Buffer.alloc(8),
    ]);
    const uploadedVideo = await request(app)
      .post("/v1/seller/verification/uploads?kind=evidence")
      .set({ ...customerAuth, "Content-Type": "video/mp4" })
      .send(video);
    expect(uploadedVideo.status).toBe(201);
    expect(uploadedVideo.body.evidence.mimeType).toBe("video/mp4");
    const audioOnly = Buffer.concat([
      Buffer.from([0, 0, 0, 20]),
      Buffer.from("ftypM4A "),
      Buffer.alloc(8),
    ]);
    expect(
      (
        await request(app)
          .post("/v1/seller/verification/uploads?kind=evidence")
          .set({ ...customerAuth, "Content-Type": "video/mp4" })
          .send(audioOnly)
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .post("/v1/seller/verification/uploads?documentType=NIN_SLIP")
          .set({ ...customerAuth, "Content-Type": "video/mp4" })
          .send(video)
      ).status,
    ).toBe(422);
    const voice = await request(app).get("/v1/seller/verification/voice").set(customerAuth);
    expect(voice.body).toEqual({ enabled: false, languages: [], acceptsAudio: false });
    expect(
      (
        await request(app)
          .post("/v1/seller/verification/description/translate")
          .send({ text: "Farm", sourceLocale: "en" })
      ).status,
    ).toBe(401);
    const translation = await request(app)
      .post("/v1/seller/verification/description/translate")
      .set(customerAuth)
      .send({ text: "Our farm description", sourceLocale: "en" });
    expect(translation.body.text).toBe("Our farm description");
    const draft = await request(app).get("/v1/seller/verification").set(customerAuth);
    expect(draft.body.verification.evidence.some((e: { hasPhoto: boolean }) => e.hasPhoto)).toBe(
      true,
    );
    expect(JSON.stringify(draft.body)).not.toContain("encryptedObjectKey");
    expect(JSON.stringify(draft.body)).not.toContain("internalNotes");

    expect(
      (
        await request(app)
          .post("/v1/seller/verification/submit")
          .set({ Authorization: `Bearer ${customer.accessToken}` })
          .send({ declarationAccepted: true })
      ).status,
    ).toBe(200);
    const reviewed = await request(app)
      .get(`/v1/admin/verifications/${verification.id}`)
      .set(auth());
    expect(reviewed.status).toBe(200);
    const videoEvidence = reviewed.body.verification.evidence.find(
      (e: { id: string }) => e.id === uploadedVideo.body.evidence.id,
    );
    const videoLink = videoEvidence.readUrl.replace("/api/admin/", "/v1/admin/");
    expect((await request(app).get(videoLink)).status).toBe(401);
    const streamedVideo = await request(app).get(videoLink).set(auth());
    expect(streamedVideo.status).toBe(200);
    expect(streamedVideo.headers["content-type"]).toContain("video/mp4");
    const evidenceLink = reviewed.body.verification.evidence
      .find((e: { readUrl: string }) => e.readUrl)
      .readUrl.replace("/api/admin/", "/v1/admin/");
    expect((await request(app).get(evidenceLink)).status).toBe(401);
    expect((await request(app).get(evidenceLink).set(auth())).status).toBe(200);
    expect(
      (
        await request(app)
          .post("/v1/seller/verification/submit")
          .set(customerAuth)
          .send({ declarationAccepted: true })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post("/v1/seller/verification/evidence")
          .set(customerAuth)
          .send({ note: "An edited note" })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app).post("/v1/me/seller-profile").set(customerAuth).send({
          farmName: "Changed farm",
          farmType: "Crop farming",
          state: "Lagos",
          lga: "Ikeja",
          city: "Lagos",
          line1: "Changed farm street",
        })
      ).status,
    ).toBe(409);

    const link = reviewed.body.verification.documents[0].readUrl.replace(
      "/api/admin/",
      "/v1/admin/",
    );
    expect((await request(app).get(link)).status).toBe(401);
    const document = await request(app).get(link).set(auth());
    expect(document.status).toBe(200);
    expect(document.headers["content-type"]).toContain("application/pdf");
    expect(
      (
        await request(app)
          .get(link.replace(/signature=[a-f0-9]+/, `signature=${"0".repeat(64)}`))
          .set(auth())
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/v1/admin/verifications/${verification.id}/approve`)
          .set(auth())
          .send({ reason: "Identity and farm evidence checked" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post("/v1/seller/verification/submit")
          .set(customerAuth)
          .send({ declarationAccepted: true })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`/v1/admin/verifications/${verification.id}/reject`)
          .set(auth())
          .send({ reason: "Duplicate review attempt" })
      ).status,
    ).toBe(409);
  });
  it("persists content and ticket replies and detects stale settings", async () => {
    const faq = await request(app).post("/v1/admin/faq").set(auth()).send({
      question: "How does testing work?",
      answer: "With persistent records.",
      audience: "ALL",
      locale: "en",
      status: "PUBLISHED",
    });
    expect(faq.status).toBe(201);
    expect(
      (await request(app).get("/v1/admin/faq").set(auth())).body.items.some(
        (row: any) => row.id === faq.body.id,
      ),
    ).toBe(true);
    expect(
      (await request(app).get("/v1/content/faq?locale=en&audience=BUYERS")).body.items.some(
        (row: any) => row.id === faq.body.id,
      ),
    ).toBe(true);
    const ticket = await request(app)
      .post("/v1/admin/support")
      .set(auth())
      .send({ subject: "Integration support" });
    expect(ticket.status).toBe(201);
    expect(
      (
        await request(app)
          .post(`/v1/admin/support/${ticket.body.id}/message`)
          .set(auth())
          .send({ body: "A persistent reply" })
      ).status,
    ).toBe(201);
    expect(
      (await request(app).get("/v1/admin/support").set(auth())).body.items[0].messages[0].body,
    ).toBe("A persistent reply");
    const settings = (await request(app).get("/v1/admin/settings").set(auth())).body;
    expect(
      (
        await request(app)
          .put("/v1/admin/settings")
          .set(auth())
          .send({ ...settings, supportEmail: "support@example.test" })
      ).status,
    ).toBe(403);
    const step = await request(app)
      .post("/v1/admin/auth/totp/step-up")
      .set(auth())
      .send({ code: authenticator.generate(secret) });
    expect(step.status).toBe(200);
    access = step.body.accessToken;
    expect(
      (
        await request(app)
          .put("/v1/admin/settings")
          .set(auth())
          .send({ ...settings, supportEmail: "support@example.test" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .put("/v1/admin/settings")
          .set(auth())
          .send({ ...settings, supportEmail: "other@example.test" })
      ).status,
    ).toBe(409);
  });
  it("reserves inventory and settles escrow once after delivery", async () => {
    const order = await request(app)
      .post("/v1/admin/orders")
      .set(auth())
      .send({ buyerId, listingId, quantity: "2" });
    expect(order.status).toBe(201);
    orderId = order.body.id;
    expect(
      (
        await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })
      ).reservedQuantity.toString(),
    ).toBe("2");
    const fund = {
      kind: "FUND",
      amountMinor: "20000",
      externalRef: `test-${randomUUID()}`,
      mutationKey: randomUUID(),
      reason: "Verified integration payment",
    };
    expect(
      (await request(app).post(`/v1/admin/orders/${orderId}/escrow`).set(auth()).send(fund)).status,
    ).toBe(200);
    expect(
      (await request(app).post(`/v1/admin/orders/${orderId}/escrow`).set(auth()).send(fund)).status,
    ).toBe(200);
    expect(await prisma.escrowEntry.count({ where: { orderId } })).toBe(1);
    const release = {
      kind: "RELEASE",
      amountMinor: "20000",
      mutationKey: randomUUID(),
      reason: "Buyer confirmed delivery",
    };
    expect(
      (await request(app).post(`/v1/admin/orders/${orderId}/escrow`).set(auth()).send(release))
        .status,
    ).toBe(409);
    const shipment = await request(app)
      .post("/v1/admin/logistics")
      .set(auth())
      .send({ orderId, carrier: "Test carrier", trackingRef: "TEST-123" });
    expect(shipment.status).toBe(201);
    for (const status of ["IN_TRANSIT", "DELIVERED"])
      expect(
        (
          await request(app)
            .post(`/v1/admin/logistics/${shipment.body.id}/status`)
            .set(auth())
            .send({ status, evidence: "Buyer signed delivery receipt" })
        ).status,
      ).toBe(200);
    expect(
      (await request(app).post(`/v1/admin/orders/${orderId}/escrow`).set(auth()).send(release))
        .status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/v1/admin/orders/${orderId}/escrow`)
          .set(auth())
          .send({ ...release, mutationKey: randomUUID() })
      ).status,
    ).toBe(409);
    expect(
      (await prisma.farmerWallet.findUniqueOrThrow({ where: { farmerProfileId: farmerId } }))
        .balanceMinor,
    ).toBe(18800n);
    const reconciliation = await request(app).get("/v1/admin/reconciliation").set(auth());
    expect(reconciliation.body.items.find((row: any) => row.id === orderId).balanced).toBe(true);
    const withdrawal = await request(app).post("/v1/admin/withdrawals").set(auth()).send({
      farmerProfileId: farmerId,
      amountMinor: "10000",
      bankName: "Test Bank",
      accountLastFour: "1234",
    });
    expect(withdrawal.status).toBe(201);
    expect(
      (
        await request(app)
          .post(`/v1/admin/withdrawals/${withdrawal.body.id}/status`)
          .set(auth())
          .send({ status: "REJECTED", reason: "Incorrect bank details supplied" })
      ).status,
    ).toBe(200);
    expect(
      (await prisma.farmerWallet.findUniqueOrThrow({ where: { farmerProfileId: farmerId } }))
        .reservedMinor,
    ).toBe(0n);
  });
  it("enforces changed grants and revokes access on logout", async () => {
    const grant = await prisma.permission.findUniqueOrThrow({ where: { code: "content.manage" } });
    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId: grant.id } },
    });
    expect((await request(app).get("/v1/admin/faq").set(auth())).status).toBe(403);
    const rotation = await request(app)
      .post("/v1/admin/auth/refresh")
      .send({ refreshToken: refresh });
    expect(rotation.status).toBe(200);
    access = rotation.body.accessToken;
    expect((await request(app).post("/v1/admin/auth/logout").set(auth())).status).toBe(204);
    expect((await request(app).get("/v1/admin/me").set(auth())).status).toBe(401);
    expect(await prisma.auditLog.count({ where: { actorId: adminId } })).toBeGreaterThan(8);
  });
});
