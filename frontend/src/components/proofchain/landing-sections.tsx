import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Coins,
  FileCheck2,
  FileUp,
  Handshake,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchNftCertificates,
  fetchPayments,
  formatDateTime,
  formatMoney,
  shortAddress,
  shortHash,
  type ApiNftCertificate,
  type ApiPayment,
} from "@/lib/proofchain-api";

type FeatureItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type ActivityEvent = {
  type: string;
  detail: string;
  status: string;
  time: string;
};

const featureItems: FeatureItem[] = [
  {
    title: "Gasless Payments",
    description: "UGF relays execution so clients approve with Mock USD and avoid manual gas handling.",
    icon: Coins,
  },
  {
    title: "Soulbound NFT Proof",
    description: "Completed milestones can mint non-transferable certificates tied to freelancer reputation.",
    icon: BadgeCheck,
  },
  {
    title: "Escrow Security",
    description: "Funds move through structured milestone states with auditable release and dispute paths.",
    icon: ShieldCheck,
  },
  {
    title: "Base Sepolia Powered",
    description: "Testnet settlement and event tracking are ready for real project workflows.",
    icon: WalletCards,
  },
  {
    title: "Project Review Flow",
    description: "Submissions, notes, hashes, approvals, and payout records stay linked to each milestone.",
    icon: FileCheck2,
  },
  {
    title: "Transparent Collaboration",
    description: "Clients and freelancers share the same source of truth for delivery and payment status.",
    icon: Handshake,
  },
];

function paymentToEvent(payment: ApiPayment): ActivityEvent {
  const tx = payment.transactions?.[0];
  return {
    type: payment.type.replace(/_/g, " "),
    detail: `${shortAddress(tx?.fromAddress ?? payment.payer?.walletAddress)} -> ${shortAddress(
      tx?.toAddress ?? payment.payee?.walletAddress,
    )} · ${formatMoney(payment.amount, payment.currency ?? "mUSD")}`,
    status: tx?.txHash ? `${tx.status} · ${shortHash(tx.txHash)}` : payment.status,
    time: formatDateTime(payment.createdAt),
  };
}

function nftToEvent(nft: ApiNftCertificate): ActivityEvent {
  return {
    type: "NFT certificate",
    detail: `Token #${nft.tokenId} · ${nft.project?.title ?? shortAddress(nft.freelancerWallet)}`,
    status: nft.transactionHash ? `${nft.certificateStatus} · ${shortHash(nft.transactionHash)}` : nft.certificateStatus,
    time: formatDateTime(nft.mintedAt ?? nft.createdAt),
  };
}

function useLandingActivity(limit = 4) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [payments, nfts] = await Promise.all([
        fetchPayments().catch(() => null),
        fetchNftCertificates().catch(() => null),
      ]);

      if (cancelled) return;

      const nextEvents = [
        ...(payments ?? []).map((payment) => ({ event: paymentToEvent(payment), at: payment.createdAt })),
        ...(nfts ?? []).map((nft) => ({ event: nftToEvent(nft), at: nft.mintedAt ?? nft.createdAt })),
      ]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, limit)
        .map((item) => item.event);

      setEvents(nextEvents);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { events, loading };
}

