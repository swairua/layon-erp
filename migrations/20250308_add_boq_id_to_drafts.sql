-- ============================================================================
-- Migration: Add boq_id column to boq_drafts for edit-in-progress drafts
-- ============================================================================
-- This allows the table to store both:
-- 1. Create drafts: boq_id IS NULL (new BOQ being created)
-- 2. Edit drafts: boq_id IS NOT NULL (editing existing BOQ)
-- 
-- Unique constraint changes from (company_id, user_id) to (company_id, user_id, boq_id)
-- This enables multiple drafts: one per user per company for create, plus one per BOQ being edited.

BEGIN TRANSACTION;

-- Add boq_id column (nullable, for edit-in-progress drafts)
ALTER TABLE boq_drafts 
ADD COLUMN IF NOT EXISTS boq_id UUID REFERENCES boqs(id) ON DELETE CASCADE;

-- Drop the old UNIQUE constraint on (company_id, user_id)
ALTER TABLE boq_drafts 
DROP CONSTRAINT IF EXISTS boq_drafts_company_id_user_id_key;

-- Create new UNIQUE constraint on (company_id, user_id, boq_id)
-- This allows: one create draft (boq_id=NULL) + multiple edit drafts (boq_id=specific BOQ)
ALTER TABLE boq_drafts 
ADD CONSTRAINT boq_drafts_company_user_boq_unique UNIQUE(company_id, user_id, boq_id);

-- Create index for efficient queries of edit drafts for a specific BOQ
CREATE INDEX IF NOT EXISTS idx_boq_drafts_boq_id ON boq_drafts(boq_id);

-- Update RLS policy to be explicit (no changes needed, but documenting intent)
-- Users can only see and edit their own drafts (existing policies remain valid)

COMMIT;
