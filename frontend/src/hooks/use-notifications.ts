import { useCallback, useEffect, useMemo, useState } from "react";
import { createRealtimeSocketClient } from "@/lib/realtime-socket";
import type { NotificationPayload } from "@/lib/realtime-socket";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiNotification,
} from "@/lib/notifications";

export type UseNotificationsOptions = {
  limit?: number;
};

function normalizeNotification(payload: NotificationPayload | ApiNotification) {
  if ("notification" in payload) {
    const projectId = typeof (payload as NotificationPayload & { projectId?: unknown }).projectId === "string"
      ? (payload as NotificationPayload & { projectId?: string }).projectId
      : undefined;

    return payload.notification && projectId
      ? {
          ...payload.notification,
          metadata: {
            ...(payload.notification.metadata ?? {}),
            projectId,
          },
        }
      : payload.notification;
  }
  return payload;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const limit = useMemo(() => options.limit ?? 6, [options.limit]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [list, count] = await Promise.all([
        fetchNotifications({ limit }),
        fetchUnreadCount(),
      ]);

      if (Array.isArray(list)) {
        setNotifications(list);
      }

      if (typeof count === "number") {
        setUnreadCount(count);
      }
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const markRead = useCallback(async (id: string) => {
    const updated = await markNotificationRead(id);
    if (!updated) {
      return null;
    }

    setNotifications((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, isRead: true } : item)),
    );
    setUnreadCount((prev) => Math.max(prev - 1, 0));
    return updated;
  }, []);

  const markAllRead = useCallback(async () => {
    const result = await markAllNotificationsRead();
    if (!result) {
      return null;
    }

    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    return result;
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      setIsLoading(false);
    });
  }, [refresh]);

  useEffect(() => {
    const socket = createRealtimeSocketClient();
    if (!socket) {
      return;
    }

    const onNotification = (payload: NotificationPayload) => {
      const notification = normalizeNotification(payload);
      if (!notification?.id) {
        return;
      }

      setNotifications((prev) => {
        const exists = prev.some((item) => item.id === notification.id);
        if (!exists && !notification.isRead) {
          setUnreadCount((count) => count + 1);
        }
        const next = [notification, ...prev.filter((item) => item.id !== notification.id)];
        return next.slice(0, limit);
      });
    };

    socket.on("notification", onNotification);

    return () => {
      socket.off("notification", onNotification);
      socket.disconnect();
    };
  }, [limit]);

  return {
    notifications,
    unreadCount,
    isLoading,
    refresh,
    markRead,
    markAllRead,
  };
}
