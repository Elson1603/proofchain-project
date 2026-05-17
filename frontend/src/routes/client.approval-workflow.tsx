import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { submissions } from "@/components/proofchain/mock-data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/client/approval-workflow")({
  head: () => ({
    meta: [
      { title: "Approval Workflow — ProofChain" },
      { name: "description", content: "Review freelance submissions and confirm gasless releases." },
      { property: "og:title", content: "Approval Workflow — ProofChain" },
      { property: "og:description", content: "Approve or reject submissions with UGF payment confirmation." },
    ],
  }),
  component: ApprovalWorkflowPage,
});

const clientNav = [
  { label: "Dashboard", to: "/client/dashboard" },
  { label: "Approvals", to: "/client/approval-workflow" },
  { label: "Project Details", to: "/project-details" },
  { label: "Settings", to: "/auth" },
];

function ApprovalWorkflowPage() {
  return (
    <DashboardShell
      title="Approval Workflow"
      subtitle="Validate deliverables and release milestone payments without ETH gas."
      navItems={clientNav}
    >
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="glass-panel rounded-xl p-4">
          <h2 className="text-base font-semibold text-foreground">Pending submissions</h2>
          <div className="mt-4 space-y-3">
            {submissions.map((submission) => (
              <div key={submission.hash} className="surface-panel rounded-lg p-3">
                <p className="text-sm font-medium text-foreground">{submission.project}</p>
                <p className="text-xs text-muted-foreground">{submission.freelancer}</p>
                <p className="mt-2 text-xs text-primary">Proof hash: {submission.hash}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2">
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <motion.article
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-xl p-4"
        >
          <h2 className="text-base font-semibold text-foreground">Gasless payment modal</h2>
          <div className="mt-4 rounded-lg border border-border/70 bg-secondary/35 p-4 text-sm text-muted-foreground">
            <p className="text-primary">No ETH required</p>
            <p className="mt-1">Gas handled via UGF relayer</p>
            <p className="mt-1">Mock USD deduction: 1,100 mUSD</p>
          </div>

          <div className="mt-4 space-y-2">
            {["Client signature received", "UGF relay dispatch", "Base Sepolia confirmation", "SBT mint queued"].map(
              (step, index) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0.45 }}
                  animate={{ opacity: 1 }}
                  transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.2, delay: index * 0.2 }}
                  className="surface-panel rounded-md p-2 text-xs text-foreground"
                >
                  {step}
                </motion.div>
              ),
            )}
          </div>
        </motion.article>
      </section>
    </DashboardShell>
  );
}
