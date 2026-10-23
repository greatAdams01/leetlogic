export type Route = {
  name:
    | "language"
    | "intro"
    | "role"
    | "phone"
    | "otp"
    | "home"
    | "search"
    | "product"
    | "orders"
    | "delivery"
    | "quotes"
    | "finance"
    | "profile"
    | "details"
    | "addresses"
    | "seller"
    | "sell"
    | "review"
    | "myListings"
    | "notifications"
    | "help";
  id?: string;
};

/** Preserve the owning screen, including the current intro slide, when changing language. */
export function openLanguageScreen(stack: Route[], introStep?: number): Route[] {
  if (stack.at(-1)?.name === "language") return stack;
  const previous = stack.map((r, i) =>
    i === stack.length - 1 && r.name === "intro" && introStep !== undefined
      ? { ...r, id: String(Math.max(0, Math.min(2, introStep))) }
      : r,
  );
  return [...previous, { name: "language" }];
}
export function finishLanguageSelection(stack: Route[]): Route[] {
  return stack.length > 1 ? stack.slice(0, -1) : [...stack, { name: "intro" }];
}
