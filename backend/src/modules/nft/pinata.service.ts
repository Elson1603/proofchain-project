import { CertificateMetadata } from './types'

type PinataUploadResult = {
  IpfsHash: string
}

function getPinataHeaders() {
  const jwt = process.env.PINATA_JWT_TOKEN?.trim()
  if (jwt) {
    return { Authorization: `Bearer ${jwt}` }
  }

  const apiKey = process.env.PINATA_API_KEY?.trim()
  const secret = process.env.PINATA_SECRET_API_KEY?.trim()
  if (!apiKey || !secret) {
    throw new Error('Pinata credentials are required')
  }

  return {
    pinata_api_key: apiKey,
    pinata_secret_api_key: secret,
  }
}

export const pinataService = {
  async uploadJson(metadata: CertificateMetadata) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    Object.assign(headers, getPinataHeaders())

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: metadata.name,
        },
        pinataOptions: {
          cidVersion: 1,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Pinata upload failed with status ${response.status}`)
    }

    const body = (await response.json()) as PinataUploadResult
    if (!body.IpfsHash) {
      throw new Error('Pinata did not return an IPFS hash')
    }

    return {
      cid: body.IpfsHash,
      uri: `ipfs://${body.IpfsHash}`,
      gatewayUrl: `${process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs'}/${body.IpfsHash}`,
    }
  },
}