import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import type {
  NewMessagePayload,
  NftMintedPayload,
  PaymentCompletedPayload,
  ProjectUpdatedPayload,
  NotificationPayload,
  RealtimeSocket,
  SubmissionUploadedPayload,
} from "@/lib/realtime-socket";
import { createRealtimeSocketClient, joinProjectRooms, leaveProjectRooms } from "@/lib/realtime-socket";

export type UseRealtimeEventsOptions = {
  /** Project rooms to join for receiving project-scoped events. */
  projectIds?: string[];
  /** Optional label to help identify logs from a specific screen. */
  logLabel?: string;
  /** Disable toast notifications (console logs still happen). */
  enableToasts?: boolean;
  /** Optional handler for new notification events. */
  onNotification?: (payload: NotificationPayload) => void;
};

function log(label: string | undefined, message: string, meta?: Record<string, unknown>) {
  const prefix = label ? `[realtime:${label}]` : "[realtime]";
  console.log(prefix, message, meta ?? "");
}

export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}) {
  const socketRef = useRef<RealtimeSocket | null>(null);

  const enableToasts = options.enableToasts !== false;
  const stableProjectIds = useMemo(() => options.projectIds ?? [], [options.projectIds]);

  useEffect(() => {
    const socket = createRealtimeSocketClient({ projectIds: stableProjectIds });
    socketRef.current = socket;

    if (!socket) {
      log(options.logLabel, "socket disabled (missing VITE_SOCKET_URL/VITE_API_BASE_URL or token)");
      return;
    }

    const onConnect = () => {
      log(options.logLabel, "connected", { socketId: socket.id });
      if (stableProjectIds.length) {
        joinProjectRooms(socket, stableProjectIds);
      }
    };

    const onDisconnect = (reason: string) => {
      log(options.logLabel, "disconnected", { reason });
    };

    const onConnectError = (err: unknown) => {
      log(options.logLabel, "connect_error", { error: String(err) });
      if (enableToasts) {
        toast.error("Realtime connection failed", { description: String(err) });
      }
    };

    const onSocketError = (payload: unknown) => {
      log(options.logLabel, "socket_error", { payload });
      if (enableToasts) {
        toast.error("Realtime error", {
          description:
            typeof payload === "object" && payload && "message" in payload
              ? String((payload as any).message)
              : "Socket error",
        });
      }
    };

    const onSubmissionUploaded = (payload: SubmissionUploadedPayload) => {
      log(options.logLabel, "submission_uploaded", payload as any);
      if (enableToasts) {
        toast.success("Submission uploaded", {
          description: `Project ${payload.projectId}`,
        });
      }
    };

    const onProjectUpdated = (payload: ProjectUpdatedPayload) => {
      log(options.logLabel, "project_updated", payload as any);
      if (enableToasts) {
        toast("Project updated", {
          description: payload.status ? `Status: ${payload.status}` : `Project ${payload.projectId}`,
        });
      }
    };

    const onPaymentCompleted = (payload: PaymentCompletedPayload) => {
      log(options.logLabel, "payment_completed", payload as any);
      if (enableToasts) {
        toast.success("Payment completed", {
          description: payload.amount ? `${payload.amount} ${payload.currency ?? ""}`.trim() : `Project ${payload.projectId}`,
        });
      }
    };

    const onNftMinted = (payload: NftMintedPayload) => {
      log(options.logLabel, "nft_minted", payload as any);
      if (enableToasts) {
        toast.success("NFT certificate minted", {
          description: payload.tokenId ? `Token #${payload.tokenId}` : `Project ${payload.projectId}`,
        });
      }
    };

    const onNewMessage = (payload: NewMessagePayload) => {
      log(options.logLabel, "new_message", payload as any);
      if (enableToasts) {
        toast("New message", {
          description: payload.content ? payload.content.slice(0, 120) : `Project ${payload.projectId}`,
        });
      }
    };

    const onNotification = (payload: NotificationPayload) => {
      log(options.logLabel, "notification", payload as any);
      if (enableToasts) {
        const title = payload.notification?.title ?? payload.title ?? "Notification received";
        toast("New notification", {
          description: title,
        });
      }
      options.onNotification?.(payload);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    // Manager-level reconnection events
    socket.io.on("reconnect_attempt", (attempt) => {
      log(options.logLabel, "reconnect_attempt", { attempt });
    });
    socket.io.on("reconnect", (attempt) => {
      log(options.logLabel, "reconnected", { attempt });
      if (stableProjectIds.length) {
        joinProjectRooms(socket, stableProjectIds);
      }
    });
    socket.io.on("reconnect_error", (error) => {
      log(options.logLabel, "reconnect_error", { error: String(error) });
    });
    socket.io.on("reconnect_failed", () => {
      log(options.logLabel, "reconnect_failed");
    });

    socket.on("socket_error", onSocketError);
    socket.on("submission_uploaded", onSubmissionUploaded);
    socket.on("project_updated", onProjectUpdated);
    socket.on("payment_completed", onPaymentCompleted);
    socket.on("nft_minted", onNftMinted);
    socket.on("new_message", onNewMessage);
    socket.on("notification", onNotification);

    return () => {
      try {
        if (stableProjectIds.length) {
          leaveProjectRooms(socket, stableProjectIds);
        }

        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off("connect_error", onConnectError);
        socket.off("socket_error", onSocketError);
        socket.off("submission_uploaded", onSubmissionUploaded);
        socket.off("project_updated", onProjectUpdated);
        socket.off("payment_completed", onPaymentCompleted);
        socket.off("nft_minted", onNftMinted);
        socket.off("new_message", onNewMessage);
        socket.off("notification", onNotification);

        socket.io.off("reconnect_attempt");
        socket.io.off("reconnect");
        socket.io.off("reconnect_error");
        socket.io.off("reconnect_failed");

        socket.disconnect();
      } finally {
        socketRef.current = null;
      }
    };
  }, [enableToasts, options.logLabel, stableProjectIds]);

  return {
    socket: socketRef.current,
  };
}
