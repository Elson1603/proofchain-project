import { io, type Socket } from "socket.io-client";

export type ChatParticipant = {
  id: string;
  name: string;
  role: "Client" | "Freelancer";
  initials: string;
  wallet: string;
  online: boolean;
};

export type AttachmentPreview = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  previewUrl?: string;
};

export type ChatReaction = {
  emoji: string;
  count: number;
  reactedByMe?: boolean;
};

export type ChatMessage = {
  id: string;
  projectId: string;
  sender: "me" | "client" | "freelancer" | "system";
  author: string;
  role?: "Client" | "Freelancer";
  content: string;
  timestamp: string;
  status?: "delivered" | "seen";
  type: "text" | "file" | "system";
  reactions?: ChatReaction[];
  attachments?: AttachmentPreview[];
  event?: {
    label: string;
    txHash?: string;
    network?: string;
    amount?: string;
    verified?: boolean;
  };
};

export type ProjectConversation = {
  id: string;
  projectId: string;
  title: string;
  status: "Active" | "Review" | "Funded" | "Completed";
  lastMessage: string;
  timestamp: string;
  unread: number;
  online: boolean;
  client: ChatParticipant;
  freelancer: ChatParticipant;
  messages: ChatMessage[];
};

export type ApiUserSummary = {
  id: string;
  fullName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  walletAddress?: string | null;
  role?: "FREELANCER" | "CLIENT" | "ADMIN";
};

export type ApiMessageAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  fileType: string;
  fileSize: number;
};

export type ApiMessageReaction = {
  emoji: string;
  user?: ApiUserSummary | null;
  userId?: string | null;
};

export type ApiMessageRead = {
  user?: ApiUserSummary | null;
  userId?: string | null;
  readAt?: string | null;
};

export type ApiMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: "TEXT" | "FILE" | "SYSTEM";
  isDeleted?: boolean;
  createdAt?: string;
  messageHash?: string | null;
  blockchainTxHash?: string | null;
  blockchainProofedAt?: string | null;
  sender?: ApiUserSummary | null;
  reactions?: ApiMessageReaction[];
  reads?: ApiMessageRead[];
  attachments?: ApiMessageAttachment[];
  conversation?: { projectId?: string | null } | null;
  projectId?: string | null;
};

export type ApiConversationSummary = {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
  latestMessage?: ApiMessage | null;
  project: {
    id: string;
    title?: string | null;
    status?: string | null;
    owner?: ApiUserSummary | null;
    freelancer?: ApiUserSummary | null;
    invitedFreelancer?: ApiUserSummary | null;
  };
};

export type ApiMessagePage = {
  messages: ApiMessage[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ApiMessagingProfile = {
  id: string;
  role: "FREELANCER" | "CLIENT" | "ADMIN";
  username?: string | null;
  avatarUrl?: string | null;
  walletAddress?: string | null;
};

export const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
export const socketBase = (import.meta.env.VITE_SOCKET_URL ?? apiBase).replace(/\/+$/, "");

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

async function authorizedFetch<T>(path: string, init?: RequestInit) {
  const token = getAccessToken();

  if (!apiBase || !token) {
    return null;
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

export async function fetchMessagingProfile() {
  const payload = await authorizedFetch<{ success?: boolean; data?: ApiMessagingProfile }>(
    "/api/profile/me",
  );

  return payload?.data ?? null;
}

export async function fetchConversationSummaries() {
  return authorizedFetch<ApiConversationSummary[]>("/api/conversations");
}

export async function fetchConversationMessages(conversationId: string, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  return authorizedFetch<ApiMessagePage>(`/api/messages/${conversationId}?${params.toString()}`);
}

export function formatBytes(bytes: number) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function shortHash(hash?: string) {
  if (!hash) {
    return "0x0000...0000";
  }

  return hash.length > 12 ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : hash;
}

export function decodeMessageText(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function createMessagingSocket(projectId?: string): Socket | null {
  const token = getAccessToken();

  if (!socketBase || !token) {
    return null;
  }

  return io(socketBase, {
    auth: {
      token,
      projectId,
    },
    transports: ["websocket"],
    reconnectionAttempts: 5,
  });
}

export async function sendMessageRequest(input: {
  projectId: string;
  content: string;
  messageType?: "TEXT" | "FILE" | "SYSTEM";
}): Promise<ApiMessage | null> {
  const token = getAccessToken();

  if (!apiBase || !token) {
    return null;
  }

  const response = await fetch(`${apiBase}/api/messages/send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Message delivery failed");
  }

  return response.json();
}

export async function markConversationReadRequest(conversationId: string): Promise<{
  count?: number;
  messageIds?: string[];
  readAt?: string;
} | null> {
  return authorizedFetch<{ count?: number; messageIds?: string[]; readAt?: string }>(
    `/api/conversations/${conversationId}/read`,
    {
      method: "POST",
    },
  );
}

export async function createMessageProofRequest(messageId: string): Promise<{
  message?: ApiMessage;
  messageHash?: string;
  txHash?: string | null;
  submittedOnchain?: boolean;
} | null> {
  return authorizedFetch<{
    message?: ApiMessage;
    messageHash?: string;
    txHash?: string | null;
    submittedOnchain?: boolean;
  }>(`/api/messages/${messageId}/proof`, {
    method: "POST",
  });
}

export async function fetchSmartReplySuggestions(conversationId: string) {
  const payload = await authorizedFetch<{ suggestions?: string[] }>(`/api/conversations/${conversationId}/smart-replies`);
  return payload?.suggestions ?? null;
}

export async function uploadAttachmentRequest(input: {
  projectId: string;
  file: File;
  content?: string;
  onProgress?: (progress: number) => void;
}): Promise<ApiMessage | null> {
  const token = getAccessToken();

  if (!apiBase || !token) {
    input.onProgress?.(100);
    return null;
  }

  input.onProgress?.(30);
  const formData = new FormData();
  formData.append("projectId", input.projectId);
  formData.append("content", input.content ?? "");
  formData.append("file", input.file);

  const response = await fetch(`${apiBase}/api/attachments/upload`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  input.onProgress?.(85);

  if (!response.ok) {
    throw new Error("Attachment upload failed");
  }

  input.onProgress?.(100);
  return response.json();
}

// Demo conversations removed: conversations are loaded from backend via `/api/conversations`.
