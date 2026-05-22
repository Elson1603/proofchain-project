import { useEffect, useState } from "react";
import {
  AUTH_STORAGE_EVENT,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredWalletAddress,
} from "@/lib/proofchain-api";

export function shortenWalletAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function useWalletAddress() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const syncWalletAddress = () => {
      const hasSession = Boolean(getStoredAccessToken() || getStoredRefreshToken());
      setWalletAddress(hasSession ? getStoredWalletAddress() : null);
    };

    syncWalletAddress();
    window.addEventListener("storage", syncWalletAddress);
    window.addEventListener(AUTH_STORAGE_EVENT, syncWalletAddress);

    return () => {
      window.removeEventListener("storage", syncWalletAddress);
      window.removeEventListener(AUTH_STORAGE_EVENT, syncWalletAddress);
    };
  }, []);

  return walletAddress;
}
