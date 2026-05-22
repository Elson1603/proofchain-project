import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Copy,
  ExternalLink,
  Github,
  Hourglass,
  Link2,
  Linkedin,
  LoaderCircle,
  PenLine,
  ShieldCheck,
  Sparkles,
  Twitter,
  UploadCloud,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { DashboardShell } from "@/components/proofchain/dashboard-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchNftCertificates,
  fetchPayments,
  fetchProjects,
  getStoredAccessToken,
  updateMyProfile,
  type ApiNftCertificate,
  type ApiPayment,
  type ApiProject,
  type ApiUser,
} from "@/lib/proofchain-api";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";

export const Route = createFileRoute("/freelancer/profile")({
  head: () => ({
    meta: [
      { title: "Freelancer Profile — ProofChain" },
      {
        name: "description",
        content:
          "A premium Web3 freelancer profile dashboard with proof-of-work, UGF settlement, and soulbound certificates.",
      },
      { property: "og:title", content: "Freelancer Profile — ProofChain" },
      {
        property: "og:description",
        content: "Showcase reputation, skills, projects, and on-chain proof." ,
      },
    ],
  }),
  component: FreelancerProfilePage,
});

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  walletAddress: string;
  verified: boolean;
  level: string;
  reputationScore: number;
  availability: "available" | "busy" | "unavailable";
  title: string;
  bio: string;
  yearsExperience: number;
  skills: string[];
  socials: {
    github?: string;
    linkedin?: string;
    portfolio?: string;
    twitter?: string;
  };
  avatarUrl?: string;
  stats: {
    completedProjects: number;
    activeProjects: number;
    totalEarningsUsd: number;
    nftsEarned: number;
    successRate: number;
  };
}

export interface NFTCertificate {
  id: string;
  projectTitle: string;
  issuedAt: string;
  previewUrl: string;
  chainLabel: string;
  verified: boolean;
}

export interface Project {
  id: string;
  title: string;
  clientName: string;
  status: "completed" | "active" | "review";
  milestonesDone: number;
  milestonesTotal: number;
  paymentUsd: number;
  ugfGasless: boolean;
  txHash: string;
}

export interface ActivityItem {
  id: string;
  type: "submitted" | "payment" | "minted" | "completed";
  title: string;
  description: string;
  timestamp: string;
}

type EarningsPoint = { label: string; earnings: number };

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; message: string; errors?: unknown };

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

function resolveApiBaseUrl(): string {
  const raw =
    (import.meta.env.VITE_API_URL as string | undefined) ??
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    "";
  return raw.replace(/\/$/, "");
}

function shortenWallet(address: string) {
  if (!address) return "Not connected";
  const head = address.slice(0, 6);
  const tail = address.slice(-4);
  return `${head}…${tail}`;
}

