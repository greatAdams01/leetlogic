export function productShareUrl(base: string, id: string) {
  const url = new URL(base);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !/^[a-f0-9-]{36}$/i.test(id)
  )
    throw new Error("Product sharing is unavailable. Please try again later.");
  return new URL(`/produce/${id}`, url).href;
}
export const whatsappShareUrl = (message: string) =>
  `https://wa.me/?text=${encodeURIComponent(message)}`;
