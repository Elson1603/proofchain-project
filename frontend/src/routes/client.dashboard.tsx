import { createFileRoute, Link } from "@tanstack/react-router";
import { BriefcaseBusiness, Clock3, FileSearch, Landmark, MessageSquare } from "lucide-react";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { submissions } from "@/components/proofchain/mock-data";
import { useNotifications } from "@/hooks/use-notifications";
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
  { label: "Project Details", to: "/project-details" },
  { label: "Messages", to: "/messages" },
  { label: "Settings", to: "/auth" },
];

const stats = [
  { label: "Posted projects", value: "14", icon: BriefcaseBusiness },
  { label: "Pending approvals", value: "06", icon: Clock3 },
  { label: "Escrow balance", value: "24,900 mUSD", icon: Landmark },
  { label: "Submissions", value: "18", icon: FileSearch },
];

function ClientDashboardPage() {
  const { notifications, unreadCount, isLoading, markAllRead, markRead } = useNotifications({ limit: 5 });

  return (
    <DashboardShell
      title="Client Dashboard"
      subtitle="Review deliverables and release secure gasless payments."
      navItems={clientNav}
      notificationCount={unreadCount}
    >
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
            {submissions.map((submission) => (
              <div key={submission.hash} className="surface-panel rounded-lg p-3">
                <p className="text-sm text-foreground">{submission.project}</p>
                <p className="text-xs text-muted-foreground">
                  {submission.freelancer} · {submission.milestone}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-primary">{submission.hash}</span>
                  <span className="text-muted-foreground">{submission.updated}</span>
                </div>
              </div>
            ))}
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
                onClick={() => void markRead(item.id)}
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
