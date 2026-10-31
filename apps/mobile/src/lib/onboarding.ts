import type { Customer } from "./domain";
import { editableVerification } from "./verification";
export const accountRoleKey = (id: string) => `account-role:${id}`;
export function restoredAccount(user: Customer, savedRole: string | null) {
  const role = signInRole(user, savedRole, null);
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
  const roles = user.capabilities?.map((entry) => entry.capability) ?? [];
  if (roles.length !== 1 || !["BUYER", "SELLER"].includes(roles[0]!))
    throw new Error("Your account role needs review. Please contact support.");
  return roles[0] as "BUYER" | "SELLER";
}
