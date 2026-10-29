import type { Request } from "express";

/** Client-reported display metadata; never used to establish device identity or access. */
export function reportedDevice(req: Request): { devicePlatform?: string; deviceName?: string } {
  const platform = req.get("X-LeetLogic-Device-Platform");
  if (!["ios", "android", "web"].includes(platform || "")) return {};
  let name: string | undefined;
  try {
    const value = decodeURIComponent(req.get("X-LeetLogic-Device-Name") || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim();
    if (value && value.length <= 100) name = value;
  } catch {
    /* Invalid display metadata must not affect authentication. */
  }
  return { devicePlatform: platform, ...(name ? { deviceName: name } : {}) };
}
