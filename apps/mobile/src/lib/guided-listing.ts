import { packagingOptions, packageUnitCode, salePackagingMatches, salePackagingSchema, saleUnitLabel, minimumPackedWeight } from "../../../../packages/contracts/src/sale-packaging";
import { commissionRate, estimateSale } from "../../../../packages/contracts/src/sale-earnings";
import type { ListingForm, ListingUnit } from "./listing-form";
import { emptyPacking, packingError, produceTotal } from "./packaging";
import { quantity, toMinor, money } from "./domain";

export type VoiceField =
  | "title"
  | "categoryId"
  | "description"
  | "salePackaging"
  | "salePackageLabel"
  | "salePackageMeasure"
  | "salePackageSize"
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
  categories: { id: string; slug: string; translations: { locale: string; name: string }[]; explanation?: string; produceItems?: string[] }[];
  units: ListingUnit[];
  addresses: { id: string; line1: string; city: string; lga: string; state: string }[];
  commissionBasisPoints?: number;
};
export const voicePackagingOptions = (categorySlug: string, title: string, catalogue: VoiceCatalogue) =>
  packagingOptions(categorySlug, title).filter((option) => option.value === "CUSTOM" || packageUnitCode(option, catalogue.units));

export function guidedProduceChoices(catalogue: VoiceCatalogue, categoryId: string) {
  const category = catalogue.categories.find(c => c.id === categoryId);
  return (category?.produceItems || []).map(title => ({ title, categoryId }));
}

