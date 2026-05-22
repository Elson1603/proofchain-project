import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { Button } from "@/components/ui/button";

type NftCertificateRecord = {
  id: string;
  tokenId: number;
  freelancerWallet: string;
  metadataURI: string;
  transactionHash: string | null;
  mintedAt: string | null;
  certificateStatus: string;
  project: {
    id: string;
    title: string;
  };
  user: {
    fullName: string | null;
    username: string | null;
  };
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

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
  { label: "Projects", to: "/freelancer/projects" },
  { label: "Messages", to: "/messages" },
  { label: "Submit Work", to: "/freelancer/submit-work" },
  { label: "NFT Certificates", to: "/freelancer/nft-certificates" },
  { label: "Earnings", to: "/freelancer/earnings" },
  { label: "Settings", to: "/auth" },
];

function NftCertificatesPage() {
  const [certificates, setCertificates] = useState<NftCertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCertificates() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE_URL}/api/nft`);
        if (!response.ok) {
          throw new Error(`Failed to load certificates (${response.status})`);
        }

        const data = (await response.json()) as NftCertificateRecord[];
        if (!cancelled) {
          setCertificates(data);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load certificates");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCertificates();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardShell
      title="NFT certificates"
      subtitle="Soulbound proof cards minted after successful gasless settlement."
      navItems={freelancerNav}
    >
      {loading ? (
        <div className="glass-panel rounded-xl p-4 text-sm text-muted-foreground">Loading live certificate data…</div>
      ) : error ? (
        <div className="glass-panel rounded-xl p-4 text-sm text-destructive">{error}</div>
      ) : certificates.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {certificates.map((cert, index) => {
            const issuer = cert.user.fullName || cert.user.username || cert.freelancerWallet;
            const issuedAt = cert.mintedAt ? new Date(cert.mintedAt).toLocaleDateString() : "Pending";

            return (
              <motion.article
                key={cert.id}
                whileHover={{ y: -4 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className="glass-panel rounded-xl p-4"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>PC-SBT-{cert.tokenId}</span>
                  <BadgeCheck className="h-4 w-4 text-primary" />
                </div>
                <h2 className="mt-3 text-base font-semibold text-foreground">{cert.project.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">Issued by {issuer}</p>
                <p className="mt-2 text-xs text-muted-foreground">{issuedAt}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link to="/certificate/$tokenId" params={{ tokenId: String(cert.tokenId) }}>
                      <ShieldCheck className="h-4 w-4" />
                      Verify certificate
                    </Link>
                  </Button>
                </div>
              </motion.article>
            );
          })}
        </section>
      ) : (
        <div className="glass-panel rounded-xl p-4 text-sm text-muted-foreground">
          No certificates found yet. Mint one by completing a project and releasing payment.
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-panel rounded-xl p-4"
      >
        <p className="text-sm text-primary">Mint success</p>
        <p className="mt-1 text-sm text-foreground">Certificate data is loaded from the backend NFT API.</p>
      </motion.div>
    </DashboardShell>
  );
}
