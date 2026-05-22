# ProofChain

ProofChain is a Web3 freelance collaboration platform for project-based client and freelancer workflows. It combines wallet authentication, milestone submissions, escrow-style payment tracking, Base Sepolia transaction monitoring, UGF gasless execution, NFT certificates, notifications, messaging, dispute flows, and an admin operations console.

## Project Structure

```text
proofchain-project/
  backend/    Node.js, Express, Prisma, PostgreSQL, Socket.io
  frontend/   React, TanStack Router/Start, Vite, Tailwind CSS, shadcn-style UI
```

## Main Features

- Wallet-based authentication for clients, freelancers, and admins
- Client project creation with milestones
- Freelancer project acceptance and work submission
- File submission with IPFS metadata support
- Client approval workflow for milestone review and payment release
- Project chat and notifications
- Light and dark mode
- Admin console for users, projects, disputes, transactions, NFTs, fraud alerts, analytics, and audit logs
- Blockchain indexing support for Base Sepolia escrow, payment, NFT, and UGF activity

## Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL 16 or newer
- MetaMask
- Base Sepolia test network
- Optional: Pinata/IPFS credentials, Base Sepolia RPC URL, deployed escrow and NFT contracts

## Environment Setup

Backend:

```powershell
cd backend
Copy-Item .env.example .env
```

Edit `backend/.env` and set at least:

```text
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/proofchain
JWT_ACCESS_SECRET=change_me
JWT_REFRESH_SECRET=change_me
BASE_SEPOLIA_RPC_URL=https://...
ESCROW_CONTRACT_ADDRESS=0x...
PROOFCHAIN_CERTIFICATE_CONTRACT_ADDRESS=0x...
```

Frontend:

Create `frontend/.env` if it does not exist:

```text
VITE_API_URL=http://localhost:5000
VITE_API_BASE_URL=http://localhost:5000
VITE_CHAIN_ID=84532
VITE_UGF_DEST_CHAIN_ID=84532
VITE_UGF_MODE=testnet
VITE_ESCROW_CONTRACT_ADDRESS=0x...
```

Do not commit real secrets.

## Install Dependencies

Backend:

```powershell
cd backend
npm install
```

Frontend:

```powershell
cd frontend
npm install
```

## Database Setup

From `backend/`:

```powershell
npx prisma generate
npx prisma migrate dev
```

For production migration deployment:

```powershell
npx prisma migrate deploy
npx prisma generate
```

The backend also includes deeper database notes in `backend/README.md` and `backend/db/README.md`.

## Run Locally

Start backend:

```powershell
cd backend
npm run dev
```

Default API URL:

```text
http://localhost:5000
```

Start frontend:

```powershell
cd frontend
npm run dev
```

Default frontend URL is usually:

```text
http://localhost:5173
```

If your dev server is configured for another port, use the port printed by Vite.

## Useful Routes

```text
/                         Landing page
/auth                     Wallet onboarding and role selection
/client/dashboard         Client workspace
/client/project-details   Client project records
/client/approval-workflow Client review and release workflow
/freelancer/dashboard     Freelancer workspace
/freelancer/projects      Accepted and available projects
/freelancer/submit-work   Deliverable upload
/messages                 Project chat
/admin                    Admin console
```

## Basic User Flow

1. Connect a wallet at `/auth`.
2. Choose `Client` or `Freelancer`.
3. Client creates a project with milestones.
4. Freelancer accepts the project from the freelancer projects page.
5. Freelancer submits deliverables from `/freelancer/submit-work`.
6. Client reviews the submission from `/client/approval-workflow`.
7. Client approves, releases payment, or raises a dispute.
8. Admins monitor activity from `/admin`.

## Escrow Notes

Backend project IDs are database UUIDs. They are not the same as escrow project IDs.

The `Project chain ID` used in the approval workflow comes from the deployed escrow contract after `createProjectEscrow(...)` emits `ProjectCreated`.

The milestone index is the milestone order inside a project:

```text
first milestone  -> 0
second milestone -> 1
third milestone  -> 2
```

If the approval page says the project is not linked on-chain yet, create or sync the escrow project before releasing payment.

## Admin Access

The admin panel is protected by admin roles. Supported admin roles include:

```text
ADMIN
SUPER_ADMIN
MODERATOR
SUPPORT_ADMIN
BLOCKCHAIN_ADMIN
```

Use an authenticated wallet/user that has one of these roles. Non-admin client or freelancer accounts should see access denied.

## Quality Checks

Backend:

```powershell
cd backend
npm run build
npm test
```

Frontend:

```powershell
cd frontend
npm run build
```

## Troubleshooting

- If the frontend cannot reach the API, check `VITE_API_URL` and `VITE_API_BASE_URL`.
- If auth fails, check JWT secrets and that the backend is running.
- If Prisma fails, check `DATABASE_URL`, then run `npx prisma validate`.
- If MetaMask transaction prompts fail, switch to Base Sepolia chain ID `84532`.
- If approval needs `Project chain ID`, make sure the escrow project was created on-chain first.

