-- Add draft_token column to allow multiple create drafts per user/company
-- Each unique draft_token gets its own create-draft slot

ALTER TABLE boq_drafts 
ADD COLUMN IF NOT EXISTS draft_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Drop the old partial unique index that limited to one create draft
DROP INDEX IF EXISTS idx_boq_drafts_create_draft_unique;

-- Create new partial unique index that allows multiple create drafts via draft_token
CREATE UNIQUE INDEX idx_boq_drafts_create_draft_unique 
ON boq_drafts (company_id, user_id, draft_token) 
WHERE boq_id IS NULL;

COMMENT ON INDEX idx_boq_drafts_create_draft_unique IS 
'Enforces exactly one create draft per draft_token per user per company. Only applies when boq_id IS NULL.';
