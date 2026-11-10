import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
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
import { adminMutation } from "../test/admin-mutation.js";
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
    const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "";
    if (!schema.startsWith("leetlogic_admin_integration_") || new URL(process.env.REDIS_URL!).pathname !== "/15")
      throw new Error("Use the isolated admin integration runner.");
    redis().options.keyPrefix = `${schema}:`;
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
        capabilities: { create: { capability: "SELLER" } },
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
  it("provides listing review context without losing authenticated queue access", async () => {
    const result = await request(app)
      .get("/v1/admin/listings?search=Integration%20Tomatoes")
      .set(auth());
    expect(result.status).toBe(200);
    const listing = result.body.items.find((item: { id: string }) => item.id === listingId);
    expect(listing).toBeDefined();
    expect(listing.unit.name).toBe("Kilogram");
    expect(listing.locationAddress.line1).toBe("Test farm");
    expect(listing.locationAddress.state).toBe("Lagos");
    expect(listing.category.translations).toEqual(expect.any(Array));
    expect(listing.media).toEqual(expect.any(Array));
    expect(listing.farmerProfile.verificationStatus).toBe("APPROVED");
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
          .send({ ...settings, supportEmail: "support@example.test", paymentRecoveryTimeoutMinutes: 45 })
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
          .send({ ...settings, supportEmail: "support@example.test", paymentRecoveryTimeoutMinutes: 45 })
      ).status,
    ).toBe(200);
    const saved = (await request(app).get("/v1/admin/settings").set(auth())).body;
    expect(saved.paymentRecoveryTimeoutMinutes).toBe(45);
    for (const invalid of [0, 14, 10081, 15.5]) {
      expect((await request(app).put("/v1/admin/settings").set(auth()).send({...saved,paymentRecoveryTimeoutMinutes:invalid})).status).toBe(422);
    }
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
      .send({ ...await adminMutation(orderId), orderId, carrier: "Test carrier", trackingRef: "TEST-123" });
    expect(shipment.status).toBe(201);
    for (const status of ["IN_TRANSIT", "DELIVERED"])
      expect(
        (
          await request(app)
            .post(`/v1/admin/logistics/${shipment.body.id}/status`)
            .set(auth())
            .send({ ...await adminMutation(orderId), status, evidence: "Buyer signed delivery receipt" })
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
  it("filters public produce by state and local government without requiring login", async () => {
    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const path = `/v1/marketplace/listings?categoryId=${listing.categoryId}`;
    const nearby = await request(app).get(`${path}&state=lagos&lga=ikeja`);
    expect(nearby.status).toBe(200);
    expect(nearby.body.items.some((item: any) => item.id === listingId)).toBe(true);
    expect(nearby.body.items.find((item: any) => item.id === listingId).locationAddress.lga).toBe(
      "Ikeja",
    );
    const elsewhere = await request(app).get(`${path}&state=Abia`);
    expect(elsewhere.body.items.some((item: any) => item.id === listingId)).toBe(false);
    const otherLga = await request(app).get(`${path}&state=Lagos&lga=Epe`);
    expect(otherLga.body.items.some((item: any) => item.id === listingId)).toBe(false);
    expect((await request(app).get(`${path}&lga=Ikeja`)).status).toBe(422);
  });
  it("finds pinned farms within the buyer's radius and ranks by distance", async () => {
    const source = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const marker = `nearby-${randomUUID()}`;
    const add = async (latitude: number | null, status: "ACTIVE" | "PAUSED" = "ACTIVE") => {
      const address = await prisma.address.create({
        data: {
          userId: sellerId,
          state: "Lagos",
          city: "Lagos",
          lga: "Ikeja",
          line1: "GPS test farm",
          latitude,
          longitude: latitude === null ? null : 3.37,
        },
      });
      return prisma.listing.create({
        data: {
          farmerProfileId: farmerId,
          categoryId: source.categoryId,
          unitCode: source.unitCode,
          locationAddressId: address.id,
          title: marker,
          availableQuantity: "5",
          unitPriceMinor: 10000n,
          shippingScope: "LOCAL",
          status,
        },
      });
    };
    const nearest = await add(6.52);
    const nearby = await add(6.54);
    const far = await add(7.52);
    await add(null);
    await add(6.52, "PAUSED");
    const path = `/v1/marketplace/listings?search=${marker}&latitude=6.52&longitude=3.37`;
    const result = await request(app).get(`${path}&radiusKm=5`);
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.items.map((row: any) => row.id)).toEqual([nearest.id, nearby.id]);
    expect(result.body.items[0].distanceKm).toBe(0);
    expect(result.body.items[1].distanceKm).toBeGreaterThan(2);
    expect(result.body.items[0].locationAddress).not.toHaveProperty("latitude");
    const wider = await request(app).get(`${path}&radiusKm=200`);
    expect(wider.body.items.map((row: any) => row.id)).toEqual([nearest.id, nearby.id, far.id]);
    expect((await request(app).get(`${path}&radiusKm=501`)).status).toBe(422);
    expect((await request(app).get("/v1/marketplace/listings?latitude=6.52")).status).toBe(422);
    expect(
      (await request(app).get("/v1/marketplace/listings?latitude=91&longitude=3")).status,
    ).toBe(422);
  });
  it("manages category names, order and availability with catalog permission and audit history", async () => {
    const body = {
      slug: `produce-${randomUUID()}`,
      sortOrder: 15,
      isActive: true,
      translations: [
        { locale: "en", name: "Seasonal produce" },
        { locale: "ig", name: "Ihe ubi" },
      ],
    };
    expect((await request(app).post("/v1/admin/categories").send(body)).status).toBe(401);
    const created = await request(app).post("/v1/admin/categories").set(auth()).send(body);
    expect(created.status).toBe(201);
    const categoryId = created.body.item.id;
    expect((await request(app).post("/v1/admin/categories").set(auth()).send(body)).status).toBe(
      409,
    );
    expect(
      (
        await request(app)
          .patch(`/v1/admin/categories/${categoryId}`)
          .set(auth())
          .send({ ...body, translations: [{ locale: "ig", name: "Ihe ubi" }] })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .patch(`/v1/admin/categories/${categoryId}`)
          .set(auth())
          .send({ ...body, translations: [body.translations[0], body.translations[0]] })
      ).status,
    ).toBe(422);
    const updated = await request(app)
      .patch(`/v1/admin/categories/${categoryId}`)
      .set(auth())
      .send({
        ...body,
        isActive: false,
        sortOrder: 2,
        translations: [{ locale: "en", name: "Seasonal crops" }],
      });
    expect(updated.status).toBe(200);
    expect(updated.body.item.translations).toHaveLength(1);
    const catalogue = await request(app).get("/v1/marketplace/categories");
    expect(catalogue.body.items.some((item: any) => item.id === categoryId)).toBe(false);
    const staffList = await request(app).get("/v1/admin/categories").set(auth());
    expect(staffList.body.items.find((item: any) => item.id === categoryId)).toMatchObject({
      isActive: false,
      sortOrder: 2,
    });
    expect(await prisma.auditLog.count({ where: { entityId: categoryId } })).toBe(2);
    const grant = await prisma.permission.findUniqueOrThrow({ where: { code: "catalog.manage" } });
    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId: grant.id } },
    });
    expect((await request(app).get("/v1/admin/categories").set(auth())).status).toBe(403);
    expect(
      (await request(app).patch(`/v1/admin/categories/${categoryId}`).set(auth()).send(body))
        .status,
    ).toBe(403);
    await prisma.rolePermission.create({ data: { roleId, permissionId: grant.id } });
  });
  it("preserves corrections, rejects stale or unauthorized writes, and protects immutable history", async () => {
    const created = await request(app).post("/v1/admin/orders").set(auth()).send({ buyerId, listingId, quantity: "1" });
    expect(created.status).toBe(201);
    const key = created.body.id;
    const endpoint = `/v1/admin/orders/${key}/corrections`;
    const detail = await request(app).get(`/v1/admin/delivery-orders/${key}/delivery`).set(auth());
    expect(detail.status).toBe(200);
    const first = { ...await adminMutation(key), changes: { fulfillmentNotes: "Keep produce shaded" } };
    expect(detail.body.staffContext.revision).toBe(first.expectedRevision);
    expect((await request(app).post(endpoint).set(auth()).send(first)).status).toBe(200);
    const count = await prisma.orderRecordHistory.count({ where: { orderId: key } });
    expect((await request(app).post(endpoint).set(auth()).send(first)).status).toBe(200);
    expect(await prisma.orderRecordHistory.count({ where: { orderId: key } })).toBe(count);
    expect((await request(app).post(endpoint).set(auth()).send({ ...first, changes: { fulfillmentNotes: "Different request" } })).status).toBe(409);
    expect((await request(app).post(endpoint).set(auth()).send({ ...first, mutationKey: randomUUID() })).status).toBe(409);
    const current = await adminMutation(key);
    const competing = await Promise.all(["Use covered loading bay", "Telephone before arrival"].map(fulfillmentNotes =>
      request(app).post(endpoint).set(auth()).send({ ...current, mutationKey: randomUUID(), changes: { fulfillmentNotes } })));
    expect(competing.map(r => r.status).sort()).toEqual([200, 409]);
    const before = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: key } });
    const historyCount = await prisma.orderRecordHistory.count({ where: { orderId: key } });
    for (const body of [
      { ...await adminMutation(key), reason: "", changes: { fulfillmentNotes: "Invalid" } },
      { ...await adminMutation(key), changes: { heldMinor: "999" } },
    ]) expect((await request(app).post(endpoint).set(auth()).send(body)).status).toBe(422);
    const grant = await prisma.permission.findUniqueOrThrow({ where: { code: "orders.manage" } });
    await prisma.rolePermission.delete({ where: { roleId_permissionId: { roleId, permissionId: grant.id } } });
    try {
      expect((await request(app).post(endpoint).set(auth()).send({ ...await adminMutation(key), changes: { fulfillmentNotes: "Forbidden correction" } })).status).toBe(403);
    } finally { await prisma.rolePermission.create({ data: { roleId, permissionId: grant.id } }); }
    expect(await prisma.tradeOrder.findUniqueOrThrow({ where: { id: key } })).toEqual(before);
    expect(await prisma.orderRecordHistory.count({ where: { orderId: key } })).toBe(historyCount);
    const history = await request(app).get(`/v1/admin/orders/${key}/history?limit=1`).set(auth());
    expect(history.status).toBe(200);
    expect(history.body.hasMore).toBe(true);
    expect(history.body.items[0]).toMatchObject({ actorType: "admin", actorId: adminId, reason: current.reason,
      before: { fulfillment_notes: "Keep produce shaded" }, after: { fulfillment_notes: before.fulfillmentNotes } });
    const earlier = await request(app).get(`/v1/admin/orders/${key}/history?limit=1&cursor=${history.body.nextCursor}&through=${history.body.through}`).set(auth());
    expect(earlier.status).toBe(200);
    expect(earlier.body.items[0].id).not.toBe(history.body.items[0].id);
    const destination = { name: "Buyer Contact", phone: "+2348012345678", email: "", address: "15 Example Street Lagos", state: "Lagos", country: "NG" };
    const delivery = await prisma.delivery.create({ data: { orderId: key, destination } });
    const deliveryEndpoint = `/v1/admin/delivery-orders/${key}/delivery/corrections`;
    const correction = { ...await adminMutation(key), changes: { destination: { ...destination, address: "25 Corrected Street Lagos" }, operationsNotes: "Call before arrival" } };
    expect((await request(app).post(deliveryEndpoint).set(auth()).send(correction)).status).toBe(200);
    expect(await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).toMatchObject({ destination: correction.changes.destination, operationsNotes: "Call before arrival", status: "QUOTE_REQUIRED" });
    await prisma.$transaction(async tx => {
      await tx.tradeOrder.update({ where: { id: key }, data: { status: "FUNDED", heldMinor: 10000n } });
      await tx.delivery.update({ where: { id: delivery.id }, data: { status: "MANUAL_ASSIGNED" } });
      await tx.shipment.create({ data: { orderId: key, carrier: "Manual courier", trackingRef: "MANUAL-TEST" } });
    });
    const riderAssignment = { name: "Verified Rider", phone: "+2348012345678", reference: "ASSIGN-123" };
    expect((await request(app).post(deliveryEndpoint).set(auth()).send({ ...await adminMutation(key), changes: { riderAssignment }, arrangementConfirmed: true })).status).toBe(200);
    expect((await prisma.shipment.findUniqueOrThrow({ where: { orderId: key } })).riderAssignment).toEqual(riderAssignment);
    const statusHistoryCount = await prisma.orderRecordHistory.count({ where: { orderId: key } });
    expect((await request(app).post(`/v1/admin/delivery-orders/${key}/delivery/manual-status`).set(auth()).send({ ...await adminMutation(key), status: "DELIVERED", evidence: "Cannot skip pickup and transit" })).status).toBe(409);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe("MANUAL_ASSIGNED");
    expect(await prisma.orderRecordHistory.count({ where: { orderId: key } })).toBe(statusHistoryCount);
    await expect(prisma.$transaction(async tx => {
      await tx.delivery.update({ where: { id: delivery.id }, data: { operationsNotes: "Uncommitted change" } });
      throw new Error("Simulated failure after writing");
    })).rejects.toThrow("Simulated failure");
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).operationsNotes).toBe("Call before arrival");
    expect(await prisma.orderRecordHistory.count({ where: { orderId: key } })).toBe(statusHistoryCount);
    await prisma.delivery.update({ where: { id: delivery.id }, data: { providerShipmentId: `provider-${randomUUID()}` } });
    const protectedState = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
    const protectedHistory = await prisma.orderRecordHistory.count({ where: { orderId: key } });
    // Notes and address are one transaction: the forbidden route correction must also roll back notes.
    expect((await request(app).post(deliveryEndpoint).set(auth()).send({ ...await adminMutation(key), changes: { operationsNotes: "Must roll back", destination } })).status).toBe(409);
    expect((await request(app).post(deliveryEndpoint).set(auth()).send({ ...await adminMutation(key), changes: { riderAssignment: { ...riderAssignment, name: "Unsupported Rider" } }, arrangementConfirmed: true })).status).toBe(409);
    expect(await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).toEqual(protectedState);
    expect(await prisma.orderRecordHistory.count({ where: { orderId: key } })).toBe(protectedHistory);
    await expect(prisma.$executeRaw`UPDATE order_record_history SET reason = 'tampered' WHERE order_id = ${key}::uuid`).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRaw`DELETE FROM order_record_history WHERE order_id = ${key}::uuid`).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRaw`TRUNCATE order_record_history`).rejects.toThrow(/append-only/);
  });
  describe("exceptional order resolution", () => {
    beforeAll(async () => { await prisma.listing.update({ where: { id: listingId }, data: { availableQuantity: "1000" } }); });
    const decision = async (key: string, outcome = "UNDER_INVESTIGATION", financialAction = "HOLD") => ({ ...await adminMutation(key), outcome, financialAction,
      evidence: "Verified operator investigation and courier correspondence", confirmed: true });
    const newCase = async (fund = false) => {
      const result = await request(app).post("/v1/admin/orders").set(auth()).send({ buyerId, listingId, quantity: "1" });
      expect(result.status).toBe(201);
      const key = result.body.id;
      if (fund) expect((await request(app).post(`/v1/admin/orders/${key}/escrow`).set(auth()).send({ kind: "FUND", amountMinor: result.body.totalMinor, externalRef: `RES-${randomUUID()}`, mutationKey: randomUUID(), reason: "Verified manual funds for resolution test" })).status).toBe(200);
      return key as string;
    };
    it("keeps investigations open, preserves dispatch evidence and resists unauthorized order closure", async () => {
      for (const status of ["AWAITING_PAYMENT", "FUNDED", "DELIVERED", "COMPLETED", "REFUNDED", "CANCELLED"]) {
        const key = await newCase();
        await prisma.tradeOrder.update({ where: { id: key }, data: { status } });
        const delivery = await prisma.delivery.create({ data: { orderId: key, status: "IN_TRANSIT", providerShipmentId: `EX-${randomUUID()}` } });
        const body = await decision(key);
        const close = () => request(app).post(`/v1/admin/orders/${key}/resolve`).set(auth()).send(body);
        expect((await close()).status).toBe(200);
        const historyCount = await prisma.orderRecordHistory.count({ where: { orderId: key } });
        expect((await close()).status).toBe(200);
        expect(await prisma.orderRecordHistory.count({ where: { orderId: key } })).toBe(historyCount);
        expect(await prisma.tradeOrder.findUniqueOrThrow({ where: { id: key } })).toMatchObject({ status: "UNDER_INVESTIGATION", financialHold: true, adminResolution: { previousOrderStatus: status, financialAction: "HOLD", adminId } });
        expect((await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe("IN_TRANSIT");
        await prisma.$transaction(async tx => {
          await tx.tradeOrder.update({ where: { id: key }, data: { status: "FUNDED", financialHold: false } });
          await tx.delivery.update({ where: { id: delivery.id }, data: { status: "IN_TRANSIT" } });
        });
        expect(await prisma.tradeOrder.findUniqueOrThrow({ where: { id: key } })).toMatchObject({ status: "UNDER_INVESTIGATION", financialHold: true });
        expect((await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe("IN_TRANSIT");
        const history = await prisma.orderRecordHistory.findFirstOrThrow({ where: { orderId: key, entityType: "order", action: "order.admin.investigation.opened", kind: "UPDATE" } });
        expect(history).toMatchObject({ actorId: adminId, actorType: "admin", reason: body.reason, before: { status }, after: { status: "UNDER_INVESTIGATION" } });
      }
    });
    it("repairs legacy closed holds from immutable history without rewriting prior evidence", async () => {
      const key = await newCase(true);
      const delivery = await prisma.delivery.create({ data: { orderId: key, status: "IN_TRANSIT", failureCode: "TRACKING_UNAVAILABLE" } });
      const shipment = await prisma.shipment.create({ data: { orderId: key, carrier: "Legacy courier", trackingRef: "LEGACY-HOLD", status: "IN_TRANSIT" } });
      const previous = readFileSync(new URL("../../../../packages/database/prisma/migrations/20261109140000_admin_order_resolution/migration.sql", import.meta.url), "utf8");
      for (const name of ["preserve_admin_order_resolution", "preserve_admin_delivery_resolution"]) {
        const start = previous.indexOf(`CREATE FUNCTION ${name}`), end = previous.indexOf("\nCREATE TRIGGER", start);
        await prisma.$executeRawUnsafe(previous.slice(start, end).replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION"));
      }
      const legacyId = randomUUID();
      await prisma.$transaction(async tx => {
        await tx.tradeOrder.update({ where: { id: key }, data: { status: "CANCELLED", financialHold: true, adminResolution: { id: legacyId, outcome: "CANCELLED", financialAction: "HOLD", previousDeliveryStatus: "IN_TRANSIT" } } });
        await tx.delivery.update({ where: { id: delivery.id }, data: { status: "CANCELLED", failureCode: null } });
        await tx.shipment.update({ where: { id: shipment.id }, data: { status: "CANCELLED" } });
        await tx.auditLog.create({ data: { actorType: "admin", actorId: adminId, action: "order.admin.resolved", entityType: "order", entityId: key, requestId: randomUUID(), reason: "Original hold decision preserved" } });
      });
      const original = await prisma.orderRecordHistory.findFirstOrThrow({ where: { orderId: key, entityType: "order", action: "order.admin.resolved", kind: "UPDATE" } });
      const databaseRequire = createRequire(new URL("../../../../packages/database/package.json", import.meta.url));
      execFileSync(process.execPath, [databaseRequire.resolve("prisma/build/index.js"), "db", "execute", "--schema", fileURLToPath(new URL("../../../../packages/database/prisma/schema.prisma", import.meta.url)), "--file", fileURLToPath(new URL("../../../../packages/database/prisma/migrations/20261109190000_open_order_investigations/migration.sql", import.meta.url))], { env: process.env, stdio: "pipe" });
      expect(await prisma.tradeOrder.findUniqueOrThrow({ where: { id: key } })).toMatchObject({ status: "UNDER_INVESTIGATION", financialHold: true, heldMinor: 10000n, adminResolution: { outcome: "UNDER_INVESTIGATION" } });
      expect(await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).toMatchObject({ status: "IN_TRANSIT", failureCode: "TRACKING_UNAVAILABLE" });
      expect((await prisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } })).status).toBe("IN_TRANSIT");
      expect(await prisma.orderRecordHistory.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original);
      expect(await prisma.orderRecordHistory.count({ where: { orderId: key, action: "order.admin.investigation.migrated", actorType: "system" } })).toBeGreaterThan(0);
    });
    it("settles manual funds once without manufacturing buyer receipt evidence", async () => {
      for (const [outcome, financialAction] of [["COMPLETED", "RELEASE"], ["CANCELLED", "REFUND"]]) {
        const key = await newCase(true);
        const body = await decision(key, outcome, financialAction);
        const send = () => request(app).post(`/v1/admin/orders/${key}/resolve`).set(auth()).send(body);
        const responses = await Promise.all([send(), send()]);
        expect(responses.map(r => r.status)).toEqual([200, 200]);
        const order = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: key } });
        expect(order).toMatchObject({ status: outcome, heldMinor: 0n, deliveryConfirmedAt: null, receiptPhotoKey: null });
        expect(financialAction === "RELEASE" ? order.releasedMinor : order.refundedMinor).toBe(order.totalMinor);
        expect(await prisma.escrowEntry.count({ where: { orderId: key, kind: financialAction } })).toBe(1);
        expect((await request(app).post(`/v1/admin/orders/${key}/resolve`).set(auth()).send(await decision(key, outcome, financialAction))).status).toBe(409);
      }
    });
    it("keeps funds held for a dispute, then supports a justified decision after investigation", async () => {
      const key = await newCase(true);
      const ticket = await prisma.supportTicket.create({ data: { orderId: key, userId: buyerId, kind: "DISPUTE", subject: "Exceptional delivery investigation" } });
      const before = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: key } });
      expect((await request(app).post(`/v1/admin/orders/${key}/resolve`).set(auth()).send(await decision(key, "COMPLETED", "RELEASE"))).status).toBe(409);
      expect(await prisma.tradeOrder.findUniqueOrThrow({ where: { id: key } })).toEqual(before);
      expect((await request(app).post(`/v1/admin/orders/${key}/resolve`).set(auth()).send(await decision(key))).status).toBe(200);
      await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "RESOLVED" } });
      expect((await request(app).post(`/v1/admin/orders/${key}/resolve`).set(auth()).send(await decision(key, "COMPLETED", "RELEASE"))).status).toBe(200);
      expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: key } })).status).toBe("COMPLETED");
    });
    it("requires payment authority, fresh verification, evidence and confirmation", async () => {
      const key = await newCase();
      const path = `/v1/admin/orders/${key}/resolve`, body = await decision(key);
      const fresh = await createSession({ subject: "ADMIN", principalId: adminId, deviceId: randomUUID() });
      expect((await request(app).post(path).set("Authorization", `Bearer ${fresh.accessToken}`).send(body)).status).toBe(403);
      const grant = await prisma.permission.findUniqueOrThrow({ where: { code: "payments.manage" } });
      await prisma.rolePermission.delete({ where: { roleId_permissionId: { roleId, permissionId: grant.id } } });
      try { expect((await request(app).post(path).set(auth()).send(body)).status).toBe(403); }
      finally { await prisma.rolePermission.create({ data: { roleId, permissionId: grant.id } }); }
      for (const invalid of [{ ...body, confirmed: false }, { ...body, evidence: "" }, { ...body, reason: "" }, { ...body, outcome: "CANCELLED", financialAction: "RELEASE" }, { ...body, outcome: "COMPLETED", financialAction: "HOLD" }, { ...body, outcome: "CANCELLED", financialAction: "HOLD" }, { ...body, outcome: "UNDER_INVESTIGATION", financialAction: "REFUND" }])
        expect((await request(app).post(path).set(auth()).send(invalid)).status).toBe(422);
      expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: key } })).adminResolution).toBeNull();
    });
    it("rejects competing resolutions and releases unpaid stock only once", async () => {
      const key = await newCase(), base = await decision(key, "CANCELLED", "NONE");
      const responses = await Promise.all([base, { ...base, mutationKey: randomUUID(), outcome: "COMPLETED" }].map(body => request(app).post(`/v1/admin/orders/${key}/resolve`).set(auth()).send(body)));
      expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
      expect(await prisma.inventoryMovement.count({ where: { referenceId: key, type: { in: ["SALE", "RELEASE"] } } })).toBe(1);
    });
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
