import { Link } from "@tanstack/react-router";
import { BadgeCheck, MessageSquare, Paperclip, ShieldCheck, Timer, UploadCloud } from "lucide-react";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { Button } from "@/components/ui/button";

type NavItem = {
  label: string;
  to: string;
};

type ProjectDetailsMode = "freelancer" | "client" | "shared";

type ProjectDetailsWorkspaceProps = {
  mode: ProjectDetailsMode;
  navItems: NavItem[];
};

const project = {
  id: "PC-82941",
  chatId: "PC-82941",
  tokenId: "1017",
  txHash: "0x8b4f...ac31",
};

const freelancerTimeline = [
  "Brief accepted",
  "Milestone 03 uploaded",
  "Proof hash attached",
  "Awaiting client approval",
  "Certificate unlocks after payout",
];

const clientTimeline = [
  "Scope funded",
  "Deliverables received",
  "Client review",
  "Release gasless payout",
  "Mint completion certificate",
];

export function ProjectDetailsWorkspace({ mode, navItems }: ProjectDetailsWorkspaceProps) {
  const isClient = mode === "client";
  const isFreelancer = mode === "freelancer";

  return (
    <DashboardShell
      title={isClient ? "Client Project Details" : isFreelancer ? "Freelancer Projects" : "Project Details"}
      subtitle={
        isClient
          ? "Review deliverables, approve milestones, and release escrow."
          : "Manage delivery, submissions, payout status, and proof records."
      }
      navItems={navItems}
      workspaceLabel={isClient ? "Client OS" : isFreelancer ? "Freelance OS" : "ProofChain OS"}
    >
      {isClient ? <ClientProjectView /> : <FreelancerProjectView />}
    </DashboardShell>
  );
}

function FreelancerProjectView() {
  return (
    <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <article className="glass-panel rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{project.id}</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">UGF settlement + escrow routing</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Delivery board for submitted work, proof hash, and payout readiness.
              </p>
            </div>
            <StatusPill label="Work submitted" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Milestone" value="03 / 05" />
            <Metric label="Payout" value="2,400 mUSD" />
            <Metric label="Certificate" value="Pending" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm" className="gap-2">
              <Link to="/freelancer/submit-work">
                <UploadCloud className="h-4 w-4" />
                Submit revision
              </Link>
            </Button>
            <ProjectUtilityButtons />
          </div>
        </article>

        <TimelineCard title="Delivery timeline" items={freelancerTimeline} />

        <article className="glass-panel rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground">Client notes</h2>
          <div className="mt-3 space-y-2">
            <p className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">
              Client requested proof of filtering by project state.
            </p>
            <p className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">
              Latest build includes the requested filters and deployment hash.
            </p>
          </div>
        </article>
      </div>

      <aside className="space-y-4">
        <InfoCard
          title="Submission package"
          icon="file"
          lines={["escrow-dashboard-v2.zip", "architecture-notes.pdf", "ipfs-proof.json"]}
        />
        <InfoCard
          title="Payout readiness"
          icon="proof"
          lines={["Escrow funded", "Client approval pending", "No ETH required from freelancer"]}
        />
        <InfoCard
          title="Freelancer proof"
          icon="proof"
          lines={["Proof hash attached", project.txHash, "SBT mint waits for release"]}
        />
      </aside>
    </section>
  );
}

function ClientProjectView() {
  return (
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="space-y-4 lg:order-1">
        <InfoCard
          title="Review queue"
          icon="file"
          lines={["Realtime charts milestone", "2 files attached", "Proof hash submitted"]}
        />
        <InfoCard
          title="Escrow release panel"
          icon="proof"
          lines={["2,400 mUSD ready", "Approve or raise dispute", "UGF relays release transaction"]}
        />
        <InfoCard
          title="Audit trail"
          icon="proof"
          lines={["PC-SBT-1017 queued", "Base Sepolia verification", project.txHash]}
        />
      </aside>

      <div className="space-y-4 lg:order-2">
        <article className="glass-panel rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{project.id}</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">Escrow Analytics Module</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Client review board for approvals, escrow controls, and certificate minting.
              </p>
            </div>
            <StatusPill label="Approval needed" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Submissions" value="2" />
            <Metric label="Escrow" value="Funded" />
            <Metric label="Disputes" value="0" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm" className="gap-2">
              <Link to="/client/approval-workflow">
                <BadgeCheck className="h-4 w-4" />
                Review approval
              </Link>
            </Button>
            <ProjectUtilityButtons />
          </div>
        </article>

        <TimelineCard title="Approval timeline" items={clientTimeline} />

        <article className="glass-panel rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground">Review thread</h2>
          <div className="mt-3 space-y-2">
            <p className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">
              Client: Please confirm filtering by project state before release.
            </p>
            <p className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">
              Freelancer: Added the filters and shared the deployment proof.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

function ProjectUtilityButtons() {
  return (
    <>
      <Button asChild size="sm" variant="outline" className="gap-2">
        <Link to="/projects/$id/chat" params={{ id: project.chatId }}>
          <MessageSquare className="h-4 w-4" />
          Open chat
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="gap-2">
        <Link to="/certificate/$tokenId" params={{ tokenId: project.tokenId }}>
          <ShieldCheck className="h-4 w-4" />
          View certificate
        </Link>
      </Button>
    </>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
      <span className="status-dot" />
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TimelineCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="glass-panel rounded-xl p-5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((step, index) => (
          <div key={step} className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs text-primary">
              {index + 1}
            </div>
            <div>
              <p className="text-sm text-foreground">{step}</p>
              <p className="text-xs text-muted-foreground">Timestamped workflow event</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function InfoCard({ title, lines, icon }: { title: string; lines: string[]; icon: "file" | "proof" }) {
  const Icon = icon === "file" ? Paperclip : ShieldCheck;

  return (
    <article className="glass-panel rounded-xl p-5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        {lines.map((line, index) => (
          <p key={line} className="surface-panel flex items-center gap-2 rounded-md p-2">
            {index === lines.length - 1 ? (
              <Timer className="h-4 w-4 text-info" />
            ) : (
              <Icon className="h-4 w-4 text-primary" />
            )}
            {line}
          </p>
        ))}
      </div>
    </article>
  );
}
