import { EventEmitter } from 'events'

export type NftBroadcastEvent = 'nft_mint_started' | 'nft_minted' | 'nft_failed' | 'certificate_verified'

export type NftBroadcastPayload = {
  userId?: string
  projectId?: string
  tokenId?: number
  certificateId?: string
  wallet?: string
  txHash?: string
  [key: string]: unknown
}

class NftEventBus extends EventEmitter {
  publish(event: NftBroadcastEvent, payload: NftBroadcastPayload) {
    this.emit(event, payload)
  }
}

export const nftEvents = new NftEventBus()