export function LandingHero() {
  const { events, loading } = useLandingActivity(3);

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-24">
      <div className="ambient-grid pointer-events-none absolute inset-0 opacity-80" />
      <div className="hero-glow pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-glass px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Built on UGF · Base Sepolia
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-2xl text-balance font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Freelance Payments Without Gas Fees
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            ProofChain routes approvals, escrow release, and NFT proof minting through UGF so clients pay in
            Mock USD while freelancers receive verifiable on-chain completion records.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button asChild className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/auth">
                Start as Freelancer
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/auth">
                Hire Talent
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-3"
        >
          <div className="glass-panel shine-panel relative overflow-hidden rounded-xl p-5">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-info/20 to-transparent" />
            <div className="relative flex items-center justify-between border-b border-border/60 pb-4">
              <p className="font-semibold text-foreground">Transaction Command Center</p>
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                <span className="status-dot" /> Live
              </span>
            </div>

            <div className="relative mt-4 space-y-3">
              {loading ? (
                <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">Loading live activity...</div>
              ) : events.length ? (
                events.map((item) => (
                <div key={item.detail} className="surface-panel activity-row rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.type}</span>
                    <span>{item.time}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{item.detail}</p>
                  <p className="mt-1 text-xs text-primary">{item.status}</p>
                </div>
                ))
              ) : (
                <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">
                  No chain activity yet. Real payments and certificates will appear here after users create projects.
                </div>
              )}
            </div>

            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 4, ease: "easeInOut" }}
              className="absolute -right-8 -top-8 hidden rounded-full border border-primary/30 bg-surface-glass p-4 lg:block"
            >
              <CircleDashed className="h-10 w-10 text-primary" />
            </motion.div>
          </div>

          <div className="glass-panel shine-panel rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Command palette</p>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
              <span>Type a command or search project...</span>
              <span className="rounded border border-border/80 px-1.5 py-0.5 text-[10px]">⌘K</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function FeatureGrid() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Product features</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Startup-grade collaboration + blockchain confidence, without UX compromises.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureItems.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: index * 0.04 }}
              className={`glass-panel shine-panel interactive-card rounded-xl p-4 ${
                index % 3 === 0 ? "sm:col-span-2" : ""
              } ${index === 5 ? "lg:col-span-2" : ""}`}
            >
              <div className="inline-flex rounded-md bg-secondary p-2">
                <feature.icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const [role, setRole] = useState<"freelancer" | "client">("freelancer");
  const [activeStep, setActiveStep] = useState(0);

  const flow = useMemo(() => {
    const sharedEnd = [
      {
        title: "UGF executes the payment",
        detail: "The relayer handles gas on Base Sepolia while the milestone moves from escrow to payout.",
        icon: Coins,
        result: "Gasless settlement",
        status: "Relayer ready",
      },
      {
        title: "Proof becomes a certificate",
        detail: "Completed work can mint a soulbound NFT certificate tied to the freelancer profile.",
        icon: BadgeCheck,
        result: "NFT proof minted",
        status: "Portfolio verified",
      },
    ];

    if (role === "client") {
      return [
        {
          title: "Create a project",
          detail: "Add the scope, budget, deadline, and milestones so freelancers know exactly what success means.",
          icon: BriefcaseBusiness,
          result: "Milestone plan created",
          status: "Draft ready",
        },
        {
          title: "Fund escrow in Mock USD",
          detail: "Lock funds for the milestone before work starts; ProofChain tracks the escrow state for both sides.",
          icon: ShieldCheck,
          result: "Funds protected",
          status: "Escrow active",
        },
        {
          title: "Review submitted work",
          detail: "Open the deliverable, check the proof hash, approve the milestone, or request changes.",
          icon: FileCheck2,
          result: "Approval decision",
          status: "Review queue",
        },
        ...sharedEnd,
      ];
    }

    return [
      {
        title: "Connect your wallet",
        detail: "Sign in once with your wallet so ProofChain can attach projects, payouts, and certificates to you.",
        icon: WalletCards,
        result: "Wallet identity ready",
        status: "No password needed",
      },
      {
        title: "Accept a milestone",
        detail: "Pick assigned work, confirm the scope, and track what is funded before you start delivery.",
        icon: Handshake,
        result: "Work accepted",
        status: "Escrow visible",
      },
      {
        title: "Submit deliverables",
        detail: "Upload links, files, notes, and proof metadata so the client can review everything in one place.",
        icon: FileUp,
        result: "Proof submitted",
        status: "Awaiting review",
      },
      ...sharedEnd,
    ];
  }, [role]);

  const current = flow[activeStep] ?? flow[0];
  const CurrentIcon = current.icon;

  const selectRole = (nextRole: "freelancer" | "client") => {
    setRole(nextRole);
    setActiveStep(0);
  };

  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-primary">New user walkthrough</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Choose your path through ProofChain</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              See what to do first, what happens on-chain, and where to go next.
            </p>
          </div>

          <div className="inline-grid grid-cols-2 rounded-lg border border-border/70 bg-surface p-1">
            <button
              type="button"
              onClick={() => selectRole("freelancer")}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                role === "freelancer" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserRound className="h-4 w-4" />
              Freelancer
            </button>
            <button
              type="button"
              onClick={() => selectRole("client")}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                role === "client" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BriefcaseBusiness className="h-4 w-4" />
              Client
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            {flow.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`group interactive-card w-full rounded-lg border p-4 text-left ${
                  activeStep === index
                    ? "border-primary/55 bg-primary/10 shadow-[var(--shadow-soft)]"
                    : "border-border/70 bg-surface/70 hover:border-primary/35 hover:bg-secondary/50"
                }`}
              >
                <div className="flex gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                      activeStep === index ? "border-primary/40 bg-primary/15 text-primary" : "border-border/70 bg-secondary text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-info" />
                      <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">{item.title}</h3>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <motion.div
            key={`${role}-${activeStep}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="glass-panel shine-panel overflow-hidden rounded-xl"
          >
            <div className="border-b border-border/60 bg-secondary/30 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/30 bg-primary/10">
                    <CurrentIcon className="h-5 w-5 text-primary" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Step {activeStep + 1} of {flow.length}</p>
                    <h3 className="text-lg font-semibold text-foreground">{current.title}</h3>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface px-3 py-1 text-xs text-muted-foreground">
                  <span className="status-dot" />
                  {current.status}
                </span>
              </div>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-[1fr_0.9fr]">
              <div>
                <p className="text-sm leading-relaxed text-muted-foreground">{current.detail}</p>
                <div className="mt-5 grid gap-3">
                  {flow.slice(0, activeStep + 1).map((item) => (
                    <div key={`done-${item.title}`} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>{item.result}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/45 p-4">
                <p className="text-xs text-muted-foreground">Workspace preview</p>
                <div className="mt-4 space-y-3">
                  <PreviewRow label="Identity" value={role === "client" ? "Client wallet" : "Freelancer wallet"} active={activeStep >= 0} />
                  <PreviewRow label="Project" value={role === "client" ? "Milestones drafted" : "Milestone accepted"} active={activeStep >= 1} />
                  <PreviewRow label="Review" value={role === "client" ? "Approve or request changes" : "Proof package sent"} active={activeStep >= 2} />
                  <PreviewRow label="Payment" value="UGF gasless execution" active={activeStep >= 3} />
                  <PreviewRow label="Certificate" value="Soulbound NFT record" active={activeStep >= 4} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 p-5">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={activeStep === flow.length - 1}
                  onClick={() => setActiveStep((step) => Math.min(flow.length - 1, step + 1))}
                >
                  Next step
                </Button>
              </div>

              <Button asChild variant={role === "freelancer" ? "default" : "outline"} size="sm" className="gap-2">
                <Link to="/auth">
                  {role === "freelancer" ? "Start as Freelancer" : "Hire Talent"}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function PreviewRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-secondary/30 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm text-foreground">{value}</p>
      </div>
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          active ? "bg-primary shadow-[0_0_0_4px_oklch(0.72_0.2_151_/_0.14)]" : "bg-muted"
        }`}
      />
    </div>
  );
}

