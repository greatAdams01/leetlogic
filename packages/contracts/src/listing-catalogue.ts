/** A selling item must belong to the category explicitly chosen by the farmer. */
export function categoryProduceError(category: { produceItems?: readonly string[] } | undefined | null, title: string): string {
  if (!category) return "Choose an available category before selecting produce.";
  if (!(category.produceItems || []).some(item => item.toLowerCase() === title.trim().toLowerCase()))
    return "Choose a produce item from the selected category.";
  return "";
}
