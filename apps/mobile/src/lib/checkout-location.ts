import {
  addressLocationSchema,
  normalizeDigitalPostcode,
  postcodeLookupSchema,
  postcodeReverseSchema,
} from "../../../../packages/contracts/src/addresses";
import { api } from "./api";
import { describePosition, type FarmPoint } from "./device-location";
import { postcodeLocation } from "./locations";

async function optionalLookup<T>(request: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request.catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 3000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Postcode lookup enriches a location; it never gates delivery or replaces a precise map address. */
export async function resolveCheckoutLocation(point: FarmPoint) {
  const place = await optionalLookup(describePosition(point));
  const details = {
    label: "Delivery location",
    line1: "",
    city: "",
    state: "",
    lga: "",
    line2: "",
    landmark: "",
    postalCode: "",
    ...place,
  };
  // A full device address needs neither a digital code nor a postcode-provider request.
  if (addressLocationSchema.safeParse(details).success)
    return { details, verificationToken: null };
  const reverse = await optionalLookup(api("/me/postcodes/reverse", {
    method: "POST",
    body: point,
    signal: AbortSignal.timeout(3000),
  }));
  const candidate = postcodeReverseSchema.safeParse(reverse);
  if (
    !candidate.success ||
    !candidate.data.found ||
    !candidate.data.candidate ||
    candidate.data.candidate.confidence !== "high"
  )
    return { details, verificationToken: null };
  const code = normalizeDigitalPostcode(candidate.data.candidate.postcode);
  if (!code) return { details, verificationToken: null };
  const response = await optionalLookup(api("/me/postcodes/lookup", {
    method: "POST",
    body: { code },
    signal: AbortSignal.timeout(3000),
  }));
  const checked = postcodeLookupSchema.safeParse(response);
  if (!checked.success || !checked.data.valid || checked.data.postcode !== code ||
    !checked.data.verificationToken) return { details, verificationToken: null };
  const lookup = checked.data;
  const fields = postcodeLocation(details, lookup.fields);
  const combined = { ...fields, ...place };
  const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  // A nearby postcode must not silently change the street or area resolved for the pin.
  if (
    (["line1", "city", "state", "lga"] as const).some(
      (key) => lookup.fields[key] && normalize(lookup.fields[key]!) !== normalize(combined[key]),
    )
  )
    return { details, verificationToken: null };
  return {
    details: { ...combined, postalCode: lookup.postcode },
    verificationToken: lookup.verificationToken || null,
  };
}
