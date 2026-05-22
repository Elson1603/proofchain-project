import { createFileRoute, Link } from "@tanstack/react-router";
import { BriefcaseBusiness, Clock3, FileSearch, Landmark, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CreateProjectDialog } from "@/components/proofchain/create-project-dialog";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { useNotifications } from "@/hooks/use-notifications";
import { openNotification } from "@/lib/notification-routing";
import {
  fetchCurrentUser,
  fetchProjects,
  fetchSubmissions,
  formatDateTime,
  formatMoney,
  shortHash,
  userDisplayName,
  type ApiProject,
  type ApiSubmission,
  type ApiUser,
} from "@/lib/proofchain-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/dashboard")({
  head: () => ({
    meta: [
      { title: "Client Dashboard — ProofChain" },
      { name: "description", content: "Manage projects, approvals, and gasless payment releases." },
      { property: "og:title", content: "Client Dashboard — ProofChain" },
      { property: "og:description", content: "Review freelance submissions and trigger UGF-secured payouts." },
    ],
  }),
  component: ClientDashboardPage,
});

const clientNav = [
  { label: "Dashboard", to: "/client/dashboard" },
  { label: "Approvals", to: "/client/approval-workflow" },
  { label: "Project Details", to: "/client/project-details" },
  { label: "Messages", to: "/messages" },
  { label: "Settings", to: "/auth" },
];

function ClientDashboardPage() {
  const { notifications, unreadCount, isLoading, markAllRead, markRead } = useNotifications({ limit: 5 });
  const [user, setUser] = useState<ApiUser | null>(null);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setDashboardLoading(true);
      const me = await fetchCurrentUser();
      const [nextProjects, nextSubmissions] = me
        ? await Promise.all([
            fetchProjects({ ownerId: me.id }).catch(() => null),
            fetchSubmissions().catch(() => null),
          ])
        : [[], []];

      if (!cancelled) {
        setUser(me);
        setProjects(nextProjects ?? []);
        setSubmissions((nextSubmissions ?? []).filter((submission) => submission.milestone?.project?.ownerId === me?.id));
        setDashboardLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const pendingApprovals = submissions.filter((submission) => submission.milestone?.status === "submitted").length;
  const escrowBalance = useMemo(
    () =>
      projects
        .flatMap((project) => project.payments ?? [])
        .filter((payment) => payment.status === "escrowed" || payment.status === "pending")
        .reduce((sum, payment) => sum + payment.amount, 0),
    [projects],
  );
  const stats = [
    { label: "Posted projects", value: String(projects.length), icon: BriefcaseBusiness },
    { label: "Pending approvals", value: String(pendingApprovals), icon: Clock3 },
    { label: "Escrow balance", value: formatMoney(escrowBalance), icon: Landmark },
    { label: "Submissions", value: String(submissions.length), icon: FileSearch },
  ];

  return (
    <DashboardShell
      title="Client Dashboard"
      subtitle="Review deliverables and release secure gasless payments."
      navItems={clientNav}
      workspaceLabel="Client OS"
      notificationCount={unreadCount}
    >
      <section className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Create a client project</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add scope, budget, and milestones before inviting a freelancer.</p>
        </div>
        <CreateProjectDialog
          owner={user}
          onCreated={(project) => {
            setProjects((current) => [project, ...current]);
          }}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="glass-panel rounded-xl p-4">
            <stat.icon className="h-5 w-5 text-primary" />
            <p className="mt-2 text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-xl font-bold text-foreground">{stat.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="glass-panel rounded-xl p-4">
          <h2 className="text-base font-semibold text-foreground">Freelancer submissions</h2>
          <div className="mt-3 space-y-2">
            {!user ? (
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">Connect a client wallet to load submissions.</div>
            ) : dashboardLoading ? (
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">Loading submissions...</div>
            ) : submissions.length ? (
              submissions.slice(0, 6).map((submission) => (
              <div key={submission.id} className="surface-panel rounded-lg p-3">
                <p className="text-sm text-foreground">{submission.milestone?.project?.title ?? "Untitled project"}</p>
                <p className="text-xs text-muted-foreground">
                  {userDisplayName(submission.submittedBy)} · {submission.milestone?.title ?? "Milestone"}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-primary">{shortHash(submission.ipfsCid ?? submission.id)}</span>
                  <span className="text-muted-foreground">{formatDateTime(submission.createdAt)}</span>
                </div>
              </div>
              ))
            ) : (
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">No submissions found yet.</div>
            )}
          </div>
        </article>

        <article className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Notification center</h2>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs text-primary hover:underline"
              disabled={!unreadCount}
            >
              Mark all read
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {isLoading && (
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">Loading notifications...</div>
            )}
            {!isLoading && notifications.length === 0 && (
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">No notifications yet.</div>
            )}
            {notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openNotification(item, markRead)}
                className={cn(
                  "surface-panel w-full rounded-lg p-3 text-left text-sm transition",
                  item.isRead ? "text-muted-foreground" : "border border-primary/30 text-foreground",
                )}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="mt-0.5 h-4 w-4 text-info" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.message}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <Link to="/client/approval-workflow" className="mt-4 inline-block text-xs text-primary hover:underline">
            Open approval workflow
          </Link>
        </article>
      </section>
    </DashboardShell>
  );
}
