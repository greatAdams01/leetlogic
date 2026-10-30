import { saleUnitLabel } from "../../../../packages/contracts/src/sale-packaging";
import type { ListingForm, ListingUnit } from "./listing-form";
import { emptyPacking, packingError } from "./packaging";
import { quantity, toMinor, money } from "./domain";

export type VoiceField =
  | "title"
  | "categoryId"
  | "description"
  | "unitCode"
  | "quantity"
  | "price"
  | "addressId"
  | "shippingScope"
  | "packing"
  | "unitsPerPackage"
  | "weightKg"
  | "length"
  | "width"
  | "height"
  | "handling";
export type VoiceCatalogue = {
  categories: { id: string; slug: string; translations: { locale: string; name: string }[] }[];
  units: ListingUnit[];
  addresses: { id: string; line1: string; city: string; lga: string; state: string }[];
};
// Prompts, grammar and parsers belong to a locale profile. Only English is enabled.
export const englishListing = {
  locale: "en" as const,
  fields: [
    "title",
    "categoryId",
    "description",
    "unitCode",
    "quantity",
    "price",
    "addressId",
    "shippingScope",
    "packing",
    "unitsPerPackage",
    "weightKg",
    "length",
    "width",
    "height",
    "handling",
  ] as VoiceField[],
  prompts: {
    title: "What produce would you like to sell?",
    categoryId: "Which category is your produce in?",
    description: "Tell buyers about the variety, freshness and condition of your produce.",
    unitCode:
      "What unit will you sell by? For example, kilogram, bag, basket, crate, tonne, piece, bunch or litre. A tuber counts as one piece.",
    quantity: "How many selling units do you have available? Say only the number.",
    price: "What is your price in naira for one selling unit? Say only the amount in naira.",
    addressId: "Which saved farm address should we use? Say its number.",
    shippingScope:
      "Will you offer delivery within your state only, or nationwide? Say local or nationwide.",
    packing:
      "Do you know the measurements of one packed package? Say yes to enter them, or say help to ask our team. Buyers cannot purchase until our team completes the measurements.",
    unitsPerPackage: "How many selling units are in one package? Say only the number.",
    weightKg:
      "What is the total weight of one packed package in kilograms, including its packaging?",
    length: "What is the length of one package in centimetres?",
    width: "What is the width of one package in centimetres?",
    height: "What is the height of one package in centimetres?",
    handling:
      "What handling does your produce need? Say standard, perishable, cold chain, or bulk.",
  } satisfies Record<VoiceField, string>,
};
const small: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
export function cleanSpeech(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?]+$/g, "")
    .replace(/&/g, " and ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}
/** Strict number grammar: never take the first number out of a mixed/ambiguous answer. */
export function spokenNumber(text: string): string | null {
  const cleaned = cleanSpeech(text);
  if (cleaned.includes(",") && !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) return null;
  const value = cleaned.replace(/,/g, "");
  if (/^\d+(\.\d+)?$/.test(value)) return value;
  const parts = value.split(" point ");
  if (parts.length > 2) return null;
  const words = parts[0]!.split(" ");
  let total = 0,
    group = 0,
    last = "",
    lastScale = Infinity;
  for (const word of words) {
    if (word === "and" && ["hundred", "thousand", "million"].includes(last)) {
      last = word;
      continue;
    }
    if (word in small) {
      const n = small[word]!;
      if (last in small && !(small[last]! >= 20 && small[last]! % 10 === 0 && n > 0 && n < 10))
        return null;
      group += n;
    } else if (word === "hundred") {
      if (!(last in small) || group < 1 || group > 9) return null;
      group *= 100;
    } else if (word === "thousand" || word === "million") {
      const scale = word === "million" ? 1_000_000 : 1000;
      if (!group || scale >= lastScale) return null;
      total += group * scale;
      group = 0;
      lastScale = scale;
    } else return null;
    last = word;
  }
  if (last === "and") return null;
  let result = String(total + group);
  if (parts[1] !== undefined) {
    const decimal = parts[1]
      .split(" ")
      .map((word) =>
        /^\d$/.test(word)
          ? word
          : small[word] !== undefined && small[word]! < 10
            ? String(small[word])
            : null,
      );
    if (!decimal.length || decimal.some((x) => x === null)) return null;
    result += `.${decimal.join("")}`;
  }
  return result;
}
export function voiceCommand(text: string): "yes" | "no" | "repeat" | "back" | null {
  const value = cleanSpeech(text);
  if (["yes", "correct", "that's correct", "that is correct"].includes(value)) return "yes";
  if (["no", "incorrect", "that's wrong", "that is wrong"].includes(value)) return "no";
  if (["repeat", "say again"].includes(value)) return "repeat";
  if (["back", "previous"].includes(value)) return "back";
  return null;
}
const unitAliases: Record<string, string> = {
  kg: "KG",
  kilogram: "KG",
  kilograms: "KG",
  kilo: "KG",
  kilos: "KG",
  bag: "BAG",
  bags: "BAG",
  basket: "BASKET",
  baskets: "BASKET",
  crate: "CRATE",
  crates: "CRATE",
  tonne: "TONNE",
  tonnes: "TONNE",
  ton: "TONNE",
  tons: "TONNE",
  piece: "PIECE",
  pieces: "PIECE",
  tuber: "PIECE",
  tubers: "PIECE",
  bunch: "BUNCH",
  bunches: "BUNCH",
  litre: "LITRE",
  litres: "LITRE",
  liter: "LITRE",
  liters: "LITRE",
};
export type VoiceAnswer = { value: string; spoken: string };
export function interpretAnswer(
  field: VoiceField,
  raw: string,
  form: ListingForm,
  catalogue: VoiceCatalogue,
): VoiceAnswer | null {
  const text = cleanSpeech(raw);
  if (field === "title" || field === "description") {
    const value = raw
      .trim()
      .replace(field === "title" ? /^(i want to sell|i am selling|i'm selling)\s+/i : /^$/, "");
    return value.length >= 2 && value.length <= (field === "title" ? 160 : 5000)
      ? { value, spoken: value }
      : null;
  }
  if (field === "categoryId") {
    const position = spokenNumber(text);
    if (position && /^\d+$/.test(position)) {
      const category = catalogue.categories[Number(position) - 1];
      return category
        ? {
            value: category.id,
            spoken: category.translations.find((t) => t.locale === "en")?.name || category.slug,
          }
        : null;
    }
    const matches = catalogue.categories.filter((c) =>
      [
        c.slug.replace(/-/g, " "),
        ...c.translations.filter((t) => t.locale === "en").map((t) => cleanSpeech(t.name)),
      ].includes(text),
    );
    return matches.length === 1
      ? {
          value: matches[0]!.id,
          spoken: matches[0]!.translations.find((t) => t.locale === "en")?.name || matches[0]!.slug,
        }
      : null;
  }
  if (field === "unitCode") {
    const value = unitAliases[text];
    return value && catalogue.units.some((u) => u.code === value)
      ? { value, spoken: value === "PIECE" ? "pieces; each tuber is one piece" : text }
      : null;
  }
  if (field === "shippingScope") {
    const value = text === "local" ? "LOCAL" : text === "nationwide" ? "NATIONWIDE" : null;
    return value
      ? {
          value,
          spoken: value === "LOCAL" ? "delivery within your farm's state" : "nationwide delivery",
        }
      : null;
  }
  if (field === "packing") {
    if (["help", "i don't know", "i do not know"].includes(text))
      return {
        value: "assistance",
        spoken:
          "ask the team to complete package measurements. Buyers cannot purchase until this is done",
      };
    return voiceCommand(text) === "yes"
      ? { value: "measured", spoken: "enter your package measurements now" }
      : null;
  }
  if (field === "handling") {
    const value = (
      {
        standard: "STANDARD",
        perishable: "PERISHABLE",
        "cold chain": "COLD_CHAIN",
        bulk: "BULK",
      } as const
    )[text as "standard"];
    return value ? { value, spoken: text } : null;
  }
  const number = spokenNumber(text);
  if (!number || !Number.isFinite(Number(number)) || Number(number) <= 0) return null;
  if (field === "addressId") {
    const address = /^\d+$/.test(number) ? catalogue.addresses[Number(number) - 1] : undefined;
    return address
      ? {
          value: address.id,
          spoken: `${address.line1}, ${address.city}, ${address.lga}, ${address.state}`,
        }
      : null;
  }
  if (field === "quantity") {
    try {
      quantity(number);
    } catch {
      return null;
    }
    const unit = catalogue.units.find((u) => u.code === form.unitCode);
    if (!unit || (!unit.allowsDecimal && !/^\d+$/.test(number))) return null;
  } else if (field === "price") {
    try {
      toMinor(number);
    } catch {
      return null;
    }
  } else {
    if (Number(number) > (["length", "width", "height"].includes(field) ? 1000 : 1_000_000))
      return null;
    if (
      field === "unitsPerPackage" &&
      (!/^\d+(\.\d{1,3})?$/.test(number) ||
        (!catalogue.units.find((u) => u.code === form.unitCode)?.allowsDecimal &&
          !/^\d+$/.test(number)))
    )
      return null;
    if (
      field === "weightKg" &&
      form.unitCode === "KG" &&
      Number(number) < Number(form.packaging?.unitsPerPackage)
    )
      return null;
  }
  return {
    value: number,
    spoken:
      field === "price"
        ? `${number} naira per ${form.unitCode}`
        : field === "quantity"
          ? `${number} ${form.unitCode}`
          : `${number}${field === "weightKg" ? " kilograms" : ["length", "width", "height"].includes(field) ? " centimetres" : ""}`,
  };
}
export function commitAnswer(
  form: ListingForm,
  field: VoiceField,
  answer: VoiceAnswer,
): ListingForm {
  if (field === "categoryId" && form.categoryId !== answer.value)
    return {
      ...form,
      categoryId: answer.value,
      salePackaging: undefined,
      unitCode: "",
      quantity: "",
      price: "",
      packaging: { ...emptyPacking },
    };
  if (field === "packing")
    return {
      ...form,
      packingAssistanceRequested: answer.value === "assistance",
      packaging: { ...emptyPacking },
    };
  if (["unitsPerPackage", "weightKg", "length", "width", "height", "handling"].includes(field))
    return { ...form, packaging: { ...(form.packaging || emptyPacking), [field]: answer.value } };
  // Unit changes require fresh confirmations for dependent quantities and money.
  if (field === "unitCode" && form.unitCode !== answer.value)
    return {
      ...form,
      unitCode: answer.value,
      salePackaging: undefined,
      quantity: "",
      price: "",
      packaging: { ...emptyPacking },
      packingAssistanceRequested: false,
    };
  return { ...form, [field]: answer.value };
}
export function voiceFields(form: ListingForm) {
  return englishListing.fields.filter(
    (field) =>
      !form.packingAssistanceRequested ||
      !["unitsPerPackage", "weightKg", "length", "width", "height", "handling"].includes(field),
  );
}
export function listingReadback(form: ListingForm, catalogue: VoiceCatalogue): string {
  const address = catalogue.addresses.find((a) => a.id === form.addressId);
  return `Your listing: ${form.title}. ${form.description}. Category: ${catalogue.categories.find((c) => c.id === form.categoryId)?.translations.find((t) => t.locale === "en")?.name || "not selected"}. Available: ${form.quantity} ${form.unitCode}. Price: ${/^\d+(\.\d{1,2})?$/.test(form.price) && Number(form.price) > 0 ? money(toMinor(form.price)) : "not entered"} per ${saleUnitLabel(form.salePackaging) || form.unitCode}. Pickup: ${address ? `${address.line1}, ${address.city}, ${address.state}` : "missing farm address"}. Delivery: ${form.shippingScope === "LOCAL" ? "within your state" : "nationwide"}. ${form.packingAssistanceRequested ? "The team must complete package measurements before buyers can purchase." : packingError(form.packaging) ? "Package measurements are incomplete." : `Each package contains ${form.packaging!.unitsPerPackage} selling units, weighs ${form.packaging!.weightKg} kilograms, and measures ${form.packaging!.length} by ${form.packaging!.width} by ${form.packaging!.height} centimetres. Handling: ${form.packaging!.handling.replace(/_/g, " ")}.`} ${form.photos.length} photos. Review and correct any details. Only the submit button can send your listing for review.`;
}
