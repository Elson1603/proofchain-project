import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, UploadCloud } from "lucide-react";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/freelancer/submit-work")({
  head: () => ({
    meta: [
      { title: "Submit Work — ProofChain" },
      { name: "description", content: "Upload deliverables and submit proof hash for client approval." },
      { property: "og:title", content: "Submit Work — ProofChain" },
      { property: "og:description", content: "Professional milestone submission with hash-backed proof." },
    ],
  }),
  component: SubmitWorkPage,
});

const freelancerNav = [
  { label: "Dashboard", to: "/freelancer/dashboard" },
  { label: "Projects", to: "/project-details" },
  { label: "Submit Work", to: "/freelancer/submit-work" },
  { label: "NFT Certificates", to: "/freelancer/nft-certificates" },
  { label: "Earnings", to: "/freelancer/earnings" },
  { label: "Settings", to: "/auth" },
];

function SubmitWorkPage() {
  return (
    <DashboardShell
      title="Submit work"
      subtitle="Deliver milestone files with verifiable proof hash and comments."
      navItems={freelancerNav}
    >
      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="glass-panel rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground">Project submission</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-dashed border-border/80 bg-secondary/30 p-6 text-center">
              <UploadCloud className="mx-auto h-6 w-6 text-primary" />
              <p className="mt-3 text-sm text-foreground">Drag and drop work files</p>
              <p className="text-xs text-muted-foreground">ZIP, PDF, Figma export, or build artifact</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-xs text-muted-foreground">
                Project description
              </label>
              <Textarea
                id="description"
                className="min-h-32 bg-secondary/30"
                placeholder="Summarize what was delivered and key acceptance criteria."
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="hash" className="text-xs text-muted-foreground">
                Proof hash
              </label>
              <Input id="hash" className="bg-secondary/30" placeholder="0x..." />
            </div>

            <Button className="gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Submit for approval
            </Button>
          </div>
        </div>

        <aside className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground">Submission checklist</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Attach final source and assets</li>
            <li>• Include deployment URL if relevant</li>
            <li>• Add deterministic proof hash</li>
            <li>• Confirm milestone acceptance notes</li>
          </ul>
        </aside>
      </section>
    </DashboardShell>
  );
}
