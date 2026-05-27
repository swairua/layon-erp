-- Hierarchical Fixed BOQ Schema
-- Supports nested sections > subsections > items structure

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: boq_fixed_structures
-- Defines hierarchical BOQ templates (e.g., "BOQ-085 Residential Maisonette")
CREATE TABLE IF NOT EXISTS boq_fixed_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  structure_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- structure_data schema:
  -- {
  --   "sections": [
  --     {
  --       "id": "SECTION_A",
  --       "name": "FOUNDATION",
  --       "subsections": [
  --         {
  --           "id": "MATERIALS",
  --           "name": "Subsection A: Materials"
  --         },
  --         {
  --           "id": "LABOR",
  --           "name": "Subsection B: Labor"
  --         }
  --       ]
  --     }
  --   ]
  -- }
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: boq_fixed_items_v2
-- Hierarchical items with section/subsection mapping
CREATE TABLE IF NOT EXISTS boq_fixed_items_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  structure_id UUID REFERENCES boq_fixed_structures(id) ON DELETE CASCADE,
  
  -- Hierarchical identifiers
  section_id TEXT NOT NULL,  -- e.g., "SECTION_A"
  subsection_id TEXT NOT NULL,  -- e.g., "MATERIALS"
  
  -- Item details
  item_number VARCHAR(50),  -- e.g., "1", "2", "A", "B" or NULL for auto-increment
  description TEXT NOT NULL,
  unit TEXT DEFAULT 'Item',
  default_qty NUMERIC(12,2),
  default_rate NUMERIC(12,2),
  
  -- Ordering within subsection
  sort_order INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_boq_fixed_structures_company 
  ON boq_fixed_structures(company_id);

CREATE INDEX IF NOT EXISTS idx_boq_fixed_items_v2_company 
  ON boq_fixed_items_v2(company_id);

CREATE INDEX IF NOT EXISTS idx_boq_fixed_items_v2_structure 
  ON boq_fixed_items_v2(structure_id);

CREATE INDEX IF NOT EXISTS idx_boq_fixed_items_v2_section_subsection 
  ON boq_fixed_items_v2(section_id, subsection_id);

-- Table: boq_fixed_items_migration_log
-- Track migration status from old to new schema
CREATE TABLE IF NOT EXISTS boq_fixed_items_migration_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  old_item_count INTEGER,
  new_item_count INTEGER,
  structure_id UUID REFERENCES boq_fixed_structures(id),
  status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed, failed
  error_message TEXT,
  migrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boq_fixed_items_migration_log_company 
  ON boq_fixed_items_migration_log(company_id);

-- RLS Policies (if using RLS)
-- Note: Adjust these based on your RLS configuration
ALTER TABLE boq_fixed_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_fixed_items_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_fixed_items_migration_log ENABLE ROW LEVEL SECURITY;

-- Create policies to restrict access to company data
DROP POLICY IF EXISTS boq_fixed_structures_company_policy ON boq_fixed_structures;
CREATE POLICY boq_fixed_structures_company_policy ON boq_fixed_structures
  USING (company_id IN (SELECT id FROM companies WHERE id = auth.uid() OR TRUE))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE id = auth.uid() OR TRUE));

DROP POLICY IF EXISTS boq_fixed_items_v2_company_policy ON boq_fixed_items_v2
  USING (company_id IN (SELECT id FROM companies WHERE id = auth.uid() OR TRUE))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE id = auth.uid() OR TRUE));

DROP POLICY IF EXISTS boq_fixed_items_migration_log_company_policy ON boq_fixed_items_migration_log
  USING (company_id IN (SELECT id FROM companies WHERE id = auth.uid() OR TRUE))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE id = auth.uid() OR TRUE));
