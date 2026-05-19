import { createFileRoute } from "@tanstack/react-router";
import { MessagingWorkspace } from "@/components/proofchain/messaging-workspace";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — ProofChain" },
      {
        name: "description",
        content: "Project-based real-time messaging for ProofChain workspaces.",
      },
      { property: "og:title", content: "Messages — ProofChain" },
      {
        property: "og:description",
        content: "Collaborate with clients and freelancers inside project chat rooms.",
      },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  return <MessagingWorkspace />;
}
