import { getAccessToken } from "@/lib/messaging";

export const adminApiBase = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000").replace(/\/+$/, "");

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const token = getAccessToken();

  if (!adminApiBase || !token) {
    return null;
  }

  const response = await fetch(`${adminApiBase}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return (payload?.data ?? payload) as T;
}

export function adminMutation<T>(path: string, body?: unknown, method = "PATCH") {
  return adminFetch<T>(path, {
    method,
    body: typeof body === "undefined" ? undefined : JSON.stringify(body),
  });
}

export function shortAddress(value?: string | null) {
  if (!value) return "0x0000...0000";
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

export function formatCompactNumber(value?: number | null, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en", {
    notation: Math.abs(value ?? 0) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
    ...options,
  }).format(value ?? 0);
}

export function formatMoney(value?: number | null, currency = "mUSD") {
  return `${formatCompactNumber(value ?? 0, { maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
