import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgeCheck, Handshake, MessageSquare, Paperclip, ShieldCheck, Timer, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { CreateProjectDialog } from "@/components/proofchain/create-project-dialog";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  acceptProject,
  fetchCurrentUser,
  fetchProjects,
  formatDateTime,
  formatMoney,
  normalizeStatus,
  shortHash,
  userDisplayName,
  type ApiProject,
  type ApiUser,
} from "@/lib/proofchain-api";

type NavItem = {
  label: string;
  to: string;
};

type ProjectDetailsMode = "freelancer" | "client" | "shared";

type ProjectDetailsWorkspaceProps = {
  mode: ProjectDetailsMode;
  navItems: NavItem[];
};

export function ProjectDetailsWorkspace({ mode, navItems }: ProjectDetailsWorkspaceProps) {
  const isClient = mode === "client";
  const isFreelancer = mode === "freelancer";
  const [user, setUser] = useState<ApiUser | null>(null);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [availableProjects, setAvailableProjects] = useState<ApiProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [acceptingProjectId, setAcceptingProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const me = mode === "shared" ? null : await fetchCurrentUser();
      let nextProjects: ApiProject[] = [];
      let nextAvailableProjects: ApiProject[] = [];

      if (mode === "freelancer" && me) {
        const [assignedProjects, openProjects, invitedProjects] = await Promise.all([
          fetchProjects({ freelancerId: me.id }).catch(() => null),
          fetchProjects({ status: "open" }).catch(() => null),
          fetchProjects({ invitedFreelancerId: me.id }).catch(() => null),
        ]);

        nextProjects = assignedProjects ?? [];
        nextAvailableProjects = dedupeProjects([...(invitedProjects ?? []), ...(openProjects ?? [])]).filter(
          (project) =>
            !project.freelancerId &&
            project.ownerId !== me.id &&
            (!project.invitedFreelancerId || project.invitedFreelancerId === me.id),
        );
      } else if (mode === "client" && me) {
        nextProjects = (await fetchProjects({ ownerId: me.id }).catch(() => null)) ?? [];
      } else if (mode === "shared") {
        nextProjects = (await fetchProjects().catch(() => null)) ?? [];
      }

      if (!cancelled) {
        setUser(me);
        setProjects(nextProjects);
        setAvailableProjects(nextAvailableProjects);
        setSelectedProjectId((currentProjectId) =>
          currentProjectId && nextProjects.some((nextProject) => nextProject.id === currentProjectId)
            ? currentProjectId
            : (nextProjects[0]?.id ?? null),
        );
        setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const project = projects.find((currentProject) => currentProject.id === selectedProjectId) ?? projects[0] ?? null;

  const handleAcceptProject = async (projectToAccept: ApiProject) => {
    if (!user) {
      toast.error("Connect your freelancer wallet before accepting a project");
      return;
    }

    setAcceptingProjectId(projectToAccept.id);
    try {
      const acceptedProject = await acceptProject(projectToAccept.id, user.id);

      if (!acceptedProject) {
        throw new Error("Project acceptance failed");
      }

      const acceptedWithContext: ApiProject = {
        ...projectToAccept,
        ...acceptedProject,
        status: acceptedProject.status ?? "in_progress",
        freelancerId: user.id,
        freelancer: user,
      };

      setProjects((current) => [
        acceptedWithContext,
        ...current.filter((currentProject) => currentProject.id !== acceptedWithContext.id),
      ]);
      setSelectedProjectId(acceptedWithContext.id);
      setAvailableProjects((current) => current.filter((currentProject) => currentProject.id !== projectToAccept.id));
      toast.success("Project accepted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Project acceptance failed");
    } finally {
      setAcceptingProjectId(null);
    }
  };

  return (
    <DashboardShell
      title={isClient ? "Client Project Details" : isFreelancer ? "Freelancer Projects" : "Project Details"}
      subtitle={
        isClient
          ? "Review real deliverables, approvals, and escrow records."
          : "Manage real delivery, submissions, payout status, and proof records."
      }
      navItems={navItems}
      workspaceLabel={isClient ? "Client OS" : isFreelancer ? "Freelance OS" : "ProofChain OS"}
    >
      {loading ? (
        <div className="glass-panel rounded-xl p-5 text-sm text-muted-foreground">Loading projects...</div>
      ) : mode !== "shared" && !user ? (
        <EmptyProjectState message="Connect your wallet to load your project workspace." />
      ) : isFreelancer ? (
        <FreelancerProjectsView
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          availableProjects={availableProjects}
          acceptingProjectId={acceptingProjectId}
          onAcceptProject={handleAcceptProject}
        />
      ) : project ? (
        <ProjectWorkspaceView
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          project={project}
          mode={mode}
          owner={user}
          onCreated={(createdProject) => {
            const createdWithOwner = user ? { ...createdProject, owner: user } : createdProject;
            setProjects((current) => [createdWithOwner, ...current]);
            setSelectedProjectId(createdProject.id);
          }}
        />
      ) : (
        <EmptyProjectState
          message="No real projects found yet. Create a project to populate this page."
          action={
            mode === "client" ? (
              <CreateProjectDialog
                owner={user}
                onCreated={(createdProject) => {
                  const createdWithOwner = user ? { ...createdProject, owner: user } : createdProject;
                  setProjects((current) => [createdWithOwner, ...current]);
                  setSelectedProjectId(createdProject.id);
                }}
              />
            ) : null
          }
        />
      )}
    </DashboardShell>
  );
}

function ProjectWorkspaceView({
  projects,
  selectedProjectId,
  onSelectProject,
  project,
  mode,
  owner,
  onCreated,
}: {
  projects: ApiProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  project: ApiProject;
  mode: ProjectDetailsMode;
  owner: ApiUser | null;
  onCreated?: (project: ApiProject) => void;
}) {
  return (
    <div className="space-y-4">
      <ProjectHistory
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={onSelectProject}
        title={mode === "client" ? "Client project history" : "Project history"}
        action={mode === "client" ? <CreateProjectDialog owner={owner} onCreated={onCreated} triggerLabel="New project" /> : null}
      />
      <ProjectView project={project} mode={mode} />
    </div>
  );
}

function FreelancerProjectsView({
  projects,
  selectedProjectId,
  onSelectProject,
  availableProjects,
  acceptingProjectId,
  onAcceptProject,
}: {
  projects: ApiProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  availableProjects: ApiProject[];
  acceptingProjectId: string | null;
  onAcceptProject: (project: ApiProject) => void;
}) {
  const project = projects.find((currentProject) => currentProject.id === selectedProjectId) ?? projects[0] ?? null;

  if (!projects.length && !availableProjects.length) {
    return (
      <EmptyProjectState message="No assigned or open projects found yet. Ask a client to create an open project, then accept it here." />
    );
  }

  return (
    <div className="space-y-4">
      {projects.length ? (
        <ProjectHistory
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={onSelectProject}
          title="Assigned project history"
        />
      ) : null}
      {project ? <ProjectView project={project} mode="freelancer" /> : null}
      <AvailableProjectsSection
        projects={availableProjects}
        acceptingProjectId={acceptingProjectId}
        onAcceptProject={onAcceptProject}
      />
    </div>
  );
}

function ProjectHistory({
  projects,
  selectedProjectId,
  onSelectProject,
  title,
  action,
}: {
  projects: ApiProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  title: string;
  action?: ReactNode;
}) {
  const totalBudget = projects.reduce((sum, project) => sum + (project.budget ?? 0), 0);

  return (
    <section className="glass-panel rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.length} project{projects.length === 1 ? "" : "s"} · {formatMoney(totalBudget)} total budget
          </p>
        </div>
        {action}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => {
          const isSelected = project.id === selectedProjectId;
          const milestoneCount = project.milestones?.length ?? 0;

          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelectProject(project.id)}
              className={`surface-panel rounded-xl border p-4 text-left transition hover:border-primary/45 hover:bg-primary/5 ${
                isSelected ? "border-primary/60 bg-primary/10" : "border-border/70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{project.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(project.createdAt)}</p>
                </div>
                <StatusPill label={normalizeStatus(project.status)} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>{formatMoney(project.budget ?? 0)}</span>
                <span className="text-right">{milestoneCount} milestone{milestoneCount === 1 ? "" : "s"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AvailableProjectsSection({
  projects,
  acceptingProjectId,
  onAcceptProject,
}: {
  projects: ApiProject[];
  acceptingProjectId: string | null;
  onAcceptProject: (project: ApiProject) => void;
}) {
  if (!projects.length) return null;

  return (
    <section className="glass-panel rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Available projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">Open and invited projects ready for freelancer acceptance.</p>
        </div>
        <StatusPill label={`${projects.length} ready`} />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {projects.map((project) => {
          const isAccepting = acceptingProjectId === project.id;
          const milestoneCount = project.milestones?.length ?? 0;

          return (
            <article key={project.id} className="surface-panel rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {project.invitedFreelancerId ? "Invitation" : "Open project"}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">{project.title}</h3>
                </div>
                <StatusPill label={normalizeStatus(project.status)} />
              </div>

              <p className="mt-3 text-sm text-muted-foreground">
                {project.description || "No project description has been added yet."}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Metric label="Budget" value={formatMoney(project.budget ?? 0)} />
                <Metric label="Milestones" value={String(milestoneCount)} />
                <Metric label="Client" value={userDisplayName(project.owner)} />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Deadline: {formatDateTime(project.deadline)}</p>
                <Button size="sm" className="gap-2" onClick={() => onAcceptProject(project)} disabled={isAccepting}>
                  <Handshake className="h-4 w-4" />
                  {isAccepting ? "Accepting..." : "Accept project"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProjectView({ project, mode }: { project: ApiProject; mode: ProjectDetailsMode }) {
  const isClient = mode === "client";
  const milestones = project.milestones ?? [];
  const submissions = milestones.flatMap((milestone) => milestone.submissions ?? []);
  const payments = project.payments ?? [];
  const certificate = project.nftCertificates?.[0];
  const latestTx = payments.flatMap((payment) => payment.transactions ?? [])[0];
  const completedMilestones = milestones.filter((milestone) => milestone.status === "completed").length;
  const escrowed = payments
    .filter((payment) => ["pending", "escrowed"].includes(payment.status))
    .reduce((sum, payment) => sum + payment.amount, 0);

  const timeline = useMemo(() => {
    const items = [
      { label: "Project created", detail: formatDateTime(project.createdAt) },
      ...milestones.map((milestone) => ({
        label: milestone.title,
        detail: `${normalizeStatus(milestone.status)} · ${formatMoney(milestone.amount)}`,
      })),
      ...submissions.map((submission) => ({
        label: `Submission ${submission.version ?? 1}`,
        detail: `${shortHash(submission.ipfsCid ?? submission.id)} · ${formatDateTime(submission.createdAt)}`,
      })),
      ...payments.map((payment) => ({
        label: payment.type.replace(/_/g, " "),
        detail: `${normalizeStatus(payment.status)} · ${formatMoney(payment.amount, payment.currency ?? "mUSD")}`,
      })),
    ];

    return items.slice(0, 8);
  }, [milestones, payments, project.createdAt, submissions]);

  return (
    <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
      <div className="space-y-4">
        <article className="glass-panel rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{project.id}</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">{project.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {project.description || "No project description has been added yet."}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Client: {userDisplayName(project.owner)} · Freelancer: {project.freelancer ? userDisplayName(project.freelancer) : "Not assigned"}
              </p>
            </div>
            <StatusPill label={normalizeStatus(project.status)} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Milestones" value={`${completedMilestones} / ${milestones.length}`} />
            <Metric label="Budget" value={formatMoney(project.budget ?? 0)} />
            <Metric label="Escrow tracked" value={formatMoney(escrowed)} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {isClient ? (
              <Button asChild size="sm" className="gap-2">
                <Link to="/client/approval-workflow">
                  <BadgeCheck className="h-4 w-4" />
                  Review approvals
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" className="gap-2">
                <Link to="/freelancer/submit-work">
                  <UploadCloud className="h-4 w-4" />
                  Submit work
                </Link>
              </Button>
            )}
            <ProjectUtilityButtons project={project} tokenId={certificate?.tokenId} />
          </div>
        </article>

        <TimelineCard title={isClient ? "Approval timeline" : "Delivery timeline"} items={timeline} />

        <article className="glass-panel rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground">Latest submissions</h2>
          <div className="mt-3 space-y-2">
            {submissions.length ? (
              submissions.slice(0, 4).map((submission) => (
                <p key={submission.id} className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">
                  {submission.fileName || submission.githubLink || submission.demoLink || shortHash(submission.ipfsCid ?? submission.id)}
                </p>
              ))
            ) : (
              <p className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">No submissions recorded for this project yet.</p>
            )}
          </div>
        </article>
      </div>

      <aside className="space-y-4">
        <InfoCard
          title="Milestone records"
          icon="proof"
          lines={milestones.length ? milestones.map((milestone) => `${milestone.title} · ${normalizeStatus(milestone.status)}`) : ["No milestones yet"]}
        />
        <InfoCard
          title="Payment records"
          icon="proof"
          lines={
            payments.length
              ? payments.map((payment) => `${payment.type.replace(/_/g, " ")} · ${formatMoney(payment.amount, payment.currency ?? "mUSD")} · ${payment.status}`)
              : ["No payments recorded yet"]
          }
        />
        <InfoCard
          title="On-chain proof"
          icon="file"
          lines={[
            latestTx?.txHash ? `Latest tx ${shortHash(latestTx.txHash)}` : "No transaction hash yet",
            certificate ? `Certificate #${certificate.tokenId}` : "No certificate minted yet",
            project.disputes?.length ? `${project.disputes.length} dispute record(s)` : "No disputes recorded",
          ]}
        />
      </aside>
    </section>
  );
}

function dedupeProjects(projects: ApiProject[]) {
  return Array.from(new Map(projects.map((project) => [project.id, project])).values());
}

function EmptyProjectState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="glass-panel rounded-xl p-6">
      <ShieldCheck className="h-5 w-5 text-primary" />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function ProjectUtilityButtons({ project, tokenId }: { project: ApiProject; tokenId?: number }) {
  return (
    <>
      <Button asChild size="sm" variant="outline" className="gap-2">
        <Link to="/projects/$id/chat" params={{ id: project.id }}>
          <MessageSquare className="h-4 w-4" />
          Open chat
        </Link>
      </Button>
      {tokenId ? (
        <Button asChild size="sm" variant="outline" className="gap-2">
          <Link to="/certificate/$tokenId" params={{ tokenId: String(tokenId) }}>
            <ShieldCheck className="h-4 w-4" />
            View certificate
          </Link>
        </Button>
      ) : (
        <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border/70 bg-secondary px-3 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          No certificate
        </span>
      )}
    </>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs capitalize text-muted-foreground">
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

function TimelineCard({ title, items }: { title: string; items: Array<{ label: string; detail: string }> }) {
  return (
    <article className="glass-panel rounded-xl p-5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((step, index) => (
            <div key={`${step.label}-${index}`} className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs text-primary">
                {index + 1}
              </div>
              <div>
                <p className="text-sm text-foreground">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.detail}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">No timeline records yet.</p>
        )}
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
        {lines.slice(0, 6).map((line, index) => (
          <p key={`${line}-${index}`} className="surface-panel flex items-center gap-2 rounded-md p-2">
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
