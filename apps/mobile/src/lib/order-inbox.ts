import { useEffect } from "react";
import { useApp, useResource } from "../state";
import { api } from "./api";
export type InboxItem = {
  id: string;
  orderId?: string;
  listingId?: string;
  produceTitle?: string;
  orderReference?: string;
  messageKey: string;
  createdAt: string;
  readAt: string | null;
};
const listeners = new Set<() => void>();
export function refreshOrderInbox() {
  for (const listener of listeners) listener();
}
export function useOrderInbox() {
  const a = useApp(),
    resource = useResource<{ items: InboxItem[]; unreadCount: number; readThrough: string }>(
      `/orders/notifications?view=${a.role === "SELLER" ? "seller" : "buyer"}`,
      !!a.user,
      15000,
    );
  useEffect(() => {
    const refresh = () => void resource.reload(true);
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [resource.reload]);
  const read = async (ids: string[]) => {
    if (!ids.length) return;
    await api("/orders/notifications/read", { method: "POST", body: { ids } });
    refreshOrderInbox();
  };
  const readAll = async () => {
    if (!resource.data?.readThrough) return;
    await api("/orders/notifications/read", {
      method: "POST",
      body: { through: resource.data.readThrough },
    });
    refreshOrderInbox();
  };
  return { ...resource, read, readAll };
}
