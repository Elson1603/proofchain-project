import { createFileRoute } from "@tanstack/react-router";
import { Paperclip, ShieldCheck, Timer } from "lucide-react";
import { ProofChainTopNav } from "@/components/proofchain/top-nav";

export const Route = createFileRoute("/project-details")({
  head: () => ({
    meta: [
      { title: "Project Details — ProofChain" },
      {
        name: "description",
        content: "Track milestone timeline, files, chat, and NFT proof history for each project.",
      },
      { property: "og:title", content: "Project Details — ProofChain" },
      {
        property: "og:description",
        content: "Detailed collaboration timeline with on-chain proof checkpoints.",
      },
    ],
  }),
  component: ProjectDetailsPage,
});

function ProjectDetailsPage() {
  return (
    <div className="min-h-screen bg-background">
      <ProofChainTopNav />
      <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <section className="space-y-4">
          <article className="glass-panel rounded-xl p-5">
            <h1 className="font-display text-2xl font-bold text-foreground">Escrow Analytics Module</h1>
            <p className="mt-2 text-sm text-muted-foreground">Milestone progress with structured approval states.</p>

            <div className="mt-4 space-y-3">
              {["Scope approved", "Work submitted", "Client review", "Gasless payout", "NFT issued"].map(
                (step, index) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm text-foreground">{step}</p>
                      <p className="text-xs text-muted-foreground">Timestamped workflow event</p>
                    </div>
                  </div>
                ),
              )}
            </div>
          </article>

          <article className="glass-panel rounded-xl p-5">
            <h2 className="text-base font-semibold text-foreground">Chat</h2>
            <div className="mt-3 space-y-2">
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Client:</strong> Please include the filtering by project state.
              </div>
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Freelancer:</strong> Added + shared proof hash and deployment.
              </div>
            </div>
          </article>
        </section>

        <aside className="space-y-4">
          <article className="glass-panel rounded-xl p-5">
            <h2 className="text-base font-semibold text-foreground">File attachments</h2>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p className="surface-panel flex items-center gap-2 rounded-md p-2">
                <Paperclip className="h-4 w-4 text-info" /> escrow-dashboard-v2.zip
              </p>
              <p className="surface-panel flex items-center gap-2 rounded-md p-2">
                <Paperclip className="h-4 w-4 text-info" /> architecture-notes.pdf
              </p>
            </div>
          </article>

          <article className="glass-panel rounded-xl p-5">
            <h2 className="text-base font-semibold text-foreground">On-chain proof</h2>
            <p className="mt-2 text-xs text-primary">0x8b4f...ac31</p>
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Verified
            </p>
          </article>

          <article className="glass-panel rounded-xl p-5">
            <h2 className="text-base font-semibold text-foreground">NFT proof history</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              PC-SBT-1017 · Protocol Data Dashboard · Apr 14, 2026
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              PC-SBT-1022 · Design System + Web App · Apr 29, 2026
            </p>
            <p className="mt-3 inline-flex items-center gap-2 text-xs text-info">
              <Timer className="h-3.5 w-3.5" /> Next mint pending approval
            </p>
          </article>
        </aside>
      </main>
    </div>
  );
}
