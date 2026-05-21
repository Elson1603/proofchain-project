import { createFileRoute } from "@tanstack/react-router";
import { ProjectDetailsWorkspace } from "@/components/proofchain/project-details-workspace";

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
  return <ProjectDetailsWorkspace mode="shared" navItems={sharedNav} />;
}

const sharedNav = [
  { label: "Freelancer Projects", to: "/freelancer/projects" },
  { label: "Client Project Details", to: "/client/project-details" },
  { label: "Messages", to: "/messages" },
  { label: "Settings", to: "/auth" },
];
