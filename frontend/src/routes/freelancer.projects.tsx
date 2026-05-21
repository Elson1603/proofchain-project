import { createFileRoute } from "@tanstack/react-router";
import { ProjectDetailsWorkspace } from "@/components/proofchain/project-details-workspace";

export const Route = createFileRoute("/freelancer/projects")({
  head: () => ({
    meta: [
      { title: "Freelancer Projects - ProofChain" },
      { name: "description", content: "Track freelancer project milestones, submissions, chat, and proof history." },
    ],
  }),
  component: FreelancerProjectsPage,
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

function FreelancerProjectsPage() {
  return <ProjectDetailsWorkspace mode="freelancer" navItems={freelancerNav} />;
}
