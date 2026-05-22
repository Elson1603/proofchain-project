import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Search, WalletCards } from "lucide-react";
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
          <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-secondary text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-secondary text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {typeof notificationCount === "number" && notificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                    {Math.min(notificationCount, 99)}
                  </span>
                )}
              </button>
              <span
                className="inline-flex max-w-40 items-center gap-2 rounded-full border border-border/80 bg-secondary px-3 py-1 text-xs text-muted-foreground"
                aria-label={walletAddress ? `Connected wallet ${walletAddress}` : "Wallet connected"}
                title={walletAddress ?? "Wallet connected"}
              >
                <WalletCards className="h-3.5 w-3.5 text-primary" />
                <span className="truncate">{walletLabel}</span>
              </span>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
