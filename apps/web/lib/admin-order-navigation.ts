export type OperationsArea = "orders" | "logistics";

const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const detailRoute = new RegExp(`^(orders|logistics)/(${uuid})$`, "i");

export function operationsDetailRoute(route: string) {
  const match = detailRoute.exec(route);
  return match && ["orders", "logistics"].includes(match[1]) ? { area: match[1] as OperationsArea, id: match[2].toLowerCase() } : null;
}

/** Only return to a known staff workspace, never to a caller-provided external URL. */
export function adminRecordReturnPath(value: string | null, fallback: string) {
  if (!value?.startsWith("/admin/")) return fallback;
  try {
    const url = new URL(value, "https://admin.invalid");
    const operations = new RegExp(`^/admin/(orders|logistics)(?:/${uuid})?$`, "i");
    const finance = new RegExp(
      `^/admin/(reconciliation|withdrawals|reports)(?:/(?:orders/${uuid}|records/(?:payments|operations|recoveries)/${uuid}))?$`,
      "i",
    );
    if (url.origin === "https://admin.invalid" && (operations.test(url.pathname) || finance.test(url.pathname)))
      return url.pathname + url.search;
  } catch { /* An invalid return link falls back to the current queue. */ }
  return fallback;
}

export function operationsQueuePath(area: OperationsArea, params: URLSearchParams) {
  const query = new URLSearchParams();
  for (const key of ["search", "status", "farmer", "view", "page"]) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  return `/admin/${area}${query.size ? `?${query}` : ""}`;
}

export function operationsDetailLink(area: OperationsArea, id: string, returnTo?: string) {
  return `/admin/${area}/${encodeURIComponent(id)}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
}

/** Keep the originating queue filters without growing nested record links on each visit. */
export function operationsReturnQueue(value: string | null, area: OperationsArea) {
  for (let depth = 0; depth < 3; depth++) {
    const path = adminRecordReturnPath(value, "");
    if (!path) break;
    if (/^\/admin\/(orders|logistics)(\?|$)/.test(path)) return path;
    value = new URL(path, "https://admin.invalid").searchParams.get("returnTo");
  }
  return `/admin/${area}`;
}
