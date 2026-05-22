import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Ban,
  BarChart3,
  Bell,
  Blocks,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Coins,
  Command,
  FileSearch,
  Flag,
  Gauge,
  Gem,
  Gavel,
  LockKeyhole,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  WalletCards,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { adminFetch, adminMutation, formatDateTime, formatMoney, shortAddress } from "@/lib/admin-api";
import { getAccessToken } from "@/lib/messaging";
import {
  createRealtimeSocketClient,
  type AdminRealtimePayload,
} from "@/lib/realtime-socket";

type AdminSection =
  | "overview"
  | "users"
  | "projects"
  | "disputes"
  | "transactions"
  | "nfts"
  | "fraud"
  | "analytics"
  | "audit"
  | "settings";

type SeriesPoint = { date: string; value: number };

type OverviewData = {
  kpis: {
    totalPlatformRevenue: number;
    totalUgfPayments: number;
    totalUgfPaymentCount: number;
    totalNftsMinted: number;
    activeUsers: number;
    totalUsers: number;
    activeProjects: number;
    transactionSuccessRate: number;
    openDisputes: number;
    escrowLockedFunds: number;
    openFraudAlerts: number;
  };
  charts: {
    paymentActivity: SeriesPoint[];
    dailyActiveUsers: SeriesPoint[];
    nftMintTrends: SeriesPoint[];
    transactionOutcomes: Array<{ name: string; value: number }>;
    projectCompletionTrends: SeriesPoint[];
    fraudAlerts: SeriesPoint[];
  };
  realtime: {
    transactions: AdminTransaction[];
    disputes: AdminDispute[];
    projectActivity: AdminProject[];
    nftMints: AdminNft[];
  };
};

type Paginated<T> = {
  data: T[];
  pagination?: { total: number; page: number; limit: number; totalPages: number };
};

type AdminUser = {
  id: string;
  avatarUrl?: string | null;
  walletAddress: string;
  email?: string | null;
  fullName?: string | null;
  username?: string | null;
  role: string;
  reputationScore: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt?: string;
  projectsCount?: number;
  totalEarnings?: number;
  nftsOwned?: number;
  isSuspended?: boolean;
  openFraudAlerts?: number;
};

type AdminProject = {
  id: string;
  title: string;
  status: string;
  budget?: number | null;
  updatedAt?: string;
  owner?: AdminIdentity | null;
  freelancer?: AdminIdentity | null;
  milestones?: Array<{ id: string; title: string; status: string; amount: number }>;
  payments?: Array<{ id: string; status: string; amount: number; currency: string }>;
  _count?: { payments?: number; disputes?: number; nftCertificates?: number };
};

type AdminIdentity = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  walletAddress?: string | null;
  avatarUrl?: string | null;
};

type AdminDispute = {
  id: string;
  status: string;
  priority?: string;
  reason: string;
  description?: string | null;
  createdAt: string;
  project?: AdminProject | null;
  milestone?: { title?: string | null; amount?: number | null } | null;
  raisedBy?: AdminIdentity | null;
  againstUser?: AdminIdentity | null;
};

type AdminTransaction = {
  id: string;
  txHash?: string | null;
  blockNumber?: number | null;
  status: string;
  type: string;
  chainId: number;
  amount?: number | null;
  currency?: string | null;
  gasQuote?: number | null;
  gasQuoteCurrency?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  createdAt: string;
  explorerUrl?: string | null;
  monitoringStatus?: string;
  payment?: { project?: AdminProject | null } | null;
};

type AdminNft = {
  id: string;
  tokenId: number;
  freelancerWallet: string;
  metadataURI: string;
  metadata?: Record<string, unknown>;
  transactionHash?: string | null;
  mintedAt?: string | null;
  createdAt: string;
  certificateStatus: string;
  project?: AdminProject | null;
  user?: AdminIdentity | null;
};

type FraudAlert = {
  id: string;
  type: string;
  severity: string;
  status: string;
  riskScore: number;
  title: string;
  description?: string | null;
  walletAddress?: string | null;
  txHash?: string | null;
  createdAt: string;
  user?: AdminIdentity | null;
};

type AuditLog = {
  id: string;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  admin?: AdminIdentity & { role?: string } | null;
};

type AuthUser = {
  id: string;
  walletAddress: string;
  email?: string | null;
  fullName?: string | null;
  role: string;
};

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "MODERATOR", "SUPPORT_ADMIN", "BLOCKCHAIN_ADMIN"];

const navItems: Array<{ id: AdminSection; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "users", label: "Users", icon: UserCog },
  { id: "projects", label: "Projects", icon: BriefcaseBusiness },
  { id: "disputes", label: "Disputes", icon: Gavel },
  { id: "transactions", label: "Transactions", icon: Network },
  { id: "nfts", label: "NFTs", icon: Gem },
  { id: "fraud", label: "Fraud Detection", icon: ShieldAlert },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "audit", label: "Audit Logs", icon: BookOpen },
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
];

