/** Exact hosted-payment origins only; link paths and queries contain private credentials. */
export function isHostedPaymentUrl(
  value: string,
  type: "checkout" | "onboarding" = "onboarding",
  mode?: "sandbox" | "live",
) {
  try {
    const url = new URL(value);
    const hosts =
      type === "checkout"
        ? ["checkout.bachs.io"]
        : [
            "connect.bachs.io",
            "app.bachs.io",
            "checkout.bachs.io",
            ...(mode !== "live" ? ["sandbox-connect.bachs.io"] : []),
          ];
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      hosts.includes(url.hostname)
    );
  } catch {
    return false;
  }
}
