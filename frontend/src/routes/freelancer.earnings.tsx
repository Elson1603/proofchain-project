import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import {
  fetchCurrentUser,
  fetchPayments,
  formatDateTime,
  formatMoney,
  shortHash,
  type ApiPayment,
  type ApiUser,
} from "@/lib/proofchain-api";

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
  const [user, setUser] = useState<ApiUser | null>(null);
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const me = await fetchCurrentUser();
      const nextPayments = me ? await fetchPayments({ payeeId: me.id }).catch(() => null) : [];

      if (!cancelled) {
        setUser(me);
        setPayments(nextPayments ?? []);
        setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const releasedBalance = useMemo(
    () => payments.filter((payment) => payment.status === "released").reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  );
  const pendingCount = payments.filter((payment) => ["pending", "escrowed"].includes(payment.status)).length;

  return (
    <DashboardShell
      title="Earnings"
      subtitle="Mock USD balance, payment records, and relayer execution visibility."
      navItems={freelancerNav}
    >
      <section className="grid gap-4 md:grid-cols-2">
        <article className="glass-panel rounded-xl p-5">
          <p className="text-xs text-muted-foreground">Mock USD balance</p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">{formatMoney(releasedBalance)}</p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            {user ? "Loaded from payment records" : "Connect wallet to load earnings"}
          </p>
        </article>

        <article className="glass-panel rounded-xl p-5">
          <p className="text-xs text-muted-foreground">Execution queue</p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">{pendingCount} pending</p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5 text-info" />
            Pending or escrowed records
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
              {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-border/60">
                    <td className="px-3 py-2 text-muted-foreground">{shortHash(payment.transactions?.[0]?.txHash)}</td>
                    <td className="px-3 py-2 text-foreground">{payment.project?.title ?? payment.type.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 text-primary">{formatMoney(payment.amount, payment.currency ?? "mUSD")}</td>
                    <td className="px-3 py-2 text-muted-foreground">{payment.status} · {formatDateTime(payment.createdAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!loading && payments.length === 0 ? (
          <div className="mt-3 rounded-lg border border-border/70 bg-secondary/30 p-3 text-sm text-muted-foreground">
            {user ? "No payment records found yet." : "Connect your wallet to load real earnings."}
          </div>
        ) : null}
      </section>
    </DashboardShell>
  );
}
