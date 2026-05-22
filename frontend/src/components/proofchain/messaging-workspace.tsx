import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  BadgeCheck,
  Bell,
  Blocks,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  CircleDollarSign,
  Download,
  FileArchive,
  FileText,
  Gem,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pin,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/proofchain/theme-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useNotifications } from "@/hooks/use-notifications";
import { openNotification } from "@/lib/notification-routing";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createMessageProofRequest,
  createMessagingSocket,
  decodeMessageText,
  fetchConversationMessages,
  fetchConversationSummaries,
  fetchMessagingProfile,
  fetchSmartReplySuggestions,
  formatBytes,
  markConversationReadRequest,
  sendMessageRequest,
  shortHash,
  uploadAttachmentRequest,
  type ApiConversationSummary,
  type ApiMessage,
  type ApiMessagingProfile,
  type ApiUserSummary,
  type ChatMessage,
  type ChatReaction,
  type ProjectConversation,
} from "@/lib/messaging";

type MessagingWorkspaceProps = {
  activeProjectId?: string;
};

type FilterMode = "All" | "Active" | "Unread";

const reactionOptions = ["👍", "❤️", "🔥", "✅"];
const defaultSmartReplies = [
  "I'll review this milestone soon.",
  "Please upload the final deliverables.",
  "Ready to store this onchain.",
];

const freelancerNavigationItems = [
  { label: "Dashboard", to: "/freelancer/dashboard", icon: LayoutDashboard },
  { label: "Projects", to: "/freelancer/projects", icon: Archive },
  { label: "Messages", to: "/messages", icon: MessageSquare },
  { label: "Submit Work", to: "/freelancer/submit-work", icon: Upload },
  { label: "NFT Certificates", to: "/freelancer/nft-certificates", icon: Gem },
  { label: "Earnings", to: "/freelancer/earnings", icon: CircleDollarSign },
  { label: "Settings", to: "/auth", icon: Settings },
];

const clientNavigationItems = [
  { label: "Dashboard", to: "/client/dashboard", icon: LayoutDashboard },
  { label: "Approvals", to: "/client/approval-workflow", icon: BadgeCheck },
  { label: "Projects", to: "/client/project-details", icon: Archive },
  { label: "Messages", to: "/messages", icon: MessageSquare },
  { label: "Settings", to: "/auth", icon: Settings },
];

const statusStyles: Record<ProjectConversation["status"], string> = {
  Active: "border-primary/40 bg-primary/12 text-primary",
  Review: "border-info/40 bg-info/12 text-info",
  Funded: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  Completed: "border-border/70 bg-secondary text-foreground",
};

function resolveNavigationItems(role?: ApiMessagingProfile["role"] | null) {
  if (role === "CLIENT") {
    return clientNavigationItems;
  }

  return freelancerNavigationItems;
}

