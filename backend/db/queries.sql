-- Optimized query examples for ProofChain API endpoints.
-- Replace :named_params with your backend framework's parameter syntax.

-- 1. Freelancer dashboard: active projects and next milestone.
SELECT
  p.id,
  p.title,
  p.status,
  p.budget_amount,
  p.currency,
  m.id AS next_milestone_id,
  m.title AS next_milestone_title,
  m.status AS next_milestone_status,
  m.due_at
FROM projects p
LEFT JOIN LATERAL (
  SELECT id, title, status, due_at
  FROM milestones
  WHERE project_id = p.id
    AND status IN ('pending', 'funded', 'submitted', 'in_review')
  ORDER BY sequence_no
  LIMIT 1
) m ON true
WHERE p.freelancer_id = :freelancer_id
  AND p.status IN ('assigned', 'in_progress', 'disputed')
ORDER BY p.updated_at DESC
LIMIT :limit OFFSET :offset;

-- 2. Client dashboard: pending submissions needing approval.
SELECT
  s.id,
  s.title,
  s.proof_hash,
  s.created_at,
  p.id AS project_id,
  p.title AS project_title,
  m.id AS milestone_id,
  m.title AS milestone_title,
  u.display_name AS freelancer_name,
  u.wallet_address AS freelancer_wallet
FROM submissions s
JOIN projects p ON p.id = s.project_id
JOIN milestones m ON m.id = s.milestone_id
JOIN users u ON u.id = s.submitted_by
WHERE p.client_id = :client_id
  AND s.status = 'submitted'
ORDER BY s.created_at ASC
LIMIT :limit OFFSET :offset;

-- 3. Project details: one project with milestones and latest submission per milestone.
SELECT
  p.id,
  p.title,
  p.description,
  p.status,
  p.budget_amount,
  p.currency,
  jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'sequenceNo', m.sequence_no,
      'title', m.title,
      'status', m.status,
      'amount', m.amount,
      'dueAt', m.due_at,
      'latestSubmission', latest_submission.payload
    )
    ORDER BY m.sequence_no
  ) AS milestones
FROM projects p
JOIN milestones m ON m.project_id = p.id
LEFT JOIN LATERAL (
  SELECT jsonb_build_object(
    'id', s.id,
    'status', s.status,
    'proofHash', s.proof_hash,
    'createdAt', s.created_at
  ) AS payload
  FROM submissions s
  WHERE s.milestone_id = m.id
  ORDER BY s.created_at DESC
  LIMIT 1
) latest_submission ON true
WHERE p.id = :project_id
  AND (:viewer_id IN (p.client_id, p.freelancer_id))
GROUP BY p.id;

-- 4. Freelancer earnings: released and pending payments.
SELECT
  pay.id,
  pay.type,
  pay.status,
  pay.amount,
  pay.currency,
  pay.created_at,
  pay.released_at,
  p.title AS project_title,
  m.title AS milestone_title
FROM payments pay
JOIN projects p ON p.id = pay.project_id
LEFT JOIN milestones m ON m.id = pay.milestone_id
WHERE pay.payee_id = :freelancer_id
ORDER BY pay.created_at DESC
LIMIT :limit OFFSET :offset;

-- 5. NFT certificates gallery.
SELECT
  c.id,
  c.status,
  c.contract_address,
  c.token_id,
  c.chain_id,
  c.metadata_uri,
  c.proof_hash,
  c.minted_at,
  p.title AS project_title,
  m.title AS milestone_title
FROM nft_certificates c
JOIN projects p ON p.id = c.project_id
JOIN milestones m ON m.id = c.milestone_id
WHERE c.freelancer_id = :freelancer_id
ORDER BY c.minted_at DESC NULLS LAST, c.created_at DESC
LIMIT :limit OFFSET :offset;

-- 6. Recent transactions for a user across projects.
SELECT
  t.id,
  t.type,
  t.status,
  t.chain_id,
  t.tx_hash,
  t.amount,
  t.currency,
  t.created_at,
  p.title AS project_title
FROM transactions t
LEFT JOIN projects p ON p.id = t.project_id
WHERE t.initiated_by = :user_id
   OR p.client_id = :user_id
   OR p.freelancer_id = :user_id
ORDER BY t.created_at DESC
LIMIT :limit OFFSET :offset;

-- 7. Notifications feed with unread-first ordering.
SELECT id, type, title, body, entity_table, entity_id, read_at, created_at
FROM notifications
WHERE user_id = :user_id
ORDER BY (read_at IS NULL) DESC, created_at DESC
LIMIT :limit OFFSET :offset;

-- 8. Unread notification count.
SELECT count(*) AS unread_count
FROM notifications
WHERE user_id = :user_id
  AND read_at IS NULL;

-- 9. Project chat messages.
SELECT
  cm.id,
  cm.body,
  cm.attachment_url,
  cm.created_at,
  cm.edited_at,
  sender.id AS sender_id,
  sender.display_name AS sender_name,
  sender.wallet_address AS sender_wallet
FROM chats c
JOIN chat_participants cp ON cp.chat_id = c.id
JOIN chat_messages cm ON cm.chat_id = c.id
JOIN users sender ON sender.id = cm.sender_id
WHERE c.project_id = :project_id
  AND cp.user_id = :viewer_id
  AND cm.deleted_at IS NULL
ORDER BY cm.created_at DESC
LIMIT :limit;

-- 10. Active disputes for an admin queue.
SELECT
  d.id,
  d.status,
  d.reason,
  d.opened_at,
  p.title AS project_title,
  opener.display_name AS opened_by_name,
  respondent.display_name AS respondent_name
FROM disputes d
JOIN projects p ON p.id = d.project_id
JOIN users opener ON opener.id = d.opened_by
LEFT JOIN users respondent ON respondent.id = d.respondent_id
WHERE d.status IN ('open', 'under_review')
ORDER BY d.opened_at ASC
LIMIT :limit OFFSET :offset;

-- 11. Fast project search.
SELECT id, title, status, budget_amount, currency, updated_at
FROM projects
WHERE to_tsvector('english', title || ' ' || description) @@ plainto_tsquery('english', :search_text)
ORDER BY updated_at DESC
LIMIT :limit;