function certificateTokenId(certificateId: string) {
  return certificateId.replace(/\D/g, "") || "1017";
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function availabilityLabel(status: UserProfile["availability"]) {
  if (status === "available") return "Available";
  if (status === "busy") return "On contract";
  return "Unavailable";
}

function availabilityTone(status: UserProfile["availability"]) {
  if (status === "available") return "text-success";
  if (status === "busy") return "text-info";
  return "text-muted-foreground";
}

function availabilityDot(status: UserProfile["availability"]) {
  if (status === "available") return "bg-success";
  if (status === "busy") return "bg-info";
  return "bg-muted-foreground";
}

function createEmptyProfile(): UserProfile {
  return {
    id: "",
    name: "Your ProofChain profile",
    username: "not-set",
    walletAddress: "",
    verified: false,
    level: "Level 0",
    reputationScore: 0,
    availability: "unavailable",
    title: "Freelancer profile",
    bio: "No bio added yet.",
    yearsExperience: 0,
    skills: [],
    socials: {},
    stats: {
      completedProjects: 0,
      activeProjects: 0,
      totalEarningsUsd: 0,
      nftsEarned: 0,
      successRate: 0,
    },
  };
}

function displayName(user: Pick<ApiUser, "fullName" | "username" | "walletAddress"> | null | undefined) {
  return user?.fullName || user?.username || (user?.walletAddress ? shortenWallet(user.walletAddress) : "Unknown");
}

function profileFromApi(me: ApiUser): UserProfile {
  const reputationScore = Number(me.reputationScore ?? 0);
  const skills = Array.isArray(me.skills) ? me.skills : [];

  return {
    ...createEmptyProfile(),
    id: me.id,
    name: displayName(me),
    username: me.username ?? "not-set",
    walletAddress: me.walletAddress ?? "",
    verified: Boolean(me.isVerified),
    level: `Level ${Math.max(0, Math.floor(reputationScore / 25))}`,
    reputationScore,
    availability: "available",
    title: skills.length ? `${skills.slice(0, 3).join(" / ")} freelancer` : "ProofChain freelancer",
    bio: me.bio || "No bio added yet.",
    skills,
    socials: {
      github: me.githubUrl ?? undefined,
      linkedin: me.linkedinUrl ?? undefined,
      portfolio: me.portfolioUrl ?? undefined,
    },
    avatarUrl: me.avatarUrl ?? me.profileImage ?? undefined,
  };
}

function calculateStats(projects: ApiProject[], payments: ApiPayment[], certificates: ApiNftCertificate[]) {
  const completedProjects = projects.filter((project) => project.status === "completed").length;
  const activeProjects = projects.filter((project) => !["completed", "rejected", "draft"].includes(project.status)).length;
  const totalEarningsUsd = payments
    .filter((payment) => payment.status === "released")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const settledProjects = new Set(payments.filter((payment) => payment.status === "released").map((payment) => payment.projectId));
  const successRate = projects.length ? Math.round((settledProjects.size / projects.length) * 100) : 0;

  return {
    completedProjects,
    activeProjects,
    totalEarningsUsd,
    nftsEarned: certificates.length,
    successRate,
  };
}

function mapCertificate(cert: ApiNftCertificate): NFTCertificate {
  return {
    id: `PC-SBT-${cert.tokenId}`,
    projectTitle: cert.project?.title ?? "ProofChain certificate",
    issuedAt: cert.mintedAt ? new Date(cert.mintedAt).toLocaleDateString() : "Pending",
    previewUrl: "",
    chainLabel: "Base Sepolia",
    verified: ["minted", "verified"].includes(cert.certificateStatus),
  };
}

function mapProject(project: ApiProject): Project {
  const milestones = project.milestones ?? [];
  const payments = project.payments ?? [];
  const latestTx = payments.flatMap((payment) => payment.transactions ?? [])[0];
  const paymentTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    id: project.id,
    title: project.title,
    clientName: displayName(project.owner),
    status: project.status === "completed" ? "completed" : ["submitted", "approved"].includes(project.status) ? "review" : "active",
    milestonesDone: milestones.filter((milestone) => milestone.status === "completed").length,
    milestonesTotal: milestones.length,
    paymentUsd: paymentTotal || project.budget || 0,
    ugfGasless: payments.some((payment) => Boolean(payment.transactions?.length)),
    txHash: latestTx?.txHash ? shortenWallet(latestTx.txHash) : "Pending",
  };
}

function buildActivity(projects: ApiProject[], payments: ApiPayment[], certificates: ApiNftCertificate[]): ActivityItem[] {
  const paymentActivity = payments.slice(0, 4).map((payment) => ({
    id: `payment-${payment.id}`,
    type: "payment" as const,
    title: payment.type.replace(/_/g, " "),
    description: `${payment.project?.title ?? "Project"} - ${payment.status}`,
    timestamp: payment.releasedAt ? new Date(payment.releasedAt).toLocaleString() : new Date(payment.createdAt).toLocaleString(),
  }));

  const certificateActivity = certificates.slice(0, 3).map((cert) => ({
    id: `minted-${cert.id}`,
    type: "minted" as const,
    title: `Certificate #${cert.tokenId}`,
    description: cert.project?.title ?? cert.metadataURI,
    timestamp: cert.mintedAt ? new Date(cert.mintedAt).toLocaleString() : new Date(cert.createdAt).toLocaleString(),
  }));

  const projectActivity = projects.slice(0, 3).map((project) => ({
    id: `project-${project.id}`,
    type: project.status === "completed" ? ("completed" as const) : ("submitted" as const),
    title: project.title,
    description: `Project status: ${project.status.replace(/_/g, " ")}`,
    timestamp: project.updatedAt ? new Date(project.updatedAt).toLocaleString() : new Date(project.createdAt).toLocaleString(),
  }));

  return [...paymentActivity, ...certificateActivity, ...projectActivity].slice(0, 8);
}