function getDisplayName(user: ApiUserSummary | null | undefined, fallback: string) {
  return user?.fullName?.trim() || user?.username?.trim() || fallback;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "now";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function mapProjectStatus(status?: string | null): ProjectConversation["status"] {
  switch (status) {
    case "submitted":
    case "rejected":
    case "disputed":
      return "Review";
    case "approved":
      return "Funded";
    case "completed":
      return "Completed";
    default:
      return "Active";
  }
}

function buildParticipant(
  user: ApiUserSummary | null | undefined,
  role: "Client" | "Freelancer",
): ProjectConversation["client"] {
  const name = getDisplayName(user, role === "Client" ? "Client" : "Freelancer");
  return {
    id: user?.id ?? `${role.toLowerCase()}-unknown`,
    name,
    role,
    initials: getInitials(name),
    wallet: user?.walletAddress ? shortHash(user.walletAddress) : "0x0000...0000",
    online: Boolean(user?.id),
  };
}

function mapReactionCounts(reactions: ApiMessage["reactions"], currentUserId?: string | null) {
  const byEmoji = new Map<string, ChatReaction>();

  (reactions ?? []).forEach((reaction) => {
    const emoji = reaction.emoji;
    const existing = byEmoji.get(emoji);
    const reactedByMe = Boolean(
      currentUserId &&
        (reaction.user?.id === currentUserId || reaction.userId === currentUserId),
    );

    if (!existing) {
      byEmoji.set(emoji, { emoji, count: 1, reactedByMe });
      return;
    }

    byEmoji.set(emoji, {
      ...existing,
      count: existing.count + 1,
      reactedByMe: existing.reactedByMe || reactedByMe,
    });
  });

  return Array.from(byEmoji.values());
}

function mapApiMessage(
  message: ApiMessage,
  projectId: string,
  currentUserId?: string | null,
): ChatMessage {
  const messageType = message.messageType ?? "TEXT";
  const senderRole = message.sender?.role;
  const isSystem = messageType === "SYSTEM";
  const isMine = Boolean(currentUserId && message.senderId === currentUserId);
  const sender = isSystem
    ? "system"
    : isMine
      ? "me"
      : senderRole === "CLIENT"
        ? "client"
        : senderRole === "FREELANCER"
          ? "freelancer"
          : "client";

  const author =
    message.sender?.fullName?.trim() ||
    message.sender?.username?.trim() ||
    (isSystem ? "ProofChain" : "ProofChain user");
  const role =
    senderRole === "CLIENT" ? "Client" : senderRole === "FREELANCER" ? "Freelancer" : undefined;
  const attachments = message.attachments?.map((attachment) => ({
    id: attachment.id,
    fileName: attachment.fileName,
    fileUrl: attachment.downloadUrl ?? attachment.fileUrl,
    previewUrl: attachment.previewUrl ?? undefined,
    fileType: attachment.fileType,
    fileSize: attachment.fileSize,
  }));
  const hasReads = (message.reads ?? []).some(
    (read) => read.user?.id && read.user.id !== currentUserId,
  );
  const status = isMine ? (hasReads ? "seen" : "delivered") : "delivered";
  const fallbackContent = attachments?.length
    ? `Shared ${attachments[0].fileName}`
    : "Message";
  const content = message.isDeleted ? "Message deleted" : decodeMessageText(message.content || fallbackContent);

  return {
    id: message.id,
    projectId,
    sender,
    author,
    role,
    content,
    timestamp: formatTimestamp(message.createdAt),
    status,
    type: messageType === "FILE" ? "file" : messageType === "SYSTEM" ? "system" : "text",
    attachments,
    reactions: mapReactionCounts(message.reactions, currentUserId),
  };
}

function mapConversationSummaries(
  summaries: ApiConversationSummary[],
  currentUserId?: string | null,
): ProjectConversation[] {
  return summaries.map((summary) => {
    const client = buildParticipant(summary.project.owner, "Client");
    const freelancer = buildParticipant(
      summary.project.freelancer ?? summary.project.invitedFreelancer,
      "Freelancer",
    );
    const projectTitle = summary.project.title || "Project Chat";
    const latestMessage = summary.latestMessage
      ? mapApiMessage(summary.latestMessage, summary.projectId, currentUserId)
      : null;

    return {
      id: summary.id,
      projectId: summary.projectId,
      title: projectTitle,
      status: mapProjectStatus(summary.project.status),
      lastMessage: latestMessage?.content ?? "Workspace opened",
      timestamp: latestMessage?.timestamp ?? formatTimestamp(summary.updatedAt),
      unread: summary.unreadCount ?? 0,
      online: Boolean(summary.project.freelancer?.id || summary.project.invitedFreelancer?.id),
      client,
      freelancer,
      messages: latestMessage ? [latestMessage] : [],
    };
  });
}

// Conversations are loaded from the backend; no demo data is used.

function mapInboundMessage(
  payload: unknown,
  fallbackProjectId: string,
  currentUserId?: string | null,
): ChatMessage | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as ApiMessage;
  const projectId =
    typeof record.projectId === "string"
      ? record.projectId
      : typeof record.conversation?.projectId === "string"
        ? record.conversation.projectId
        : fallbackProjectId;

  return mapApiMessage(
    {
      ...record,
      projectId,
      messageType: (record.messageType ?? "TEXT") as ApiMessage["messageType"],
    },
    projectId,
    currentUserId,
  );
}

function updateConversationMessage(
  conversations: ProjectConversation[],
  projectId: string,
  updater: (messages: ChatMessage[]) => ChatMessage[],
) {
  return conversations.map((conversation) => {
    if (conversation.projectId !== projectId) {
      return conversation;
    }

    const messages = updater(conversation.messages);
    const latest = messages[messages.length - 1];

    return {
      ...conversation,
      messages,
      lastMessage: latest?.content || conversation.lastMessage,
      timestamp: latest?.timestamp || conversation.timestamp,
    };
  });
}

function toggleReaction(reactions: ChatReaction[] | undefined, emoji: string) {
  const existing = reactions?.find((reaction) => reaction.emoji === emoji);

  if (!existing) {
    return [...(reactions ?? []), { emoji, count: 1, reactedByMe: true }];
  }

  return (reactions ?? [])
    .map((reaction) => {
      if (reaction.emoji !== emoji) {
        return reaction;
      }

      const count = reaction.reactedByMe ? Math.max(0, reaction.count - 1) : reaction.count + 1;
      return { ...reaction, count, reactedByMe: !reaction.reactedByMe };
    })
    .filter((reaction) => reaction.count > 0);
}

function ConversationStatus({ status }: { status: ProjectConversation["status"] }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        statusStyles[status],
      )}
    >
      {status}
    </span>
  );
}

