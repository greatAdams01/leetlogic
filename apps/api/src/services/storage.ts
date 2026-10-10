import { createHmac } from "node:crypto";
import { getConfig } from "../config.js";
export interface PrivateObjectStorage {
  createReadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
}
export class LocalPrivateObjectStorage implements PrivateObjectStorage {
  async createReadUrl(objectKey: string, expiresInSeconds: number) {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = createHmac("sha256", getConfig().TOKEN_HASH_SECRET)
      .update(`${objectKey}:${expires}`)
      .digest("hex");
    return `/api/admin/verifications/documents/${encodeURIComponent(objectKey)}?expires=${expires}&signature=${signature}`;
  }
}
