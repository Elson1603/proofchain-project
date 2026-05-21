import { io, type Socket } from "socket.io-client";

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

export type NftMintedPayload = {
  certificateId: string;
  projectId: string;
  recipientId: string;
  tokenId?: string;
  contractAddress?: string;
  txHash?: string;
  mintedAt?: string;
  meta?: Record<string, unknown>;
};

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
  nft_minted: (payload: NftMintedPayload) => void;
  new_message: (payload: NewMessagePayload) => void;
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
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem("proofchain_access_token") ??
    window.localStorage.getItem("accessToken") ??
    window.localStorage.getItem("token")
  );
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
