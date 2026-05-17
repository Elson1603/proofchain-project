import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Blocks,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileKey2,
  Fingerprint,
  HandCoins,
  ShieldCheck,
  Wallet,
} from "lucide-react";

export interface FeatureItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const featureItems: FeatureItem[] = [
  {
    title: "Gasless Payments",
    description: "UGF relays execution so clients approve with Mock USD and never touch gas settings.",
    icon: HandCoins,
  },
  {
    title: "Soulbound NFT Proof",
    description: "Every completed milestone mints a non-transferable certificate tied to freelancer reputation.",
    icon: BadgeCheck,
  },
  {
    title: "Escrow Security",
    description: "Funds move through structured approval states with transparent, auditable release rules.",
    icon: ShieldCheck,
  },
  {
    title: "Base Sepolia Powered",
    description: "Low-latency testnet settlement built for rapid hackathon iteration and production migration.",
    icon: Blocks,
  },
  {
    title: "Mock USD Transactions",
    description: "Predictable payout simulation enables realistic product UX before mainnet liquidity.",
    icon: CircleDollarSign,
  },
  {
    title: "Transparent Workflow",
    description: "Project submission, review, payment, and certificate state updates are visible end-to-end.",
    icon: FileCheck2,
  },
];

export const timelineItems = [
  {
    title: "Freelancer submits work",
    detail: "Deliverables and proof hash are attached to the project milestone.",
    icon: FileKey2,
  },
  {
    title: "Client reviews & approves",
    detail: "Approval queue supports rejection comments or direct release confirmation.",
    icon: Fingerprint,
  },
  {
    title: "UGF executes gasless tx",
    detail: "Relayer handles transaction fees while Mock USD settles to freelancer wallet.",
    icon: Wallet,
  },
  {
    title: "Soulbound NFT minted",
    detail: "Verified proof-of-work certificate is minted and pinned in freelancer profile.",
    icon: BadgeCheck,
  },
];

export const liveFeed = [
  {
    type: "Payment approved",
    detail: "0xf2a3...71e9 → 0x90c4...8821 · 2,400 mUSD",
    status: "Confirmed in 1.3s",
    time: "Now",
  },
  {
    type: "SBT minted",
    detail: "Cert #PC-82941 issued for Milestone 03",
    status: "Metadata anchored",
    time: "12s ago",
  },
  {
    type: "UGF execution",
    detail: "Escrow payout routed without gas wallet",
    status: "Relayer finalizing",
    time: "21s ago",
  },
  {
    type: "Client approval",
    detail: "Acme Labs approved Design System handoff",
    status: "Awaiting token release",
    time: "34s ago",
  },
];

export const testimonials = [
  {
    quote:
      "ProofChain gives clients the confidence of escrow with the speed of modern product UX. It feels enterprise-ready.",
    name: "Aria Morgan",
    role: "Product Lead, Nebula Studio",
  },
  {
    quote:
      "The soulbound certificates became my best portfolio signal. Every delivery now has immutable proof.",
    name: "Kenji Rao",
    role: "Freelance Frontend Engineer",
  },
  {
    quote:
      "We onboarded non-crypto clients in minutes because they never needed ETH or gas education.",
    name: "Mila Santos",
    role: "Operations, Base Guild",
  },
];

export const txHistory = [
  { id: "TX-2811", project: "Mobile Wallet UX", amount: "1,100 mUSD", status: "Confirmed" },
  { id: "TX-2784", project: "DEX Landing Build", amount: "650 mUSD", status: "Confirmed" },
  { id: "TX-2730", project: "Protocol Docs", amount: "480 mUSD", status: "Queued" },
];

export const submissions = [
  {
    project: "ProofChain Marketing Site",
    freelancer: "Dana Flores",
    milestone: "Design QA + Deploy",
    hash: "0x8b4f...ac31",
    updated: "4m ago",
  },
  {
    project: "Escrow Analytics Module",
    freelancer: "Theo Kim",
    milestone: "Realtime charts",
    hash: "0xe11a...9b72",
    updated: "17m ago",
  },
];

export const nftCertificates = [
  {
    id: "PC-SBT-1024",
    title: "Smart Contract Audit Delivery",
    issuer: "Atlas Ventures",
    date: "May 10, 2026",
  },
  {
    id: "PC-SBT-1022",
    title: "Design System + Web App",
    issuer: "Circuit Labs",
    date: "Apr 29, 2026",
  },
  {
    id: "PC-SBT-1017",
    title: "Protocol Data Dashboard",
    issuer: "Vector Foundry",
    date: "Apr 14, 2026",
  },
];

export const architectureNodes = [
  "Freelancer UI",
  "Client Review",
  "Escrow Contract",
  "UGF Relayer",
  "Base Sepolia",
  "SBT Minter",
];

export const codePreview = `function releasePayment(projectId: bytes32) external onlyClient(projectId) {
  require(state[projectId] == State.Approved, "Not approved");
  ugf.executeGasless(
    abi.encodeWithSelector(token.transfer.selector, freelancer[projectId], amount[projectId])
  );
  sbt.mintProof(freelancer[projectId], projectId);
}`;
