import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, FileText, LoaderCircle, UploadCloud, XCircle } from "lucide-react";
import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/freelancer/submit-work")({
  head: () => ({
    meta: [
      { title: "Submit Work — ProofChain" },
      { name: "description", content: "Upload deliverables and submit proof hash for client approval." },
      { property: "og:title", content: "Submit Work — ProofChain" },
      { property: "og:description", content: "Professional milestone submission with hash-backed proof." },
    ],
  }),
  component: SubmitWorkPage,
});

const freelancerNav = [
  { label: "Dashboard", to: "/freelancer/dashboard" },
  { label: "Profile", to: "/freelancer/profile" },
  { label: "Projects", to: "/project-details" },
  { label: "Submit Work", to: "/freelancer/submit-work" },
  { label: "NFT Certificates", to: "/freelancer/nft-certificates" },
  { label: "Earnings", to: "/freelancer/earnings" },
  { label: "Settings", to: "/auth" },
];

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  status: string;
  projectId: string;
  createdAt: string;
};

type UploadSubmissionResponse = {
  id: string;
  milestoneId: string;
  submittedById: string;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  ipfsCid: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  version: number;
  gatewayUrl: string;
};

type ApiErrorPayload = {
  success?: boolean;
  message?: string;
  errors?: unknown;
};

const DEFAULT_MAX_FILE_MB = 20;
const MAX_FILE_BYTES = DEFAULT_MAX_FILE_MB * 1024 * 1024;
const DEFAULT_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-7z-compressed",
  "application/gzip",
  "text/plain",
  "text/markdown",
  "application/json",
]);

const DEFAULT_ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "zip",
  "7z",
  "gz",
  "txt",
  "md",
  "json",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "mp4",
  "mov",
  "webm",
]);

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function extractApiErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Upload failed";
  }

  const maybe = payload as ApiErrorPayload;
  if (typeof maybe.message === "string" && maybe.message.trim()) {
    return maybe.message;
  }

  return "Upload failed";
}

function tryParseJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function getFileExtension(name: string) {
  const idx = name.lastIndexOf(".");
  if (idx === -1) return "";
  return name.slice(idx + 1).toLowerCase();
}

function validateFile(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    return `File too large. Max size is ${DEFAULT_MAX_FILE_MB}MB.`;
  }

  const mime = file.type;
  if (DEFAULT_ALLOWED_MIME_TYPES.has(mime)) {
    return null;
  }

  if (mime.startsWith("image/") || mime.startsWith("video/")) {
    return null;
  }

  // Some browsers provide an empty MIME type for unknown extensions.
  // Fall back to extension checks to avoid blocking valid uploads.
  if (!mime) {
    const ext = getFileExtension(file.name);
    if (ext && DEFAULT_ALLOWED_EXTENSIONS.has(ext)) {
      return null;
    }
  }

  return "Unsupported file type.";
}