function buildEarnings(payments: ApiPayment[]): EarningsPoint[] {
  const monthTotals = new Map<string, number>();

  payments
    .filter((payment) => payment.status === "released")
    .forEach((payment) => {
      const date = new Date(payment.releasedAt ?? payment.createdAt);
      const label = date.toLocaleString(undefined, { month: "short" });
      monthTotals.set(label, (monthTotals.get(label) ?? 0) + payment.amount);
    });

  return Array.from(monthTotals.entries()).map(([label, earnings]) => ({ label, earnings }));
}

async function fetchMyProfile(apiBaseUrl: string): Promise<UserProfile | null> {
  const token = getStoredAccessToken();
  if (!apiBaseUrl || !token) return null;

  try {
    const response = await fetch(`${apiBaseUrl}/api/profile/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = (await response.json()) as ApiResponse<{
      id: string;
      username: string | null;
      bio: string | null;
      avatarUrl: string | null;
      githubUrl: string | null;
      linkedinUrl: string | null;
      portfolioUrl: string | null;
      skills: string[];
      reputationScore: number;
      fullName?: string | null;
      walletAddress?: string | null;
      isVerified?: boolean;
    }>;

    if (!response.ok || !payload.success) {
      return null;
    }

    const me = payload.data;
    return profileFromApi(me);
  } catch {
    return null;
  }
}

const editProfileSchema = z.object({
  username: z.string().min(2, "Username is too short").max(24, "Username is too long"),
  bio: z.string().max(320, "Bio is too long").optional().or(z.literal("")),
  skills: z
    .string()
    .max(180, "Skills are too long")
    .optional()
    .or(z.literal("")),
  githubUrl: z
    .string()
    .url("GitHub URL must be valid")
    .optional()
    .or(z.literal("")),
  linkedinUrl: z
    .string()
    .url("LinkedIn URL must be valid")
    .optional()
    .or(z.literal("")),
  portfolioUrl: z
    .string()
    .url("Portfolio URL must be valid")
    .optional()
    .or(z.literal("")),
});

type EditProfileValues = z.infer<typeof editProfileSchema>;

function parseSkills(raw: string | undefined) {
  if (!raw) return [] as string[];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 14);
}

function EmptyState({
  icon,
  title,
  description,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="glass-panel relative overflow-hidden rounded-xl p-6">
      <div className="ambient-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative">
        <div className="inline-flex items-center justify-center rounded-lg border border-border/70 bg-secondary p-2 text-muted-foreground">
          {icon}
        </div>
        <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {cta ? <div className="mt-5">{cta}</div> : null}
      </div>
    </div>
  );
}

function FreelancerProfilePage() {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile>(() => createEmptyProfile());
  const [certificates, setCertificates] = useState<NFTCertificate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [earnings, setEarnings] = useState<EarningsPoint[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarDraftUrl, setAvatarDraftUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      const nextProfile = await fetchMyProfile(apiBaseUrl);

      if (!nextProfile) {
        if (!cancelled) {
          setProfile(createEmptyProfile());
          setCertificates([]);
          setProjects([]);
          setActivity([]);
          setEarnings([]);
          setLoading(false);
        }
        return;
      }

      const [apiProjects, apiPayments, apiCertificates] = await Promise.all([
        fetchProjects({ freelancerId: nextProfile.id }).catch(() => null),
        fetchPayments({ payeeId: nextProfile.id }).catch(() => null),
        fetchNftCertificates(nextProfile.walletAddress).catch(() => null),
      ]);

      if (!cancelled) {
        const realProjects = apiProjects ?? [];
        const realPayments = apiPayments ?? [];
        const realCertificates = apiCertificates ?? [];
        setProfile({
          ...nextProfile,
          stats: calculateStats(realProjects, realPayments, realCertificates),
        });
        setCertificates(realCertificates.map(mapCertificate));
        setProjects(realProjects.map(mapProject));
        setActivity(buildActivity(realProjects, realPayments, realCertificates));
        setEarnings(buildEarnings(realPayments));
        setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const shareUrl = useMemo(() => {
    if (!profile.id) return "";
    try {
      return new URL(`/profile/${profile.id}`, window.location.origin).toString();
    } catch {
      return "";
    }
  }, [profile.id]);

  const form = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      username: profile.username,
      bio: profile.bio,
      skills: profile.skills.join(", "),
      githubUrl: profile.socials.github ?? "",
      linkedinUrl: profile.socials.linkedin ?? "",
      portfolioUrl: profile.socials.portfolio ?? "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (!editOpen) return;
    form.reset({
      username: profile.username,
      bio: profile.bio,
      skills: profile.skills.join(", "),
      githubUrl: profile.socials.github ?? "",
      linkedinUrl: profile.socials.linkedin ?? "",
      portfolioUrl: profile.socials.portfolio ?? "",
    });
    setAvatarDraftUrl(undefined);
  }, [editOpen, form, profile]);

  async function copyWallet() {
    if (!profile.walletAddress) {
      toast.error("No wallet connected");
      return;
    }

    try {
      await navigator.clipboard.writeText(profile.walletAddress);
      toast.success("Wallet copied");
    } catch {
      toast.error("Could not copy wallet");
    }
  }

  async function shareProfile() {
    if (!shareUrl) {
      toast.error("Could not create share link");
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({ title: "ProofChain profile", url: shareUrl });
        return;
      }
    } catch {
      // fall through to copy
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Profile link copied");
    } catch {
      toast.error("Could not share profile");
    }
  }

  async function copyShareLink() {
    if (!shareUrl) {
      toast.error("Could not create share link");
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  async function onSave(values: EditProfileValues) {
    const nextSkills = parseSkills(values.skills);

    setSaving(true);
    try {
      if (avatarDraftUrl) {
        toast.info("Avatar upload storage is not configured yet; profile text fields will be saved.");
      }

      const updated = await updateMyProfile({
        username: values.username,
        bio: values.bio?.trim() || null,
        skills: nextSkills,
        githubUrl: values.githubUrl?.trim() || null,
        linkedinUrl: values.linkedinUrl?.trim() || null,
        portfolioUrl: values.portfolioUrl?.trim() || null,
      });

      if (!updated) {
        throw new Error("Profile update failed");
      }

      setProfile((prev) => ({
        ...profileFromApi(updated),
        stats: prev.stats,
      }));

      toast.success("Profile updated");
      setEditOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  function onAvatarPicked(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const url = URL.createObjectURL(file);
    setAvatarDraftUrl(url);
  }

  const completionDensity = profile.stats.completedProjects
    ? clamp(Math.round((profile.stats.completedProjects / Math.max(1, projects.length)) * 100), 0, 100)
    : 0;

  return (
    <DashboardShell
      title="Profile"
      subtitle="Your on-chain reputation, proofs, and delivery velocity in one place."
      navItems={freelancerNav}
    >
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]"
      >
        <div className="space-y-4">
          <motion.div
            whileHover={{ y: -2 }}
            className="glass-panel relative overflow-hidden rounded-xl p-5"
          >
            <div className="ambient-grid pointer-events-none absolute inset-0 opacity-45" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/30 via-info/10 to-transparent blur-lg" />
                  <Avatar className="relative h-16 w-16 border border-border/70 bg-secondary">
                    <AvatarImage src={profile.avatarUrl} alt={profile.name} />
                    <AvatarFallback>{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">{profile.name}</h2>
                    {profile.verified ? (
                      <Badge className="gap-1" variant="secondary">
                        <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                        Verified
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="border-border/70 bg-secondary/50">
                      <Sparkles className="mr-1 h-3.5 w-3.5 text-info" />
                      {profile.level}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">@{profile.username}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary px-3 py-1 text-xs text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5 text-primary" />
                      {shortenWallet(profile.walletAddress)}
                    </span>
                    <span className={cn(
                      "inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary px-3 py-1 text-xs",
                      availabilityTone(profile.availability),
                    )}>
                      <span className={cn("h-2 w-2 rounded-full", availabilityDot(profile.availability))} />
                      {availabilityLabel(profile.availability)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary px-3 py-1 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-info" />
                      Reputation {profile.reputationScore}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" size="sm">
                      <PenLine className="h-4 w-4" />
                      Edit profile
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit profile</DialogTitle>
                      <DialogDescription>
                        Update your public info. Changes are saved through `PATCH /api/profile/me`.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                      <div className="space-y-3">
                        <div className="glass-panel rounded-xl p-4">
                          <Avatar className="h-20 w-20 border border-border/70 bg-secondary">
                            <AvatarImage src={avatarDraftUrl ?? profile.avatarUrl} alt={profile.name} />
                            <AvatarFallback>{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <p className="mt-3 text-xs text-muted-foreground">Avatar</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full gap-2"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <UploadCloud className="h-4 w-4" />
                            Upload
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => onAvatarPicked(e.target.files?.[0] ?? null)}
                          />
                        </div>
                      </div>

                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                              control={form.control}
                              name="username"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Username</FormLabel>
                                  <FormControl>
                                    <Input placeholder="your-handle" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="space-y-2">
                              <p className="text-sm font-medium text-foreground">Wallet</p>
                              <div className="rounded-md border border-border/70 bg-secondary px-3 py-2 text-sm text-muted-foreground">
                                {profile.walletAddress || "Not connected"}
                              </div>
                              <p className="text-xs text-muted-foreground">Wallet is managed by auth.</p>
                            </div>
                          </div>

                          <FormField
                            control={form.control}
                            name="bio"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Bio</FormLabel>
                                <FormControl>
                                  <Textarea rows={4} placeholder="Tell clients what you ship." {...field} />
                                </FormControl>
                                <FormDescription>Keep it crisp — proofs speak for themselves.</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="skills"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Skills</FormLabel>
                                <FormControl>
                                  <Input placeholder="Solidity, React, IPFS" {...field} />
                                </FormControl>
                                <FormDescription>Comma-separated skills (max 14).</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid gap-4 sm:grid-cols-3">
                            <FormField
                              control={form.control}
                              name="githubUrl"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>GitHub</FormLabel>
                                  <FormControl>
                                    <Input placeholder="https://github.com/..." {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="linkedinUrl"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>LinkedIn</FormLabel>
                                  <FormControl>
                                    <Input placeholder="https://linkedin.com/in/..." {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="portfolioUrl"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Portfolio</FormLabel>
                                  <FormControl>
                                    <Input placeholder="https://your.site" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setEditOpen(false)}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={!form.formState.isValid || saving} className="gap-2">
                              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                              Save changes
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" size="sm" className="gap-2" onClick={shareProfile}>
                  <ExternalLink className="h-4 w-4" />
                  Share
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={copyWallet}>
                  <Copy className="h-4 w-4" />
                  Copy wallet
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="grid gap-4 lg:grid-cols-3"
          >
            <div className="glass-panel rounded-xl p-4 lg:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">About</p>
                  <p className="mt-1 text-sm text-muted-foreground">{profile.title}</p>
                </div>
                <Badge variant="outline" className="border-border/70 bg-secondary/50">
                  <BriefcaseBusiness className="mr-1 h-3.5 w-3.5 text-info" />
                  {profile.yearsExperience}y exp
                </Badge>
              </div>
              <p className="mt-4 text-sm text-foreground/90">{profile.bio}</p>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Social</p>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={copyShareLink}>
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <SocialButton href={profile.socials.github} label="GitHub" icon={<Github className="h-4 w-4" />} />
                <SocialButton href={profile.socials.linkedin} label="LinkedIn" icon={<Linkedin className="h-4 w-4" />} />
                <SocialButton href={profile.socials.portfolio} label="Portfolio" icon={<ExternalLink className="h-4 w-4" />} />
                <SocialButton href={profile.socials.twitter} label="X" icon={<Twitter className="h-4 w-4" />} />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="glass-panel rounded-xl p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Skills</p>
                <p className="mt-1 text-xs text-muted-foreground">Technologies clients can verify in your proofs.</p>
              </div>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Proof-backed
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.skills.length ? profile.skills.map((skill) => (
                <motion.span
                  key={skill}
                  whileHover={{ y: -2 }}
                  className="rounded-full border border-border/70 bg-secondary px-3 py-1 text-xs text-muted-foreground"
                >
                  {skill}
                </motion.span>
              )) : (
                <p className="text-sm text-muted-foreground">No skills added yet.</p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <StatCard label="Completed projects" value={profile.stats.completedProjects} icon={<CheckCircle2 className="h-4 w-4 text-primary" />} />
              <StatCard label="Active projects" value={profile.stats.activeProjects} icon={<Hourglass className="h-4 w-4 text-info" />} />
              <StatCard label="Total earnings" value={formatUsd(profile.stats.totalEarningsUsd)} icon={<Wallet className="h-4 w-4 text-primary" />} />
              <StatCard label="NFTs earned" value={profile.stats.nftsEarned} icon={<BadgeCheck className="h-4 w-4 text-primary" />} />
              <StatCard label="Reputation" value={profile.reputationScore} icon={<ShieldCheck className="h-4 w-4 text-info" />} />
              <StatCard label="Success rate" value={`${profile.stats.successRate}%`} icon={<Sparkles className="h-4 w-4 text-primary" />} />
            </div>

            <div className="glass-panel rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Earnings trend</p>
                  <p className="mt-1 text-xs text-muted-foreground">Verified payouts executed via UGF gasless settlement.</p>
                </div>
                <Badge variant="outline" className="border-border/70 bg-secondary/50">
                  Density {completionDensity}%
                </Badge>
              </div>
              <div className="mt-4 h-44">
                {earnings.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={earnings} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={42} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-background)",
                          border: "1px solid oklch(0.29 0.015 248 / 0.7)",
                          borderRadius: 12,
                        }}
                        cursor={{ fill: "oklch(0.22 0.01 252 / 0.6)" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="earnings"
                        stroke="var(--color-chart-2)"
                        fill="var(--color-chart-2)"
                        fillOpacity={0.18}
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-border/70 bg-secondary/30 text-sm text-muted-foreground">
                    No released payment data yet.
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="space-y-4"
          >
            <SectionHeader title="NFT certificates" subtitle="Soulbound proof cards minted after successful settlement." />
            {certificates.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {certificates.map((cert, index) => (
                  <motion.article
                    key={cert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + index * 0.05 }}
                    whileHover={{ y: -4 }}
                    className="glass-panel overflow-hidden rounded-xl"
                  >
                    <div className="relative h-28 overflow-hidden">
                      {cert.previewUrl ? (
                        <img
                          src={cert.previewUrl}
                          alt={cert.projectTitle}
                          className="h-full w-full object-cover opacity-85"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-secondary/60">
                          <BadgeCheck className="h-8 w-8 text-primary" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
                      <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-glass px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                        <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                        {cert.chainLabel}
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">{cert.id}</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{cert.projectTitle}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Issued {cert.issuedAt}</p>
                        </div>
                        {cert.verified ? <ShieldCheck className="mt-1 h-4 w-4 text-info" /> : null}
                      </div>
                      <Button asChild variant="outline" size="sm" className="mt-4 w-full gap-2">
                        <Link to="/certificate/$tokenId" params={{ tokenId: certificateTokenId(cert.id) }}>
                          <ExternalLink className="h-4 w-4" />
                          View certificate
                        </Link>
                      </Button>
                    </div>
                  </motion.article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<BadgeCheck className="h-5 w-5" />}
                title="No certificates yet"
                description="Certificates mint automatically after verified project completion and settlement."
              />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <SectionHeader title="Recent projects" subtitle="Milestones, payments, and on-chain verification at a glance." />
            {projects.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {projects.map((project, index) => (
                  <motion.article
                    key={project.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + index * 0.05 }}
                    whileHover={{ y: -3 }}
                    className="glass-panel rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{project.id}</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{project.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Client: {project.clientName}</p>
                      </div>
                      <Badge
                        variant={project.status === "completed" ? "secondary" : "outline"}
                        className={cn(
                          "border-border/70",
                          project.status === "completed" ? "bg-secondary" : "bg-secondary/40",
                        )}
                      >
                        {project.status === "completed" ? "Completed" : project.status === "active" ? "Active" : "In review"}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="surface-panel rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Milestones</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {project.milestonesDone}/{project.milestonesTotal}
                        </p>
                      </div>
                      <div className="surface-panel rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Payment</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{formatUsd(project.paymentUsd)}</p>
                      </div>
                      <div className="surface-panel rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Tx hash</p>
                        <p className="mt-1 font-mono text-xs text-foreground">{project.txHash}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="status-dot" />
                        {project.ugfGasless ? "UGF gasless payment" : "Standard settlement"}
                      </span>
                      <Button asChild variant="outline" size="sm" className="gap-2">
                        <Link to="/freelancer/projects">
                          <ShieldCheck className="h-4 w-4" />
                          View proof
                        </Link>
                      </Button>
                    </div>
                  </motion.article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<BriefcaseBusiness className="h-5 w-5" />}
                title="No projects yet"
                description="Once you complete your first proof-backed milestone, it will appear here with settlement details."
                cta={
                  <Button asChild>
                    <Link to="/freelancer/submit-work">Submit work</Link>
                  </Button>
                }
              />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36 }}
            className="space-y-4"
          >
            <SectionHeader title="Activity" subtitle="A verified timeline of delivery, settlement, and minting events." />
            {activity.length ? (
              <div className="glass-panel rounded-xl p-4">
                <div className="space-y-4">
                  {activity.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.06 + idx * 0.05 }}
                      className="grid grid-cols-[16px_1fr] gap-3"
                    >
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border border-border/70",
                          item.type === "payment" ? "bg-info/20" : item.type === "minted" ? "bg-primary/15" : "bg-secondary",
                        )}>
                          <span className={cn(
                            "h-2 w-2 rounded-full",
                            item.type === "payment" ? "bg-info" : item.type === "minted" ? "bg-primary" : "bg-muted-foreground",
                          )} />
                        </div>
                        {idx !== activity.length - 1 ? (
                          <div className="mt-2 h-full w-px bg-border/60" />
                        ) : null}
                      </div>
                      <div className="surface-panel rounded-lg p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Sparkles className="h-5 w-5" />}
                title="No activity yet"
                description="Once you submit work, releases and mint events will stream here in real time."
              />
            )}
          </motion.div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Profile summary</p>
              <Badge variant="outline" className="border-border/70 bg-secondary/50">
                Live
              </Badge>
            </div>

            <div className="mt-4 space-y-3">
              <SummaryRow label="UGF mode" value={(import.meta.env.VITE_UGF_MODE as string | undefined) ?? "testnet"} />
              <SummaryRow label="Chain" value="Base Sepolia" />
              <SummaryRow label="Public profile" value={shareUrl ? "Ready" : "Unavailable"} />
              <Separator className="bg-border/60" />
              <div className="grid grid-cols-2 gap-3">
                <div className="surface-panel rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Success</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{profile.stats.successRate}%</p>
                </div>
                <div className="surface-panel rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">NFTs</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{profile.stats.nftsEarned}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={shareProfile}>
                <ExternalLink className="h-4 w-4" />
                Share profile
              </Button>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4">
            <p className="text-sm font-semibold text-foreground">Data source</p>
            <p className="mt-1 text-xs text-muted-foreground">Profile, projects, payments, and certificates are loaded from the backend API.</p>
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="surface-panel rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{profile.id ? "Live data loaded" : "No authenticated profile"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {profile.id ? "This page is using live backend records." : "Connect a wallet and complete authentication to populate this page."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.section>
    </DashboardShell>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <motion.div whileHover={{ y: -3 }} className="glass-panel rounded-xl p-4">
      <div className="inline-flex rounded-md bg-secondary p-2 text-muted-foreground">{icon}</div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </motion.div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function SocialButton({
  href,
  label,
  icon,
}: {
  href: string | undefined;
  label: string;
  icon: React.ReactNode;
}) {
  const disabled = !href;
  return (
    <a
      href={href || "#"}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex items-center justify-between rounded-lg border border-border/70 bg-secondary px-3 py-2 text-sm text-foreground transition-colors",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:border-primary/50 hover:bg-accent",
      )}
    >
      <span className="inline-flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </span>
      <ExternalLink className="h-4 w-4 text-muted-foreground" />
    </a>
  );
}
