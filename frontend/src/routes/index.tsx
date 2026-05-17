import { createFileRoute } from "@tanstack/react-router";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import type { MouseEvent } from "react";
import { useCallback } from "react";
import {
  FeatureGrid,
  HowItWorks,
  LandingHero,
  LiveTransactions,
  TestimonialsSection,
} from "@/components/proofchain/landing-sections";
import { ProofChainFooter, ProofChainTopNav } from "@/components/proofchain/top-nav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ProofChain — Freelance Payments Without Gas Fees" },
      {
        name: "description",
        content:
          "Premium Web3 freelance platform for gasless escrow payments, UGF execution, and soulbound NFT proof on Base Sepolia.",
      },
      { property: "og:title", content: "ProofChain — Freelance Payments Without Gas Fees" },
      {
        property: "og:description",
        content: "Gasless freelance proof-of-work platform with escrow security and NFT certificates.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const maskImage = useMotionTemplate`radial-gradient(260px at ${mouseX}px ${mouseY}px, oklch(0.72 0.2 151 / 0.16), transparent 72%)`;

  const handleMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      mouseX.set(event.clientX - rect.left);
      mouseY.set(event.clientY - rect.top);
    },
    [mouseX, mouseY],
  );

  return (
    <div className="relative min-h-screen overflow-hidden" onMouseMove={handleMove}>
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: maskImage }} />
      <ProofChainTopNav />
      <main>
        <LandingHero />
        <section id="features">
          <FeatureGrid />
        </section>
        <section id="how-it-works">
          <HowItWorks />
        </section>
        <LiveTransactions />
        <TestimonialsSection />
      </main>
      <ProofChainFooter />
    </div>
  );
}
