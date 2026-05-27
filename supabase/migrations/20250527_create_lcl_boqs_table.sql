-- Create lcl_boqs table to store saved LCL BOQ documents
-- This table stores LCL BOQ documents with customer info and item snapshots
CREATE TABLE IF NOT EXISTS lcl_boqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number TEXT NOT NULL, -- LCL-001, LCL-002, etc.
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  project_title TEXT,
  boq_date DATE DEFAULT CURRENT_DATE,
  items_snapshot JSONB, -- Flattened items with qty/rate/amount
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'saved', -- 'draft' or 'saved'
  CONSTRAINT unique_lcl_boq_number UNIQUE(company_id, number)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lcl_boqs_company_id ON lcl_boqs(company_id);
CREATE INDEX IF NOT EXISTS idx_lcl_boqs_customer_id ON lcl_boqs(customer_id);
CREATE INDEX IF NOT EXISTS idx_lcl_boqs_number ON lcl_boqs(number);
CREATE INDEX IF NOT EXISTS idx_lcl_boqs_created_at ON lcl_boqs(created_at);

-- Enable RLS
ALTER TABLE lcl_boqs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view lcl_boqs from their company"
  ON lcl_boqs
  FOR SELECT
  USING (
    company_id IN (
      SELECT id FROM companies 
      WHERE id IN (
        SELECT company_id FROM company_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert lcl_boqs for their company"
  ON lcl_boqs
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies 
      WHERE id IN (
        SELECT company_id FROM company_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update lcl_boqs from their company"
  ON lcl_boqs
  FOR UPDATE
  USING (
    company_id IN (
      SELECT id FROM companies 
      WHERE id IN (
        SELECT company_id FROM company_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete lcl_boqs from their company"
  ON lcl_boqs
  FOR DELETE
  USING (
    company_id IN (
      SELECT id FROM companies 
      WHERE id IN (
        SELECT company_id FROM company_members 
        WHERE user_id = auth.uid()
      )
    )
  );
