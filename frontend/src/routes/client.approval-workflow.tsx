import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { Interface, type TransactionRequest } from "ethers";
import { useUGFModal } from "@tychilabs/react-ugf";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { escrowAbi } from "@/lib/escrow-abi";
import { ESCROW_CONTRACT_ADDRESS, connectWallet, getEscrowContract, requireEscrowAddress } from "@/lib/escrow";
import {
  fetchCurrentUser,
  fetchSubmissions,
  formatDateTime,
  shortHash,
  userDisplayName,
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

function ApprovalWorkflowPage() {
  const { openUGF, result } = useUGFModal();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([]);
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
  const lastRecordedTxHash = useRef<string | null>(null);

  const contractLabel = ESCROW_CONTRACT_ADDRESS
    ? `${ESCROW_CONTRACT_ADDRESS.slice(0, 6)}...${ESCROW_CONTRACT_ADDRESS.slice(-4)}`
    : "Not set";

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
      const projectValue = parseUint(projectChainId, "project chain ID");
      const milestoneValue = parseUint(milestoneIndex, "milestone index");
      const amountValue = parseAmount(amount);

      if (!projectId || !payerId || !payeeId) {
        throw new Error("Backend project, payer, and payee IDs are required.");
      }

      const { signer, address } = await connectWallet(null);
      setWalletAddress(address);

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
    await executeUgfPayment("approve_milestone");
  };

  const handleReleasePayment = async () => {
    await executeUgfPayment("release_payment");
  };

  const handleRaiseDispute = async () => {
    const projectValue = parseUint(projectChainId, "project chain ID");

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
      const nextSubmissions = me ? await fetchSubmissions().catch(() => null) : [];

      if (!cancelled) {
        setUser(me);
        setSubmissions((nextSubmissions ?? []).filter((submission) => submission.milestone?.project?.ownerId === me?.id));
        setSubmissionsLoading(false);
      }
    }

    void loadSubmissions();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmissionDecision = (submission: ApiSubmission, action: "approve" | "reject", index: number) => {
    const project = submission.milestone?.project;

    setSubmissionId(submission.id);
    setMilestoneId(submission.milestoneId);
    setProjectId(project?.id ?? "");
    setPayerId(project?.ownerId ?? "");
    setPayeeId(submission.submittedById);
    setAmount(String(submission.milestone?.amount ?? ""));
    setMilestoneIndex(String(index));
    setPaymentType(action === "approve" ? "milestone_release" : "milestone_rejected");
    setStatus(
      action === "approve"
        ? `${project?.title ?? "Submission"} selected. Review the escrow fields, then run Approve milestone.`
        : `${project?.title ?? "Submission"} selected for rejection. Review the project chain ID, then run Raise dispute.`,
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
          <h2 className="text-base font-semibold text-foreground">Escrow actions</h2>
          <p className="mt-1 text-xs text-muted-foreground">Contract: {contractLabel}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Wallet: {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"}
            </p>
            <Button size="sm" onClick={handleConnect} disabled={isBusy}>
              {walletAddress ? "Wallet connected" : "Connect MetaMask"}
            </Button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="projectChainId">
                Project chain ID
              </label>
              <Input
                id="projectChainId"
                value={projectChainId}
                onChange={(event) => setProjectChainId(event.target.value)}
                className="bg-secondary/30"
                inputMode="numeric"
                placeholder="0"
              />
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
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="backendProjectId">
                Backend project ID
              </label>
              <Input
                id="backendProjectId"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="bg-secondary/30"
                placeholder="uuid"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="backendMilestoneId">
                Backend milestone ID
              </label>
              <Input
                id="backendMilestoneId"
                value={milestoneId}
                onChange={(event) => setMilestoneId(event.target.value)}
                className="bg-secondary/30"
                placeholder="uuid"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="backendSubmissionId">
                Backend submission ID
              </label>
              <Input
                id="backendSubmissionId"
                value={submissionId}
                onChange={(event) => setSubmissionId(event.target.value)}
                className="bg-secondary/30"
                placeholder="uuid"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="payerId">
                Payer ID
              </label>
              <Input
                id="payerId"
                value={payerId}
                onChange={(event) => setPayerId(event.target.value)}
                className="bg-secondary/30"
                placeholder="uuid"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="payeeId">
                Payee ID
              </label>
              <Input
                id="payeeId"
                value={payeeId}
                onChange={(event) => setPayeeId(event.target.value)}
                className="bg-secondary/30"
                placeholder="uuid"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="amount">
                Amount (mUSD)
              </label>
              <Input
                id="amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="bg-secondary/30"
                inputMode="decimal"
                placeholder="1200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="paymentType">
                Payment type
              </label>
              <Input
                id="paymentType"
                value={paymentType}
                onChange={(event) => setPaymentType(event.target.value)}
                className="bg-secondary/30"
                placeholder="milestone_release"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={handleApproveMilestone} disabled={isBusy}>
              Approve milestone
            </Button>
            <Button size="sm" variant="outline" onClick={handleReleasePayment} disabled={isBusy}>
              Release payment
            </Button>
            <Button size="sm" variant="outline" onClick={handleRaiseDispute} disabled={isBusy}>
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
              submissions.map((submission, index) => (
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
                    onClick={() => handleSubmissionDecision(submission, "approve", index)}
                    disabled={isBusy}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleSubmissionDecision(submission, "reject", index)}
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
