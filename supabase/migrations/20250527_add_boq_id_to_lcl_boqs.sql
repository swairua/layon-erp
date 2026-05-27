-- Add boq_id column to lcl_boqs to track the relationship with boqs records
-- This enables syncing LCL changes to the corresponding BOQ record
ALTER TABLE lcl_boqs
ADD COLUMN boq_id UUID REFERENCES boqs(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_lcl_boqs_boq_id ON lcl_boqs(boq_id);
