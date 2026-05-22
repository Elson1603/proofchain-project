import { Link } from "@tanstack/react-router";
import { Bell, Command, Dot, Wallet2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-secondary px-3 py-1 text-xs text-muted-foreground sm:flex">
            <Dot className="h-4 w-4 text-success" />
            Base Sepolia Live
          </div>
          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-secondary text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            aria-label="Command palette"
          >
            <Command className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-secondary text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
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
          <a href="#" className="transition-colors hover:text-foreground">
            Docs
          </a>
          <a href="#" className="transition-colors hover:text-foreground">
            GitHub
          </a>
          <a href="#" className="transition-colors hover:text-foreground">
            Base Sepolia
          </a>
        </div>
        <p className="sm:text-right lg:text-left">UGF-integrated settlement · No ETH required.</p>
      </div>
    </footer>
  );
}
