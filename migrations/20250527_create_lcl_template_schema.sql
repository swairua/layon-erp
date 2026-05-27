-- LCL Template Schema
-- Supports nested sections > subsections > items structure
-- Similar to Hierarchical BOQ but dedicated to LCL Template feature

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: lcl_template_structures
-- Defines LCL Template definitions (e.g., "LCL-001 Standard Template")
CREATE TABLE IF NOT EXISTS lcl_template_structures (
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
  --       "name": "SECTION NAME",
  --       "subsections": [
  --         {
  --           "id": "SUBSECTION_1",
  --           "name": "Subsection Name"
  --         }
  --       ]
  --     }
  --   ]
  -- }
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: lcl_template_items
-- Individual items within LCL templates
CREATE TABLE IF NOT EXISTS lcl_template_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  structure_id UUID REFERENCES lcl_template_structures(id) ON DELETE CASCADE,
  
  -- Hierarchical identifiers
  section_id TEXT NOT NULL,
  subsection_id TEXT NOT NULL,
  
  -- Item details
  item_number VARCHAR(50),
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

-- Table: lcl_template_history
-- Track changes/versions for audit purposes
CREATE TABLE IF NOT EXISTS lcl_template_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  structure_id UUID REFERENCES lcl_template_structures(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,  -- created, updated, deleted, etc.
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lcl_template_structures_company 
  ON lcl_template_structures(company_id);

CREATE INDEX IF NOT EXISTS idx_lcl_template_items_company 
  ON lcl_template_items(company_id);

CREATE INDEX IF NOT EXISTS idx_lcl_template_items_structure 
  ON lcl_template_items(structure_id);

CREATE INDEX IF NOT EXISTS idx_lcl_template_items_section_subsection 
  ON lcl_template_items(section_id, subsection_id);

CREATE INDEX IF NOT EXISTS idx_lcl_template_history_company 
  ON lcl_template_history(company_id);

CREATE INDEX IF NOT EXISTS idx_lcl_template_history_structure 
  ON lcl_template_history(structure_id);

-- RLS Policies (if using RLS)
ALTER TABLE lcl_template_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE lcl_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lcl_template_history ENABLE ROW LEVEL SECURITY;

-- Create policies to restrict access to company data
DROP POLICY IF EXISTS lcl_template_structures_company_policy ON lcl_template_structures;
CREATE POLICY lcl_template_structures_company_policy ON lcl_template_structures
  USING (company_id IN (SELECT id FROM companies WHERE id = auth.uid() OR TRUE))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE id = auth.uid() OR TRUE));

DROP POLICY IF EXISTS lcl_template_items_company_policy ON lcl_template_items
  USING (company_id IN (SELECT id FROM companies WHERE id = auth.uid() OR TRUE))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE id = auth.uid() OR TRUE));

DROP POLICY IF EXISTS lcl_template_history_company_policy ON lcl_template_history
  USING (company_id IN (SELECT id FROM companies WHERE id = auth.uid() OR TRUE))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE id = auth.uid() OR TRUE));
