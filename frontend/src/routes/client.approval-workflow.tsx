import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, CircleDollarSign, FileCheck2, ShieldCheck, Wallet, XCircle, type LucideIcon } from "lucide-react";
import { Contract, Interface, type TransactionRequest } from "ethers";
import { useUGFModal } from "@tychilabs/react-ugf";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { escrowAbi } from "@/lib/escrow-abi";
import { ESCROW_CONTRACT_ADDRESS, connectWallet, getEscrowContract, requireEscrowAddress } from "@/lib/escrow";
import {
  fetchCurrentUser,
  fetchProjects,
  fetchSubmissions,
  formatDateTime,
  formatMoney,
  shortAddress,
  shortHash,
  userDisplayName,
  type ApiProject,
  type ApiSubmission,
  type ApiUser,
} from "@/lib/proofchain-api";

export const Route = createFileRoute("/client/approval-workflow")({
  head: () => ({
    meta: [
      { title: "Approval Workflow — ProofChain" },
      { name: "description", content: "Review freelance submissions and confirm gasless releases." },
      { property: "og:title", content: "Approval Workflow — ProofChain" },
      { property: "og:description", content: "Approve or reject submissions with UGF payment confirmation." },
    ],
  }),
  component: ApprovalWorkflowPage,
});

const clientNav = [
  { label: "Dashboard", to: "/client/dashboard" },
  { label: "Approvals", to: "/client/approval-workflow" },
  { label: "Project Details", to: "/client/project-details" },
  { label: "Messages", to: "/messages" },
  { label: "Settings", to: "/auth" },
];

function projectIdFromLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("projectId");
}

function ReviewMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/50 p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function metadataNumber(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function getStoredProjectChainId(project: ApiProject | null | undefined) {
  if (!project?.payments?.length) return null;

  for (const payment of project.payments) {
    const value = metadataNumber(payment.metadata, "projectChainId");
    if (value !== null) return value;
  }

  return null;
}

function getMilestoneIndex(project: ApiProject | null | undefined, milestoneId: string) {
  const index = project?.milestones?.findIndex((milestone) => milestone.id === milestoneId) ?? -1;
  return index >= 0 ? index : 0;
}

function addressesMatch(left?: string | null, right?: string | null) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function readEscrowProjectFreelancer(record: unknown) {
  if (!record) return "";
  if (typeof record === "object" && "freelancer" in record) {
    return String((record as { freelancer?: unknown }).freelancer ?? "");
  }
  if (Array.isArray(record)) {
    return String(record[1] ?? "");
  }
  return "";
}

function ApprovalWorkflowPage() {
  const { openUGF, result } = useUGFModal();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([]);
  const [ownerProjects, setOwnerProjects] = useState<ApiProject[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [projectChainId, setProjectChainId] = useState("");
  const [milestoneIndex, setMilestoneIndex] = useState("0");
  const [projectId, setProjectId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [payerId, setPayerId] = useState("");
  const [payeeId, setPayeeId] = useState("");
  const [amount, setAmount] = useState("0");
  const [paymentType, setPaymentType] = useState("milestone_release");
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve_milestone" | "release_payment" | null>(null);
  const [pendingPayload, setPendingPayload] = useState<{
    projectChainId: number;
    milestoneIndex: number;
    escrowAddress: string;
    payerWallet: string;
    amount: number;
  } | null>(null);
  const [verifiedEscrowFreelancer, setVerifiedEscrowFreelancer] = useState<string | null>(null);
  const lastRecordedTxHash = useRef<string | null>(null);

  const contractLabel = ESCROW_CONTRACT_ADDRESS
    ? `${ESCROW_CONTRACT_ADDRESS.slice(0, 6)}...${ESCROW_CONTRACT_ADDRESS.slice(-4)}`
    : "Not set";

  const selectedSubmission = useMemo(
    () => submissions.find((submission) => submission.id === submissionId) ?? null,
    [submissionId, submissions],
  );
  const selectedProject =
    ownerProjects.find((project) => project.id === selectedSubmission?.milestone?.project?.id) ??
    selectedSubmission?.milestone?.project ??
    null;
  const selectedMilestone = selectedSubmission?.milestone ?? null;
  const selectedPayeeWallet = selectedSubmission?.submittedBy?.walletAddress ?? selectedProject?.freelancer?.walletAddress ?? null;
  const hasSelectedSubmission = Boolean(selectedSubmission && projectId && milestoneId && payerId && payeeId);
  const hasProjectChainId = projectChainId.trim().length > 0;

  const parseUint = (value: string, field: string) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`Invalid ${field}. Use a non-negative number.`);
    }
    return parsed;
  };

  const parseAmount = (value: string) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("Invalid amount. Use a value greater than 0.");
    }
    return parsed;
  };

  const destChainId = useMemo(() => {
    return import.meta.env.VITE_UGF_DEST_CHAIN_ID ?? import.meta.env.VITE_CHAIN_ID ?? "84532";
  }, []);

  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE_URL ?? "", []);
  const ugfPaymentCoin = "TYI_MOCK_USD";

  const runTx = async (label: string, action: () => Promise<{ hash: string; wait: () => Promise<unknown> }>) => {
    setIsBusy(true);
    setStatus(`${label}...`);

    try {
      const tx = await action();
      setStatus(`${label} submitted: ${tx.hash}`);
      await tx.wait();
      setStatus(`${label} confirmed.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transaction failed";
      setStatus(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleConnect = async () => {
    setIsBusy(true);
    setStatus(null);

    try {
      const { address } = await connectWallet(Number(destChainId));
      setWalletAddress(address);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet connection failed";
      setStatus(message);
    } finally {
      setIsBusy(false);
    }
  };

  const executeUgfPayment = async (action: "approve_milestone" | "release_payment") => {
    setIsBusy(true);
    setStatus("Preparing UGF modal...");
    setTxHash(null);

    try {
      const escrowAddress = requireEscrowAddress();
      const projectValue = parseUint(projectChainId, "escrow project ID");
      const milestoneValue = parseUint(milestoneIndex, "milestone index");
      const amountValue = parseAmount(amount);

      if (!projectId || !payerId || !payeeId) {
        throw new Error("Backend project, payer, and payee IDs are required.");
      }

      const { signer, address } = await connectWallet(null);
      setWalletAddress(address);

      if (!selectedPayeeWallet) {
        throw new Error("Selected freelancer wallet is missing. Ask the freelancer to reconnect once before payment release.");
      }

      const escrowContract = new Contract(escrowAddress, escrowAbi, signer);
      const escrowProject = await escrowContract.projects(projectValue);
      const onChainFreelancer = readEscrowProjectFreelancer(escrowProject);
      setVerifiedEscrowFreelancer(onChainFreelancer || null);

      if (!addressesMatch(onChainFreelancer, selectedPayeeWallet)) {
        throw new Error(
          `Escrow project ID ${projectValue} belongs to ${shortAddress(onChainFreelancer)}, but this submission is from ${shortAddress(
            selectedPayeeWallet,
          )}. Use the ProjectCreated ID for this freelancer.`,
        );
      }

      const escrowInterface = new Interface(escrowAbi);
      const functionName = action === "approve_milestone" ? "approveMilestone" : "releasePayment";
      const data = escrowInterface.encodeFunctionData(functionName, [projectValue, milestoneValue]);

      const tx: TransactionRequest = {
        to: escrowAddress,
        data,
        value: 0n,
      };

      setPendingAction(action);
      setPendingPayload({
        projectChainId: projectValue,
        milestoneIndex: milestoneValue,
        escrowAddress,
        payerWallet: address,
        amount: amountValue,
      });

      setStatus("UGF modal opened");
      openUGF({
        signer,
        tx,
        destChainId: String(destChainId),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "UGF execution failed";
      setStatus(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleApproveMilestone = async () => {
    if (!hasSelectedSubmission) {
      setStatus("Select a pending submission before approving.");
      return;
    }

    if (!hasProjectChainId) {
      setStatus("Escrow project ID is missing. Create the project escrow on-chain first, then use the ProjectCreated event ID.");
      return;
    }

    await executeUgfPayment("approve_milestone");
  };

  const handleReleasePayment = async () => {
    if (!hasSelectedSubmission) {
      setStatus("Select a pending submission before releasing payment.");
      return;
    }

    if (!hasProjectChainId) {
      setStatus("Escrow project ID is missing. Create the project escrow on-chain first, then use the ProjectCreated event ID.");
      return;
    }

    await executeUgfPayment("release_payment");
  };

  const handleRaiseDispute = async () => {
    if (!hasSelectedSubmission) {
      setStatus("Select a pending submission before raising a dispute.");
      return;
    }

    if (!hasProjectChainId) {
      setStatus("Escrow project ID is missing. Create the project escrow on-chain first, then use the ProjectCreated event ID.");
      return;
    }

    const projectValue = parseUint(projectChainId, "escrow project ID");

    await runTx("Raise dispute", async () => {
      const contract = await getEscrowContract();
      return contract.raiseDispute(projectValue);
    });
  };

  useEffect(() => {
    let cancelled = false;

    async function loadSubmissions() {
      setSubmissionsLoading(true);
      const me = await fetchCurrentUser();
      const [nextSubmissions, nextProjects] = me
        ? await Promise.all([
            fetchSubmissions().catch(() => null),
            fetchProjects({ ownerId: me.id }).catch(() => null),
          ])
        : [[], []];

      if (!cancelled) {
        const linkedProjectId = projectIdFromLocation();
        const projects = nextProjects ?? [];
        const filteredSubmissions = (nextSubmissions ?? []).filter((submission) => submission.milestone?.project?.ownerId === me?.id);
        const linkedIndex = linkedProjectId
          ? filteredSubmissions.findIndex((submission) => submission.milestone?.project?.id === linkedProjectId)
          : -1;
        const linkedSubmission = linkedIndex >= 0 ? filteredSubmissions[linkedIndex] : null;
        const linkedProject = linkedSubmission?.milestone?.project;

        setUser(me);
        setOwnerProjects(projects);
        setSubmissions(filteredSubmissions);
        if (linkedSubmission && linkedProject) {
          const projectRecord = projects.find((project) => project.id === linkedProject.id);
          const storedChainId = getStoredProjectChainId(projectRecord);

          setSubmissionId(linkedSubmission.id);
          setMilestoneId(linkedSubmission.milestoneId);
          setProjectId(linkedProject.id);
          setPayerId(linkedProject.ownerId);
          setPayeeId(linkedSubmission.submittedById);
          setVerifiedEscrowFreelancer(null);
          setAmount(String(linkedSubmission.milestone?.amount ?? ""));
          setMilestoneIndex(String(getMilestoneIndex(projectRecord, linkedSubmission.milestoneId)));
          setProjectChainId(storedChainId === null ? "" : String(storedChainId));
          setPaymentType("milestone_release");
          setStatus(
            storedChainId === null
              ? `${linkedProject.title ?? "Submission"} selected. Create/link the on-chain escrow before release.`
              : `${linkedProject.title ?? "Submission"} selected from notification.`,
          );
        }
        setSubmissionsLoading(false);
      }
    }

    void loadSubmissions();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmissionDecision = (submission: ApiSubmission, action: "approve" | "reject") => {
    const project = submission.milestone?.project;
    const projectRecord = ownerProjects.find((ownerProject) => ownerProject.id === project?.id);
    const storedChainId = getStoredProjectChainId(projectRecord);

    setSubmissionId(submission.id);
    setMilestoneId(submission.milestoneId);
    setProjectId(project?.id ?? "");
    setPayerId(project?.ownerId ?? "");
    setPayeeId(submission.submittedById);
    setVerifiedEscrowFreelancer(null);
    setAmount(String(submission.milestone?.amount ?? ""));
    setMilestoneIndex(String(getMilestoneIndex(projectRecord, submission.milestoneId)));
    setProjectChainId(storedChainId === null ? "" : String(storedChainId));
    setPaymentType(action === "approve" ? "milestone_release" : "milestone_rejected");
    setStatus(
      storedChainId === null
        ? `${project?.title ?? "Submission"} selected. No on-chain escrow ID is linked yet.`
        : action === "approve"
        ? `${project?.title ?? "Submission"} selected for approval.`
        : `${project?.title ?? "Submission"} selected for dispute review.`,
    );
  };

  useEffect(() => {
    if (!result?.txHash || !pendingAction || !pendingPayload) {
      return;
    }

    if (lastRecordedTxHash.current === result.txHash) {
      return;
    }

    lastRecordedTxHash.current = result.txHash;
    setTxHash(result.txHash);
    setStatus(`UGF submitted: ${result.txHash}`);

    const recordPayment = async () => {
      const response = await fetch(`${apiBase}/api/payments/execute`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          milestoneId: milestoneId || undefined,
          submissionId: submissionId || undefined,
          payerId,
          payeeId,
          amount: pendingPayload.amount,
          type: paymentType,
          action: pendingAction,
          projectChainId: pendingPayload.projectChainId,
          milestoneIndex: pendingPayload.milestoneIndex,
          escrowAddress: pendingPayload.escrowAddress,
          payerWallet: pendingPayload.payerWallet,
          chainId: Number(destChainId),
          currency: ugfPaymentCoin,
          txHash: result.txHash,
          status: "submitted",
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Backend record failed");
      }

      setPendingAction(null);
      setPendingPayload(null);
    };

    recordPayment().catch((error) => {
      const message = error instanceof Error ? error.message : "Backend record failed";
      setStatus(message);
    });
  }, [
    apiBase,
    destChainId,
    milestoneId,
    payeeId,
    payerId,
    paymentType,
    pendingAction,
    pendingPayload,
    projectId,
    result?.txHash,
    submissionId,
  ]);

  return (
    <DashboardShell
      title="Approval Workflow"
      subtitle="Validate deliverables and release milestone payments without ETH gas."
      navItems={clientNav}
      workspaceLabel="Client OS"
    >
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="glass-panel rounded-xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Review and release</h2>
              <p className="mt-1 text-xs text-muted-foreground">Contract: {contractLabel}</p>
            </div>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Auto-filled from submission
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Wallet: {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"}
            </p>
            <Button size="sm" onClick={handleConnect} disabled={isBusy}>
              {walletAddress ? "Wallet connected" : "Connect MetaMask"}
            </Button>
          </div>

          <div className="mt-4 rounded-xl border border-border/70 bg-secondary/25 p-4">
            {selectedSubmission ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedProject?.title ?? "Selected project"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedMilestone?.title ?? "Milestone"} submitted by {userDisplayName(selectedSubmission.submittedBy)}
                    </p>
                  </div>
                  <Badge variant="secondary">{selectedMilestone?.status ?? "submitted"}</Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <ReviewMetric icon={FileCheck2} label="Proof" value={shortHash(selectedSubmission.ipfsCid ?? selectedSubmission.id)} />
                  <ReviewMetric icon={CircleDollarSign} label="Amount" value={formatMoney(Number(amount || 0))} />
                  <ReviewMetric icon={ShieldCheck} label="Payment" value={paymentType.replace(/_/g, " ")} />
                  <ReviewMetric icon={Wallet} label="Freelancer" value={shortAddress(selectedPayeeWallet)} />
                </div>

                {selectedSubmission.gatewayUrl || selectedSubmission.ipfsCid ? (
                  <a
                    href={selectedSubmission.gatewayUrl ?? `https://gateway.pinata.cloud/ipfs/${selectedSubmission.ipfsCid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Open deliverable proof
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Choose a pending submission from the right panel before taking an escrow action.</p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-border/70 bg-background/45 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Escrow identifiers</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Escrow project ID comes from the ProjectCreated event. MetaMask will show the escrow contract as the transaction recipient.
                </p>
              </div>
              <Badge variant="outline" className="border-border/80 text-muted-foreground">
                Advanced
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="projectChainId">
                  Escrow project ID
                </label>
                <Input
                  id="projectChainId"
                  value={projectChainId}
                  onChange={(event) => setProjectChainId(event.target.value)}
                  className="bg-secondary/30"
                  inputMode="numeric"
                  placeholder="From ProjectCreated event"
                />
                {!projectChainId ? (
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    Not linked yet. The client can only get this after creating the escrow on Base Sepolia.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="milestoneIndex">
                  Milestone index
                </label>
                <Input
                  id="milestoneIndex"
                  value={milestoneIndex}
                  onChange={(event) => setMilestoneIndex(event.target.value)}
                  className="bg-secondary/30"
                  inputMode="numeric"
                  placeholder="0"
                  readOnly
                />
                <p className="text-xs text-muted-foreground">First milestone is 0, second is 1, third is 2.</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-border/70 bg-secondary/25 p-3 text-xs text-muted-foreground">
              <p>Contract recipient: {contractLabel} · Freelancer payout wallet: {shortAddress(selectedPayeeWallet)}</p>
              {verifiedEscrowFreelancer ? (
                <p className="mt-1 text-primary">Verified on-chain freelancer: {shortAddress(verifiedEscrowFreelancer)}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={handleApproveMilestone} disabled={isBusy || !hasSelectedSubmission}>
              Approve milestone
            </Button>
            <Button size="sm" variant="outline" onClick={handleReleasePayment} disabled={isBusy || !hasSelectedSubmission}>
              Release payment
            </Button>
            <Button size="sm" variant="outline" onClick={handleRaiseDispute} disabled={isBusy || !hasSelectedSubmission}>
              Raise dispute
            </Button>
          </div>
          {status ? <p className="mt-3 text-xs text-muted-foreground">{status}</p> : null}
        </article>

        <article className="glass-panel rounded-xl p-4">
          <h2 className="text-base font-semibold text-foreground">Pending submissions</h2>
          <div className="mt-4 space-y-3">
            {!user ? (
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">Connect a client wallet to load submissions.</div>
            ) : submissionsLoading ? (
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">Loading submissions...</div>
            ) : submissions.length ? (
              submissions.map((submission) => (
              <div key={submission.id} className="surface-panel rounded-lg p-3">
                <p className="text-sm font-medium text-foreground">{submission.milestone?.project?.title ?? "Untitled project"}</p>
                <p className="text-xs text-muted-foreground">
                  {userDisplayName(submission.submittedBy)} · {submission.milestone?.title ?? "Milestone"} · {formatDateTime(submission.createdAt)}
                </p>
                <p className="mt-2 text-xs text-primary">Proof: {shortHash(submission.ipfsCid ?? submission.id)}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => handleSubmissionDecision(submission, "approve")}
                    disabled={isBusy}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleSubmissionDecision(submission, "reject")}
                    disabled={isBusy}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
              ))
            ) : (
              <div className="surface-panel rounded-lg p-3 text-sm text-muted-foreground">No submitted milestones are waiting for review.</div>
            )}
          </div>
        </article>
        <motion.article
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-xl p-4"
        >
          <h2 className="text-base font-semibold text-foreground">Gasless payment modal</h2>
          <div className="mt-4 rounded-lg border border-border/70 bg-secondary/35 p-4 text-sm text-muted-foreground">
            <p className="text-primary">No ETH required</p>
            <p className="mt-1">Gas handled via UGF modal</p>
            <p className="mt-1">Mock USD deduction shown inside UGF</p>
            {txHash ? <p className="mt-1">Tx hash: {txHash}</p> : null}
          </div>

          <div className="mt-4 space-y-2">
            <div className="surface-panel rounded-md p-2 text-xs text-foreground">
              Selected project ID: {projectId || "None selected"}
            </div>
            <div className="surface-panel rounded-md p-2 text-xs text-foreground">
              Selected submission ID: {submissionId || "None selected"}
            </div>
            <div className="surface-panel rounded-md p-2 text-xs text-foreground">
              Last UGF transaction: {txHash ? shortHash(txHash) : "None submitted"}
            </div>
          </div>
        </motion.article>
      </section>
    </DashboardShell>
  );
}
