import { BrowserProvider, Contract } from "ethers";

import { escrowAbi } from "./escrow-abi";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type Eip1193Error = Error & {
  code?: number | string;
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

const NETWORK_PARAMS_BY_CHAIN_ID: Record<number, Record<string, unknown>> = {
  84532: {
    chainId: "0x14a34",
    chainName: "Base Sepolia",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  },
};

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

const toHexChainId = (chainId: number) => `0x${chainId.toString(16)}`;

const getProviderErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const getProviderErrorCode = (error: unknown) => Number((error as Eip1193Error).code);

const getCurrentChainId = async (ethereum: EthereumProvider) => {
  const chainId = await ethereum.request({ method: "eth_chainId" });

  if (typeof chainId === "string") {
    return Number.parseInt(chainId, 16);
  }

  if (typeof chainId === "number") {
    return chainId;
  }

  throw new Error("Could not read the active wallet network.");
};

const switchEthereumChain = async (ethereum: EthereumProvider, expectedChainId: number) => {
  const chainId = toHexChainId(expectedChainId);

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    const errorCode = getProviderErrorCode(error);

    if (errorCode === 4001) {
      throw new Error(`Network switch was rejected. Switch MetaMask to chain ID ${expectedChainId} and try again.`);
    }

    if (errorCode !== 4902) {
      throw new Error(`Could not switch MetaMask to chain ID ${expectedChainId}: ${getProviderErrorMessage(error)}`);
    }

    const networkParams = NETWORK_PARAMS_BY_CHAIN_ID[expectedChainId];
    if (!networkParams) {
      throw new Error(`Wrong network. Add chain ID ${expectedChainId} to MetaMask and try again.`);
    }

    try {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [networkParams],
      });
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    } catch (addError) {
      const addErrorCode = getProviderErrorCode(addError);
      if (addErrorCode === 4001) {
        throw new Error(`Base Sepolia was not added. Approve the MetaMask prompt and try again.`);
      }

      throw new Error(`Could not add Base Sepolia to MetaMask: ${getProviderErrorMessage(addError)}`);
    }
  }
};

export const connectWallet = async (expectedChainIdOverride?: number | null) => {
  const ethereum = requireEthereumProvider();
  await ethereum.request({ method: "eth_requestAccounts" });

  const expectedChainId = expectedChainIdOverride === null ? null : expectedChainIdOverride ?? EXPECTED_CHAIN_ID;
  let chainId = await getCurrentChainId(ethereum);

  if (expectedChainId && chainId !== expectedChainId) {
    await switchEthereumChain(ethereum, expectedChainId);
    chainId = await getCurrentChainId(ethereum);

    if (chainId !== expectedChainId) {
      throw new Error(`Wallet is still on chain ID ${chainId}. Switch to chain ID ${expectedChainId} and try again.`);
    }
  }

  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address, chainId };
};

export const getEscrowContract = async () => {
  const { signer } = await connectWallet();
  return new Contract(requireEscrowAddress(), escrowAbi, signer);
};
