/**
 * Authentication Flow Test - TEST FLOW 1
 * Tests: Wallet login, JWT generation, protected routes, role-based access
 */

import crypto from 'crypto'
import { ethers } from 'ethers'

const BASE_URL = 'http://localhost:5000'

interface TestResult {
  name: string
  passed: boolean
  error?: string
  data?: unknown
}

const results: TestResult[] = []

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ name, passed: true })
    console.log(`✅ ${name}`)
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    })
    console.log(`❌ ${name}`)
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function request(endpoint: string, method = 'POST', body?: unknown, token?: string) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`${response.status}: ${data.message || response.statusText}`)
  }

  // Some endpoints return { success, data: {...} }, others return { success, message: "..." }
  return data.data ?? data
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════')
  console.log('🧪 AUTHENTICATION FLOW TEST (TEST FLOW 1)')
  console.log('═══════════════════════════════════════════\n')

  // Create a test wallet
  const testWallet = ethers.Wallet.createRandom()
  const walletAddress = testWallet.address
  console.log(`📱 Test Wallet: ${walletAddress}\n`)

  let nonce: string
  let accessToken: string
  let refreshToken: string
  let userId: string

  // TEST 1: Request Nonce
  await test('1. Request nonce for wallet', async () => {
    const result = await request('/api/auth/nonce', 'POST', { walletAddress })

    if (!result.nonce) throw new Error('No nonce returned')
    if (!result.expiresAt) throw new Error('No expiresAt returned')

    nonce = result.nonce
    console.log(`   Nonce: ${nonce}`)
  })

  // TEST 2: Sign the nonce with wallet
  let signature: string
  await test('2. Sign nonce with wallet', async () => {
    const message = `ProofChain Authentication Nonce: ${nonce}`
    signature = await testWallet.signMessage(message)

    if (!signature) throw new Error('Failed to sign message')
    console.log(`   Signature: ${signature.substring(0, 20)}...`)
  })

  // TEST 3: Verify signature (wallet login)
  await test('3. Verify signature & login with wallet', async () => {
    const result = await request('/api/auth/verify', 'POST', {
      walletAddress,
      signature,
      role: 'FREELANCER',
    })

    if (!result.accessToken) throw new Error('No accessToken returned')
    if (!result.refreshToken) throw new Error('No refreshToken returned')
    if (!result.user) throw new Error('No user returned')

    accessToken = result.accessToken
    refreshToken = result.refreshToken
    userId = result.user.id

    console.log(`   ✔ User ID: ${userId}`)
    console.log(`   ✔ Access Token: ${accessToken.substring(0, 30)}...`)
    console.log(`   ✔ Refresh Token: ${refreshToken.substring(0, 30)}...`)
  })

  // TEST 4: Verify JWT contains correct claims
  await test('4. Verify JWT payload & claims', async () => {
    const parts = accessToken.split('.')
    if (parts.length !== 3) throw new Error('Invalid JWT format')

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())

    if (payload.userId !== userId) throw new Error('JWT userId mismatch')
    if (payload.walletAddress !== walletAddress) throw new Error('JWT walletAddress mismatch')
    if (payload.role !== 'FREELANCER') throw new Error('JWT role mismatch')
    if (!payload.iat || !payload.exp) throw new Error('JWT missing iat/exp')

    console.log(`   ✔ Payload:`, {
      userId: payload.userId,
      walletAddress: payload.walletAddress,
      role: payload.role,
      expiresIn: `${(payload.exp - payload.iat)}s`,
    })
  })

  // TEST 5: Access protected route with valid token
  await test('5. Access protected route with valid token (/me)', async () => {
    const result = await request('/api/auth/me', 'GET', undefined, accessToken)

    if (!result.id) throw new Error('No id in user object')
    if (result.walletAddress !== walletAddress) throw new Error('walletAddress mismatch')

    console.log(`   ✔ User retrieved: ${result.username || result.walletAddress}`)
  })

  // TEST 6: Access protected route without token (should fail)
  await test('6. Reject request without token', async () => {
    try {
      await request('/api/auth/me', 'GET', undefined, undefined)
      throw new Error('Should have been rejected')
    } catch (error) {
      if (error instanceof Error && error.message.includes('401')) {
        return // Expected
      }
      throw error
    }
  })

  // TEST 7: Access protected route with invalid token (should fail)
  await test('7. Reject request with invalid token', async () => {
    try {
      await request('/api/auth/me', 'GET', undefined, 'invalid.token.here')
      throw new Error('Should have been rejected')
    } catch (error) {
      if (error instanceof Error && error.message.includes('401')) {
        return // Expected
      }
      throw error
    }
  })

  // TEST 8: Get sessions list
  await test('8. Get active sessions', async () => {
    const result = await request('/api/auth/sessions', 'GET', undefined, accessToken)

    if (!Array.isArray(result)) throw new Error('Sessions should be an array')
    if (result.length === 0) throw new Error('Should have at least one session')

    console.log(`   ✔ Active sessions: ${result.length}`)
  })

  // TEST 9: Test role-based access - FREELANCER route (should succeed)
  await test('9. Access FREELANCER-only route', async () => {
    const result = await request('/api/auth/freelancer-only', 'GET', undefined, accessToken)

    if (!result.message || !result.message.includes('Freelancer')) {
      throw new Error('Expected freelancer-only success message')
    }

    console.log(`   ✔ ${result.message}`)
  })

  // TEST 10: Refresh token to get new access token
  await test('10. Refresh access token', async () => {
    const result = await request('/api/auth/refresh', 'POST', {
      refreshToken,
    })

    if (!result.accessToken) throw new Error('No new accessToken returned')
    if (!result.user) throw new Error('No user data returned')

    // New token is valid (timing might be the same, so just verify it's a valid JWT)
    const parts = result.accessToken.split('.')
    if (parts.length !== 3) throw new Error('Invalid JWT format in refreshed token')

    accessToken = result.accessToken
    console.log(`   ✔ New Access Token: ${accessToken.substring(0, 30)}...`)
  })

  // TEST 11: Test role-based access - ADMIN route (should fail)
  await test('11. Reject ADMIN-only route for FREELANCER user', async () => {
    try {
      await request('/api/auth/admin-only', 'GET', undefined, accessToken)
      throw new Error('Should have been rejected (forbidden)')
    } catch (error) {
      if (error instanceof Error && error.message.includes('403')) {
        return // Expected
      }
      throw error
    }
  })

  // TEST 12: Logout
  await test('12. Logout (revoke refresh token)', async () => {
    const result = await request('/api/auth/logout', 'POST', { refreshToken })

    if (!result.success) throw new Error('Logout should return success: true')

    console.log(`   ✔ Logout successful`)
  })

  // TEST 13: Verify refresh token is invalid after logout
  await test('13. Verify refresh token is invalid after logout', async () => {
    try {
      await request('/api/auth/refresh', 'POST', { refreshToken })
      throw new Error('Should have been rejected')
    } catch (error) {
      if (error instanceof Error && error.message.includes('400')) {
        return // Expected
      }
      throw error
    }
  })

  // Print summary
  console.log('\n═══════════════════════════════════════════')
  console.log('📊 TEST SUMMARY')
  console.log('═══════════════════════════════════════════\n')

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const total = results.length

  results.forEach((r) => {
    const icon = r.passed ? '✅' : '❌'
    console.log(`${icon} ${r.name}`)
  })

  console.log(`\n📈 Results: ${passed}/${total} passed`)

  if (failed > 0) {
    console.log(`\n⚠️  ${failed} test(s) failed:`)
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`   - ${r.name}: ${r.error}`)
    })
    process.exit(1)
  } else {
    console.log('\n🎉 All tests passed!')
    process.exit(0)
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
