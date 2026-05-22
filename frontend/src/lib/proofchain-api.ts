export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000").replace(/\/+$/, "");

export type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; message: string; errors?: unknown };

export type ApiUser = {
  id: string;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
  walletAddress?: string | null;
  avatarUrl?: string | null;
  profileImage?: string | null;
  role?: string | null;
  bio?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  skills?: string[];
  reputationScore?: number;
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ApiMilestone = {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  status: string;
  projectId: string;
  createdAt?: string;
  submissions?: ApiSubmission[];
  payments?: ApiPayment[];
};

export type ApiProject = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  budget?: number | null;
  deadline?: string | null;
  ownerId: string;
  freelancerId?: string | null;
  invitedFreelancerId?: string | null;
  createdAt: string;
  updatedAt?: string;
  owner?: ApiUser | null;
  freelancer?: ApiUser | null;
  invitedFreelancer?: ApiUser | null;
  milestones?: ApiMilestone[];
  payments?: ApiPayment[];
  nftCertificates?: ApiNftCertificate[];
  disputes?: Array<{ id: string; status: string }>;
};

export type ApiSubmission = {
  id: string;
  milestoneId: string;
  submittedById: string;
  githubLink?: string | null;
  demoLink?: string | null;
  remarks?: string | null;
  ipfsCid?: string | null;
  gatewayUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  version?: number;
  createdAt: string;
  updatedAt?: string;
  submittedBy?: ApiUser | null;
  milestone?: ApiMilestone & { project?: ApiProject | null };
};

export type ApiPayment = {
  id: string;
  projectId: string;
  milestoneId?: string | null;
  submissionId?: string | null;
  payerId: string;
  payeeId: string;
  type: string;
  status: string;
  amount: number;
  currency?: string | null;
  escrowAddress?: string | null;
  releasedAt?: string | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  project?: ApiProject | null;
  payer?: ApiUser | null;
  payee?: ApiUser | null;
  milestone?: ApiMilestone | null;
  submission?: ApiSubmission | null;
  transactions?: ApiTransaction[];
};

export type ApiTransaction = {
  id: string;
  txHash?: string | null;
  type: string;
  status: string;
  chainId: number;
  fromAddress?: string | null;
  toAddress?: string | null;
  amount?: number | null;
  currency?: string | null;
  gasQuote?: number | null;
  gasQuoteCurrency?: string | null;
  blockNumber?: number | null;
  createdAt: string;
  confirmedAt?: string | null;
};

export type ApiNftCertificate = {
  id: string;
  tokenId: number;
  userId?: string;
  projectId?: string;
  freelancerWallet: string;
  metadataURI: string;
  metadata?: Record<string, unknown>;
  transactionHash?: string | null;
  certificateStatus: string;
  mintedAt?: string | null;
  createdAt: string;
  project?: ApiProject | null;
  user?: ApiUser | null;
};

export type CreateProjectInput = {
  title: string;
  description?: string;
  budget: number;
  deadline?: string;
  ownerId: string;
  invitedFreelancerId?: string;
  status?: string;
  milestones?: Array<{
    title: string;
    description?: string;
    amount: number;
  }>;
};

type AuthRefreshPayload = {
  accessToken?: string;
  user?: ApiUser;
};

export const AUTH_STORAGE_EVENT = "proofchain:auth-storage";
export const WALLET_ADDRESS_STORAGE_KEY = "proofchain_wallet_address";

function notifyAuthStorageChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

export function getStoredAccessToken() {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem("proofchain_access_token") ??
    window.localStorage.getItem("accessToken") ??
    window.localStorage.getItem("token")
  );
}

export function getStoredRefreshToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("proofchain_refresh_token") ?? window.localStorage.getItem("refreshToken");
}

export function getStoredWalletAddress() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(WALLET_ADDRESS_STORAGE_KEY);
}

export function storeAccessToken(accessToken: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("proofchain_access_token", accessToken);
  window.localStorage.setItem("accessToken", accessToken);
  window.localStorage.setItem("token", accessToken);
  notifyAuthStorageChanged();
}

