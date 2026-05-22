import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { LockKeyhole, Wallet, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { connectWallet } from "@/lib/escrow";
import { API_BASE_URL } from "@/lib/proofchain-api";

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN", "BLOCKCHAIN_ADMIN"]);

function routeForRole(role: string) {
  if (ADMIN_ROLES.has(role)) {
    return "/admin";
  }

  if (role === "CLIENT") {
    return "/client/dashboard";
  }

  return "/freelancer/dashboard";
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connect Wallet — ProofChain" },
      {
        name: "description",
        content: "Connect your wallet and choose your role to access the ProofChain gasless workflow.",
      },
      { property: "og:title", content: "Connect Wallet — ProofChain" },
      {
        property: "og:description",
        content: "Smooth onboarding for freelancers and clients with secure wallet authentication.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [role, setRole] = useState<"FREELANCER" | "CLIENT">("FREELANCER");
  const [status, setStatus] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleMetaMaskConnect = async () => {
    setIsConnecting(true);
    setStatus("Connecting wallet...");

    try {
      const { address, signer } = await connectWallet();
      if (address) {
        window.localStorage.setItem("proofchain_wallet_address", address);
      }

      setStatus("Requesting authentication nonce...");
      const nonceResponse = await fetch(`${API_BASE_URL}/api/auth/nonce`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const noncePayload = await nonceResponse.json();

      if (!nonceResponse.ok || !noncePayload?.success) {
        throw new Error(noncePayload?.message ?? "Could not request nonce");
      }

      const message = noncePayload.data?.message ?? `ProofChain Authentication Nonce: ${noncePayload.data?.nonce}`;
      setStatus("Sign the ProofChain message in your wallet...");
      const signature = await signer.signMessage(message);

      setStatus("Verifying wallet signature...");
      const verifyResponse = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          role,
        }),
      });
      const verifyPayload = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyPayload?.success) {
        throw new Error(verifyPayload?.message ?? "Wallet verification failed");
      }

      const data = verifyPayload.data ?? {};
      const accessToken = data.accessToken ?? data.tokens?.accessToken;
      const refreshToken = data.refreshToken ?? data.tokens?.refreshToken;

      if (!accessToken) {
        throw new Error("Backend did not return an access token");
      }

      window.localStorage.setItem("proofchain_access_token", accessToken);
      window.localStorage.setItem("accessToken", accessToken);
      if (refreshToken) {
        window.localStorage.setItem("proofchain_refresh_token", refreshToken);
      }

      const nextRole = data.user?.role ?? role;
      window.location.href = routeForRole(nextRole);
    } catch (err) {
      console.error(err);
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setIsConnecting(false);
    }
  };
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="ambient-grid pointer-events-none absolute inset-0 opacity-75" />
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="glass-panel rounded-xl p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Secure onboarding</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Connect your wallet</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in with MetaMask and route your workspace into a freelancer or client experience.
          </p>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleMetaMaskConnect}
              disabled={isConnecting}
              className="flex w-full items-center justify-between rounded-lg border border-border/80 bg-secondary px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
            >
              <span className="inline-flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                {isConnecting ? "Connecting..." : "Continue with MetaMask"}
              </span>
              <span className="text-xs text-muted-foreground">Popular</span>
            </button>
            <div className="flex w-full items-center justify-between rounded-lg border border-border/80 bg-secondary/60 px-4 py-3 text-left text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-info" />
                Signature-based JWT session
              </span>
              <span className="text-xs text-muted-foreground">Required</span>
            </div>
          </div>
          {status ? <p className="mt-4 text-xs text-muted-foreground">{status}</p> : null}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-panel rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold text-foreground">Choose your role</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            New wallets choose freelancer or client. Existing admin wallets keep their admin role automatically.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setRole("FREELANCER")}
              className={`surface-panel hover-lift rounded-lg p-4 text-left ${role === "FREELANCER" ? "border-primary/60" : ""}`}
            >
              <UserRound className="h-5 w-5 text-primary" />
              <p className="mt-3 font-medium text-foreground">Freelancer</p>
              <p className="text-xs text-muted-foreground">Submit work, track earnings, collect SBT proof.</p>
            </button>
            <button
              type="button"
              onClick={() => setRole("CLIENT")}
              className={`surface-panel hover-lift rounded-lg p-4 text-left ${role === "CLIENT" ? "border-primary/60" : ""}`}
            >
              <ShieldCheck className="h-5 w-5 text-info" />
              <p className="mt-3 font-medium text-foreground">Client</p>
              <p className="text-xs text-muted-foreground">Review submissions and release gasless payments.</p>
            </button>
          </div>

          <div className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-4">
            <div className="flex gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Admin access</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Admin is not selectable here for security. If this MetaMask wallet is already promoted to SUPER_ADMIN, click Continue and it will open the admin console after signing.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <Button onClick={handleMetaMaskConnect} disabled={isConnecting}>
              Continue
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Back</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
