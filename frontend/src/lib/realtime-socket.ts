import { io, type Socket } from "socket.io-client";
import { getStoredAccessToken } from "@/lib/proofchain-api";

export type SubmissionUploadedPayload = {
  submissionId: string;
  projectId: string;
  uploaderId: string;
  ipfsCid?: string | null;
  uploadedAt?: string;
};

export type ProjectUpdatedPayload = {
  projectId: string;
  updatedBy?: string;
  status?: string;
  updatedAt?: string;
  changes?: Record<string, unknown>;
};

export type PaymentCompletedPayload = {
  paymentId: string;
  projectId: string;
  payerId?: string;
  payeeId?: string;
  amount?: string;
  currency?: string;
  txHash?: string;
  completedAt?: string;
  meta?: Record<string, unknown>;
};

export type NftBroadcastPayload = {
  userId?: string;
  recipientId?: string;
  projectId?: string;
  paymentId?: string;
  certificateId?: string;
  tokenId?: string | number;
  contractAddress?: string;
  wallet?: string;
  txHash?: string;
  mintedAt?: string;
  error?: string;
  meta?: Record<string, unknown>;
};

export type NftMintedPayload = NftBroadcastPayload;

export type NewMessagePayload = {
  projectId: string;
  conversationId?: string;
  messageId: string;
  senderId: string;
  content?: string;
  messageType?: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
};

export type NotificationPayload = {
  userId: string;
  type?: string;
  notification?: {
    id: string;
    title: string;
    message: string;
    type?: string;
    actionUrl?: string | null;
    metadata?: Record<string, unknown> | null;
    isRead: boolean;
    createdAt: string;
  };
  title?: string;
  message?: string;
};

export type AdminRealtimePayload = {
  type:
    | "dispute_raised"
    | "dispute_resolved"
    | "escrow_issue"
    | "tx_failure"
    | "tx_retry"
    | "fraud_alert"
    | "nft_minted"
    | "ugf_update"
    | "project_activity"
    | "user_moderation"
    | "system_warning";
  severity?: "info" | "success" | "warning" | "critical";
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
  txHash?: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
};

export type SocketErrorPayload = {
  success: false;
  statusCode: number;
  code?: string;
  message: string;
};

export interface RealtimeServerToClientEvents {
  socket_error: (payload: SocketErrorPayload) => void;

  submission_uploaded: (payload: SubmissionUploadedPayload) => void;
  project_updated: (payload: ProjectUpdatedPayload) => void;
  payment_completed: (payload: PaymentCompletedPayload) => void;
  nft_mint_started: (payload: NftBroadcastPayload) => void;
  nft_minted: (payload: NftBroadcastPayload) => void;
  nft_failed: (payload: NftBroadcastPayload) => void;
  certificate_verified: (payload: NftBroadcastPayload) => void;
  new_message: (payload: NewMessagePayload) => void;
  notification: (payload: NotificationPayload) => void;
  admin_event: (payload: AdminRealtimePayload) => void;
}

export interface RealtimeClientToServerEvents {
  join_project_room: (payload: { projectId?: string }, ack?: (payload: unknown) => void) => void;
  leave_project_room: (payload: { projectId?: string }, ack?: (payload: unknown) => void) => void;
}

export type RealtimeSocket = Socket<RealtimeServerToClientEvents, RealtimeClientToServerEvents>;

export const socketBase = (import.meta.env.VITE_SOCKET_URL ?? import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

export function getAccessToken() {
  return getStoredAccessToken();
}

export type CreateRealtimeSocketOptions = {
  /** Join these project rooms after connect (recommended for project-scoped events). */
  projectIds?: string[];
  /** Override socket url (defaults to VITE_SOCKET_URL or VITE_API_BASE_URL). */
  url?: string;
  /** Override token (defaults to localStorage token). */
  token?: string;
};

function normalizeProjectIds(ids?: string[]) {
  return (ids ?? []).map(String).map((id) => id.trim()).filter(Boolean);
}

export function createRealtimeSocketClient(options: CreateRealtimeSocketOptions = {}): RealtimeSocket | null {
  const url = (options.url ?? socketBase).trim();
  const token = (options.token ?? getAccessToken())?.trim();

  if (!url || !token) {
    return null;
  }

  const projectIds = normalizeProjectIds(options.projectIds);

  return io(url, {
    auth: {
      token,
      // backend supports projectId + projectIds in handshake auth
      projectIds: projectIds.join(","),
    },
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });
}

export function joinProjectRooms(socket: RealtimeSocket, projectIds: string[]) {
  const unique = Array.from(new Set(normalizeProjectIds(projectIds)));

  for (const projectId of unique) {
    socket.emit("join_project_room", { projectId }, (ack) => {
      console.log("[realtime] join_project_room ack", { projectId, ack });
    });
  }
}

export function leaveProjectRooms(socket: RealtimeSocket, projectIds: string[]) {
  const unique = Array.from(new Set(normalizeProjectIds(projectIds)));

  for (const projectId of unique) {
    socket.emit("leave_project_room", { projectId }, (ack) => {
      console.log("[realtime] leave_project_room ack", { projectId, ack });
    });
  }
}
