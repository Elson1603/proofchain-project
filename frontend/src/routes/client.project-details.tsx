import { createFileRoute } from "@tanstack/react-router";
import { ProjectDetailsWorkspace } from "@/components/proofchain/project-details-workspace";

export const Route = createFileRoute("/client/project-details")({
  head: () => ({
    meta: [
      { title: "Client Project Details - ProofChain" },
      { name: "description", content: "Review client project details, submissions, approvals, chat, and proof history." },
    ],
  }),
  component: ClientProjectDetailsPage,
});

const clientNav = [
  { label: "Dashboard", to: "/client/dashboard" },
  { label: "Approvals", to: "/client/approval-workflow" },
  { label: "Project Details", to: "/client/project-details" },
  { label: "Messages", to: "/messages" },
  { label: "Settings", to: "/auth" },
];

function ClientProjectDetailsPage() {
  return <ProjectDetailsWorkspace mode="client" navItems={clientNav} />;
}
