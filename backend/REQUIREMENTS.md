# Backend Requirements

## Runtime

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 16 or newer

## Core Stack

- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT
- ethers.js
- Zod
- Helmet
- Morgan
- express-rate-limit

## Required Environment Variables

Create `backend/.env` from `backend/.env.example` and set:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/proofchain_db
PORT=5000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=replace_with_a_long_random_access_secret
JWT_REFRESH_SECRET=replace_with_a_different_long_random_refresh_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
NOTIFICATIONS_EMAIL_ENABLED=true
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=notifications@yourdomain.com
RESEND_FROM_NAME=ProofChain
APP_BASE_URL=https://app.yourdomain.com
NOTIFICATIONS_ENABLE_REMINDERS=true
NOTIFICATIONS_REMINDER_INTERVAL_MS=21600000
NOTIFICATIONS_APPROVAL_REMINDER_AFTER_HOURS=24
NOTIFICATIONS_DEADLINE_WINDOW_HOURS=48
```

Use long random values for `JWT_SECRET` and `JWT_REFRESH_SECRET` in production.

## Install

```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate dev
```

## Development

```powershell
npm run dev
```

## Verification

```powershell
npm run typecheck
npx prisma validate
```

## Notes

- Do not commit `.env`.
- Prisma migrations should be committed.
- `node_modules`, build output, logs, and generated clients are ignored by `.gitignore`.
