import { useEffect, useState } from "react";

const WALLET_ADDRESS_STORAGE_KEY = "proofchain_wallet_address";

export function shortenWalletAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function useWalletAddress() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const syncWalletAddress = () => {
      setWalletAddress(window.localStorage.getItem(WALLET_ADDRESS_STORAGE_KEY));
    };

    syncWalletAddress();
    window.addEventListener("storage", syncWalletAddress);

    return () => {
      window.removeEventListener("storage", syncWalletAddress);
    };
  }, []);

  return walletAddress;
}
