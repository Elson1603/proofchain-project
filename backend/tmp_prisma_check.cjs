require('dotenv').config()

const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
})

const prisma = new PrismaClient({ adapter })

const milestoneId = process.env.MILESTONE_ID
const userId = process.env.USER_ID

if (!milestoneId || !userId) {
  console.error('Missing env vars: MILESTONE_ID and/or USER_ID')
  process.exitCode = 1
} else {
  ;(async () => {
    const [milestone, user] = await Promise.all([
      prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: { id: true, projectId: true, status: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, walletAddress: true, role: true },
      }),
    ])

    console.log('milestone', milestone)
    console.log('user', user)
  })()
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
