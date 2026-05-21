import { useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ExternalLink, QrCode, ShieldCheck, Sparkles } from 'lucide-react';
import { ProofChainTopNav } from '@/components/proofchain/top-nav';

type CertificateExplorerResponse = {
  valid: boolean;
  owner: string;
  project: string;
  issuedAt: string;
  tokenId: number;
  metadataURI: string;
  certificate: Record<string, unknown>;
  blockchain: {
    txHash?: string | null;
    blockNumber?: number | null;
    explorerUrl?: string;
  };
};

function resolveApiBaseUrl() {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  return raw.replace(/\/+$/, '');
}

export const Route = createFileRoute('/certificate/$tokenId')({
  head: () => ({
    meta: [
      { title: 'Certificate Explorer — ProofChain' },
      {
        name: 'description',
        content: 'Explore a verified ProofChain soulbound certificate on Base Sepolia.',
      },
    ],
  }),
  component: CertificateExplorerPage,
});

function CertificateExplorerPage() {
  const { tokenId } = Route.useParams();
  const apiBaseUrl = resolveApiBaseUrl();
  const [certificate, setCertificate] = useState<CertificateExplorerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCertificate() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/api/nft/explorer/${tokenId}`);
        if (!response.ok) {
          throw new Error('Certificate not found');
        }

        const data = (await response.json()) as CertificateExplorerResponse;
        if (!cancelled) {
          setCertificate(data);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load certificate');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCertificate();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, tokenId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ProofChainTopNav />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_35%),linear-gradient(135deg,_rgba(8,15,38,0.95),_rgba(10,12,20,0.98))] p-6 shadow-2xl shadow-black/30">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" /> Public certificate explorer
              </div>
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
                  ProofChain Certificate #{tokenId}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  A soulbound, non-transferable record of verified freelance delivery on Base Sepolia.
                </p>
              </div>

              {loading ? (
                <div className="surface-panel rounded-2xl p-5 text-sm text-slate-300">Loading certificate record…</div>
              ) : error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</div>
              ) : certificate ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <article className="surface-panel rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Project</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">{certificate.project}</h2>
                    <p className="mt-2 text-sm text-slate-300">Issued {new Date(certificate.issuedAt).toLocaleString()}</p>
                  </article>
                  <article className="surface-panel rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Ownership</p>
                    <p className="mt-2 break-all text-sm text-white">{certificate.owner}</p>
                    <p className="mt-2 text-sm text-slate-300">Token URI: {certificate.metadataURI}</p>
                  </article>
                  <article className="surface-panel rounded-2xl p-4 sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Verification</p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${certificate.valid ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {certificate.valid ? 'Verified certificate' : 'Verification pending'}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                        Block {certificate.blockchain.blockNumber ?? 'pending'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">
                      Transaction Hash: <span className="break-all text-white">{certificate.blockchain.txHash ?? 'Unavailable'}</span>
                    </p>
                  </article>
                </div>
              ) : null}
            </div>

            <aside className="space-y-4">
              <div className="surface-panel rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-400/15 p-3 text-emerald-200">
                    <QrCode className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Base Sepolia verification</p>
                    <p className="text-xs text-slate-400">Non-transferable proof anchored onchain</p>
                  </div>
                </div>

                {certificate?.blockchain.explorerUrl ? (
                  <a
                    href={certificate.blockchain.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    View on Base Sepolia <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    Explorer link will appear after blockchain confirmation.
                  </div>
                )}
              </div>

              <div className="surface-panel rounded-2xl p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">About this credential</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  ProofChain issues this certificate only after a project is completed and payment is released. The NFT is bound to the freelancer wallet and cannot be transferred.
                </p>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
                  Metadata and onchain proof are designed for portfolio sharing, verification, and reputation systems.
                </div>
              </div>

              <Link
                to="/freelancer/nft-certificates"
                className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Back to certificate list
              </Link>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
