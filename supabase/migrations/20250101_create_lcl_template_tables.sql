-- Create LCL Template Structures table
CREATE TABLE IF NOT EXISTS lcl_template_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  structure_data JSONB NOT NULL DEFAULT '{"sections": []}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- Create LCL Template Items table
CREATE TABLE IF NOT EXISTS lcl_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  structure_id UUID NOT NULL REFERENCES lcl_template_structures(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  subsection_id TEXT NOT NULL,
  item_number TEXT NOT NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  default_qty NUMERIC(10, 2) DEFAULT 0,
  default_rate NUMERIC(10, 2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create LCL Template History table for audit logging
CREATE TABLE IF NOT EXISTS lcl_template_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  structure_id UUID REFERENCES lcl_template_structures(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  changed_by TEXT DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lcl_template_structures_company_id ON lcl_template_structures(company_id);
CREATE INDEX IF NOT EXISTS idx_lcl_template_items_structure_id ON lcl_template_items(structure_id);
CREATE INDEX IF NOT EXISTS idx_lcl_template_items_section_subsection ON lcl_template_items(section_id, subsection_id);
CREATE INDEX IF NOT EXISTS idx_lcl_template_history_company_id ON lcl_template_history(company_id);
