import { PrismaClient } from "@prisma/client";

const categories = [
  { slug: "vegetables", names: ["Vegetables", "Vegetables", "Kayan lambu", "Akwụkwọ nri", "Ẹfọ́"] },
  { slug: "fruits", names: ["Fruits", "Fruits", "'Ya'yan itace", "Mkpụrụ osisi", "Èso"] },
  { slug: "grains", names: ["Grains", "Grains", "Hatsi", "Ọka", "Ọkà"] },
  {
    slug: "roots-tubers",
    names: [
      "Roots & Tubers",
      "Roots & Tubers",
      "Tushen amfanin gona",
      "Mgbọrọgwụ na ji",
      "Gbòǹgbò àti iṣu",
    ],
  },
  { slug: "legumes", names: ["Legumes", "Beans family", "Kayan wake", "Ụdị agwa", "Ẹ̀wà"] },
  { slug: "oils", names: ["Oils", "Oils", "Mai", "Mmanụ", "Epo"] },
  {
    slug: "processed-produce",
    names: [
      "Processed Produce",
      "Processed Produce",
      "Amfanin gona da aka sarrafa",
      "Ihe ubi a haziri",
      "Ọjà tí a ti ṣe",
    ],
  },
];
const legacyCategories: Record<string, string> = {
  tomatoes: "vegetables",
  pepper: "vegetables",
  yam: "roots-tubers",
  garri: "processed-produce",
  plantain: "fruits",
  "palm-oil": "oils",
};
/** Add starter catalogue entries without overwriting staff-managed names. */
export async function seedCatalogue(prisma: PrismaClient) {
  for (const [sortOrder, item] of categories.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: item.slug },
      create: { slug: item.slug, sortOrder },
      update: {},
    });
    for (const [index, locale] of ["en", "pcm", "ha", "ig", "yo"].entries())
      await prisma.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: category.id, locale } },
        create: { categoryId: category.id, locale, name: item.names[index]! },
        update: {},
      });
  }
  // Preserve old category records for history while moving listings and saved drafts.
  // Device drafts are recovered through the aliases returned by the catalogue API.
  await prisma.$transaction(async (tx) => {
    for (const [oldSlug, newSlug] of Object.entries(legacyCategories)) {
      const old = await tx.category.findUnique({ where: { slug: oldSlug } });
      const target = await tx.category.findUniqueOrThrow({ where: { slug: newSlug } });
      if (!old) continue;
      await tx.listing.updateMany({
        where: { categoryId: old.id },
        data: { categoryId: target.id },
      });
      await tx.$executeRaw`UPDATE listing_drafts SET fields = jsonb_set(fields, '{categoryId}', to_jsonb(${target.id}::text)) WHERE fields->>'categoryId' = ${old.id}`;
      await tx.category.update({ where: { id: old.id }, data: { isActive: false } });
    }
  });
  for (const unit of [
    { code: "KG", name: "Kilogram", allowsDecimal: true },
    { code: "BAG", name: "Bag", allowsDecimal: false },
    { code: "BASKET", name: "Basket", allowsDecimal: false },
    { code: "CRATE", name: "Crate", allowsDecimal: false },
    { code: "TONNE", name: "Tonne", allowsDecimal: true },
    { code: "PIECE", name: "Piece", allowsDecimal: false },
    { code: "BUNCH", name: "Bunch", allowsDecimal: false },
    { code: "LITRE", name: "Litre", allowsDecimal: true },
  ])
    await prisma.unit.upsert({ where: { code: unit.code }, create: unit, update: {} });
}
if (process.argv[1]?.endsWith("seed-catalogue.ts")) {
  const prisma = new PrismaClient();
  try {
    await seedCatalogue(prisma);
    console.log("Starter produce catalogue is ready.");
  } finally {
    await prisma.$disconnect();
  }
}
