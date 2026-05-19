import { createFileRoute } from "@tanstack/react-router";
import { MessagingWorkspace } from "@/components/proofchain/messaging-workspace";

export const Route = createFileRoute("/projects/$id/chat")({
  head: () => ({
    meta: [
      { title: "Project Chat — ProofChain" },
      {
        name: "description",
        content: "Real-time project messaging with UGF payments and on-chain activity.",
      },
      { property: "og:title", content: "Project Chat — ProofChain" },
      {
        property: "og:description",
        content: "Live project collaboration with blockchain workflow updates.",
      },
    ],
  }),
  component: ProjectChatPage,
});

function ProjectChatPage() {
  const { id } = Route.useParams();

  return <MessagingWorkspace activeProjectId={id} />;
}
