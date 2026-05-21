import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock3 } from "lucide-react";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { txHistory } from "@/components/proofchain/mock-data";

export const Route = createFileRoute("/freelancer/earnings")({
  head: () => ({
    meta: [
      { title: "Earnings — ProofChain" },
      { name: "description", content: "Monitor Mock USD balance and UGF execution states." },
      { property: "og:title", content: "Earnings — ProofChain" },
      { property: "og:description", content: "Track payout history and transaction execution progress." },
    ],
  }),
  component: EarningsPage,
});

const freelancerNav = [
  { label: "Dashboard", to: "/freelancer/dashboard" },
  { label: "Profile", to: "/freelancer/profile" },
  { label: "Projects", to: "/freelancer/projects" },
  { label: "Messages", to: "/messages" },
  { label: "Submit Work", to: "/freelancer/submit-work" },
  { label: "NFT Certificates", to: "/freelancer/nft-certificates" },
  { label: "Earnings", to: "/freelancer/earnings" },
  { label: "Settings", to: "/auth" },
];

function EarningsPage() {
  return (
    <DashboardShell
      title="Earnings"
      subtitle="Mock USD balance, payment records, and relayer execution visibility."
      navItems={freelancerNav}
    >
      <section className="grid gap-4 md:grid-cols-2">
        <article className="glass-panel rounded-xl p-5">
          <p className="text-xs text-muted-foreground">Mock USD balance</p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">5,928.40 mUSD</p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            UGF execution healthy
          </p>
        </article>

        <article className="glass-panel rounded-xl p-5">
          <p className="text-xs text-muted-foreground">Execution queue</p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">2 pending</p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5 text-info" />
            Next payout in ~35s
          </p>
        </article>
      </section>

      <section className="glass-panel rounded-xl p-4">
        <h2 className="text-base font-semibold text-foreground">Transaction history</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Tx</th>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {txHistory.map((tx) => (
                <tr key={tx.id} className="border-t border-border/60">
                  <td className="px-3 py-2 text-muted-foreground">{tx.id}</td>
                  <td className="px-3 py-2 text-foreground">{tx.project}</td>
                  <td className="px-3 py-2 text-primary">{tx.amount}</td>
                  <td className="px-3 py-2 text-muted-foreground">{tx.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
