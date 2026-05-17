import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Code2, Cpu, Database, ShieldCheck } from "lucide-react";
import { architectureNodes, codePreview } from "@/components/proofchain/mock-data";
import { ProofChainTopNav } from "@/components/proofchain/top-nav";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Developers — ProofChain Architecture" },
      {
        name: "description",
        content:
          "Understand UGF integration, Base Sepolia flow, escrow contracts, and soulbound NFT mint architecture.",
      },
      { property: "og:title", content: "Developers — ProofChain Architecture" },
      {
        property: "og:description",
        content: "Technical overview of gasless execution and blockchain proof-of-work pipeline.",
      },
    ],
  }),
  component: DevelopersPage,
});

function DevelopersPage() {
  return (
    <div className="min-h-screen bg-background">
      <ProofChainTopNav />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="glass-panel rounded-xl p-6">
          <h1 className="font-display text-3xl font-bold text-foreground">Developer / Tech Overview</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            ProofChain combines UGF relayed execution, escrow contracts, Base Sepolia settlement, and soulbound NFT
            certificates to produce a transparent freelance proof-of-work system.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "UGF Integration", icon: Cpu },
              { label: "Base Sepolia", icon: Database },
              { label: "Gasless Execution", icon: ShieldCheck },
              { label: "Smart Contract Architecture", icon: Code2 },
              { label: "NFT Proof System", icon: ShieldCheck },
              { label: "Escrow Workflow", icon: Database },
            ].map((item) => (
              <div key={item.label} className="surface-panel rounded-lg p-3 text-sm text-foreground">
                <item.icon className="mb-2 h-4 w-4 text-primary" />
                {item.label}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="glass-panel rounded-xl p-5">
            <h2 className="text-base font-semibold text-foreground">Interactive architecture diagram</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {architectureNodes.map((node, index) => (
                <motion.div
                  key={node}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="surface-panel flex items-center justify-between rounded-md p-3 text-sm text-foreground"
                >
                  <span>{node}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-info" />
                </motion.div>
              ))}
            </div>
          </article>

          <article className="glass-panel rounded-xl p-5">
            <h2 className="text-base font-semibold text-foreground">Contract snippet</h2>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border/70 bg-secondary/45 p-3 text-xs leading-relaxed text-muted-foreground">
              <code>{codePreview}</code>
            </pre>
          </article>
        </section>
      </main>
    </div>
  );
}
