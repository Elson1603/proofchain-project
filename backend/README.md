# ProofChain Backend Database

This backend folder contains a production-ready PostgreSQL foundation for the ProofChain app.

## What is included

- `db/schema.sql` creates the database extensions, enums, tables, constraints, foreign keys, indexes, and update triggers.
- `db/queries.sql` contains optimized query patterns for the frontend screens.
- `.env.example` shows the connection variables your backend API should use.

## PostgreSQL setup on Windows

1. Install PostgreSQL 16 or newer from:
   `https://www.postgresql.org/download/windows/`

2. During installation, keep note of the password you set for the default `postgres` superuser.

3. Open **SQL Shell (psql)** or a terminal where `psql` is available.

4. Connect as the admin user:

   ```powershell
   psql -U postgres
   ```

5. Create the database and application user:

   ```sql
   CREATE DATABASE proofchain;
   CREATE USER proofchain_app WITH PASSWORD 'change_me';
   GRANT CONNECT ON DATABASE proofchain TO proofchain_app;
   ```

6. Connect to the new database:

   ```sql
   \c proofchain
   ```

7. Allow the app user to use and create objects in the public schema:

   ```sql
   GRANT USAGE, CREATE ON SCHEMA public TO proofchain_app;
   ```

8. From the project root, run the schema:

   ```powershell
   psql -U proofchain_app -d proofchain -f backend/db/schema.sql
   ```

9. Confirm the tables were created:

   ```powershell
   psql -U proofchain_app -d proofchain -c "\dt"
   ```

10. Copy the environment template:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```

11. Edit `backend/.env` and replace `change_me` with your real database password.

12. For a one-time PowerShell connection test, set `DATABASE_URL` and query the database:

   ```powershell
   $env:DATABASE_URL="postgresql://proofchain_app:change_me@localhost:5432/proofchain"
   psql "$env:DATABASE_URL" -c "\dt"
   ```

13. Optional: open pgAdmin, register the local server, then browse:

   ```text
   Servers > PostgreSQL > Databases > proofchain > Schemas > public > Tables
   ```

## Recommended backend API mapping

- `users`: wallet authentication, client/freelancer/admin profiles.
- `projects`: top-level freelance contract between a client and optional assigned freelancer.
- `milestones`: payable units inside a project.
- `submissions`: freelancer work uploads/proof hashes for milestone approval.
- `payments`: escrow deposits, releases, refunds, and fee records.
- `nft_certificates`: soulbound proof-of-work certificate records.
- `transactions`: blockchain or relayer execution log.
- `notifications`: user-facing activity feed and unread counts.
- `chats`, `chat_participants`, `chat_messages`: project communication.
- `disputes`: formal issue tracking for projects, milestones, submissions, and payments.

For a deeper table-by-table rationale, read `db/README.md`.

## Migration workflow

For a fresh local database, run:

```powershell
psql -U proofchain_app -d proofchain -f backend/db/schema.sql
```

For production, use a migration tool such as Prisma Migrate, Drizzle Kit, Knex, node-pg-migrate, Flyway, or Liquibase. Keep this SQL as the source design and split future changes into timestamped migration files.

## Query performance notes

The schema includes indexes for the common screens:

- Freelancer dashboard: active projects, recent transactions, certificate counts.
- Client dashboard: posted projects and pending submissions.
- Approval workflow: pending/reviewed milestone submissions.
- Earnings: payments by freelancer and status.
- Project details: milestones, chat, files/proofs, transactions.
- Notifications: unread feed by user.

Read `db/queries.sql` for copy-ready query patterns.
