import { AppError } from "../lib/errors.js";
/** Never infer permissions from a client preference or an old token. */
export function accountRole(user: { capabilities: { capability: string }[] }) {
  const roles = user.capabilities.map((entry) => entry.capability);
  if (roles.length !== 1 || !["BUYER", "SELLER"].includes(roles[0]!))
    throw new AppError(409, "ACCOUNT_ROLE_CONFLICT", "Your account role needs review. Please contact support.");
  return roles[0] as "BUYER" | "SELLER";
}
