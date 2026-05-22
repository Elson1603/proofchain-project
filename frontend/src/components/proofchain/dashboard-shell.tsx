import { useMemo, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Search, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { shortenWalletAddress, useWalletAddress } from "@/hooks/use-wallet-address";

interface NavItem {
  label: string;
  to: string;
}

interface DashboardShellProps {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  workspaceLabel?: string;
  notificationCount?: number;
  children: ReactNode;
}

export function DashboardShell({
  title,
  subtitle,
  navItems,
  workspaceLabel = "Freelance OS",
  notificationCount,
  children,
}: DashboardShellProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const walletAddress = useWalletAddress();
  const walletLabel = walletAddress ? shortenWalletAddress(walletAddress) : "No wallet";
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    isLoading: notificationsLoading,
    markRead,
    markAllRead,
  } = useNotifications({ limit: 6 });

  const searchableItems = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    const items = [
      ...navItems,
      { label: "Messages", to: "/messages" },
      { label: "Authentication", to: "/auth" },
    ];

    return items
      .filter((item, index, list) => list.findIndex((candidate) => candidate.to === item.to) === index)
      .filter((item) => !needle || item.label.toLowerCase().includes(needle) || item.to.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [navItems, searchQuery]);
  const visibleNotificationCount = notificationsLoading && typeof notificationCount === "number" ? notificationCount : unreadCount;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
        <aside className="glass-panel h-fit rounded-xl p-4">
          <p className="font-display text-base font-bold text-foreground">ProofChain</p>
          <p className="mt-1 text-xs text-muted-foreground">{workspaceLabel}</p>
          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="space-y-5">
          <div className="glass-panel relative z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((open) => !open);
                  setNotificationsOpen(false);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-secondary text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setSearchOpen(false);
                }}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-secondary text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {visibleNotificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                    {Math.min(visibleNotificationCount, 99)}
                  </span>
                )}
              </button>
              <Link
                to="/auth"
                className="inline-flex max-w-40 items-center gap-2 rounded-full border border-border/80 bg-secondary px-3 py-1 text-xs text-muted-foreground"
                aria-label={walletAddress ? `Connected wallet ${walletAddress}` : "Wallet connected"}
                title={walletAddress ?? "Wallet connected"}
              >
                <WalletCards className="h-3.5 w-3.5 text-primary" />
                <span className="truncate">{walletLabel}</span>
              </Link>
            </div>

            {searchOpen ? (
              <div className="w-full rounded-lg border border-border/70 bg-background/80 p-3">
                <label className="flex items-center gap-2 rounded-md border border-border/70 bg-secondary/50 px-3 py-2 text-sm">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                    placeholder="Search dashboard pages..."
                    autoFocus
                  />
                </label>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {searchableItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setSearchOpen(false)}
                      className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {notificationsOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[90] cursor-default bg-transparent"
                aria-label="Close notifications"
                onClick={() => setNotificationsOpen(false)}
              />
              <div className="fixed right-4 top-24 z-[100] w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur-xl sm:right-8">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Notifications</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => void markAllRead()}
                    disabled={!visibleNotificationCount}
                  >
                    Mark all read
                  </Button>
                </div>
                <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                  {notificationsLoading ? (
                    <p className="rounded-lg border border-border/70 bg-secondary/30 p-3 text-sm text-muted-foreground">Loading notifications...</p>
                  ) : notifications.length ? (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void markRead(item.id)}
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
            </>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