const emptyOverview: OverviewData = {
  kpis: {
    totalPlatformRevenue: 0,
    totalUgfPayments: 0,
    totalUgfPaymentCount: 0,
    totalNftsMinted: 0,
    activeUsers: 0,
    totalUsers: 0,
    activeProjects: 0,
    transactionSuccessRate: 0,
    openDisputes: 0,
    escrowLockedFunds: 0,
    openFraudAlerts: 0,
  },
  charts: {
    paymentActivity: [],
    dailyActiveUsers: [],
    nftMintTrends: [],
    transactionOutcomes: [],
    projectCompletionTrends: [],
    fraudAlerts: [],
  },
  realtime: {
    transactions: [],
    disputes: [],
    projectActivity: [],
    nftMints: [],
  },
};

const outcomeColors = ["#4ade80", "#fb7185", "#60a5fa", "#facc15"];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeStatus(status?: string) {
  return (status ?? "unknown").replace(/_/g, " ");
}

function statusTone(status?: string) {
  const value = (status ?? "").toLowerCase();
  if (["confirmed", "completed", "released", "verified", "resolved"].includes(value)) return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  if (["failed", "reverted", "rejected", "critical"].includes(value)) return "border-rose-400/40 bg-rose-400/10 text-rose-200";
  if (["disputed", "under_review", "open", "pending", "processing"].includes(value)) return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  return "border-sky-400/35 bg-sky-400/10 text-sky-200";
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("border border-white/10 bg-zinc-950/58 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl rounded-[8px]", className)}>
      {children}
    </section>
  );
}

function SectionTitle({ icon: Icon, title, meta }: { icon: LucideIcon; title: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.04]">
          <Icon className="h-4 w-4 text-emerald-300" />
        </span>
        <h2 className="truncate text-sm font-semibold text-zinc-100">{title}</h2>
      </div>
      {meta ? <span className="shrink-0 text-xs text-zinc-500">{meta}</span> : null}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, delta, tone }: { icon: LucideIcon; label: string; value: string; delta: string; tone: string }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-white/10 bg-white/[0.045] p-4 rounded-[8px]"
    >
      <div className="flex items-center justify-between">
        <span className={cx("flex h-9 w-9 items-center justify-center rounded-[8px] border", tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs text-zinc-500">{delta}</span>
      </div>
      <p className="mt-4 text-xs text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-zinc-50">{value}</p>
    </motion.article>
  );
}

function EmptyLine({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm text-zinc-500">{label}</p>;
}

function useAdminData(enabled: boolean) {
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => adminFetch<OverviewData>("/api/admin/analytics/overview?days=14"),
    enabled,
    refetchInterval: 25_000,
  });
  const users = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminFetch<Paginated<AdminUser>>("/api/admin/users?limit=12"),
    enabled,
  });
  const projects = useQuery({
    queryKey: ["admin", "projects"],
    queryFn: () => adminFetch<Paginated<AdminProject>>("/api/admin/projects?limit=12"),
    enabled,
  });
  const disputes = useQuery({
    queryKey: ["admin", "disputes"],
    queryFn: () => adminFetch<Paginated<AdminDispute>>("/api/admin/disputes?limit=12"),
    enabled,
    refetchInterval: 20_000,
  });
  const transactions = useQuery({
    queryKey: ["admin", "transactions"],
    queryFn: () => adminFetch<Paginated<AdminTransaction>>("/api/admin/transactions?limit=12"),
    enabled,
    refetchInterval: 20_000,
  });
  const fraud = useQuery({
    queryKey: ["admin", "fraud"],
    queryFn: () => adminFetch<Paginated<FraudAlert>>("/api/admin/fraud/alerts?limit=12"),
    enabled,
  });
  const audit = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => adminFetch<Paginated<AuditLog>>("/api/admin/audit-logs?limit=12"),
    enabled,
  });
  const nfts = useQuery({
    queryKey: ["admin", "nfts"],
    queryFn: () => adminFetch<{ recent?: AdminNft[] }>("/api/admin/analytics/nfts?days=30"),
    enabled,
  });
  const payments = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: () =>
      adminFetch<{
        volume: SeriesPoint[];
        successFailure: Array<{ name: string; value: number }>;
        gasQuotes: SeriesPoint[];
        executionTiming: SeriesPoint[];
      }>("/api/admin/analytics/payments?days=30"),
    enabled,
  });

  return {
    overview: overview.data ?? emptyOverview,
    users: users.data?.data ?? [],
    projects: projects.data?.data ?? [],
    disputes: disputes.data?.data ?? [],
    transactions: transactions.data?.data ?? [],
    fraud: fraud.data?.data ?? [],
    audit: audit.data?.data ?? [],
    nfts: nfts.data?.recent ?? [],
    paymentAnalytics: payments.data,
    isLive: Boolean(overview.data),
    isLoading: overview.isLoading || users.isLoading || projects.isLoading,
  };
}