export function LiveTransactions() {
  const { events, loading } = useLandingActivity(6);

  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl rounded-xl border border-border/70 bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <h2 className="text-xl font-semibold text-foreground">Live chain activity</h2>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Backend activity feed
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {loading ? (
            <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">Loading live activity...</div>
          ) : events.length ? (
            events.map((event) => (
            <motion.div
              key={event.detail}
              whileHover={{ scale: 1.01 }}
              className="surface-panel activity-row rounded-lg p-3"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{event.type}</span>
                <span>{event.time}</span>
              </div>
              <p className="mt-1 text-sm text-foreground">{event.detail}</p>
              <p className="mt-1 text-xs text-primary">{event.status}</p>
            </motion.div>
            ))
          ) : (
            <div className="surface-panel rounded-lg p-4 text-sm text-muted-foreground sm:col-span-2">
              No real transactions or NFT mints have been recorded yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Built for real workflow data</h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Create projects",
              copy: "Client-created projects and milestones populate dashboards, approvals, and project detail pages.",
            },
            {
              title: "Submit work",
              copy: "Uploaded deliverables and IPFS metadata appear in client review queues from backend records.",
            },
            {
              title: "Record settlement",
              copy: "UGF payments, Base Sepolia transactions, and certificates power the live activity feed.",
            },
          ].map((item) => (
            <article key={item.title} className="glass-panel shine-panel interactive-card rounded-xl p-5">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <p className="mt-5 font-medium text-foreground">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
