import { Contract, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers'

const proofAbi = ['function storeMessageProof(bytes32 messageHash) public']

export function buildMessageHash(input: {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: Date
}) {
  return keccak256(
    toUtf8Bytes(
      JSON.stringify({
        id: input.id,
        conversationId: input.conversationId,
        senderId: input.senderId,
        content: input.content,
        createdAt: input.createdAt.toISOString(),
      }),
    ),
  )
}

export async function submitMessageProof(messageHash: string) {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL
  const privateKey = process.env.MESSAGE_PROOF_PRIVATE_KEY
  const contractAddress = process.env.MESSAGE_PROOF_CONTRACT_ADDRESS

  if (!rpcUrl || !privateKey || !contractAddress) {
    return null
  }

  const provider = new JsonRpcProvider(rpcUrl)
  const wallet = new Wallet(privateKey, provider)
  const contract = new Contract(contractAddress, proofAbi, wallet)
  const tx = await contract.storeMessageProof(messageHash)
  const receipt = await tx.wait(1)

  return receipt?.hash ?? tx.hash
}
