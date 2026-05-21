export const ESCROW_INDEXER_ABI = [
  'event ProjectCreated(uint256 indexed projectId, address indexed client, address indexed freelancer, uint256 totalBudget)',
  'event FundsDeposited(uint256 indexed projectId, uint256 amount)',
  'event MilestoneApproved(uint256 indexed projectId, uint256 indexed milestoneIndex)',
  'event PaymentReleased(uint256 indexed projectId, uint256 indexed milestoneIndex, uint256 amount)',
  'event DisputeRaised(uint256 indexed projectId, address raisedBy)',
  'event DisputeResolved(uint256 indexed projectId, uint8 status)',
] as const

export const CERTIFICATE_INDEXER_ABI = [
  'event CertificateMinted(uint256 indexed tokenId, address indexed freelancerWallet, string metadataURI)',
] as const

export const DEFAULT_UGF_INDEXER_ABI = [
  'event ExecutionRequested(bytes32 indexed requestId, address indexed sender, address indexed target, bytes data)',
  'event ExecutionSucceeded(bytes32 indexed requestId, address indexed target, bytes32 txHash)',
  'event ExecutionFailed(bytes32 indexed requestId, address indexed target, string reason)',
  'event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)',
] as const
