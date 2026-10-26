import type { Customer } from "./domain";
import { editableVerification } from "./verification";
export const accountRoleKey = (id: string) => `account-role:${id}`;
export function restoredAccount(user: Customer, savedRole: string | null) {
  const role = savedRole === "SELLER" || (!savedRole && user.farmerProfile) ? "SELLER" : "BUYER";
  const unfinished =
    !user.farmerProfile || editableVerification(user.farmerProfile.verificationStatus);
  return { role, route: role === "SELLER" && unfinished ? "seller" : "home" } as const;
}

/** Resolve only verified-account preferences and an explicit choice from this entry flow. */
export function signInRole(
  user: Customer,
  savedRole: string | null,
  intent: "BUYER" | "SELLER" | null,
) {
  if (intent) return intent;
  if (savedRole === "BUYER" || savedRole === "SELLER") return savedRole;
  return user.farmerProfile ? "SELLER" : null;
}
