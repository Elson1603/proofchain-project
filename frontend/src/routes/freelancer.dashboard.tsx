import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BarChart3, FileUp, Gem, Hourglass, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { txHistory } from "@/components/proofchain/mock-data";

export const Route = createFileRoute("/freelancer/dashboard")({
  head: () => ({
    meta: [
      { title: "Freelancer Dashboard — ProofChain" },
      { name: "description", content: "Track earnings, activity, and proof certificates in ProofChain." },
      { property: "og:title", content: "Freelancer Dashboard — ProofChain" },
      { property: "og:description", content: "Manage gasless freelance workflow with real-time status." },
    ],
  }),
  component: FreelancerDashboardPage,
});

const freelancerNav = [
  { label: "Dashboard", to: "/freelancer/dashboard" },
  { label: "Profile", to: "/freelancer/profile" },
  { label: "Projects", to: "/project-details" },
  { label: "Submit Work", to: "/freelancer/submit-work" },
  { label: "NFT Certificates", to: "/freelancer/nft-certificates" },
  { label: "Earnings", to: "/freelancer/earnings" },
  { label: "Settings", to: "/auth" },
];

const metrics = [
  { label: "Total earnings", value: "12,840 mUSD", icon: Wallet },
  { label: "Active projects", value: "08", icon: FileUp },
  { label: "NFT certificates", value: "24", icon: Gem },
  { label: "Pending approvals", value: "03", icon: Hourglass },
];

function FreelancerDashboardPage() {
  return (
    <DashboardShell
      title="Freelancer Dashboard"
      subtitle="Delivery velocity and on-chain trust, in one workspace."
      navItems={freelancerNav}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <motion.article
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass-panel rounded-xl p-4"
          >
            <div className="inline-flex rounded-md bg-secondary p-2">
              <metric.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-xl font-bold text-foreground">{metric.value}</p>
          </motion.article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Transaction activity graph</h2>
            <BarChart3 className="h-4 w-4 text-info" />
          </div>
          <div className="mt-4 h-48 rounded-lg border border-border/70 bg-secondary/40 p-4">
            <div className="flex h-full items-end gap-2">
              {[45, 62, 54, 75, 80, 66, 92].map((height, i) => (
                <motion.div
                  key={`bar-${height}`}
                  initial={{ scaleY: 0.2 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.45, delay: i * 0.05 }}
                  className="w-full origin-bottom rounded-sm bg-gradient-to-t from-primary/30 to-info/70"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4">
          <h2 className="text-base font-semibold text-foreground">Recent transactions</h2>
          <div className="mt-3 space-y-2">
            {txHistory.map((tx) => (
              <div key={tx.id} className="surface-panel rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{tx.id}</p>
                <p className="text-sm text-foreground">{tx.project}</p>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-primary">{tx.amount}</span>
                  <span className="text-muted-foreground">{tx.status}</span>
                </div>
              </div>
            ))}
          </div>
          <Link to="/freelancer/earnings" className="mt-4 inline-block text-xs text-primary hover:underline">
            Open earnings page
          </Link>
        </div>
      </section>
    </DashboardShell>
  );
}