export function storeRefreshToken(refreshToken: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("proofchain_refresh_token", refreshToken);
  window.localStorage.setItem("refreshToken", refreshToken);
  notifyAuthStorageChanged();
}

export function storeWalletAddress(walletAddress: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WALLET_ADDRESS_STORAGE_KEY, walletAddress);
  notifyAuthStorageChanged();
}

export function clearStoredAuthTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("proofchain_access_token");
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("proofchain_refresh_token");
  window.localStorage.removeItem("refreshToken");
  window.localStorage.removeItem(WALLET_ADDRESS_STORAGE_KEY);
  notifyAuthStorageChanged();
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken() {
  if (!API_BASE_URL) return null;

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) {
          clearStoredAuthTokens();
          return null;
        }

        const payload = await response.json();
        const data = (payload && typeof payload === "object" && "success" in payload ? payload.data : payload) as AuthRefreshPayload | null;
        const accessToken = data?.accessToken;

        if (!accessToken) {
          clearStoredAuthTokens();
          return null;
        }

        storeAccessToken(accessToken);
        return accessToken;
      })
      .catch(() => {
        clearStoredAuthTokens();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function buildRequestHeaders(init: RequestInit, token?: string | null) {
  return {
    ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }),
    ...(init.headers ?? {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export async function authenticatedFetch(path: string, init: RequestInit = {}, options: { auth?: boolean } = {}) {
  if (!API_BASE_URL) return null;

  let token = getStoredAccessToken();
  if (options.auth && !token) {
    token = await refreshAccessToken();
    if (!token) return null;
  }

  const send = (accessToken?: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: buildRequestHeaders(init, accessToken),
    });

  let response = await send(token);

  if (response.status === 401) {
    token = await refreshAccessToken();
    if (token) {
      response = await send(token);
    }
  }

  return response;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, options: { auth?: boolean } = {}) {
  let response = await authenticatedFetch(path, init, options);

  if (!response && options.auth) {
    const token = await refreshAccessToken();
    if (token) {
      response = await authenticatedFetch(path, init, options);
    }
  }

  if (!response) return null;

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return ((payload && typeof payload === "object" && "success" in payload ? payload.data : payload) ?? null) as T | null;
}

export function fetchCurrentUser() {
  return apiFetch<ApiUser>("/api/auth/me", {}, { auth: true });
}

export function fetchMyProfile() {
  return apiFetch<ApiUser>("/api/profile/me", {}, { auth: true });
}

export function updateMyProfile(input: Partial<ApiUser>) {
  return apiFetch<ApiUser>(
    "/api/profile/me",
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    { auth: true },
  );
}

export function fetchProjects(filters: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<ApiProject[]>(`/api/projects${suffix}`);
}

export function createProject(input: CreateProjectInput) {
  return apiFetch<ApiProject>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function acceptProject(projectId: string, freelancerId: string) {
  return apiFetch<ApiProject>(`/api/projects/${projectId}/accept`, {
    method: "POST",
    body: JSON.stringify({ freelancerId }),
  });
}

export function fetchPayments(filters: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<ApiPayment[]>(`/api/payments${suffix}`);
}

export function fetchSubmissions(filters: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<ApiSubmission[]>(`/api/submissions${suffix}`);
}

export function fetchNftCertificates(wallet?: string | null) {
  if (wallet) {
    return apiFetch<ApiNftCertificate[]>(`/api/nft/user/${encodeURIComponent(wallet)}`);
  }
  return apiFetch<ApiNftCertificate[]>("/api/nft");
}

export function shortAddress(value?: string | null) {
  if (!value) return "Not available";
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

export function shortHash(value?: string | null) {
  if (!value) return "Pending";
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

export function formatMoney(value?: number | null, currency = "mUSD") {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value ?? 0)} ${currency}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function userDisplayName(user?: ApiUser | null) {
  if (!user) return "Unknown user";
  return user.fullName || user.username || shortAddress(user.walletAddress);
}

export function normalizeStatus(status?: string | null) {
  return (status ?? "unknown").replace(/_/g, " ");
}
