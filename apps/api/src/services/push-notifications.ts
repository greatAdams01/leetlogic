import { prisma } from "@leetlogic/database";
/** Returns true when the gateway needs a retry; inbox delivery is independent of push. */
export async function sendFarmerPush({ userId, title, body, channelId, data }: {
  userId: string; title: string; body: string; channelId: string; data: Record<string, string>;
}) {
      const devices = await prisma.mobilePushDevice.findMany({ where: { userId: userId } });
      let retry = false;
      for (const device of devices) {
        const session = await prisma.session.findFirst({
          where: {
            tokenFamilyId: device.sessionFamilyId,
            userId: userId,
            user: { status: "ACTIVE" },
            revokedAt: null,
            replacedById: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (!session) continue;
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          signal: AbortSignal.timeout(10000),
          headers: {
            "Content-Type": "application/json",
            ...(process.env.EXPO_ACCESS_TOKEN
              ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
              : {}),
          },
          body: JSON.stringify({
            to: device.token,
            title,
            body,
            sound: "default",
            channelId,
            data,
          }),
        });
        if (!response.ok) {
          retry = true;
          continue;
        }
        const result = (await response.json()) as {
          data?: { status?: string; details?: { error?: string } };
        };
        if (result.data?.details?.error === "DeviceNotRegistered") {
          await prisma.mobilePushDevice.deleteMany({
            where: { token: device.token, sessionFamilyId: device.sessionFamilyId },
          });
        } else if (result.data?.status !== "ok") retry = true;
      }

  return retry;
}
