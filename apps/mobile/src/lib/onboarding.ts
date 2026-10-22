import type { Customer } from "./domain";
import { editableVerification } from "./verification";
export const accountRoleKey = (id: string) => `account-role:${id}`;
export function restoredAccount(user: Customer, savedRole: string | null) {
  const role = savedRole === "SELLER" || (!savedRole && user.farmerProfile) ? "SELLER" : "BUYER";
  const unfinished =
    !user.farmerProfile || editableVerification(user.farmerProfile.verificationStatus);
  return { role, route: role === "SELLER" && unfinished ? "seller" : "home" } as const;
}
