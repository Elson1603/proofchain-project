BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('client', 'freelancer', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE project_status AS ENUM ('draft', 'open', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE milestone_status AS ENUM ('pending', 'funded', 'submitted', 'in_review', 'approved', 'rejected', 'paid', 'disputed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE submission_status AS ENUM ('submitted', 'changes_requested', 'approved', 'rejected', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'escrowed', 'released', 'refunded', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE payment_type AS ENUM ('escrow_deposit', 'milestone_release', 'refund', 'platform_fee');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE certificate_status AS ENUM ('queued', 'minting', 'minted', 'failed', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE transaction_status AS ENUM ('queued', 'submitted', 'confirmed', 'failed', 'replaced');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE transaction_type AS ENUM ('escrow_deposit', 'payment_release', 'refund', 'certificate_mint', 'certificate_revoke');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE notification_type AS ENUM ('project', 'milestone', 'submission', 'payment', 'certificate', 'transaction', 'chat', 'dispute', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE chat_status AS ENUM ('active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved_client', 'resolved_freelancer', 'split_resolution', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  email citext,
  display_name text NOT NULL,
  role user_role NOT NULL,
  status user_status NOT NULL DEFAULT 'active',
  avatar_url text,
  bio text,
  reputation_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (reputation_score >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_wallet_address_format CHECK (wallet_address ~* '^0x[0-9a-f]{40}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS users_wallet_address_lower_idx ON users (lower(wallet_address));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_role_status_idx ON users (role, status);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  freelancer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text,
  status project_status NOT NULL DEFAULT 'draft',
  budget_amount numeric(18,6) NOT NULL CHECK (budget_amount >= 0),
  currency text NOT NULL DEFAULT 'mUSD',
  escrow_contract_address text,
  chain_id integer,
  deadline_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_client_freelancer_different CHECK (freelancer_id IS NULL OR freelancer_id <> client_id),
  CONSTRAINT projects_escrow_address_format CHECK (escrow_contract_address IS NULL OR escrow_contract_address ~* '^0x[0-9a-f]{40}$')
);

CREATE INDEX IF NOT EXISTS projects_client_status_idx ON projects (client_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS projects_freelancer_status_idx ON projects (freelancer_id, status, updated_at DESC) WHERE freelancer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_status_deadline_idx ON projects (status, deadline_at);
CREATE INDEX IF NOT EXISTS projects_title_search_idx ON projects USING gin (to_tsvector('english', title || ' ' || description));

CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL CHECK (sequence_no > 0),
  title text NOT NULL,
  description text,
  status milestone_status NOT NULL DEFAULT 'pending',
  amount numeric(18,6) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'mUSD',
  due_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, sequence_no),
  UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS milestones_project_sequence_idx ON milestones (project_id, sequence_no);
CREATE INDEX IF NOT EXISTS milestones_project_status_idx ON milestones (project_id, status, due_at);
CREATE INDEX IF NOT EXISTS milestones_due_open_idx ON milestones (due_at) WHERE status IN ('pending', 'funded', 'submitted', 'in_review');

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL,
  submitted_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status submission_status NOT NULL DEFAULT 'submitted',
  title text NOT NULL,
  notes text,
  deliverable_url text,
  proof_hash text NOT NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (milestone_id, project_id) REFERENCES milestones(id, project_id) ON DELETE CASCADE,
  UNIQUE (id, project_id),
  UNIQUE (id, milestone_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS submissions_proof_hash_idx ON submissions (proof_hash);
CREATE INDEX IF NOT EXISTS submissions_project_status_idx ON submissions (project_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS submissions_milestone_created_idx ON submissions (milestone_id, created_at DESC);
CREATE INDEX IF NOT EXISTS submissions_reviewer_status_idx ON submissions (reviewed_by, status) WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS submissions_pending_review_idx ON submissions (project_id, created_at DESC) WHERE status = 'submitted';

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  milestone_id uuid,
  submission_id uuid,
  payer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payee_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type payment_type NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  amount numeric(18,6) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'mUSD',
  escrow_address text,
  released_at timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_payer_payee_different CHECK (payer_id <> payee_id),
  CONSTRAINT payments_escrow_address_format CHECK (escrow_address IS NULL OR escrow_address ~* '^0x[0-9a-f]{40}$'),
  FOREIGN KEY (milestone_id, project_id) REFERENCES milestones(id, project_id) ON DELETE RESTRICT,
  FOREIGN KEY (submission_id, project_id) REFERENCES submissions(id, project_id) ON DELETE RESTRICT,
  UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS payments_project_status_idx ON payments (project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_payee_status_idx ON payments (payee_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_payer_status_idx ON payments (payer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_milestone_type_idx ON payments (milestone_id, type) WHERE milestone_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_release_queue_idx ON payments (created_at) WHERE status IN ('pending', 'escrowed');

CREATE TABLE IF NOT EXISTS nft_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  milestone_id uuid NOT NULL,
  submission_id uuid NOT NULL,
  freelancer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status certificate_status NOT NULL DEFAULT 'queued',
  contract_address text,
  token_id numeric(78,0),
  chain_id integer,
  metadata_uri text,
  metadata_hash text,
  proof_hash text NOT NULL,
  minted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id),
  UNIQUE (chain_id, contract_address, token_id),
  CONSTRAINT nft_certificates_contract_address_format CHECK (contract_address IS NULL OR contract_address ~* '^0x[0-9a-f]{40}$'),
  FOREIGN KEY (milestone_id, project_id) REFERENCES milestones(id, project_id) ON DELETE RESTRICT,
  FOREIGN KEY (submission_id, project_id) REFERENCES submissions(id, project_id) ON DELETE RESTRICT,
  FOREIGN KEY (submission_id, milestone_id) REFERENCES submissions(id, milestone_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS nft_certificates_freelancer_status_idx ON nft_certificates (freelancer_id, status, minted_at DESC);
CREATE INDEX IF NOT EXISTS nft_certificates_project_idx ON nft_certificates (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS nft_certificates_proof_hash_idx ON nft_certificates (proof_hash);
CREATE INDEX IF NOT EXISTS nft_certificates_mint_queue_idx ON nft_certificates (created_at) WHERE status IN ('queued', 'minting');

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  nft_certificate_id uuid REFERENCES nft_certificates(id) ON DELETE SET NULL,
  initiated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'queued',
  chain_id integer NOT NULL,
  tx_hash text,
  relayer_request_id text,
  from_address text,
  to_address text,
  amount numeric(18,6),
  currency text,
  gas_used numeric(30,0),
  gas_quote numeric(18,6),
  gas_quote_currency text,
  block_number bigint,
  error_message text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transactions_tx_hash_format CHECK (tx_hash IS NULL OR tx_hash ~* '^0x[0-9a-f]{64}$'),
  CONSTRAINT transactions_from_address_format CHECK (from_address IS NULL OR from_address ~* '^0x[0-9a-f]{40}$'),
  CONSTRAINT transactions_to_address_format CHECK (to_address IS NULL OR to_address ~* '^0x[0-9a-f]{40}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_chain_tx_hash_idx ON transactions (chain_id, lower(tx_hash)) WHERE tx_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_relayer_request_idx ON transactions (relayer_request_id) WHERE relayer_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_project_created_idx ON transactions (project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_payment_created_idx ON transactions (payment_id, created_at DESC) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_certificate_created_idx ON transactions (nft_certificate_id, created_at DESC) WHERE nft_certificate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_status_queue_idx ON transactions (status, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  body text,
  entity_table text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_entity_idx ON notifications (entity_table, entity_id) WHERE entity_table IS NOT NULL AND entity_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status chat_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS chat_participants (
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_participants_user_idx ON chat_participants (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body text NOT NULL,
  attachment_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS chat_messages_chat_created_idx ON chat_messages (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_sender_created_idx ON chat_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_search_idx ON chat_messages USING gin (to_tsvector('english', body));

CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  milestone_id uuid,
  submission_id uuid,
  payment_id uuid,
  opened_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  respondent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status dispute_status NOT NULL DEFAULT 'open',
  reason text NOT NULL,
  details text,
  resolution_notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (milestone_id, project_id) REFERENCES milestones(id, project_id) ON DELETE RESTRICT,
  FOREIGN KEY (submission_id, project_id) REFERENCES submissions(id, project_id) ON DELETE RESTRICT,
  FOREIGN KEY (payment_id, project_id) REFERENCES payments(id, project_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS disputes_project_status_idx ON disputes (project_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS disputes_opened_by_status_idx ON disputes (opened_by, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS disputes_respondent_status_idx ON disputes (respondent_id, status, opened_at DESC) WHERE respondent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS disputes_active_idx ON disputes (opened_at DESC) WHERE status IN ('open', 'under_review');

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS projects_set_updated_at ON projects;
CREATE TRIGGER projects_set_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS milestones_set_updated_at ON milestones;
CREATE TRIGGER milestones_set_updated_at
BEFORE UPDATE ON milestones
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS submissions_set_updated_at ON submissions;
CREATE TRIGGER submissions_set_updated_at
BEFORE UPDATE ON submissions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS payments_set_updated_at ON payments;
CREATE TRIGGER payments_set_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS nft_certificates_set_updated_at ON nft_certificates;
CREATE TRIGGER nft_certificates_set_updated_at
BEFORE UPDATE ON nft_certificates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS transactions_set_updated_at ON transactions;
CREATE TRIGGER transactions_set_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS chats_set_updated_at ON chats;
CREATE TRIGGER chats_set_updated_at
BEFORE UPDATE ON chats
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS disputes_set_updated_at ON disputes;
CREATE TRIGGER disputes_set_updated_at
BEFORE UPDATE ON disputes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