export function ProofChainAdminPanel() {
  const [active, setActive] = useState<AdminSection>("overview");
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<AdminRealtimePayload[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const auth = useQuery({
    queryKey: ["admin", "me"],
    queryFn: () => adminFetch<AuthUser>("/api/auth/me"),
    enabled: authReady && hasToken,
    retry: false,
  });
  const isAdmin = Boolean(auth.data?.role && ADMIN_ROLES.includes(auth.data.role));
  const data = useAdminData(isAdmin);
  const queryClient = useQueryClient();

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data.users;
    return data.users.filter((user) =>
      [user.fullName, user.email, user.walletAddress, user.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [data.users, query]);

  useEffect(() => {
    setHasToken(Boolean(getAccessToken()));
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const socket = createRealtimeSocketClient();
    if (!socket) return;

    const onAdminEvent = (payload: AdminRealtimePayload) => {
      setEvents((prev) => [payload, ...prev].slice(0, 20));
      if (payload.severity === "critical") {
        toast.error(payload.title, { description: payload.message });
      } else {
        toast(payload.title, { description: payload.message });
      }
    };

    socket.on("admin_event", onAdminEvent);
    return () => {
      socket.off("admin_event", onAdminEvent);
      socket.disconnect();
    };
  }, [isAdmin]);

  const runAction = async (label: string, promise: Promise<unknown>) => {
    const result = await promise;
    if (!result) {
      toast.error(`${label} failed`);
      return;
    }
    toast.success(label);
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  const syncTransactions = () =>
    runAction("Blockchain sync requested", adminMutation("/api/admin/transactions/sync", {}, "POST"));

  const runFraudScan = () =>
    runAction("Fraud scan completed", adminMutation("/api/admin/fraud/scan", {}, "POST"));

  if (!authReady || (hasToken && auth.isLoading)) {
    return <AdminAccessScreen state="loading" />;
  }

  if (!hasToken) {
    return <AdminAccessScreen state="signed-out" />;
  }

  if (!isAdmin) {
    return <AdminAccessScreen state="denied" user={auth.data} />;
  }

  return (
    <div className="min-h-screen bg-[#07090d] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40" />
      <div className="relative grid min-h-screen lg:grid-cols-[268px_1fr]">
        <aside className="border-b border-white/10 bg-black/35 px-4 py-4 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-emerald-400/30 bg-emerald-400/10">
                <Blocks className="h-4 w-4 text-emerald-300" />
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-50">ProofChain</p>
                <p className="text-xs text-zinc-500">Admin Console</p>
              </div>
            </div>
            <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Base Sepolia</Badge>
          </div>

          <nav className="mt-6 grid gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const selected = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(item.id)}
                  className={cx(
                    "flex h-10 items-center gap-3 rounded-[8px] px-3 text-left text-sm transition",
                    selected
                      ? "border border-white/10 bg-white/[0.08] text-zinc-50"
                      : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Realtime relay</span>
              <span className={cx("font-medium", data.isLive ? "text-emerald-300" : "text-amber-300")}>
                {data.isLive ? "Live" : "No API data"}
              </span>
            </div>
            <Progress value={data.overview.kpis.transactionSuccessRate} className="mt-3 h-1.5" />
          </div>
        </aside>

        <main className="min-w-0 px-4 py-4 sm:px-6 lg:px-8">
          <header className="sticky top-0 z-30 -mx-4 border-b border-white/10 bg-[#07090d]/88 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-sky-400/30 bg-sky-400/10 text-sky-200">
                    <Zap className="mr-1 h-3 w-3" />
                    UGF Operations
                  </Badge>
                  <Badge className="border-white/10 bg-white/[0.04] text-zinc-300">
                    <LockKeyhole className="mr-1 h-3 w-3" />
                    RBAC Protected
                  </Badge>
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">Admin Control Plane</h1>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search wallets, users, projects"
                    className="h-10 rounded-[8px] border-white/10 bg-white/[0.04] pl-9 text-sm text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
                <Button variant="outline" className="gap-2 rounded-[8px] border-white/10 bg-white/[0.04]" onClick={syncTransactions}>
                  <RefreshCw className="h-4 w-4" />
                  Sync
                </Button>
                <Button className="gap-2 rounded-[8px] bg-emerald-400 text-zinc-950 hover:bg-emerald-300" onClick={runFraudScan}>
                  <ShieldCheck className="h-4 w-4" />
                  Scan
                </Button>
              </div>
            </div>
          </header>

          <div className="mt-5 space-y-5">
            {active === "overview" ? <OverviewSection data={data.overview} events={events} transactions={data.transactions} disputes={data.disputes} /> : null}
            {active === "users" ? <UsersSection users={filteredUsers} runAction={runAction} /> : null}
            {active === "projects" ? <ProjectsSection projects={data.projects} runAction={runAction} /> : null}
            {active === "disputes" ? <DisputesSection disputes={data.disputes} runAction={runAction} /> : null}
            {active === "transactions" ? <TransactionsSection transactions={data.transactions} runAction={runAction} /> : null}
            {active === "nfts" ? <NftSection nfts={data.nfts} overview={data.overview} /> : null}
            {active === "fraud" ? <FraudSection alerts={data.fraud} overview={data.overview} /> : null}
            {active === "analytics" ? <AnalyticsSection overview={data.overview} payments={data.paymentAnalytics} /> : null}
            {active === "audit" ? <AuditSection logs={data.audit} /> : null}
            {active === "settings" ? <SettingsSection /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function AdminAccessScreen({ state, user }: { state: "loading" | "signed-out" | "denied"; user?: AuthUser | null }) {
  const copy =
    state === "loading"
      ? {
          title: "Checking admin access",
          message: "ProofChain is validating your session before loading the operations console.",
          action: null,
        }
      : state === "signed-out"
        ? {
            title: "Admin session required",
            message: "Sign in with an admin wallet before opening the ProofChain control plane.",
            action: "Go to sign in",
          }
        : {
            title: "Admin access denied",
            message: `This account is ${user?.role ?? "not authenticated"} and cannot access the admin console.`,
            action: "Switch account",
          };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07090d] px-4 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40" />
      <section className="relative w-full max-w-md rounded-[8px] border border-white/10 bg-zinc-950/70 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <span className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-emerald-400/30 bg-emerald-400/10">
          <LockKeyhole className="h-5 w-5 text-emerald-300" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-50">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{copy.message}</p>
        {user?.walletAddress ? (
          <p className="mt-4 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-zinc-500">
            {shortAddress(user.walletAddress)}
          </p>
        ) : null}
        {copy.action ? (
          <Button
            className="mt-5 w-full rounded-[8px] bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
            onClick={() => {
              window.location.href = "/auth";
            }}
          >
            {copy.action}
          </Button>
        ) : null}
      </section>
    </div>
  );
}

function OverviewSection({
  data,
  events,
  transactions,
  disputes,
}: {
  data: OverviewData;
  events: AdminRealtimePayload[];
  transactions: AdminTransaction[];
  disputes: AdminDispute[];
}) {
  const kpis = [
    { icon: CircleDollarSign, label: "Platform revenue", value: formatMoney(data.kpis.totalPlatformRevenue), delta: "+12.4%", tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
    { icon: Coins, label: "UGF payments", value: formatMoney(data.kpis.totalUgfPayments), delta: `${data.kpis.totalUgfPaymentCount} tx`, tone: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
    { icon: Gem, label: "NFTs minted", value: String(data.kpis.totalNftsMinted), delta: "SBT proof", tone: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300" },
    { icon: Activity, label: "Active users", value: String(data.kpis.activeUsers), delta: `${data.kpis.totalUsers} total`, tone: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
    { icon: BriefcaseBusiness, label: "Active projects", value: String(data.kpis.activeProjects), delta: "workflow", tone: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" },
    { icon: CheckCircle2, label: "Tx success rate", value: `${data.kpis.transactionSuccessRate}%`, delta: "Base", tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
    { icon: Gavel, label: "Open disputes", value: String(data.kpis.openDisputes), delta: "moderation", tone: "border-rose-400/30 bg-rose-400/10 text-rose-300" },
    { icon: WalletCards, label: "Escrow locked", value: formatMoney(data.kpis.escrowLockedFunds), delta: "protected", tone: "border-indigo-400/30 bg-indigo-400/10 text-indigo-300" },
  ];

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <KpiCard key={item.label} {...item} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <Panel className="min-h-[340px]">
          <SectionTitle icon={BarChart3} title="Payment Activity" meta="mUSD volume" />
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.charts.paymentActivity}>
                <defs>
                  <linearGradient id="paymentGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} />
                <XAxis dataKey="date" stroke="#71717a" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke="#71717a" tickLine={false} axisLine={false} fontSize={12} width={52} />
                <Tooltip contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="value" stroke="#34d399" fill="url(#paymentGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <SectionTitle icon={Bell} title="Realtime Admin Feed" meta={`${events.length} events`} />
          <ScrollArea className="mt-4 h-72 pr-3">
            <div className="space-y-0">
              {events.map((event, index) => (
                <div key={`${event.title}-${index}`} className="border-b border-white/10 py-3 last:border-b-0">
                  <div className="flex items-start gap-3">
                    <span className={cx("mt-0.5 h-2 w-2 rounded-full", event.severity === "critical" ? "bg-rose-400" : event.severity === "success" ? "bg-emerald-400" : "bg-amber-300")} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-100">{event.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{event.message ?? event.type}</p>
                      <p className="mt-2 text-[11px] text-zinc-600">{formatDateTime(event.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel>
          <SectionTitle icon={Activity} title="Daily Active Users" />
          <MiniLine data={data.charts.dailyActiveUsers} color="#60a5fa" />
        </Panel>
        <Panel>
          <SectionTitle icon={Gem} title="NFT Mint Trends" />
          <MiniLine data={data.charts.nftMintTrends} color="#e879f9" />
        </Panel>
        <Panel>
          <SectionTitle icon={ShieldAlert} title="Fraud Alerts" />
          <MiniLine data={data.charts.fraudAlerts} color="#fb7185" />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <LiveTransactionPanel transactions={transactions} />
        <DisputeQueuePanel disputes={disputes} />
      </section>
    </>
  );
}

function MiniLine({ data, color }: { data: SeriesPoint[]; color: string }) {
  return (
    <div className="mt-4 h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
          <XAxis dataKey="date" hide />
          <YAxis hide />
          <Tooltip contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LiveTransactionPanel({ transactions }: { transactions: AdminTransaction[] }) {
  return (
    <Panel>
      <SectionTitle icon={Network} title="Live Transaction Feed" meta="UGF, escrow, NFT" />
      <div className="mt-4 divide-y divide-white/10">
        {transactions.map((tx) => (
          <div key={tx.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusTone(tx.status)}>{normalizeStatus(tx.status)}</Badge>
                <span className="truncate font-mono text-xs text-zinc-400">{shortAddress(tx.txHash)}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-200">{normalizeStatus(tx.type)}</p>
              <p className="text-xs text-zinc-500">{formatDateTime(tx.createdAt)} · block {tx.blockNumber ?? "pending"}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-medium text-zinc-100">{formatMoney(tx.amount, tx.currency ?? "mUSD")}</p>
              <p className="text-xs text-zinc-500">gas {tx.gasQuote ?? "n/a"} {tx.gasQuoteCurrency ?? ""}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DisputeQueuePanel({ disputes }: { disputes: AdminDispute[] }) {
  return (
    <Panel>
      <SectionTitle icon={Gavel} title="Dispute Queue" meta="moderation SLA" />
      <div className="mt-4 divide-y divide-white/10">
        {disputes.map((dispute) => (
          <div key={dispute.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={statusTone(dispute.status)}>{normalizeStatus(dispute.status)}</Badge>
              <Badge className="border-white/10 bg-white/[0.04] text-zinc-300">{dispute.priority ?? "medium"}</Badge>
            </div>
            <p className="mt-2 text-sm font-medium text-zinc-100">{dispute.reason}</p>
            <p className="mt-1 text-xs text-zinc-500">{dispute.project?.title ?? "Unlinked project"} · {formatDateTime(dispute.createdAt)}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function UsersSection({
  users,
  runAction,
}: {
  users: AdminUser[];
  runAction: (label: string, promise: Promise<unknown>) => Promise<void>;
}) {
  return (
    <Panel>
      <SectionTitle icon={UserCog} title="User Management" meta={`${users.length} visible`} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr className="border-b border-white/10">
              <th className="py-3 font-medium">User</th>
              <th className="py-3 font-medium">Wallet</th>
              <th className="py-3 font-medium">Role</th>
              <th className="py-3 font-medium">Reputation</th>
              <th className="py-3 font-medium">Projects</th>
              <th className="py-3 font-medium">Earnings</th>
              <th className="py-3 font-medium">NFTs</th>
              <th className="py-3 font-medium">Last active</th>
              <th className="py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.05] text-xs font-semibold">
                      {(user.fullName ?? user.email ?? "PC").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-zinc-100">{user.fullName ?? user.username ?? "Unnamed account"}</p>
                      <p className="truncate text-xs text-zinc-500">{user.email ?? "No email"}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 font-mono text-xs text-zinc-400">{shortAddress(user.walletAddress)}</td>
                <td className="py-3">
                  <Badge className={statusTone(user.role)}>{normalizeStatus(user.role)}</Badge>
                  {user.isVerified ? <Badge className="ml-2 border-emerald-400/30 bg-emerald-400/10 text-emerald-200">verified</Badge> : null}
                </td>
                <td className="py-3">
                  <div className="flex w-28 items-center gap-2">
                    <Progress value={user.reputationScore} className="h-1.5" />
                    <span className="text-xs text-zinc-400">{Math.round(user.reputationScore)}</span>
                  </div>
                </td>
                <td className="py-3 text-zinc-300">{user.projectsCount ?? 0}</td>
                <td className="py-3 text-zinc-300">{formatMoney(user.totalEarnings)}</td>
                <td className="py-3 text-zinc-300">{user.nftsOwned ?? 0}</td>
                <td className="py-3 text-xs text-zinc-500">{formatDateTime(user.updatedAt ?? user.createdAt)}</td>
                <td className="py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-[8px] border-white/10 bg-white/[0.04]"
                      onClick={() => runAction("User verified", adminMutation(`/api/admin/users/${user.id}/verify`, { isVerified: true }))}
                    >
                      <BadgeCheck className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-[8px] border-white/10 bg-white/[0.04]"
                      onClick={() =>
                        runAction(
                          "Account flagged",
                          adminMutation(`/api/admin/users/${user.id}/flag`, {
                            reason: "Suspicious operational signal reviewed from admin panel",
                            riskScore: 72,
                            severity: "HIGH",
                          }, "POST"),
                        )
                      }
                    >
                      <Flag className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-[8px] border-rose-400/30 bg-rose-400/10 text-rose-200"
                      onClick={() =>
                        runAction(
                          "User suspended",
                          adminMutation(`/api/admin/users/${user.id}/suspend`, {
                            reason: "Temporary risk hold issued from admin panel",
                          }),
                        )
                      }
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ProjectsSection({
  projects,
  runAction,
}: {
  projects: AdminProject[];
  runAction: (label: string, promise: Promise<unknown>) => Promise<void>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel>
        <SectionTitle icon={BriefcaseBusiness} title="Project Monitoring" meta={`${projects.length} projects`} />
        <div className="mt-4 divide-y divide-white/10">
          {projects.map((project) => {
            const milestones = project.milestones ?? [];
            const complete = milestones.filter((item) => item.status === "completed").length;
            const progress = milestones.length ? Math.round((complete / milestones.length) * 100) : 0;
            const escrow = project.payments?.reduce((sum, payment) => sum + (["escrowed", "pending"].includes(payment.status) ? payment.amount : 0), 0) ?? 0;
            return (
              <div key={project.id} className="py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={statusTone(project.status)}>{normalizeStatus(project.status)}</Badge>
                      <span className="text-xs text-zinc-500">{formatMoney(project.budget)}</span>
                    </div>
                    <h3 className="mt-2 truncate text-base font-semibold text-zinc-50">{project.title}</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {project.owner?.fullName ?? shortAddress(project.owner?.walletAddress)} → {project.freelancer?.fullName ?? "Unassigned"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 rounded-[8px] border-white/10 bg-white/[0.04]"
                    onClick={() =>
                      runAction(
                        "Project force-closed",
                        adminMutation(`/api/admin/projects/${project.id}/close`, {
                          status: "completed",
                          reason: "Administrative close after evidence review",
                        }),
                      )
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Close
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-zinc-500">Milestones</p>
                    <Progress value={progress} className="mt-2 h-1.5" />
                    <p className="mt-1 text-xs text-zinc-400">{progress}% complete</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Escrow funds</p>
                    <p className="mt-1 text-sm text-zinc-100">{formatMoney(escrow)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Records</p>
                    <p className="mt-1 text-sm text-zinc-100">
                      {project._count?.payments ?? project.payments?.length ?? 0} payments · {project._count?.disputes ?? 0} disputes
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon={FileSearch} title="Moderation Lens" />
        <div className="mt-4 space-y-4">
          {projects.map((project) => (
            <div key={`lens-${project.id}`} className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
              <p className="text-sm font-medium text-zinc-100">{project.title}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-500">
                <span>Client</span>
                <span className="truncate text-right text-zinc-300">{shortAddress(project.owner?.walletAddress)}</span>
                <span>Freelancer</span>
                <span className="truncate text-right text-zinc-300">{shortAddress(project.freelancer?.walletAddress)}</span>
                <span>NFTs</span>
                <span className="text-right text-zinc-300">{project._count?.nftCertificates ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function DisputesSection({
  disputes,
  runAction,
}: {
  disputes: AdminDispute[];
  runAction: (label: string, promise: Promise<unknown>) => Promise<void>;
}) {
  const selected = disputes[0];
  const resolve = (action: string) =>
    selected
      ? runAction(
          "Dispute action recorded",
          adminMutation(`/api/admin/disputes/${selected.id}/resolve`, {
            action,
            notes: `${normalizeStatus(action)} from admin arbitration panel`,
          }),
        )
      : Promise.resolve();

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel>
        <SectionTitle icon={Gavel} title="Dispute Resolution Queue" />
        <div className="mt-4 divide-y divide-white/10">
          {disputes.map((dispute) => (
            <div key={dispute.id} className="py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusTone(dispute.status)}>{normalizeStatus(dispute.status)}</Badge>
                <Badge className="border-white/10 bg-white/[0.04] text-zinc-300">{dispute.priority ?? "medium"}</Badge>
              </div>
              <p className="mt-2 text-sm font-medium text-zinc-100">{dispute.reason}</p>
              <p className="mt-1 text-xs text-zinc-500">{dispute.project?.title ?? "Unknown project"}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon={FileSearch} title="Arbitration Workspace" meta={selected?.id} />
        {selected ? (
          <div className="mt-4 space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-zinc-50">{selected.reason}</h3>
              <p className="mt-2 text-sm text-zinc-400">{selected.description ?? "Evidence review pending."}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricPill label="Project" value={selected.project?.title ?? "Unknown"} />
              <MetricPill label="Milestone" value={selected.milestone?.title ?? "All"} />
              <MetricPill label="Amount" value={formatMoney(selected.milestone?.amount ?? selected.project?.budget)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <EvidenceRow icon={WalletCards} label="Raised by" value={shortAddress(selected.raisedBy?.walletAddress)} />
              <EvidenceRow icon={ShieldAlert} label="Against" value={shortAddress(selected.againstUser?.walletAddress)} />
              <EvidenceRow icon={Network} label="Blockchain proof" value="Indexed events attached" />
              <EvidenceRow icon={Gem} label="NFT proof" value="Certificate metadata inspected" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="gap-2 rounded-[8px] bg-emerald-400 text-zinc-950 hover:bg-emerald-300" onClick={() => resolve("RELEASE_PAYMENT")}>
                <Coins className="h-4 w-4" />
                Release
              </Button>
              <Button variant="outline" className="gap-2 rounded-[8px] border-white/10 bg-white/[0.04]" onClick={() => resolve("REFUND_CLIENT")}>
                <RefreshCw className="h-4 w-4" />
                Refund
              </Button>
              <Button variant="outline" className="gap-2 rounded-[8px] border-white/10 bg-white/[0.04]" onClick={() => resolve("SPLIT_PAYMENT")}>
                <Gavel className="h-4 w-4" />
                Split
              </Button>
              <Button variant="outline" className="gap-2 rounded-[8px] border-amber-400/30 bg-amber-400/10 text-amber-200" onClick={() => resolve("REQUEST_EVIDENCE")}>
                <FileSearch className="h-4 w-4" />
                Evidence
              </Button>
            </div>
          </div>
        ) : (
          <EmptyLine label="No disputes in queue" />
        )}
      </Panel>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.035] p-3 rounded-[8px]">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}

function EvidenceRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border border-white/10 bg-white/[0.025] p-3 rounded-[8px]">
      <Icon className="h-4 w-4 text-emerald-300" />
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="truncate text-sm text-zinc-100">{value}</p>
      </div>
    </div>
  );
}

function TransactionsSection({
  transactions,
  runAction,
}: {
  transactions: AdminTransaction[];
  runAction: (label: string, promise: Promise<unknown>) => Promise<void>;
}) {
  return (
    <Panel>
      <SectionTitle icon={Network} title="Blockchain Transaction Monitoring" meta="Base Sepolia" />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr className="border-b border-white/10">
              <th className="py-3 font-medium">Hash</th>
              <th className="py-3 font-medium">Type</th>
              <th className="py-3 font-medium">Status</th>
              <th className="py-3 font-medium">Block</th>
              <th className="py-3 font-medium">Gas quote</th>
              <th className="py-3 font-medium">Wallets</th>
              <th className="py-3 font-medium">Time</th>
              <th className="py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td className="py-3 font-mono text-xs text-zinc-300">
                  {tx.explorerUrl ? (
                    <a className="hover:text-emerald-300" href={tx.explorerUrl} target="_blank" rel="noreferrer">
                      {shortAddress(tx.txHash)}
                    </a>
                  ) : (
                    shortAddress(tx.txHash)
                  )}
                </td>
                <td className="py-3 text-zinc-300">{normalizeStatus(tx.type)}</td>
                <td className="py-3">
                  <Badge className={statusTone(tx.status)}>{normalizeStatus(tx.monitoringStatus ?? tx.status)}</Badge>
                </td>
                <td className="py-3 text-zinc-400">{tx.blockNumber ?? "pending"}</td>
                <td className="py-3 text-zinc-400">{tx.gasQuote ?? "n/a"} {tx.gasQuoteCurrency ?? ""}</td>
                <td className="py-3 text-xs text-zinc-500">{shortAddress(tx.fromAddress)} → {shortAddress(tx.toAddress)}</td>
                <td className="py-3 text-xs text-zinc-500">{formatDateTime(tx.createdAt)}</td>
                <td className="py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 rounded-[8px] border-white/10 bg-white/[0.04]"
                    disabled={tx.status === "confirmed" || !tx.txHash}
                    onClick={() =>
                      runAction(
                        "Transaction retry queued",
                        adminMutation(`/api/admin/transactions/${tx.txHash}/retry`, {
                          notes: "Retry requested from blockchain monitoring panel",
                        }, "POST"),
                      )
                    }
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function NftSection({ nfts, overview }: { nfts: AdminNft[]; overview: OverviewData }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel>
        <SectionTitle icon={Gem} title="Soulbound NFT Certificates" meta={`${overview.kpis.totalNftsMinted} minted`} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {nfts.map((nft) => (
            <div key={nft.id} className="grid grid-cols-[88px_1fr] gap-3 border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[8px] border border-emerald-400/25 bg-[radial-gradient(circle_at_35%_25%,rgba(52,211,153,.35),transparent_35%),linear-gradient(135deg,rgba(14,165,233,.24),rgba(168,85,247,.2))]">
                <Gem className="h-8 w-8 text-emerald-200" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={statusTone(nft.certificateStatus)}>{normalizeStatus(nft.certificateStatus)}</Badge>
                  <span className="text-xs text-zinc-500">#{nft.tokenId}</span>
                </div>
                <p className="mt-2 truncate text-sm font-medium text-zinc-100">{nft.project?.title ?? "Certificate"}</p>
                <p className="mt-1 truncate font-mono text-xs text-zinc-500">{shortAddress(nft.freelancerWallet)}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">{nft.metadataURI}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <SectionTitle icon={BarChart3} title="Mint Statistics" />
        <MiniLine data={overview.charts.nftMintTrends} color="#e879f9" />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MetricPill label="Minted" value={String(overview.kpis.totalNftsMinted)} />
          <MetricPill label="Latest owner" value={shortAddress(nfts[0]?.freelancerWallet)} />
          <MetricPill label="Network" value="Base Sepolia" />
        </div>
      </Panel>
    </div>
  );
}

function FraudSection({ alerts, overview }: { alerts: FraudAlert[]; overview: OverviewData }) {
  const heatmapAlerts = alerts.slice(0, 12);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <Panel>
        <SectionTitle icon={ShieldAlert} title="Fraud Detection" meta={`${overview.kpis.openFraudAlerts} open`} />
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {heatmapAlerts.length ? (
            heatmapAlerts.map((alert) => {
              const risk = alert.riskScore ?? 0;
              return (
                <div
                  key={alert.id}
                  className="h-16 rounded-[8px] border border-white/10"
                  style={{ background: `rgba(${risk > 75 ? "244,63,94" : risk > 50 ? "251,191,36" : "52,211,153"}, ${0.12 + risk / 350})` }}
                >
                  <div className="flex h-full items-end justify-between p-2 text-xs">
                    <span className="truncate text-zinc-500">{alert.type}</span>
                    <span className="font-medium text-zinc-100">{risk}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="surface-panel rounded-[8px] p-4 text-sm text-zinc-500 sm:col-span-4">
              No fraud alerts found.
              </div>
          )}
        </div>
        <div className="mt-5 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overview.charts.fraudAlerts}>
              <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
              <XAxis dataKey="date" stroke="#71717a" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis stroke="#71717a" tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
              <Bar dataKey="value" fill="#fb7185" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel>
        <SectionTitle icon={Flag} title="Suspicious Activity Feed" />
        <div className="mt-4 divide-y divide-white/10">
          {alerts.map((alert) => (
            <div key={alert.id} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={statusTone(alert.severity)}>{alert.severity}</Badge>
                    <span className="text-xs text-zinc-500">risk {alert.riskScore}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-zinc-100">{alert.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{alert.description}</p>
                </div>
                <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-300" />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AnalyticsSection({
  overview,
  payments,
}: {
  overview: OverviewData;
  payments?: {
    volume: SeriesPoint[];
    successFailure: Array<{ name: string; value: number }>;
    gasQuotes: SeriesPoint[];
    executionTiming: SeriesPoint[];
  } | null;
}) {
  const paymentVolume = payments?.volume?.length ? payments.volume : overview.charts.paymentActivity;
  const successFailure = payments?.successFailure?.length ? payments.successFailure : overview.charts.transactionOutcomes;

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel>
        <SectionTitle icon={CircleDollarSign} title="UGF Payment Analytics" meta="volume, gas, latency" />
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={paymentVolume}>
              <defs>
                <linearGradient id="ugfVolume" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
              <XAxis dataKey="date" stroke="#71717a" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis stroke="#71717a" tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
              <Area dataKey="value" type="monotone" stroke="#38bdf8" fill="url(#ugfVolume)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel>
        <SectionTitle icon={CheckCircle2} title="Execution Outcomes" />
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={successFailure} dataKey="value" nameKey="name" innerRadius={64} outerRadius={98} paddingAngle={3}>
                {successFailure.map((_, index) => (
                  <Cell key={index} fill={outcomeColors[index % outcomeColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel className="xl:col-span-2">
        <SectionTitle icon={BriefcaseBusiness} title="Project Completion Trends" />
        <MiniLine data={overview.charts.projectCompletionTrends} color="#34d399" />
      </Panel>
    </div>
  );
}

function AuditSection({ logs }: { logs: AuditLog[] }) {
  return (
    <Panel>
      <SectionTitle icon={BookOpen} title="Immutable Admin Audit Logs" meta={`${logs.length} entries`} />
      <div className="mt-4 divide-y divide-white/10">
        {logs.map((log) => (
          <div key={log.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-white/10 bg-white/[0.04] text-zinc-300">{log.actionType}</Badge>
                <span className="text-xs text-zinc-500">{log.entityType}</span>
              </div>
              <p className="mt-2 truncate text-sm text-zinc-100">{log.entityId ?? "system"}</p>
              <p className="mt-1 text-xs text-zinc-500">{log.admin?.fullName ?? shortAddress(log.admin?.walletAddress)} · {log.admin?.role ?? "admin"}</p>
            </div>
            <p className="text-xs text-zinc-500">{formatDateTime(log.createdAt)}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SettingsSection() {
  const roles = [
    { role: "SUPER_ADMIN", access: "Full control", icon: ShieldCheck },
    { role: "MODERATOR", access: "Disputes and fraud review", icon: Gavel },
    { role: "SUPPORT_ADMIN", access: "Users and account health", icon: UserCog },
    { role: "BLOCKCHAIN_ADMIN", access: "Transactions, UGF, NFTs", icon: Network },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel>
        <SectionTitle icon={LockKeyhole} title="RBAC Matrix" />
        <div className="mt-4 divide-y divide-white/10">
          {roles.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.role} className="flex items-center gap-3 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.04]">
                  <Icon className="h-4 w-4 text-emerald-300" />
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-100">{item.role}</p>
                  <p className="text-xs text-zinc-500">{item.access}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel>
        <SectionTitle icon={Command} title="Security Controls" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <MetricPill label="JWT validation" value="Enabled" />
          <MetricPill label="Admin rate limit" value="120/min" />
          <MetricPill label="Audit protection" value="Append-only" />
          <MetricPill label="Session model" value="Refresh-token backed" />
          <MetricPill label="Realtime rooms" value="Admin-only" />
          <MetricPill label="Chain" value="Base Sepolia" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2 rounded-[8px] border-white/10 bg-white/[0.04]">
            <Clock3 className="h-4 w-4" />
            Session Policy
          </Button>
          <Button variant="outline" className="gap-2 rounded-[8px] border-white/10 bg-white/[0.04]">
            <XCircle className="h-4 w-4" />
            Emergency Lock
          </Button>
        </div>
      </Panel>
    </div>
  );
}
