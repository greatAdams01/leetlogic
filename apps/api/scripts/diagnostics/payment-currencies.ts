/** Sandbox-only, read-only currency audit; never prints private hosted URLs. */
import { prisma } from "@leetlogic/database";
import { bachs } from "../../src/providers/payments/bachs.js";
import { getConfig } from "../../src/config.js";
const c = getConfig();
if (c.BACHS_MODE !== "sandbox" || !c.BACHS_API_KEY?.startsWith("sk_sandbox_"))
  throw new Error("Sandbox key and mode required");
const currencies = (v: any): any => {
  if (!v || typeof v !== "object") return undefined;
  return Object.fromEntries(
    Object.entries(v)
      .filter(([k]) =>
        /currency|currencies|settlement|adaptive_pricing|payment_method_types|enabled_payment_methods/.test(
          k,
        ),
      )
      .map(([k, v]) => [k, v]),
  );
};
try {
  const account = await bachs.account();
  const settings = await bachs.call("/accounts/checkout/settings");
  const attempts = await prisma.paymentAttempt.findMany({
    where: { mode: "sandbox", kind: "ORDER", checkoutId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const rows = [];
  for (const p of attempts) {
    const checkout = await bachs.checkoutState(p.checkoutId!);
    const payment = p.chargeId ? await bachs.payment(p.chargeId) : null;
    const rawUrl = checkout.checkout_url || p.checkoutUrl;
    const url = rawUrl ? new URL(rawUrl) : null;
    rows.push({
      attemptId: p.id,
      status: p.status,
      createdAt: p.createdAt,
      host: url?.hostname,
      pathPrefix: url?.pathname.split("/")[1],
      checkoutFields: Object.keys(checkout),
      checkout: currencies(checkout),
      pricing: currencies(checkout.pricing),
      charge: currencies(payment),
      chargeStatus: payment?.status,
    });
  }
  console.log(
    JSON.stringify(
      {
        mode: c.BACHS_MODE,
        organizationMatches: account.id === c.BACHS_ORGANIZATION_ID,
        accountFields: Object.keys(account),
        settingsFields: Object.keys(settings),
        account: currencies(account),
        settings: currencies(settings),
        rows,
      },
      null,
      2,
    ),
  );
} catch (e: any) {
  console.log(JSON.stringify({ error: e.code || e.name, diagnostics: e.diagnostics }));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
