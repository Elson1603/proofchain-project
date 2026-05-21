import { apiBase, getAccessToken } from "@/lib/messaging";

export type ApiNotification = {
  id: string;
  title: string;
  message: string;
  type?: string;
  isRead: boolean;
  createdAt: string;
};

export async function fetchNotifications(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}) {
  const token = getAccessToken();

  if (!apiBase || !token) {
    return null;
  }

  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  if (typeof params?.unreadOnly === "boolean") search.set("unreadOnly", String(params.unreadOnly));

  const response = await fetch(`${apiBase}/api/notifications?${search.toString()}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as ApiNotification[];
}

export async function fetchUnreadCount() {
  const token = getAccessToken();

  if (!apiBase || !token) {
    return null;
  }

  const response = await fetch(`${apiBase}/api/notifications/unread-count`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { count?: number };
  return payload.count ?? 0;
}

export async function markNotificationRead(id: string) {
  const token = getAccessToken();

  if (!apiBase || !token) {
    return null;
  }

  const response = await fetch(`${apiBase}/api/notifications/${id}/read`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as ApiNotification;
}

export async function markAllNotificationsRead() {
  const token = getAccessToken();

  if (!apiBase || !token) {
    return null;
  }

  const response = await fetch(`${apiBase}/api/notifications/read-all`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as { updated?: number };
}
