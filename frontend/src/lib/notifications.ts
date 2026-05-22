import { apiFetch } from "@/lib/proofchain-api";

export type ApiNotification = {
  id: string;
  title: string;
  message: string;
  type?: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
};

export async function fetchNotifications(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}) {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  if (typeof params?.unreadOnly === "boolean") search.set("unreadOnly", String(params.unreadOnly));

  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<ApiNotification[]>(`/api/notifications${suffix}`, {}, { auth: true });
}

export async function fetchUnreadCount() {
  const payload = await apiFetch<{ count?: number }>("/api/notifications/unread-count", {}, { auth: true });
  return payload?.count ?? null;
}

export async function markNotificationRead(id: string) {
  return apiFetch<ApiNotification>(`/api/notifications/${id}/read`, { method: "POST" }, { auth: true });
}

export async function markAllNotificationsRead() {
  return apiFetch<{ updated?: number }>("/api/notifications/read-all", { method: "POST" }, { auth: true });
}
