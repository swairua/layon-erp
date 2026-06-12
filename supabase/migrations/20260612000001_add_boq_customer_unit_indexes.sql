-- Performance indexes for BOQ, customer, and units tables
-- These improve query performance on company-based lookups and sorting
-- Run: psql -f this_file or paste into Supabase SQL Editor

-- BOQs: efficient company filtering + date sorting for list view
CREATE INDEX IF NOT EXISTS idx_boqs_company_id_created_at
  ON boqs(company_id, created_at DESC);

-- BOQs: fast lookup by number within a company
CREATE INDEX IF NOT EXISTS idx_boqs_company_id_number
  ON boqs(company_id, number);

-- Customers: efficient company filtering for dropdowns and reports
CREATE INDEX IF NOT EXISTS idx_customers_company_id_created_at
  ON customers(company_id, created_at DESC);

-- Units: efficient company filtering for dropdowns
CREATE INDEX IF NOT EXISTS idx_units_company_id_created_at
  ON units(company_id, created_at DESC);

-- LCL BOQs: same as BOQs for consistency
CREATE INDEX IF NOT EXISTS idx_lcl_boqs_company_id_created_at
  ON lcl_boqs(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lcl_boqs_company_id_number
  ON lcl_boqs(company_id, number);

-- LCL Template Items: efficient structure navigation
CREATE INDEX IF NOT EXISTS idx_lcl_template_items_structure_section_item
  ON lcl_template_items(structure_id, section_id, item_number);
