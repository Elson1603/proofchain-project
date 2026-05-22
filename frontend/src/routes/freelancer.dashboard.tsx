import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BarChart3, FileUp, Gem, Hourglass, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import {
  fetchCurrentUser,
  fetchNftCertificates,
  fetchPayments,
  fetchProjects,
  formatDateTime,
  formatMoney,
  shortHash,
  type ApiNftCertificate,
  type ApiPayment,
  type ApiProject,
  type ApiUser,
} from "@/lib/proofchain-api";

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
  { label: "Projects", to: "/freelancer/projects" },
  { label: "Messages", to: "/messages" },
  { label: "Submit Work", to: "/freelancer/submit-work" },
  { label: "NFT Certificates", to: "/freelancer/nft-certificates" },
  { label: "Earnings", to: "/freelancer/earnings" },
  { label: "Settings", to: "/auth" },
];

function FreelancerDashboardPage() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [certificates, setCertificates] = useState<ApiNftCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const me = await fetchCurrentUser();

      if (!me) {
        if (!cancelled) {
          setUser(null);
          setProjects([]);
          setPayments([]);
          setCertificates([]);
          setLoading(false);
        }
        return;
      }

      const [nextProjects, nextPayments, nextCertificates] = await Promise.all([
        fetchProjects({ freelancerId: me.id }).catch(() => null),
        fetchPayments({ payeeId: me.id }).catch(() => null),
        fetchNftCertificates(me.walletAddress).catch(() => null),
      ]);

      if (!cancelled) {
        setUser(me);
        setProjects(nextProjects ?? []);
        setPayments(nextPayments ?? []);
        setCertificates(nextCertificates ?? []);
        setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalEarnings = useMemo(
    () => payments.filter((payment) => payment.status === "released").reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  );
  const activeProjects = projects.filter((project) => !["completed", "rejected", "draft"].includes(project.status)).length;
  const pendingApprovals = projects.filter((project) => ["submitted", "approved"].includes(project.status)).length;
  const chartBars = payments.slice(0, 7).map((payment) => Math.max(10, Math.min(100, payment.amount / Math.max(1, totalEarnings || payment.amount) * 100)));

  const metrics = [
    { label: "Total earnings", value: formatMoney(totalEarnings), icon: Wallet },
    { label: "Active projects", value: String(activeProjects), icon: FileUp },
    { label: "NFT certificates", value: String(certificates.length), icon: Gem },
    { label: "Pending approvals", value: String(pendingApprovals), icon: Hourglass },
  ];

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
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading payment activity...</div>
            ) : chartBars.length ? (
              <div className="flex h-full items-end gap-2">
                {chartBars.map((height, i) => (
                <motion.div
                  key={`bar-${i}`}
                  initial={{ scaleY: 0.2 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.45, delay: i * 0.05 }}
                  className="w-full origin-bottom rounded-sm bg-gradient-to-t from-primary/30 to-info/70"
                  style={{ height: `${height}%` }}
                />
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No real payment records yet.
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4">
          <h2 className="text-base font-semibold text-foreground">Recent transactions</h2>
          <div className="mt-3 space-y-2">
            {!user ? (
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">Connect a wallet to load your records.</div>
            ) : loading ? (
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">Loading transactions...</div>
            ) : payments.length ? (
              payments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="surface-panel rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{shortHash(payment.transactions?.[0]?.txHash)}</p>
                <p className="text-sm text-foreground">{payment.project?.title ?? payment.type.replace(/_/g, " ")}</p>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-primary">{formatMoney(payment.amount, payment.currency ?? "mUSD")}</span>
                  <span className="text-muted-foreground">{formatDateTime(payment.createdAt)}</span>
                </div>
              </div>
              ))
            ) : (
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">No transactions recorded yet.</div>
            )}
          </div>
          <Link to="/freelancer/earnings" className="mt-4 inline-block text-xs text-primary hover:underline">
            Open earnings page
          </Link>
        </div>
      </section>
    </DashboardShell>
  );
}
