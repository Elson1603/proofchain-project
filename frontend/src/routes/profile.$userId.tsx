import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ProofChainTopNav } from "@/components/proofchain/top-nav";

type PublicProfile = {
  id: string;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  skills: string[];
  reputationScore: number;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse =
  | { success: true; data: PublicProfile }
  | { success: false; message: string; errors?: unknown };

export const Route = createFileRoute("/profile/$userId")({
  head: () => ({
    meta: [
      { title: "User Profile — ProofChain" },
      { name: "description", content: "Public freelancer profile on ProofChain." },
    ],
  }),
  component: PublicProfilePage,
});

function resolveApiBaseUrl(): string {
  const raw =
    (import.meta.env.VITE_API_URL as string | undefined) ??
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    "";
  return raw.replace(/\/$/, "");
}

function PublicProfilePage() {
  const { userId } = Route.useParams();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!apiBaseUrl) {
        setLoading(false);
        setError("Missing API base URL. Set VITE_API_URL in frontend/.env (example: http://localhost:5000)");
        return;
      }

      setLoading(true);
      setError(null);
      setProfile(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/profile/${encodeURIComponent(userId)}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "include",
        });

        const payload = (await response.json()) as ApiResponse;

        if (!response.ok || !payload.success) {
          const message = !payload.success
            ? payload.message
            : `Request failed (${response.status})`;
          throw new Error(message);
        }

        if (!cancelled) {
          setProfile(payload.data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, userId]);

  return (
    <div className="min-h-screen bg-background">
      <ProofChainTopNav />

      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="glass-panel rounded-xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Public profile</p>
              <h1 className="mt-2 font-display text-2xl font-bold text-foreground">User Profile</h1>
              <p className="mt-1 text-sm text-muted-foreground">User ID: {userId}</p>
            </div>
            <div className="flex gap-2">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Home
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Connect Wallet
              </Link>
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="surface-panel rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Loading profile…</p>
              </div>
            ) : error ? (
              <div className="surface-panel rounded-lg p-4">
                <p className="text-sm font-medium text-foreground">Could not load profile</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Tip: set <span className="font-mono">VITE_API_URL</span> to your backend (usually
                  <span className="font-mono"> http://localhost:5000</span>).
                </p>
              </div>
            ) : !profile ? (
              <div className="surface-panel rounded-lg p-4">
                <p className="text-sm text-muted-foreground">No profile found.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="surface-panel rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="mt-1 text-sm text-foreground">{profile.username ?? "—"}</p>

                  <p className="mt-4 text-xs text-muted-foreground">Bio</p>
                  <p className="mt-1 text-sm text-foreground">{profile.bio ?? "—"}</p>

                  <p className="mt-4 text-xs text-muted-foreground">Reputation score</p>
                  <p className="mt-1 text-sm text-foreground">{profile.reputationScore}</p>
                </div>

                <div className="surface-panel rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Skills</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.skills.length ? (
                      profile.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-border/70 bg-secondary px-3 py-1 text-xs text-muted-foreground"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    {profile.githubUrl ? (
                      <a
                        className="block text-primary hover:underline"
                        href={profile.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        GitHub
                      </a>
                    ) : null}
                    {profile.linkedinUrl ? (
                      <a
                        className="block text-primary hover:underline"
                        href={profile.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        LinkedIn
                      </a>
                    ) : null}
                    {profile.portfolioUrl ? (
                      <a
                        className="block text-primary hover:underline"
                        href={profile.portfolioUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Portfolio
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
