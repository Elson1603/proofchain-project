import { createFileRoute } from "@tanstack/react-router";
import { ProofChainAdminPanel } from "@/components/proofchain/admin-panel";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — ProofChain" },
      {
        name: "description",
        content:
          "ProofChain operations console for users, disputes, UGF payments, blockchain monitoring, NFT certificates, fraud alerts, and audit logs.",
      },
    ],
  }),
  component: ProofChainAdminPanel,
});
