import { Link } from "@tanstack/react-router";
import { Bell, Command, Dot, Wallet2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/proofchain/theme-toggle";
import { useNotifications } from "@/hooks/use-notifications";
import { shortenWalletAddress, useWalletAddress } from "@/hooks/use-wallet-address";

const links = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How It Works" },
  { to: "/developers", label: "Developers" },
  { to: "/freelancer/dashboard", label: "Dashboard" },
];

export function ProofChainTopNav() {
  const walletAddress = useWalletAddress();
  const walletLabel = walletAddress ? shortenWalletAddress(walletAddress) : "Connect Wallet";
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications({ limit: 5 });
  const commandItems = useMemo(() => {
    const items = [
      { label: "Start as freelancer", to: "/auth" },
      { label: "Hire talent", to: "/auth" },
      { label: "Freelancer dashboard", to: "/freelancer/dashboard" },
      { label: "Client dashboard", to: "/client/dashboard" },
      { label: "Messages", to: "/messages" },
      { label: "Developers", to: "/developers" },
    ];
    const needle = commandQuery.trim().toLowerCase();
    return items.filter((item) => !needle || item.label.toLowerCase().includes(needle) || item.to.toLowerCase().includes(needle));
  }, [commandQuery]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-surface-glass/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-lg font-bold text-foreground transition-opacity hover:opacity-85"
        >
          <span className="status-dot" />
          ProofChain
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            "href" in link ? (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                to={link.to}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {link.label}
              </Link>
            )
          ))}
        </nav>

        <div className="relative flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-secondary px-3 py-1 text-xs text-muted-foreground sm:flex">
            <Dot className="h-4 w-4 text-success" />
            Base Sepolia Live
          </div>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => {
              setCommandOpen((open) => !open);
              setNotificationOpen(false);
            }}
            className="hidden h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-secondary text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            aria-label="Command palette"
          >
            <Command className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setNotificationOpen((open) => !open);
              setCommandOpen(false);
            }}
            className="relative hidden h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-secondary text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {Math.min(unreadCount, 99)}
              </span>
            ) : null}
          </button>
          <Button asChild variant="outline" size="sm" className="max-w-40 gap-2">
            <Link
              to="/auth"
              aria-label={walletAddress ? `Connected wallet ${walletAddress}` : "Connect wallet"}
              title={walletAddress ?? "Connect wallet"}
            >
              <Wallet2 className="h-4 w-4" />
              <span className="truncate">{walletLabel}</span>
            </Link>
          </Button>

          {commandOpen ? (
            <div className="absolute right-0 top-12 z-50 w-[min(calc(100vw-2rem),22rem)] rounded-xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur">
              <p className="text-xs font-medium uppercase text-primary">Command palette</p>
              <input
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border/70 bg-secondary/55 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="Search pages..."
                autoFocus
              />
              <div className="mt-2 grid gap-1">
                {commandItems.map((item) => (
                  <Link
                    key={`${item.label}-${item.to}`}
                    to={item.to}
                    onClick={() => setCommandOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {notificationOpen ? (
            <div className="absolute right-0 top-12 z-50 w-[min(calc(100vw-2rem),23rem)] rounded-xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur">
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
              <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                {isLoading ? (
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
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function ProofChainFooter() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-surface/60">
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-8 text-sm text-muted-foreground sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
        <p>© {new Date().getFullYear()} ProofChain · Gasless freelance infrastructure.</p>
        <div className="flex gap-4">
          <Link to="/developers" className="transition-colors hover:text-foreground">
            Docs
          </Link>
          <a href="https://github.com/" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
            GitHub
          </a>
          <a href="https://sepolia.basescan.org/" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
            Base Sepolia
          </a>
        </div>
        <p className="sm:text-right lg:text-left">UGF-integrated settlement · No ETH required.</p>
      </div>
    </footer>
  );
}
