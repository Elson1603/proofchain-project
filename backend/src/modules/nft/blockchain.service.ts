import { Contract, JsonRpcProvider, Wallet } from 'ethers'

const CERTIFICATE_ABI = [
  'function mintCertificate(address to, tuple(string freelancerName,address freelancerWallet,string projectTitle,string projectDescription,string projectCompletionProof,bool clientApprovalStatus,uint256 completionTimestamp,string paymentTransactionHash,string metadataURI,string[] skillTags,string platformName) input) external returns (uint256 tokenId)',
  'function tokenURI(uint256 tokenId) external view returns (string memory)',
  'function getCertificateData(uint256 tokenId) external view returns (tuple(string freelancerName,address freelancerWallet,string projectTitle,string projectDescription,string projectCompletionProof,bool clientApprovalStatus,uint256 completionTimestamp,string paymentTransactionHash,string metadataURI,uint256 mintTimestamp,string[] skillTags,string platformName))',
  'function verifyCertificate(uint256 tokenId) external view returns (bool valid,address owner,string memory metadataURI)',
] as const

type MintArgs = {
  to: string
  metadataURI: string
  certificate: {
    freelancerName: string
    freelancerWallet: string
    projectTitle: string
    projectDescription: string
    projectCompletionProof: string
    clientApprovalStatus: boolean
    completionTimestamp: bigint
    paymentTransactionHash: string
    metadataURI: string
    skillTags: string[]
    platformName: string
  }
}

let provider: JsonRpcProvider | null = null

function getProvider() {
  if (provider) {
    return provider
  }

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL
  if (!rpcUrl) {
    throw new Error('BASE_SEPOLIA_RPC_URL is required')
  }

  provider = new JsonRpcProvider(rpcUrl)
  return provider
}

function getContractAddress() {
  const address = process.env.PROOFCHAIN_CERTIFICATE_CONTRACT_ADDRESS
  if (!address) {
    throw new Error('PROOFCHAIN_CERTIFICATE_CONTRACT_ADDRESS is required')
  }

  return address
}

function getSigner() {
  const privateKey = process.env.PROOFCHAIN_CERTIFICATE_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('PROOFCHAIN_CERTIFICATE_PRIVATE_KEY is required')
  }

  return new Wallet(privateKey, getProvider())
}

function getContract() {
  return new Contract(getContractAddress(), CERTIFICATE_ABI, getSigner())
}

export const blockchainService = {
  getExplorerUrl(txHash?: string | null) {
    if (!txHash) {
      return undefined
    }

    const baseUrl = process.env.BASE_SEPOLIA_EXPLORER_URL || 'https://sepolia.basescan.org'
    return `${baseUrl.replace(/\/$/, '')}/tx/${txHash}`
  },

  async mintCertificate(args: MintArgs) {
    const contract = getContract()
    const tx = await contract.mintCertificate(args.to, {
      freelancerName: args.certificate.freelancerName,
      freelancerWallet: args.certificate.freelancerWallet,
      projectTitle: args.certificate.projectTitle,
      projectDescription: args.certificate.projectDescription,
      projectCompletionProof: args.certificate.projectCompletionProof,
      clientApprovalStatus: args.certificate.clientApprovalStatus,
      completionTimestamp: args.certificate.completionTimestamp,
      paymentTransactionHash: args.certificate.paymentTransactionHash,
      metadataURI: args.certificate.metadataURI,
      skillTags: args.certificate.skillTags,
      platformName: args.certificate.platformName,
    })

    const receipt = await tx.wait()

    return {
      txHash: receipt?.hash ?? tx.hash,
      blockNumber: receipt?.blockNumber ?? null,
      gasUsed: receipt?.gasUsed ? Number(receipt.gasUsed) : null,
      tokenId: null,
      explorerUrl: this.getExplorerUrl(receipt?.hash ?? tx.hash),
    }
  },

  async verifyCertificate(tokenId: number) {
    const contract = getContract()
    const [valid, owner, metadataURI] = (await contract.verifyCertificate(tokenId)) as [boolean, string, string]

    return {
      valid,
      owner,
      metadataURI,
    }
  },

  async getCertificateData(tokenId: number) {
    const contract = getContract()
    return contract.getCertificateData(tokenId)
  },

  async getTokenURI(tokenId: number) {
    const contract = getContract()
    return contract.tokenURI(tokenId)
  },
}