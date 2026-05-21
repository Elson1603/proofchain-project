import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Wallet, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectWallet } from "@/lib/escrow";

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
  const handleMetaMaskConnect = async () => {
    try {
      const { address } = await connectWallet();
      if (address) {
        window.localStorage.setItem("proofchain_wallet_address", address);
      }
      // Navigate to dashboard after connect
      window.location.href = "/freelancer/dashboard";
    } catch (err) {
      // Simple user feedback for local debugging
      // eslint-disable-next-line no-console
      console.error(err);
      window.alert(String(err));
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
            Sign in with MetaMask or RainbowKit and route your workspace into a freelancer or client experience.
          </p>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleMetaMaskConnect}
              className="flex w-full items-center justify-between rounded-lg border border-border/80 bg-secondary px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
            >
              <span className="inline-flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Continue with MetaMask
              </span>
              <span className="text-xs text-muted-foreground">Popular</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-border/80 bg-secondary px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
            >
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-info" />
                Continue with RainbowKit
              </span>
              <span className="text-xs text-muted-foreground">Secure</span>
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-panel rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold text-foreground">Choose your role</h2>
          <p className="mt-2 text-sm text-muted-foreground">You can switch later from settings.</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link to="/freelancer/dashboard" className="surface-panel hover-lift rounded-lg p-4">
              <UserRound className="h-5 w-5 text-primary" />
              <p className="mt-3 font-medium text-foreground">Freelancer</p>
              <p className="text-xs text-muted-foreground">Submit work, track earnings, collect SBT proof.</p>
            </Link>
            <Link to="/client/dashboard" className="surface-panel hover-lift rounded-lg p-4">
              <ShieldCheck className="h-5 w-5 text-info" />
              <p className="mt-3 font-medium text-foreground">Client</p>
              <p className="text-xs text-muted-foreground">Review submissions and release gasless payments.</p>
            </Link>
          </div>

          <div className="mt-6 flex gap-2">
            <Button asChild>
              <Link to="/freelancer/dashboard">Continue</Link>
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
