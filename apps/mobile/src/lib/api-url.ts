/** Expo's Metro host is reachable by Expo Go on the same local network. */
export function resolveApiUrl(options: {
  explicitUrl?: string;
  hostUri?: string | null;
  platform: string;
  development: boolean;
}) {
  const explicit = options.explicitUrl?.trim().replace(/\/+$/, "");
  if (explicit) {
    const url = new URL(explicit);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("API URL must use HTTP or HTTPS.");
    if (!options.development && url.protocol !== "https:")
      throw new Error("Production API URL must use HTTPS.");
    return explicit;
  }
  if (!options.development)
    throw new Error("Set EXPO_PUBLIC_API_URL to your HTTPS backend before building a release.");
  if (options.hostUri) {
    const host = new URL(`http://${options.hostUri}`).hostname;
    // Only infer a backend on a local network. A Metro tunnel exposes Metro alone.
    const local =
      host === "localhost" ||
      host.endsWith(".local") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^\[(::1|f[cd][\da-f]*:)/i.test(host);
    if (!local)
      throw new Error(
        "Expo tunnel detected. Use Expo LAN mode on the same Wi-Fi, or set EXPO_PUBLIC_API_URL to a reachable backend.",
      );
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(host);
    return `http://${loopback && options.platform === "android" ? "10.0.2.2" : host}:3000`;
  }
  return options.platform === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";
}
