-- Migration: Add BOQ instance table and cost breakdown fields for Hierarchical BOQ
-- Date: 2025-06-13
-- Purpose: Support actual hierarchical BOQ instances (not just templates) with cost breakdown

-- Ensure prerequisite tables exist (self-contained migration)
CREATE TABLE IF NOT EXISTS boq_fixed_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  structure_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: boq_hierarchical_instances
-- Represents an actual BOQ created from a structure template
CREATE TABLE IF NOT EXISTS boq_hierarchical_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  structure_id UUID NOT NULL REFERENCES boq_fixed_structures(id) ON DELETE RESTRICT,

  -- BOQ metadata
  number VARCHAR(100) NOT NULL,
  boq_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  project_title TEXT,

  -- Financial fields
  currency VARCHAR(3) DEFAULT 'KES',
  subtotal NUMERIC(15,2) DEFAULT 0,
  discount_type VARCHAR(50) CHECK (discount_type IN ('percentage', 'fixed', NULL)),
  discount_value NUMERIC(15,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  tax_type VARCHAR(50) DEFAULT 'VAT' CHECK (tax_type IN ('VAT', 'GST', 'Sales Tax', 'Other', 'None')),
  tax_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL,

  -- Approval workflow
  approval_status VARCHAR(50) DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approval_date TIMESTAMPTZ,
  approval_notes TEXT,

  -- Revision tracking
  revision_number INT DEFAULT 1,
  previous_version_id UUID REFERENCES boq_hierarchical_instances(id) ON DELETE SET NULL,

  -- Lock mechanism
  locked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  lock_expires_at TIMESTAMPTZ,

  -- Audit trail
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Conversion tracking
  converted_to_invoice_id UUID,
  converted_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,
  attachment_url TEXT,

  UNIQUE(company_id, number)
);

-- Table: boq_hierarchical_item_costs
-- Extends boq_fixed_items_v2 with cost breakdown when used in an instance
CREATE TABLE IF NOT EXISTS boq_hierarchical_item_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  boq_instance_id UUID NOT NULL REFERENCES boq_hierarchical_instances(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES boq_fixed_items_v2(id) ON DELETE CASCADE,

  -- Quantity and pricing from item
  quantity NUMERIC(12,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,

  -- Cost breakdown (optional, for detailed analysis)
  material_cost NUMERIC(15,2),
  labor_cost NUMERIC(15,2),
  equipment_cost NUMERIC(15,2),
  other_cost NUMERIC(15,2),
  margin_percentage NUMERIC(5,2),
  margin_amount NUMERIC(15,2),

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(boq_instance_id, item_id)
);

-- Table: boq_hierarchical_section_totals
-- Cache section and subsection totals for performance
CREATE TABLE IF NOT EXISTS boq_hierarchical_section_totals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boq_instance_id UUID NOT NULL REFERENCES boq_hierarchical_instances(id) ON DELETE CASCADE,
  section_id VARCHAR(100) NOT NULL,
  section_name VARCHAR(255),
  section_total NUMERIC(15,2) NOT NULL,
  section_subtotal NUMERIC(15,2) NOT NULL,
  section_margin_amount NUMERIC(15,2),
  item_count INT DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(boq_instance_id, section_id)
);

-- Extend boq_fixed_items_v2 with cost breakdown fields (for defaults)
ALTER TABLE boq_fixed_items_v2
ADD COLUMN IF NOT EXISTS material_cost_percentage NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS labor_cost_percentage NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS equipment_cost_percentage NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC(5,2);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_boq_hierarchical_instances_company
  ON boq_hierarchical_instances(company_id);

CREATE INDEX IF NOT EXISTS idx_boq_hierarchical_instances_structure
  ON boq_hierarchical_instances(structure_id);

CREATE INDEX IF NOT EXISTS idx_boq_hierarchical_instances_number
  ON boq_hierarchical_instances(company_id, number);

CREATE INDEX IF NOT EXISTS idx_boq_hierarchical_instances_approval
  ON boq_hierarchical_instances(approval_status);

CREATE INDEX IF NOT EXISTS idx_boq_hierarchical_item_costs_instance
  ON boq_hierarchical_item_costs(boq_instance_id);

CREATE INDEX IF NOT EXISTS idx_boq_hierarchical_item_costs_item
  ON boq_hierarchical_item_costs(item_id);

CREATE INDEX IF NOT EXISTS idx_boq_hierarchical_section_totals_instance
  ON boq_hierarchical_section_totals(boq_instance_id);

-- Add comments
COMMENT ON TABLE boq_hierarchical_instances IS
  'Individual hierarchical BOQ instances created from structure templates. Each instance represents an actual BOQ document.';

COMMENT ON TABLE boq_hierarchical_item_costs IS
  'Extended cost information for items within a specific BOQ instance. Supports material/labor/equipment cost breakdown and margin tracking.';

COMMENT ON TABLE boq_hierarchical_section_totals IS
  'Cached section totals for performance optimization. Recalculated when items are modified.';

COMMENT ON COLUMN boq_hierarchical_instances.approval_status IS
  'Workflow state: pending (new), approved (ready for use), rejected (not approved), needs_revision (requested changes)';

COMMENT ON COLUMN boq_hierarchical_item_costs.material_cost IS
  'Cost attributable to materials for this item (optional breakdown)';

COMMENT ON COLUMN boq_hierarchical_item_costs.labor_cost IS
  'Cost attributable to labor for this item (optional breakdown)';

COMMENT ON COLUMN boq_hierarchical_item_costs.margin_percentage IS
  'Markup percentage applied to this item for profit calculation';
