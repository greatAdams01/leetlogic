import { bachs } from "../providers/payments/bachs.js";
import { getConfig } from "../config.js";

const cache = new Map<string, { until: number; names: Promise<Map<string, string>> }>();
/** Resolve older destinations too: Bachs may omit bank_name on a verified destination. */
export async function bankName(code: string, stored?: string): Promise<string> {
  if (stored?.trim() && stored.trim().toLowerCase() !== "bank") return stored.trim();
  const mode = getConfig().BACHS_MODE;
  let entry = cache.get(mode);
  if (!entry || entry.until < Date.now()) {
    const names = bachs.banks().then((result) => {
      const rows = Array.isArray(result) ? result : result.banks || result.data || [];
      return new Map<string, string>(
        (Array.isArray(rows) ? rows : [])
          .filter((row: any) => typeof row.code === "string" && typeof row.name === "string")
          .map((row: any) => [row.code, row.name]),
      );
    });
    entry = { until: Date.now() + 3600000, names };
    cache.set(mode, entry);
    names.catch(() => {
      if (cache.get(mode) === entry) cache.delete(mode);
    });
  }
  try {
    return (await entry.names).get(code) || `Bank (${code})`;
  } catch {
    return `Bank (${code})`;
  }
}
