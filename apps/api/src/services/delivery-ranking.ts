type Quote = {
  id: string;
  courier: string;
  amountMinor: bigint;
  eta: string | null;
  expiresAt: Date;
  courierId?: string | null;
  quality?: unknown;
};

export function courierQuality(value: unknown) {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const bounded = (value: unknown, max: number) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max
      ? value
      : null;
  return {
    rating: bounded(source.rating, 5),
    votes:
      typeof source.votes === "number" && Number.isSafeInteger(source.votes) && source.votes > 0
        ? source.votes
        : 0,
    trackingLevel: bounded(source.trackingLevel, 10),
  };
}
function qualityPenalty(quote: Quote) {
  const quality = courierQuality(quote.quality);
  // Low-sample ratings are shrunk toward neutral; absent data is never displayed as a rating.
  const confidence = quality.votes / (quality.votes + 20);
  const rating =
    quality.rating !== null && quality.votes > 0
      ? (1 - quality.rating / 5) * confidence + 0.5 * (1 - confidence)
      : 0.5;
  const tracking = quality.trackingLevel !== null ? 1 - quality.trackingLevel / 10 : 0.5;
  return 0.7 * rating + 0.3 * tracking;
}
/** Compare the upper bound of the provider's estimate; working days remain estimates. */
export function estimatedHours(eta: string | null): number | null {
  if (!eta) return null;
  const text = eta.toLowerCase();
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?\s*(?:working\s+|business\s+)?(hours?|hrs?|h\b|days?|weeks?)/,
  );
  if (match)
    return (
      Number(match[2] || match[1]) *
      (match[3]!.startsWith("week") ? 168 : match[3]!.startsWith("day") ? 24 : 1)
    );
  if (/same day|today/.test(text)) return 24;
  if (/next day|tomorrow/.test(text)) return 48;
  return null;
}

/** Price 60%, ETA 30%, provider-rated service quality 10%. Only current offered quotes qualify. */
export function rankDeliveryQuotes<T extends Quote>(quotes: T[], now = new Date()) {
  const available = quotes.filter((quote) => quote.expiresAt > now && !!quote.courierId);
  const maxPrice = Math.max(1, ...available.map((quote) => Number(quote.amountMinor)));
  const maxHours = Math.max(1, ...available.map((quote) => estimatedHours(quote.eta) || 0));
  const score = (quote: T) =>
    (0.6 * Number(quote.amountMinor)) / maxPrice +
    0.3 * (estimatedHours(quote.eta) === null ? 1.1 : estimatedHours(quote.eta)! / maxHours) +
    0.1 * qualityPenalty(quote);
  const availableIds = new Set(available.map((quote) => quote.id));
  const sorted = [...quotes].sort((a, b) => {
    const liveA = availableIds.has(a.id),
      liveB = availableIds.has(b.id);
    if (liveA !== liveB) return liveA ? -1 : 1;
    if (liveA && score(a) !== score(b)) return score(a) - score(b);
    if (a.amountMinor !== b.amountMinor) return a.amountMinor < b.amountMinor ? -1 : 1;
    return a.courier.localeCompare(b.courier) || a.id.localeCompare(b.id);
  });
  const first = sorted.find((quote) => availableIds.has(quote.id));
  const qualityAdvantage =
    first &&
    estimatedHours(first.eta) !== null &&
    available.some(
      (other) =>
        other.id !== first.id &&
        other.amountMinor <= first.amountMinor &&
        estimatedHours(other.eta) !== null &&
        estimatedHours(other.eta)! <= estimatedHours(first.eta)! &&
        (other.amountMinor < first.amountMinor ||
          estimatedHours(other.eta)! < estimatedHours(first.eta)!) &&
        qualityPenalty(first) < qualityPenalty(other),
    );
  const hasQuality = available.some((quote) => {
    const quality = courierQuality(quote.quality);
    return (quality.rating !== null && quality.votes > 0) || quality.trackingLevel !== null;
  });
  return sorted.map((quote) => ({
    ...quote,
    recommended: quote.id === first?.id,
    recommendationReason:
      quote.id === first?.id
        ? qualityAdvantage
          ? "Higher provider-rated service quality offsets the price and delivery estimate"
          : estimatedHours(quote.eta) === null
            ? "Best available value; delivery estimate unavailable"
            : hasQuality
              ? "Best value based on price, estimated time and provider quality"
              : "Best value based on price and estimated delivery time"
        : null,
  }));
}