function uploadSubmission(args: {
  apiBase: string;
  milestoneId: string;
  submittedById: string;
  remarks?: string;
  file: File;
  onProgress: (percent: number) => void;
}) {
  const { apiBase, milestoneId, submittedById, remarks, file, onProgress } = args;

  return new Promise<UploadSubmissionResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBase}/api/submissions/upload`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress(percent);
    };

    xhr.onload = () => {
      const isOk = xhr.status >= 200 && xhr.status < 300;
      const raw = xhr.responseText;
      const parsed = raw ? tryParseJson(raw) : null;

      if (!isOk) {
        reject(new Error(extractApiErrorMessage(parsed) || raw || "Upload failed"));
        return;
      }

      if (!parsed) {
        reject(new Error("Unexpected server response"));
        return;
      }

      console.debug("[submit-work] upload response", parsed);
      resolve(parsed as UploadSubmissionResponse);
    };

    xhr.onerror = () => {
      reject(new Error("Network error while uploading"));
    };

    const body = new FormData();
    body.append("file", file);
    body.append("milestoneId", milestoneId);
    body.append("submittedById", submittedById);
    if (remarks && remarks.trim()) {
      body.append("remarks", remarks.trim());
    }

    console.debug("[submit-work] upload payload", {
      apiBase,
      milestoneId,
      submittedById,
      remarks: remarks?.trim() || undefined,
      file: { name: file.name, size: file.size, type: file.type },
    });

    xhr.send(body);
  });
}

function SubmitWorkPage() {
  const apiBase = useMemo(() => {
    const fromUrl = import.meta.env.VITE_API_URL as string | undefined;
    const fromBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
    return (fromUrl ?? fromBase ?? "").replace(/\/$/, "");
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [milestonesError, setMilestonesError] = useState<string | null>(null);

  const [milestoneId, setMilestoneId] = useState<string>("");
  const [submittedById, setSubmittedById] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadSubmissionResponse | null>(null);

  useEffect(() => {
    const cached = window.localStorage.getItem("proofchain.userId");
    if (cached && !submittedById) {
      setSubmittedById(cached);
    }
  }, [submittedById]);

  useEffect(() => {
    if (!apiBase) {
      setMilestonesError("Missing API base URL. Set VITE_API_URL (or VITE_API_BASE_URL) in frontend/.env");
      return;
    }

    const controller = new AbortController();
    setMilestonesLoading(true);
    setMilestonesError(null);

    fetch(`${apiBase}/api/milestones`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to load milestones");
        }
        return (await res.json()) as Milestone[];
      })
      .then((data) => {
        setMilestones(Array.isArray(data) ? data : []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Failed to load milestones";
        setMilestonesError(message);
      })
      .finally(() => {
        setMilestonesLoading(false);
      });

    return () => controller.abort();
  }, [apiBase]);

  const selectedMilestone = useMemo(() => {
    return milestones.find((m) => m.id === milestoneId) ?? null;
  }, [milestones, milestoneId]);

  const canSubmit = Boolean(apiBase && milestoneId && submittedById.trim() && file && !isUploading);

  const onChooseFile = (next: File | null) => {
    setSubmitError(null);
    setUploadResult(null);

    if (!next) {
      setFile(null);
      return;
    }

    const validationError = validateFile(next);
    if (validationError) {
      toast.error(validationError);
      setSubmitError(validationError);
      setFile(null);
      return;
    }

    setFile(next);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setUploadResult(null);

    if (!apiBase) {
      setSubmitError("Missing API base URL (VITE_API_URL).");
      return;
    }

    if (!milestoneId) {
      setSubmitError("Please choose a milestone.");
      return;
    }

    const trimmedUserId = submittedById.trim();
    if (!trimmedUserId) {
      setSubmitError("Please provide your freelancer user id.");
      return;
    }

    if (!file) {
      setSubmitError("Please choose a file to upload.");
      return;
    }

    const fileError = validateFile(file);
    if (fileError) {
      setSubmitError(fileError);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadSubmission({
        apiBase,
        milestoneId,
        submittedById: trimmedUserId,
        remarks,
        file,
        onProgress: setUploadProgress,
      });

      setUploadProgress(100);
      setUploadResult(result);
      window.localStorage.setItem("proofchain.userId", trimmedUserId);
      toast.success("Submission uploaded successfully.");
      console.debug("[submit-work] upload success", result);

      // Reset form fields but keep cached userId.
      setRemarks("");
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload failed";
      console.error("[submit-work] upload error", error);
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardShell
      title="Submit work"
      subtitle="Upload milestone deliverables with remarks for client approval."
      navItems={freelancerNav}
    >
      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="glass-panel rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground">Project submission</h2>

          {milestonesError ? (
            <div className="mt-4">
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Milestones unavailable</AlertTitle>
                <AlertDescription>{milestonesError}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          {submitError ? (
            <div className="mt-4">
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Submission failed</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Milestone</Label>
              <Select value={milestoneId} onValueChange={setMilestoneId} disabled={milestonesLoading}>
                <SelectTrigger className="bg-secondary/30">
                  <SelectValue placeholder={milestonesLoading ? "Loading milestones..." : "Select a milestone"} />
                </SelectTrigger>
                <SelectContent>
                  {milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title} • ${m.amount} • {m.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMilestone ? (
                <p className="text-xs text-muted-foreground">
                  {selectedMilestone.description ? selectedMilestone.description : "No milestone description"}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="submittedById" className="text-xs text-muted-foreground">
                Freelancer user id
              </Label>
              <Input
                id="submittedById"
                className="bg-secondary/30"
                placeholder="UUID (e.g. from auth-test output)"
                value={submittedById}
                onChange={(e) => setSubmittedById(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Stored in local storage as <span className="font-mono">proofchain.userId</span> after first submit.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Deliverable file</Label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files?.[0] ?? null;
                  onChooseFile(dropped);
                }}
                className={`rounded-lg border border-dashed bg-secondary/30 p-6 text-center outline-none transition-colors ${
                  isDragging
                    ? "border-primary/70 bg-secondary/50"
                    : "border-border/80 hover:border-primary/40"
                }`}
              >
                <UploadCloud className="mx-auto h-6 w-6 text-primary" />
                <p className="mt-3 text-sm text-foreground">
                  {file ? "File selected" : "Drag and drop a file, or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Up to {DEFAULT_MAX_FILE_MB}MB. PDF, ZIP, images, videos, markdown, JSON.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  onChooseFile(next);
                }}
              />

              {file ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-secondary/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)} • {file.type || "unknown type"}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onChooseFile(null)}
                    disabled={isUploading}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks" className="text-xs text-muted-foreground">
                Remarks (optional)
              </Label>
              <Textarea
                id="remarks"
                className="min-h-28 bg-secondary/30"
                placeholder="Add context for the client (what changed, how to review, acceptance notes)."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            {isUploading ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            ) : null}

            <Button className="gap-2" onClick={handleSubmit} disabled={!canSubmit}>
              {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Submit for approval
            </Button>
          </div>
        </div>

        <aside className="space-y-4">
          {uploadResult ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Upload complete
                </CardTitle>
                <CardDescription>Submission stored and pinned to IPFS.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <p className="text-muted-foreground">File</p>
                  <p className="text-foreground">{uploadResult.fileName ?? "(unknown)"}</p>
                </div>

                <div className="text-sm">
                  <p className="text-muted-foreground">Milestone</p>
                  <p className="text-foreground">
                    {selectedMilestone ? selectedMilestone.title : uploadResult.milestoneId}
                  </p>
                </div>

                <div className="text-sm">
                  <p className="text-muted-foreground">IPFS CID</p>
                  <p className="break-all text-foreground">{uploadResult.ipfsCid ?? "(missing)"}</p>
                </div>

                <div className="text-sm">
                  <p className="text-muted-foreground">Gateway URL</p>
                  {uploadResult.gatewayUrl ? (
                    <a
                      className="break-all text-primary underline-offset-4 hover:underline"
                      href={uploadResult.gatewayUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {uploadResult.gatewayUrl}
                    </a>
                  ) : (
                    <p className="text-foreground">(missing)</p>
                  )}
                </div>

                <div className="text-sm">
                  <p className="text-muted-foreground">Uploaded at</p>
                  <p className="text-foreground">
                    {uploadResult.createdAt ? format(new Date(uploadResult.createdAt), "PPpp") : "(unknown)"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground">Submission checklist</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>• Attach final source and assets</li>
              <li>• Include deployment URL if relevant</li>
              <li>• Add review notes in remarks</li>
              <li>• Confirm milestone acceptance criteria</li>
            </ul>
          </div>
        </aside>
      </section>
    </DashboardShell>
  );
}
