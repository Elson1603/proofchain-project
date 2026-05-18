import { BrowserProvider, Contract } from "ethers";

import { escrowAbi } from "./escrow-abi";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export const ESCROW_CONTRACT_ADDRESS = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS;
const EXPECTED_CHAIN_ID = import.meta.env.VITE_CHAIN_ID
  ? Number(import.meta.env.VITE_CHAIN_ID)
  : null;

export const requireEscrowAddress = (): `0x${string}` => {
  if (!ESCROW_CONTRACT_ADDRESS) {
    throw new Error("Missing VITE_ESCROW_CONTRACT_ADDRESS in frontend/.env");
  }

  return ESCROW_CONTRACT_ADDRESS as `0x${string}`;
};

const requireEthereumProvider = (): EthereumProvider => {
  if (!window.ethereum) {
    throw new Error("MetaMask not detected. Install the browser extension first.");
  }

  return window.ethereum;
};

export const connectWallet = async (expectedChainIdOverride?: number | null) => {
  const provider = new BrowserProvider(requireEthereumProvider());
  await provider.send("eth_requestAccounts", []);

  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  const expectedChainId = expectedChainIdOverride === null ? null : expectedChainIdOverride ?? EXPECTED_CHAIN_ID;

  if (expectedChainId && chainId !== expectedChainId) {
    throw new Error(`Wrong network. Switch to chain ID ${expectedChainId}.`);
  }

  return { provider, signer, address, chainId };
};

export const getEscrowContract = async () => {
  const { signer } = await connectWallet();
  return new Contract(requireEscrowAddress(), escrowAbi, signer);
};
