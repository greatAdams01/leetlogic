export type Route = {
  name:
    | "language"
    | "intro"
    | "role"
    | "phone"
    | "otp"
    | "home"
    | "search"
    | "categories"
    | "shoppingLocation"
    | "product"
    | "cart"
    | "likes"
    | "orders"
    | "delivery"
    | "quotes"
    | "finance"
    | "banks"
    | "profile"
    | "details"
    | "addresses"
    | "seller"
    | "sell"
    | "review"
    | "myListings"
    | "securitySettings"
    | "notifications"
    | "help";
  id?: string;
  query?: string;
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

export const protectedScreens: Route["name"][] = [
  "cart",
  "likes",
  "orders",
  "delivery",
  "quotes",
  "finance",
  "banks",
  "profile",
  "details",
  "addresses",
  "seller",
  "sell",
  "review",
  "myListings",
  "securitySettings",
  "notifications",
];

/** A sign-in prompt must always have a way back to public browsing. */
export function backStack(stack: Route[], signedIn: boolean): Route[] {
  if (stack.length > 1) return stack.slice(0, -1);
  if (signedIn) return stack;
  const route = stack[0];
  if (route && protectedScreens.includes(route.name)) return [{ name: "home" }];
  if (route?.name === "phone") return [{ name: "role" }];
  if (route?.name === "otp") return [{ name: "phone" }];
  return stack;
}

/** Finish a nested flow without leaving its form in the back history. */
export function returnToScreen(stack: Route[], target: Route): Route[] {
  const index = stack.findLastIndex(
    (route) => route.name === target.name && route.id === target.id,
  );
  return index >= 0 ? [...stack.slice(0, index), target] : [...stack.slice(0, -1), target];
}
