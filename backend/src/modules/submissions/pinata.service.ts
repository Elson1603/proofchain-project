import axios from 'axios'
import FormData from 'form-data'

const DEFAULT_GATEWAY = 'https://gateway.pinata.cloud/ipfs'
const PINATA_ENDPOINT = 'https://api.pinata.cloud/pinning/pinFileToIPFS'

type PinataUploadResult = {
  cid: string
  size?: number
}

const trimEnv = (value?: string) => (value ? value.trim() : undefined)

export const pinataService = {
  getGatewayBase(): string {
    const gateway = trimEnv(process.env.PINATA_GATEWAY_URL) || DEFAULT_GATEWAY
    return gateway.replace(/\/+$/, '')
  },

  buildGatewayUrl(cid: string): string {
    return `${this.getGatewayBase()}/${cid}`
  },

  async uploadFile(file: Express.Multer.File): Promise<PinataUploadResult> {
    const pinataJwt = trimEnv(process.env.PINATA_JWT_TOKEN)
    const pinataApiKey = trimEnv(process.env.PINATA_API_KEY)
    const pinataSecret = trimEnv(process.env.PINATA_SECRET_API_KEY)

    if (!pinataJwt && !(pinataApiKey && pinataSecret)) {
      throw new Error('Pinata credentials are missing')
    }

    const data = new FormData()
    data.append('file', file.buffer, {
      filename: file.originalname || 'upload',
      contentType: file.mimetype || 'application/octet-stream',
    })

    const headers: Record<string, string> = {
      ...data.getHeaders(),
    }

    if (pinataJwt) {
      headers.Authorization = `Bearer ${pinataJwt}`
    } else {
      headers.pinata_api_key = pinataApiKey as string
      headers.pinata_secret_api_key = pinataSecret as string
    }

    const response = await axios.post(PINATA_ENDPOINT, data, {
      headers,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    return {
      cid: response.data.IpfsHash,
      size: response.data.PinSize,
    }
  },
}