export function guidedListingForm(form: ListingForm, catalogue: VoiceCatalogue): ListingForm {
  const needsMeasurements = voiceFields(form, catalogue).includes("weightKg");
  return {
    ...form,
    // Never estimate courier dimensions. Staff completes these before sales are enabled.
    packingAssistanceRequested: form.packingAssistanceRequested || needsMeasurements,
    addressId: form.addressId || (catalogue.addresses.length === 1 ? catalogue.addresses[0]!.id : ""),
    voiceCursor: /^(?:change:)?(?:packing|unitsPerPackage|weightKg|length|width|height|handling)$/.test(form.voiceCursor || "")
      ? undefined : form.voiceCursor,
  };
}
// Prompts, grammar and parsers belong to a locale profile. Only English is enabled.
export const englishListing = {
  locale: "en" as const,
  fields: [
    "categoryId",
    "title",
    "description",
    "salePackaging",
    "salePackageLabel",
    "salePackageMeasure",
    "salePackageSize",
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
    salePackaging: "How do you sell this produce? Choose the package type from the numbered options.",
    salePackageLabel: "What should we call this custom selling package?",
    salePackageMeasure: "Is the custom package measured in kilograms, litres, or pieces?",
    salePackageSize: "How much produce is in one selling package? The suggested sizes are examples; you can say another size.",
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
  if (["half", "a half"].includes(cleaned)) return "0.5";
  const mixedHalf = /^(.*?) and a half$/.exec(cleaned);
  if (mixedHalf) {
    const whole = spokenNumber(mixedHalf[1]!);
    return whole && Number.isInteger(Number(whole)) ? String(Number(whole) + 0.5) : null;
  }
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
const packageAliases: Record<string, string[]> = {
  BAG: ["bag", "bags"], SACK: ["sack", "sacks", "bag", "bags"],
  BASKET: ["basket", "baskets"], CRATE: ["crate", "crates"], CARTON: ["carton", "cartons"],
  BUNCH: ["bunch", "bunches"], BUNDLE: ["bundle", "bundles"], PIECE: ["piece", "pieces", "tuber", "tubers"],
  BOTTLE: ["bottle", "bottles"], CONTAINER: ["container", "containers", "jerrycan", "jerrycans"],
  KG: ["kilogram", "kilograms", "kilo", "kilos", "kg"], TONNE: ["tonne", "tonnes", "ton", "tons"],
  LITRE: ["litre", "litres", "liter", "liters", "l"],
};
const packageWords = (form: ListingForm) => [
  ...(packageAliases[form.salePackaging?.type || form.unitCode] || []),
  ...(form.salePackaging?.type === "CUSTOM" && form.salePackaging.customLabel
    ? [cleanSpeech(form.salePackaging.customLabel)]
    : []),
];
const measureWords: Record<NonNullable<ListingForm["salePackaging"]>["measure"], string[]> = {
  KG: ["kg", "kilo", "kilos", "kilogram", "kilograms"],
  LITRE: ["l", "litre", "litres", "liter", "liters"],
  PIECE: ["piece", "pieces"],
};
function contextualNumber(field: VoiceField, raw: string, form: ListingForm): string | null {
  let text = cleanSpeech(raw).replace(/^₦\s*/, "");
  if (field === "salePackageSize") {
    const each = /^(?:each|one)\s+(.+?)\s+(?:contains|has|is)\s+(.+)$/.exec(text);
    if (each) {
      if (!packageWords(form).includes(each[1]!)) return null;
      text = each[2]!;
    }
    const per = /\s+per\s+(.+)$/.exec(text);
    if (per) {
      if (!packageWords(form).includes(per[1]!)) return null;
      text = text.slice(0, per.index);
    }
    const tonnes = /\s+(?:a\s+)?(tonnes?|tons?)$/.exec(text);
    if (tonnes) {
      if (form.salePackaging?.measure !== "KG") return null;
      const amount = spokenNumber(text.slice(0, tonnes.index));
      return amount ? String(Number(amount) * 1000) : null;
    }
    const measure = form.salePackaging?.measure;
    const suffix = measure && measureWords[measure].find((word) => text.endsWith(` ${word}`));
    if (suffix) text = text.slice(0, -(suffix.length + 1));
    else if (/\s+(?:kg|kilos?|kilograms?|litres?|liters?|pieces?)$/.test(text)) return null;
  } else if (field === "quantity" || field === "unitsPerPackage") {
    const suffix = packageWords(form).sort((a, b) => b.length - a.length).find((word) => text.endsWith(` ${word}`));
    if (suffix) text = text.slice(0, -(suffix.length + 1));
    else if (/\s+[a-z]+$/.test(text) && /\b(?:bags?|sacks?|baskets?|crates?|cartons?|bunches?|bundles?|pieces?|tubers?|bottles?|containers?)$/.test(text)) return null;
  } else if (field === "price") {
    text = text.replace(/\s+(?:naira|ngn)$/i, "");
    const per = /\s+per\s+(.+)$/.exec(text);
    if (per) {
      if (!packageWords(form).includes(per[1]!)) return null;
      text = text.slice(0, per.index);
    }
    const shorthand = /^(\d+(?:\.\d+)?)k$/.exec(text);
    if (shorthand) return String(Number(shorthand[1]) * 1000);
  } else if (field === "weightKg" || ["length", "width", "height"].includes(field)) {
    const words = field === "weightKg"
      ? measureWords.KG
      : ["cm", "centimetre", "centimetres", "centimeter", "centimeters"];
    const suffix = words.find((word) => text.endsWith(` ${word}`));
    if (suffix) text = text.slice(0, -(suffix.length + 1));
  }
  return spokenNumber(text);
}
export type VoiceAnswer = { value: string; spoken: string };
export function interpretAnswer(
  field: VoiceField,
  raw: string,
  form: ListingForm,
  catalogue: VoiceCatalogue,
): VoiceAnswer | null {
  const text = cleanSpeech(raw);
  if (field === "title") {
    const spoken = cleanSpeech(raw.replace(/^(i want to sell|i am selling|i'm selling)\s+/i, ""));
    const matches = guidedProduceChoices(catalogue, form.categoryId).filter(p => cleanSpeech(p.title) === spoken);
    return matches.length === 1 ? { value: matches[0]!.title, spoken: matches[0]!.title } : null;
  }
  if (field === "description") {
    const value = raw
      .trim()
      .replace(/^$/, "");
    return value.length >= 2 && value.length <= 5000
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
  if (field === "salePackaging") {
    const category = catalogue.categories.find((item) => item.id === form.categoryId);
    if (!category) return null;
    const options = voicePackagingOptions(category.slug, form.title, catalogue);
    const position = spokenNumber(text);
    const selected = position && /^\d+$/.test(position)
      ? options[Number(position) - 1]
      : options.find((option) => cleanSpeech(option.label) === text || cleanSpeech(option.value) === text);
    const unitCode = selected && packageUnitCode(selected, catalogue.units);
    return selected && unitCode
      ? {
          value: JSON.stringify({
            salePackaging: {
              type: selected.value,
              size: selected.sizes.length === 1 ? selected.sizes[0]! : 0,
              measure: selected.measure,
              ...(selected.value === "CUSTOM" ? { customLabel: "" } : {}),
            },
            unitCode,
          }),
          spoken: selected.label,
        }
      : null;
  }
  if (field === "salePackageLabel") {
    const value = raw.trim();
    return value.length >= 2 && value.length <= 80 ? { value, spoken: value } : null;
  }
  if (field === "salePackageMeasure") {
    const measure = ({
      kg: "KG", kilogram: "KG", kilograms: "KG", kilo: "KG", kilos: "KG",
      litre: "LITRE", litres: "LITRE", liter: "LITRE", liters: "LITRE", l: "LITRE",
      piece: "PIECE", pieces: "PIECE",
    } as Record<string, "KG" | "LITRE" | "PIECE">)[text];
    return measure ? { value: measure, spoken: measure === "KG" ? "kilograms" : measure === "LITRE" ? "litres" : "pieces" } : null;
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
  const number = contextualNumber(field, raw, form);
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
  if (field === "salePackageSize") {
    const category = catalogue.categories.find((item) => item.id === form.categoryId);
    const option = category && voicePackagingOptions(category.slug, form.title, catalogue).find((item) => item.value === form.salePackaging?.type);
    const measure = option?.value === "CUSTOM" ? form.salePackaging?.measure : option?.measure;
    if (!option || Number(number) > 1_000_000 || !/^\d+(\.\d{1,3})?$/.test(number) ||
      (option.sizes.length === 1 && Number(number) !== option.sizes[0]) ||
      (measure === "PIECE" && !Number.isInteger(Number(number)))) return null;
    const unitCode = packageUnitCode(option, catalogue.units);
    if (!unitCode) return null;
    const size = Number(number);
    const salePackaging = { ...form.salePackaging, type: option.value, size, measure: measure! } as const;
    return { value: JSON.stringify({ salePackaging, unitCode }), spoken: `${size} ${measure!.toLowerCase()} per ${option.label.toLowerCase()}` };
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
      title: "",
      salePackaging: undefined,
      unitCode: "",
      quantity: "",
      price: "",
      packaging: { ...emptyPacking },
      packingAssistanceRequested: false,
    };
  if (field === "title" && form.title !== answer.value)
    return { ...form, title: answer.value, salePackaging: undefined, unitCode: "", quantity: "", price: "", packaging: { ...emptyPacking } };
  if (field === "packing")
    return {
      ...form,
      packingAssistanceRequested: answer.value === "assistance",
      packaging: { ...emptyPacking },
    };
  if (field === "salePackaging") {
    const { salePackaging, unitCode } = JSON.parse(answer.value) as { salePackaging: NonNullable<ListingForm["salePackaging"]>; unitCode: string };
    return { ...form, salePackaging, unitCode, quantity: "", price: "", packaging: { ...emptyPacking } };
  }
  if (field === "salePackageLabel" || field === "salePackageMeasure") {
    if (!form.salePackaging || form.salePackaging.type !== "CUSTOM") return form;
    return {
      ...form,
      salePackaging: {
        ...form.salePackaging!,
        ...(field === "salePackageLabel" ? { customLabel: answer.value } : { measure: answer.value as "KG" | "LITRE" | "PIECE" }),
      },
      quantity: "",
      price: "",
      packaging: { ...emptyPacking },
    };
  }
  if (field === "salePackageSize") {
    const { salePackaging, unitCode } = JSON.parse(answer.value) as { salePackaging: NonNullable<ListingForm["salePackaging"]>; unitCode: string };
    return { ...form, salePackaging, unitCode, quantity: "", price: "", packaging: { ...emptyPacking } };
  }
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
export function voiceFields(form: ListingForm, catalogue?: VoiceCatalogue) {
  const packingStarted = !!form.packaging && [form.packaging.unitsPerPackage, form.packaging.weightKg, form.packaging.length, form.packaging.width, form.packaging.height].some(Boolean);
  const packingComplete = form.packingAssistanceRequested || (!!form.packaging && !packingError(form.packaging) &&
    Number(form.packaging.weightKg) >= Math.max(
      form.unitCode === "KG" ? Number(form.packaging.unitsPerPackage) : 0,
      minimumPackedWeight(form.salePackaging, Number(form.packaging.unitsPerPackage)),
    ) && (!catalogue || !!catalogue.units.find((unit) => unit.code === form.unitCode)?.allowsDecimal || Number.isInteger(Number(form.packaging.unitsPerPackage))));
  return englishListing.fields.filter(
    (field) =>
      (form.salePackaging?.type === "CUSTOM" || !["salePackageLabel", "salePackageMeasure"].includes(field)) &&
      (!packingComplete || !["packing", "unitsPerPackage", "weightKg", "length", "width", "height", "handling"].includes(field)) &&
      !(packingStarted && field === "packing"),
  );
}
export function firstIncompleteVoiceField(form: ListingForm, catalogue: VoiceCatalogue): VoiceField | null {
  const selectedCategory = catalogue.categories.find(c => c.id === form.categoryId);
  if (!selectedCategory) return "categoryId";
  if (form.voiceCursor === "change:categoryId") return "categoryId";
  if (!guidedProduceChoices(catalogue, form.categoryId).some(p => p.title === form.title)) return "title";
  const correction = /^change:(.+)$/.exec(form.voiceCursor || "");
  if (correction && englishListing.fields.includes(correction[1] as VoiceField)) return correction[1] as VoiceField;
  if (form.salePackaging?.type === "CUSTOM" && form.voiceCursor === "salePackageMeasure") return "salePackageMeasure";
  const category = catalogue.categories.find((item) => item.id === form.categoryId);
  const option = category && voicePackagingOptions(category.slug, form.title, catalogue).find((item) => item.value === form.salePackaging?.type);
  const packageTypeValid = !!category && !!form.salePackaging && salePackagingMatches(form.salePackaging, category.slug, form.title, form.unitCode);
  const sizeValid = !!option && !!form.salePackaging && salePackagingSchema.safeParse(form.salePackaging).success &&
    (option.sizes.length !== 1 || form.salePackaging.size === option.sizes[0]);
  const packed = form.packaging || emptyPacking;
  const packingStarted = [packed.unitsPerPackage, packed.weightKg, packed.length, packed.width, packed.height].some(Boolean);
  for (const field of voiceFields(form, catalogue)) {
    if (field === "title" && (form.title.trim().length < 2 || form.title.length > 160)) return field;
    if (field === "categoryId" && !category) return field;
    if (field === "description" && (!form.description.trim() || form.description.length > 5000)) return field;
    if (field === "salePackaging" && !packageTypeValid) return field;
    if (field === "salePackageLabel" && !form.salePackaging?.customLabel?.trim()) return field;
    if (field === "salePackageSize" && (!packageTypeValid || !sizeValid)) return field;
    if (field === "quantity") {
      try { quantity(form.quantity); } catch { return field; }
      if (!catalogue.units.find((unit) => unit.code === form.unitCode)?.allowsDecimal && !/^\d+$/.test(form.quantity)) return field;
    }
    if (field === "price") { try { if (BigInt(toMinor(form.price)) <= 0n) return field; } catch { return field; } }
    if (field === "addressId" && !catalogue.addresses.some((item) => item.id === form.addressId)) return field;
    if (field === "shippingScope" && !["LOCAL", "NATIONWIDE"].includes(form.shippingScope)) return field;
    if (field === "packing" && !packingStarted && !form.packingAssistanceRequested) return field;
    if (field === "unitsPerPackage" && (!/^\d+(\.\d{1,3})?$/.test(packed.unitsPerPackage) || Number(packed.unitsPerPackage) <= 0 || Number(packed.unitsPerPackage) > 1_000_000 || (!catalogue.units.find((unit) => unit.code === form.unitCode)?.allowsDecimal && !/^\d+$/.test(packed.unitsPerPackage)))) return field;
    if (field === "weightKg" && (!/^\d+(\.\d+)?$/.test(packed.weightKg) || Number(packed.weightKg) <= 0 || Number(packed.weightKg) > 1_000_000 || Number(packed.weightKg) < Math.max(form.unitCode === "KG" ? Number(packed.unitsPerPackage) : 0, minimumPackedWeight(form.salePackaging, Number(packed.unitsPerPackage))))) return field;
    if (["length", "width", "height"].includes(field) && (!/^\d+(\.\d+)?$/.test(packed[field as "length" | "width" | "height"]) || Number(packed[field as "length" | "width" | "height"]) <= 0 || Number(packed[field as "length" | "width" | "height"]) > 1000)) return field;
  }
  return null;
}
export function listingReadback(form: ListingForm, catalogue: VoiceCatalogue): string {
  const address = catalogue.addresses.find((a) => a.id === form.addressId);
  const price = /^\d+(\.\d{1,2})?$/.test(form.price) && Number(form.price) > 0 ? toMinor(form.price) : null;
  const earnings = price && catalogue.commissionBasisPoints !== undefined ? estimateSale(BigInt(price), catalogue.commissionBasisPoints) : null;
  const commission = earnings ? `Estimated Leetlogic commission: ${money(earnings.commissionMinor)} (${commissionRate(catalogue.commissionBasisPoints!)}). From ${money(earnings.grossMinor)}, estimated earnings are ${money(earnings.netMinor)} per selling unit.` : "Commission estimate is unavailable.";
  const packageDescription = form.salePackaging ? saleUnitLabel(form.salePackaging) : form.unitCode;
  const stockWeight = form.salePackaging?.measure === "KG" && Number(form.quantity) > 0
    ? new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(Number(form.salePackaging.size) * Number(form.quantity))
    : null;
  const stockValue = price ? produceTotal(form.quantity, price) : null;
  return `Your listing: ${form.title}. ${form.description}. Category: ${catalogue.categories.find((c) => c.id === form.categoryId)?.translations.find((t) => t.locale === "en")?.name || "not selected"}. Available: ${form.quantity} ${packageDescription}. Price: ${price ? money(price) : "not entered"} per ${packageDescription}. ${stockWeight ? `Total produce stock: ${stockWeight} kilograms. ` : ""}${stockValue ? `Gross stock value before commission: ${money(stockValue)}. ` : ""}${commission} Pickup: ${address ? `${address.line1}, ${address.city}, ${address.state}` : "missing farm address"}. Delivery: ${form.shippingScope === "LOCAL" ? "within your state" : "nationwide"}. ${form.packingAssistanceRequested ? "Our team will complete missing measurements during listing review before approving it for buyers." : packingError(form.packaging) ? "Package measurements are incomplete." : `Each courier package contains ${form.packaging!.unitsPerPackage} selling units, weighs ${form.packaging!.weightKg} kilograms, and measures ${form.packaging!.length} by ${form.packaging!.width} by ${form.packaging!.height} centimetres. Handling: ${form.packaging!.handling.replace(/_/g, " ")}.`} ${form.photos.length} photos. Review and correct any details. Only the submit button can send your listing for review.`;
}