function Sidebar({
  isOpen,
  onClose,
  navItems,
  profile,
}: {
  isOpen: boolean;
  onClose: () => void;
  navItems: typeof freelancerNavigationItems;
  profile: ApiMessagingProfile | null;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications({ limit: 4 });

  return (
    <aside
      className={cn(
        "glass-panel fixed inset-x-4 top-16 z-40 rounded-2xl p-4 lg:static lg:block lg:h-[calc(100vh-32px)] lg:w-auto",
        isOpen ? "block" : "hidden",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <span className="status-dot shrink-0" />
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-bold text-foreground">
              ProofChain
            </span>
            <span className="block truncate text-xs text-muted-foreground">Freelance OS</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle className="h-8 w-8" />
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-secondary text-muted-foreground lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/8 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-2 text-xs text-primary">
            <WalletCards className="h-4 w-4 shrink-0" />
            <span className="truncate">{profile?.walletAddress ? shortHash(profile.walletAddress) : "Connect wallet"}</span>
          </span>
          <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
        </div>
      </div>

      <nav className="mt-5 space-y-1">
        {navItems.map((item) => {
          const active = item.label === "Messages";
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={onClose}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200",
                active
                  ? "border border-primary/30 bg-primary/12 text-foreground shadow-[0_0_28px_oklch(0.72_0.2_151/0.13)]"
                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="relative mt-5 rounded-2xl border border-border/70 bg-surface/80 p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-primary/30">
            <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
              {profile?.username ? getInitials(profile.username) : "U?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {profile?.username ?? "You"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {profile?.role === "CLIENT" ? "Client" : profile?.role === "FREELANCER" ? "Freelancer" : "User"} · Online
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNotificationsOpen((open) => !open)}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary" />
            ) : null}
          </button>
        </div>
        {notificationsOpen ? (
          <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 rounded-xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur lg:bottom-auto lg:top-[calc(100%+8px)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={!unreadCount}
                className="text-xs text-primary disabled:text-muted-foreground"
              >
                Mark all read
              </button>
            </div>
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {isLoading ? (
                <p className="rounded-lg border border-border/70 bg-secondary/30 p-3 text-sm text-muted-foreground">Loading notifications...</p>
              ) : notifications.length ? (
                notifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openNotification(item, markRead, () => setNotificationsOpen(false))}
                    className="w-full rounded-lg border border-border/70 bg-secondary/35 p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/60"
                  >
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
                  </button>
                ))
              ) : (
                <p className="rounded-lg border border-border/70 bg-secondary/30 p-3 text-sm text-muted-foreground">No notifications yet.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function ConversationList({
  conversations,
  activeProjectId,
  filter,
  search,
  newConversationHref,
  onFilterChange,
  onSearchChange,
}: {
  conversations: ProjectConversation[];
  activeProjectId: string | null;
  filter: FilterMode;
  search: string;
  newConversationHref: string;
  onFilterChange: (filter: FilterMode) => void;
  onSearchChange: (search: string) => void;
}) {
  const filtered = conversations.filter((conversation) => {
    const matchesSearch = conversation.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "All" ||
      (filter === "Active" && conversation.status !== "Completed") ||
      (filter === "Unread" && conversation.unread > 0);

    return matchesSearch && matchesFilter;
  });

  return (
    <section className="glass-panel flex min-h-[520px] flex-col rounded-2xl">
      <div className="border-b border-border/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Messages</h1>
            <p className="mt-1 text-xs text-muted-foreground">Project rooms · live workflow</p>
          </div>
          <a
            href={newConversationHref}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            aria-label="New conversation"
            title="Open project conversations"
          >
            <Plus className="h-4 w-4" />
          </a>
        </div>

        <label className="mt-4 flex items-center gap-2 rounded-xl border border-border/70 bg-secondary/55 px-3 py-2 text-sm text-muted-foreground focus-within:border-primary/50 focus-within:shadow-[0_0_24px_oklch(0.72_0.2_151/0.11)]">
          <Search className="h-4 w-4 shrink-0" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Search project conversations"
          />
        </label>

        <div className="mt-3 grid grid-cols-3 rounded-xl border border-border/70 bg-background/40 p-1">
          {(["All", "Active", "Unread"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onFilterChange(item)}
              className={cn(
                "rounded-lg px-2 py-1.5 text-xs font-semibold transition-all",
                filter === item
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {filtered.map((conversation, index) => {
            const active = conversation.projectId === activeProjectId;
            return (
              <motion.div
                key={conversation.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.035 }}
              >
                <Link
                  to="/projects/$id/chat"
                  params={{ id: conversation.projectId }}
                  className={cn(
                    "group block rounded-2xl border p-3 transition-all duration-200",
                    active
                      ? "border-primary/55 bg-primary/10 shadow-[0_0_32px_oklch(0.72_0.2_151/0.13)]"
                      : "border-border/60 bg-surface/65 hover:scale-[1.01] hover:border-primary/35 hover:bg-surface-elevated/70",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10 border border-border/70">
                          <AvatarFallback className="bg-secondary text-xs font-bold text-foreground">
                            {conversation.freelancer.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                            conversation.online ? "bg-primary" : "bg-muted-foreground",
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {conversation.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {conversation.lastMessage}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] text-muted-foreground">{conversation.timestamp}</p>
                      {conversation.unread ? (
                        <span className="mt-2 inline-flex min-w-5 justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                          {conversation.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <ConversationStatus status={conversation.status} />
                    <span className="truncate text-[11px] text-muted-foreground">
                      Client: {conversation.client.name} · Freelancer: {conversation.freelancer.name}
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>
    </section>
  );
}

function Header({
  conversation,
  connectionLabel,
  messageSearchOpen,
  proofsOnly,
  toolsOpen,
  onToggleSearch,
  onAttachFile,
  onToggleProofs,
  onToggleTools,
}: {
  conversation: ProjectConversation;
  connectionLabel: string;
  messageSearchOpen: boolean;
  proofsOnly: boolean;
  toolsOpen: boolean;
  onToggleSearch: () => void;
  onAttachFile: () => void;
  onToggleProofs: () => void;
  onToggleTools: () => void;
}) {
  const actions = [
    { label: "Search messages", icon: Search, onClick: onToggleSearch, active: messageSearchOpen },
    { label: "Attach file", icon: Paperclip, onClick: onAttachFile, active: false },
    { label: "Pinned proofs", icon: Pin, onClick: onToggleProofs, active: proofsOnly },
    { label: "More options", icon: MoreHorizontal, onClick: onToggleTools, active: toolsOpen },
  ];

  return (
    <header className="flex min-h-20 items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex -space-x-2">
          {[conversation.client, conversation.freelancer].map((participant) => (
            <Avatar key={participant.id} className="h-10 w-10 border-2 border-background">
              <AvatarFallback className="bg-secondary text-xs font-bold text-foreground">
                {participant.initials}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-display text-lg font-bold text-foreground">
              {conversation.title}
            </h2>
            <ConversationStatus status={conversation.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-secondary/60 px-2 py-0.5">
              Client: {conversation.client.name}
            </span>
            <span className="rounded-full border border-border/70 bg-secondary/60 px-2 py-0.5">
              Freelancer: {conversation.freelancer.name}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {conversation.online ? "Online" : "Last active 18m ago"} · {connectionLabel}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-secondary text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground",
              action.active && "border-primary/50 bg-primary/12 text-primary",
            )}
            aria-label={action.label}
            title={action.label}
          >
            <action.icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </header>
  );
}

function SystemMessage({ message }: { message: ChatMessage }) {
  const Icon = message.event?.label.toLowerCase().includes("nft")
    ? Gem
    : message.event?.label.toLowerCase().includes("payment") ||
        message.event?.label.toLowerCase().includes("escrow")
      ? CircleDollarSign
      : Blocks;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto my-2 w-full max-w-xl rounded-2xl border border-primary/30 bg-[linear-gradient(135deg,oklch(0.2_0.015_248/0.86),oklch(0.17_0.02_151/0.52))] p-4 shadow-[0_0_38px_oklch(0.72_0.2_151/0.13)]"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/12 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{message.content}</p>
            {message.event?.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </span>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/35 p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Event</p>
              <p className="mt-1 truncate text-xs text-foreground">{message.event?.label}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/35 p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Tx hash</p>
              <p className="mt-1 truncate text-xs text-primary">
                {shortHash(message.event?.txHash)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/35 p-2">
              <p className="text-[10px] uppercase text-muted-foreground">
                {message.event?.amount ? "Amount" : "Network"}
              </p>
              <p className="mt-1 truncate text-xs text-foreground">
                {message.event?.amount ?? message.event?.network}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{message.timestamp}</p>
        </div>
      </div>
    </motion.div>
  );
}

function AttachmentCard({
  attachment,
}: {
  attachment: NonNullable<ChatMessage["attachments"]>[number];
}) {
  const isImage = attachment.fileType.startsWith("image/");
  const isZip = attachment.fileType.includes("zip") || attachment.fileName.endsWith(".zip");
  const Icon = isImage ? ImageIcon : isZip ? FileArchive : FileText;

  return (
    <div className="mt-3 rounded-2xl border border-border/70 bg-background/45 p-3">
      {isImage && attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.fileName}
          className="mb-3 aspect-video w-full rounded-xl border border-border/60 object-cover"
        />
      ) : null}
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{attachment.fileName}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(attachment.fileSize)}</p>
        </div>
        <a
          href={attachment.fileUrl}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-secondary text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Download ${attachment.fileName}`}
          title="Download"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onReaction,
}: {
  message: ChatMessage;
  onReaction: (messageId: string, emoji: string) => void;
}) {
  if (message.type === "system") {
    return <SystemMessage message={message} />;
  }

  const mine = message.sender === "me";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("group flex gap-3", mine ? "justify-end" : "justify-start")}
    >
      {!mine ? (
        <Avatar className="mt-1 h-8 w-8 border border-border/70">
          <AvatarFallback className="bg-secondary text-[11px] font-bold text-foreground">
            {message.author
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      ) : null}
      <div className={cn("max-w-[min(680px,82%)]", mine && "items-end")}>
        <div className={cn("flex items-center gap-2 pb-1", mine ? "justify-end" : "justify-start")}>
          <span className="text-xs font-semibold text-foreground">
            {mine ? "You" : message.author}
          </span>
          {message.role ? (
            <span className="text-[11px] text-muted-foreground">{message.role}</span>
          ) : null}
          <span className="text-[11px] text-muted-foreground">{message.timestamp}</span>
        </div>
        <div
          className={cn(
            "relative rounded-2xl border px-4 py-3 shadow-[0_14px_32px_oklch(0.05_0.01_250/0.28)]",
            mine
              ? "border-primary/30 bg-primary/14 text-foreground"
              : "border-border/70 bg-surface-elevated/78 text-foreground",
          )}
        >
          <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
          {message.attachments?.map((attachment) => (
            <AttachmentCard key={attachment.id} attachment={attachment} />
          ))}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {message.reactions?.map((reaction) => (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => onReaction(message.id, reaction.emoji)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all",
                    reaction.reactedByMe
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/70 bg-background/35 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              ))}
            </div>
            {mine ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                {message.status === "seen" ? (
                  <CheckCheck className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {message.status ?? "delivered"}
              </span>
            ) : null}
          </div>
          <div className="absolute -bottom-4 right-3 hidden gap-1 rounded-full border border-border/70 bg-background/95 p-1 shadow-lg group-hover:flex">
            {reactionOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReaction(message.id, emoji)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110 hover:bg-secondary"
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="glass-panel flex min-h-[520px] items-center justify-center rounded-2xl p-6">
      <div className="relative w-full max-w-md text-center">
        <div className="mx-auto grid h-44 w-64 grid-cols-6 gap-2 rounded-2xl border border-border/70 bg-surface/75 p-4">
          {Array.from({ length: 24 }).map((_, index) => (
            <motion.span
              key={index}
              className={cn(
                "rounded-sm border border-border/60 bg-secondary/70",
                index % 5 === 0 && "border-primary/40 bg-primary/15",
              )}
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, delay: index * 0.04 }}
            />
          ))}
        </div>
        <div className="mt-5 inline-flex rounded-2xl border border-primary/30 bg-primary/10 p-3 text-primary">
          <MessageCircle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-foreground">
          Select a project conversation
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Project updates, UGF payment activity, and NFT proof events will appear here.
        </p>
      </div>
    </div>
  );
}

function MessageComposer({
  value,
  uploadProgress,
  isDragging,
  fileInputRef,
  smartReplies,
  proofing,
  onChange,
  onSend,
  onDropFile,
  onPickFile,
  onDragState,
  onSmartReply,
  onLoadSmartReplies,
  onStoreProof,
}: {
  value: string;
  uploadProgress: number | null;
  isDragging: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  smartReplies: string[];
  proofing: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  onDropFile: (file: File) => void;
  onPickFile: (file: File) => void;
  onDragState: (isDragging: boolean) => void;
  onSmartReply: (reply: string) => void;
  onLoadSmartReplies: () => void;
  onStoreProof: () => void;
}) {
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onDragState(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      onDropFile(file);
    }
  };

  return (
    <div
      className={cn(
        "border-t border-border/70 bg-background/40 p-4 backdrop-blur-xl",
        isDragging && "bg-primary/8",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        onDragState(true);
      }}
      onDragLeave={() => onDragState(false)}
      onDrop={handleDrop}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {smartReplies.map((reply) => (
          <button
            key={reply}
            type="button"
            onClick={() => onSmartReply(reply)}
            className="rounded-full border border-border/70 bg-secondary/70 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {reply}
          </button>
        ))}
      </div>

      {uploadProgress !== null ? (
        <div className="mb-3 rounded-xl border border-primary/30 bg-primary/8 p-2">
          <div className="flex items-center justify-between text-xs text-primary">
            <span>Uploading attachment</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/80 bg-surface/82 p-2 shadow-[0_18px_46px_oklch(0.05_0.01_250/0.36)] focus-within:border-primary/50 focus-within:shadow-[0_0_34px_oklch(0.72_0.2_151/0.14)]">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Send a message or upload deliverables..."
          className="min-h-16 resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onLoadSmartReplies}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Refresh smart replies"
              title="Refresh smart replies"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Upload file"
              title="Upload file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onStoreProof}
              disabled={proofing}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Store latest message proof"
              title="Store latest message proof"
            >
              <Blocks className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={onSend} disabled={!value.trim()} className="rounded-xl px-4">
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onPickFile(file);
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function ChatArea({
  conversation,
  connectionLabel,
  draft,
  uploadProgress,
  isDragging,
  typingLabel,
  smartReplies,
  proofing,
  onDraftChange,
  onSend,
  onFile,
  onDragState,
  onReaction,
  onLoadSmartReplies,
  onStoreProof,
  onMarkRead,
}: {
  conversation: ProjectConversation;
  connectionLabel: string;
  draft: string;
  uploadProgress: number | null;
  isDragging: boolean;
  typingLabel: string | null;
  smartReplies: string[];
  proofing: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onFile: (file: File) => void;
  onDragState: (isDragging: boolean) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onLoadSmartReplies: () => void;
  onStoreProof: () => void;
  onMarkRead: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [proofsOnly, setProofsOnly] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const visibleMessages = useMemo(() => {
    const needle = messageSearch.trim().toLowerCase();

    return conversation.messages.filter((message) => {
      const matchesProof = !proofsOnly || message.type === "system" || Boolean(message.event);
      const matchesSearch =
        !needle ||
        [message.content, message.author, message.role, message.event?.label, message.event?.txHash]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));

      return matchesProof && matchesSearch;
    });
  }, [conversation.messages, messageSearch, proofsOnly]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visibleMessages.length, typingLabel]);

  return (
    <section className="glass-panel flex min-h-[calc(100vh-32px)] flex-col overflow-hidden rounded-2xl">
      <Header
        conversation={conversation}
        connectionLabel={connectionLabel}
        messageSearchOpen={messageSearchOpen}
        proofsOnly={proofsOnly}
        toolsOpen={toolsOpen}
        onToggleSearch={() => setMessageSearchOpen((open) => !open)}
        onAttachFile={() => fileInputRef.current?.click()}
        onToggleProofs={() => setProofsOnly((enabled) => !enabled)}
        onToggleTools={() => setToolsOpen((open) => !open)}
      />
      {messageSearchOpen ? (
        <div className="border-b border-border/70 bg-background/35 px-4 py-3">
          <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-secondary/55 px-3 py-2 text-sm text-muted-foreground focus-within:border-primary/50">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={messageSearch}
              onChange={(event) => setMessageSearch(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Search messages in this room"
            />
          </label>
        </div>
      ) : null}
      {toolsOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-background/35 px-4 py-3 text-xs text-muted-foreground">
          <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={onMarkRead}>
            Mark read
          </Button>
          <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={onStoreProof} disabled={proofing}>
            Store proof
          </Button>
          <Button size="sm" variant="outline" className="h-8 rounded-lg" asChild>
            <Link to="/project-details">Project details</Link>
          </Button>
          <span className="ml-auto truncate font-mono">{conversation.projectId}</span>
        </div>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 px-4 py-5">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border/70 bg-secondary/55 px-3 py-1 text-xs text-muted-foreground">
            <Bot className="h-3.5 w-3.5 text-primary" />
            Workflow events are synced into this room
          </div>
          <AnimatePresence initial={false}>
            {visibleMessages.map((message) => (
              <MessageBubble key={message.id} message={message} onReaction={onReaction} />
            ))}
          </AnimatePresence>
          {!visibleMessages.length ? (
            <p className="rounded-xl border border-border/70 bg-secondary/35 p-4 text-center text-sm text-muted-foreground">
              No messages match this view.
            </p>
          ) : null}
          {typingLabel ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span className="inline-flex h-7 items-center gap-1 rounded-full border border-border/70 bg-secondary px-3">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                {typingLabel}
              </span>
            </motion.div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <MessageComposer
        value={draft}
        uploadProgress={uploadProgress}
        isDragging={isDragging}
        fileInputRef={fileInputRef}
        smartReplies={smartReplies}
        proofing={proofing}
        onChange={onDraftChange}
        onSend={onSend}
        onDropFile={onFile}
        onPickFile={onFile}
        onDragState={onDragState}
        onSmartReply={onDraftChange}
        onLoadSmartReplies={onLoadSmartReplies}
        onStoreProof={onStoreProof}
      />
    </section>
  );
}

export function MessagingWorkspace({ activeProjectId }: MessagingWorkspaceProps) {
  const [conversations, setConversations] = useState<ProjectConversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<ApiMessagingProfile["role"] | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<ApiMessagingProfile | null>(null);
  const [filter, setFilter] = useState<FilterMode>("All");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [showNav, setShowNav] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [connectionLabel, setConnectionLabel] = useState("Preview mode");
  const [typingLabel, setTypingLabel] = useState<string | null>(null);
  const [smartReplies, setSmartReplies] = useState(defaultSmartReplies);
  const [proofing, setProofing] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);
  const socketRef = useRef<ReturnType<typeof createMessagingSocket>>(null);
  const readSyncKeyRef = useRef<string | null>(null);

  const selectedProjectId = activeProjectId ?? null;
  const navItems = useMemo(
    () => (currentUserRole ? resolveNavigationItems(currentUserRole) : []),
    [currentUserRole],
  );
  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.projectId === selectedProjectId) ?? null,
    [conversations, selectedProjectId],
  );
  const newConversationHref = currentUserRole === "CLIENT" ? "/client/project-details" : "/freelancer/projects";

  useEffect(() => {
    let isActive = true;

    const loadMessagingData = async () => {
      const profile = await fetchMessagingProfile();

      if (!isActive) {
        return;
      }

      if (profile) {
        setCurrentUserId(profile.id);
        setCurrentUserRole(profile.role);
        setCurrentUserProfile(profile);
      }

      const summaries = await fetchConversationSummaries();

      if (!isActive) {
        return;
      }

      if (summaries?.length) {
        setConversations(mapConversationSummaries(summaries, profile?.id ?? null));
      }
    };

    void loadMessagingData();

    return () => {
      isActive = false;
    };
  }, []);

  // Conversations are loaded from the backend; do not inject demo conversations.

  useEffect(() => {
    if (!activeConversation) {
      return;
    }

    const conversationId = activeConversation.id;
    const projectId = activeConversation.projectId;
    let isActive = true;

    const loadMessages = async () => {
      const page = await fetchConversationMessages(conversationId, 60);

      if (!isActive || !page) {
        return;
      }

      const mapped = page.messages.map((message) =>
        mapApiMessage(message, projectId, currentUserId),
      );
      const latest = mapped[mapped.length - 1];

      setConversations((current) =>
        current.map((conversation) =>
          conversation.projectId === projectId
            ? {
                ...conversation,
                messages: mapped,
                lastMessage: latest?.content || conversation.lastMessage,
                timestamp: latest?.timestamp || conversation.timestamp,
              }
            : conversation,
        ),
      );
    };

    void loadMessages();

    return () => {
      isActive = false;
    };
  }, [activeConversation?.id, activeConversation?.projectId, currentUserId]);

  useEffect(() => {
    setSmartReplies(defaultSmartReplies);
    readSyncKeyRef.current = null;
  }, [activeConversation?.id]);

  useEffect(() => {
    if (!activeConversation || !currentUserId) {
      return undefined;
    }

    const incomingMessageIds = activeConversation.messages
      .filter((message) => message.sender !== "me" && message.sender !== "system" && !message.id.startsWith("local-"))
      .map((message) => message.id);

    if (!incomingMessageIds.length) {
      return undefined;
    }

    const syncKey = `${activeConversation.id}:${incomingMessageIds.join(",")}`;
    if (readSyncKeyRef.current === syncKey) {
      return undefined;
    }

    readSyncKeyRef.current = syncKey;
    const timer = window.setTimeout(() => {
      void markConversationReadRequest(activeConversation.id).then((result) => {
        if (!result) {
          return;
        }

        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === activeConversation.id ? { ...conversation, unread: 0 } : conversation,
          ),
        );
      });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [activeConversation?.id, activeConversation?.messages, currentUserId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setConnectionLabel("Select a room");
      return undefined;
    }

    const socket = createMessagingSocket(selectedProjectId);
    socketRef.current = socket;

    if (!socket) {
      setConnectionLabel("Preview mode");
      return undefined;
    }

    setConnectionLabel("Connecting");

    socket.on("connect", () => {
      setConnectionLabel("Live socket");
      socket.emit("join_project_room", { projectId: selectedProjectId });
    });

    socket.on("disconnect", () => setConnectionLabel("Reconnecting"));
    socket.on("receive_message", (payload) => {
      const inbound = mapInboundMessage(payload, selectedProjectId, currentUserId);
      if (!inbound) {
        return;
      }

      setConversations((current) =>
        updateConversationMessage(current, inbound.projectId, (messages) =>
          messages.some((message) => message.id === inbound.id)
            ? messages
            : [
                ...messages.filter(
                  (message) =>
                    !(
                      inbound.sender === "me" &&
                      (message.id.startsWith("local-") || message.id.startsWith("file-")) &&
                      message.content === inbound.content
                    ),
                ),
                inbound,
              ],
        ),
      );
    });

    const applySeenReceipt = (payload: { projectId?: string; userId?: string; messageId?: string; messageIds?: string[] }) => {
      if (!payload.projectId || payload.userId === currentUserId) {
        return;
      }

      const seenIds = new Set([...(payload.messageIds ?? []), payload.messageId].filter(Boolean) as string[]);
      if (!seenIds.size) {
        return;
      }

      setConversations((current) =>
        updateConversationMessage(current, payload.projectId as string, (messages) =>
          messages.map((message) =>
            message.sender === "me" && seenIds.has(message.id) ? { ...message, status: "seen" } : message,
          ),
        ),
      );
    };

    socket.on("message_seen", applySeenReceipt);
    socket.on("message_read", applySeenReceipt);
    socket.on("conversation_seen", applySeenReceipt);

    socket.on("typing_start", (payload: { userId?: string; projectId?: string }) => {
      if (payload.projectId === selectedProjectId && payload.userId !== currentUserId) {
        setTypingLabel("Client is typing...");
      }
    });

    socket.on("typing_stop", () => setTypingLabel(null));

    return () => {
      socket.emit("leave_project_room", { projectId: selectedProjectId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [selectedProjectId, currentUserId]);

  const addMessage = (projectId: string, message: ChatMessage) => {
    setConversations((current) =>
      updateConversationMessage(current, projectId, (messages) => [...messages, message]),
    );
  };

  const handleSend = async () => {
    if (!activeConversation || !draft.trim()) {
      return;
    }

    const roleLabel = currentUserRole === "CLIENT" ? "Client" : "Freelancer";
    const authorName =
      currentUserRole === "CLIENT" ? activeConversation.client.name : activeConversation.freelancer.name;
    const content = draft.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const optimisticMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      projectId: activeConversation.projectId,
      sender: "me",
      author: authorName,
      role: roleLabel,
      content,
      timestamp,
      status: "delivered",
      type: "text",
    };

    setDraft("");
    addMessage(activeConversation.projectId, optimisticMessage);

    try {
      const savedMessage = await sendMessageRequest({ projectId: activeConversation.projectId, content });
      const confirmedMessage = savedMessage
        ? mapApiMessage(savedMessage, activeConversation.projectId, currentUserId)
        : null;

      window.setTimeout(() => {
        setConversations((current) =>
          updateConversationMessage(current, activeConversation.projectId, (messages) =>
            confirmedMessage
              ? [
                  ...messages.filter(
                    (message) =>
                      message.id !== optimisticMessage.id && message.id !== confirmedMessage.id,
                  ),
                  confirmedMessage,
                ]
              : messages.map((message) =>
                  message.id === optimisticMessage.id ? { ...message, status: "delivered" } : message,
                ),
          ),
        );
      }, 250);
    } catch (_error) {
      setConversations((current) =>
        updateConversationMessage(current, activeConversation.projectId, (messages) =>
          messages.map((message) =>
            message.id === optimisticMessage.id
              ? { ...message, status: "delivered", content: `${message.content}` }
              : message,
          ),
        ),
      );
    }
  };

  const handleFile = async (file: File) => {
    if (!activeConversation) {
      return;
    }

    const roleLabel = currentUserRole === "CLIENT" ? "Client" : "Freelancer";
    const authorName =
      currentUserRole === "CLIENT" ? activeConversation.client.name : activeConversation.freelancer.name;
    setUploadProgress(12);
    const isImage = file.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const optimisticMessage: ChatMessage = {
      id: `file-${Date.now()}`,
      projectId: activeConversation.projectId,
      sender: "me",
      author: authorName,
      role: roleLabel,
      content: draft.trim() || `Shared ${file.name}`,
      timestamp,
      status: "delivered",
      type: "file",
      attachments: [
        {
          id: `attachment-${Date.now()}`,
          fileName: file.name,
          fileUrl: previewUrl ?? "#",
          previewUrl,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
        },
      ],
    };

    addMessage(activeConversation.projectId, optimisticMessage);
    setDraft("");

    try {
      const savedMessage = await uploadAttachmentRequest({
        projectId: activeConversation.projectId,
        file,
        content: optimisticMessage.content,
        onProgress: setUploadProgress,
      });
      const confirmedMessage = savedMessage
        ? mapApiMessage(savedMessage, activeConversation.projectId, currentUserId)
        : null;

      if (confirmedMessage) {
        setConversations((current) =>
          updateConversationMessage(current, activeConversation.projectId, (messages) => [
            ...messages.filter(
              (message) =>
                message.id !== optimisticMessage.id &&
                message.id !== confirmedMessage.id &&
                !(
                  message.sender === "me" &&
                  message.content === confirmedMessage.content &&
                  message.attachments?.[0]?.fileName === confirmedMessage.attachments?.[0]?.fileName
                ),
            ),
            confirmedMessage,
          ]),
        );
      }
    } finally {
      window.setTimeout(() => setUploadProgress(null), 450);
    }
  };

  const handleLoadSmartReplies = async () => {
    if (!activeConversation) {
      return;
    }

    const suggestions = await fetchSmartReplySuggestions(activeConversation.id);
    if (suggestions?.length) {
      setSmartReplies(suggestions.map((reply) => decodeMessageText(reply)));
      toast.success("Smart replies refreshed");
      return;
    }

    toast("No new suggestions available");
  };

  const handleMarkConversationRead = async () => {
    if (!activeConversation) {
      return;
    }

    const result = await markConversationReadRequest(activeConversation.id);
    if (!result) {
      toast.error("Could not mark conversation as read");
      return;
    }

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversation.id ? { ...conversation, unread: 0 } : conversation,
      ),
    );
    toast.success("Conversation marked read");
  };

  const handleStoreProof = async () => {
    if (!activeConversation) {
      return;
    }

    const target = [...activeConversation.messages]
      .reverse()
      .find((message) => message.sender === "me" && message.type !== "system" && !message.id.startsWith("local-"));

    if (!target) {
      toast.error("Send a message before storing a proof");
      return;
    }

    setProofing(true);
    try {
      const result = await createMessageProofRequest(target.id);

      if (!result) {
        throw new Error("Proof request failed");
      }

      const proofMessage: ChatMessage = {
        id: `proof-${target.id}-${Date.now()}`,
        projectId: activeConversation.projectId,
        sender: "system",
        author: "ProofChain",
        content: result.submittedOnchain ? "Message proof stored onchain" : "Message proof hash prepared",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "system",
        event: {
          label: "Message proof",
          txHash: result.txHash ?? result.messageHash,
          network: "Base Sepolia",
          verified: Boolean(result.messageHash),
        },
      };

      addMessage(activeConversation.projectId, proofMessage);
      toast.success(result.submittedOnchain ? "Proof stored onchain" : "Proof hash prepared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Proof request failed");
    } finally {
      setProofing(false);
    }
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (!activeConversation) {
      return;
    }

    setConversations((current) =>
      updateConversationMessage(current, activeConversation.projectId, (messages) =>
        messages.map((message) =>
          message.id === messageId
            ? { ...message, reactions: toggleReaction(message.reactions, emoji) }
            : message,
        ),
      ),
    );

    socketRef.current?.emit("reaction_added", { messageId, emoji });
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!activeConversation) {
      return;
    }

    socketRef.current?.emit(value.trim() ? "typing_start" : "typing_stop", {
      projectId: activeConversation.projectId,
    });
  };

  return (
    <div className="min-h-screen bg-background px-3 py-4 text-foreground sm:px-4">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3">
        <div className="glass-panel flex items-center justify-between rounded-2xl px-3 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setShowNav(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-secondary text-muted-foreground"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Link to="/messages" className="font-display text-sm font-bold text-foreground">
            ProofChain Messages
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setShowConversationList((open) => !open)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-secondary text-muted-foreground"
              aria-label="Conversation menu"
              title={showConversationList ? "Hide conversations" : "Show conversations"}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showConversationList ? "rotate-180" : "")} />
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[240px_minmax(290px,380px)_minmax(0,1fr)]">
          <Sidebar
            isOpen={showNav}
            onClose={() => setShowNav(false)}
            navItems={navItems}
            profile={currentUserProfile}
          />
          <div className={cn(showConversationList ? "block" : "hidden lg:block")}>
            <ConversationList
              conversations={conversations}
              activeProjectId={selectedProjectId}
              filter={filter}
              search={search}
              newConversationHref={newConversationHref}
              onFilterChange={setFilter}
              onSearchChange={setSearch}
            />
          </div>
          {activeConversation ? (
            <ChatArea
              conversation={activeConversation}
              connectionLabel={connectionLabel}
              draft={draft}
              uploadProgress={uploadProgress}
              isDragging={isDragging}
              typingLabel={typingLabel}
              smartReplies={smartReplies}
              proofing={proofing}
              onDraftChange={handleDraftChange}
              onSend={handleSend}
              onFile={handleFile}
              onDragState={setIsDragging}
              onReaction={handleReaction}
              onLoadSmartReplies={handleLoadSmartReplies}
              onStoreProof={handleStoreProof}
              onMarkRead={handleMarkConversationRead}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}
