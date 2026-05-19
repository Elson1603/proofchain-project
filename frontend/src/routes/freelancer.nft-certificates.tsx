import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { nftCertificates } from "@/components/proofchain/mock-data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/freelancer/nft-certificates")({
  head: () => ({
    meta: [
      { title: "NFT Certificates — ProofChain" },
      {
        name: "description",
        content: "View soulbound proof certificates and verify completion metadata.",
      },
      { property: "og:title", content: "NFT Certificates — ProofChain" },
      {
        property: "og:description",
        content: "A modern certificate gallery of immutable freelance proof-of-work records.",
      },
    ],
  }),
  component: NftCertificatesPage,
});

const freelancerNav = [
  { label: "Dashboard", to: "/freelancer/dashboard" },
  { label: "Profile", to: "/freelancer/profile" },
  { label: "Projects", to: "/project-details" },
  { label: "Messages", to: "/messages" },
  { label: "Submit Work", to: "/freelancer/submit-work" },
  { label: "NFT Certificates", to: "/freelancer/nft-certificates" },
  { label: "Earnings", to: "/freelancer/earnings" },
  { label: "Settings", to: "/auth" },
];

function NftCertificatesPage() {
  return (
    <DashboardShell
      title="NFT certificates"
      subtitle="Soulbound proof cards minted after successful gasless settlement."
      navItems={freelancerNav}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {nftCertificates.map((cert, index) => (
          <motion.article
            key={cert.id}
            whileHover={{ y: -4 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="glass-panel rounded-xl p-4"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{cert.id}</span>
              <BadgeCheck className="h-4 w-4 text-primary" />
            </div>
            <h2 className="mt-3 text-base font-semibold text-foreground">{cert.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">Issued by {cert.issuer}</p>
            <p className="mt-2 text-xs text-muted-foreground">{cert.date}</p>
            <Button variant="outline" size="sm" className="mt-4 gap-2">
              <ShieldCheck className="h-4 w-4" />
              Verify certificate
            </Button>
          </motion.article>
        ))}
      </section>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-panel rounded-xl p-4"
      >
        <p className="text-sm text-primary">Mint success</p>
        <p className="mt-1 text-sm text-foreground">Soulbound certificate PC-SBT-1025 just minted for Milestone 04.</p>
      </motion.div>
    </DashboardShell>
  );
}
