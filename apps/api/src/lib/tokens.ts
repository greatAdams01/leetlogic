import jwt from "jsonwebtoken";
import { getConfig } from "../config.js";
import { AppError } from "./errors.js";
export type AccessClaims = {
  sub: string;
  subject: "customer" | "admin";
  sessionId: string;
  capabilities?: string[];
  permissions?: string[];
  stepUpAt?: number;
};
export function signAccessToken(claims: AccessClaims): string {
  const admin = claims.subject === "admin";
  const { sub, subject, sessionId, capabilities, permissions, stepUpAt } = claims;
  return jwt.sign(
    { sub, subject, sessionId, capabilities, permissions, stepUpAt },
    admin ? getConfig().ADMIN_ACCESS_TOKEN_SECRET : getConfig().ACCESS_TOKEN_SECRET,
    {
      expiresIn: admin ? "10m" : "15m",
      issuer: "leetlogic",
      audience: admin ? "leetlogic-admin" : "leetlogic-customer",
    },
  );
}
export function verifyAccessToken(token: string, subject: "customer" | "admin"): AccessClaims {
  try {
    return jwt.verify(
      token,
      subject === "admin" ? getConfig().ADMIN_ACCESS_TOKEN_SECRET : getConfig().ACCESS_TOKEN_SECRET,
      {
        issuer: "leetlogic",
        audience: subject === "admin" ? "leetlogic-admin" : "leetlogic-customer",
      },
    ) as AccessClaims;
  } catch {
    throw new AppError(401, "INVALID_ACCESS_TOKEN", "Authentication is required");
  }
}
