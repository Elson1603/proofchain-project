import type { ApiNotification } from "@/lib/notifications";

function sameOriginPath(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  return trimmed;
}

function metadataValue(metadata: ApiNotification["metadata"], key: string) {
  const value = metadata?.[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function withProject(path: string, projectId: string | null) {
  return projectId ? `${path}?projectId=${encodeURIComponent(projectId)}` : path;
}

function tokenIdFromMessage(message: string) {
  const match = message.match(/token\s*#?(\d+)/i);
  return match?.[1] ?? null;
}

export function notificationHref(notification: ApiNotification) {
  const explicitUrl = sameOriginPath(notification.actionUrl);
  if (explicitUrl) {
    return explicitUrl;
  }

  const projectId = metadataValue(notification.metadata, "projectId");
  const tokenId = metadataValue(notification.metadata, "tokenId") ?? tokenIdFromMessage(notification.message);

  switch (notification.type) {
    case "chat":
      return projectId ? `/projects/${encodeURIComponent(projectId)}/chat` : "/messages";
    case "work_submitted":
    case "submission_uploaded":
    case "approval_reminder":
      return withProject("/client/approval-workflow", projectId);
    case "payment_released":
    case "payment_completed":
    case "transaction_alert":
    case "project_deadline_reminder":
      return withProject("/project-details", projectId);
    case "nft_minted":
      return tokenId ? `/certificate/${encodeURIComponent(tokenId)}` : "/freelancer/nft-certificates";
    default:
      return null;
  }
}

export async function openNotification(
  notification: ApiNotification,
  markRead: (id: string) => Promise<ApiNotification | null>,
  onClose?: () => void,
) {
  const href = notificationHref(notification);

  if (!notification.isRead) {
    await markRead(notification.id).catch(() => null);
  }

  onClose?.();

  if (href) {
    window.location.assign(href);
  }
}
