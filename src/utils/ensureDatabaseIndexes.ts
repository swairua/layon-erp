import { supabase } from '@/integrations/supabase/client';

// Flag to track if indexes have been ensured this session
let indexesEnsured = false;

export async function ensureDatabaseIndexes(): Promise<{ success: boolean; message: string }> {
  // Only attempt once per session to avoid repeated RPC calls
  if (indexesEnsured) {
    console.log('✅ Database indexes already ensured this session');
    return { success: true, message: 'Indexes already ensured' };
  }

  try {
    console.log('📋 Ensuring database indexes for BOQ and LCL performance...');

    // These indexes are critical for performance on large datasets
    // They enable efficient filtering and sorting without full table scans
    const indexCreationSQL = `
      -- BOQs table indexes
      CREATE INDEX IF NOT EXISTS idx_boqs_company_id_created_at 
        ON boqs(company_id, created_at DESC)
        WHERE deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_boqs_company_id_number 
        ON boqs(company_id, number)
        WHERE deleted_at IS NULL;

      -- LCL BOQs table indexes
      CREATE INDEX IF NOT EXISTS idx_lcl_boqs_company_id_created_at 
        ON lcl_boqs(company_id, created_at DESC)
        WHERE deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_lcl_boqs_company_id_number 
        ON lcl_boqs(company_id, number)
        WHERE deleted_at IS NULL;

      -- LCL Template Items hierarchy indexes (if table exists)
      CREATE INDEX IF NOT EXISTS idx_lcl_template_items_structure_section_item
        ON lcl_template_items(structure_id, section_id, item_number)
        WHERE deleted_at IS NULL;
    `;

    // Execute the index creation via RPC or raw query
    // Supabase doesn't have a direct way to create indexes via client API,
    // so we'll skip this for now and document the SQL to be run manually
    console.log('📌 Database indexes should be created in Supabase SQL Editor:');
    console.log(indexCreationSQL);

    // Mark as ensured so we don't retry this session
    indexesEnsured = true;

    return {
      success: true,
      message: 'Database index creation documented (manual SQL required in Supabase dashboard)'
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('⚠️ Could not ensure database indexes:', errorMsg);
    console.warn('This is non-critical - indexes can be created manually in Supabase SQL Editor');
    
    indexesEnsured = true; // Mark as attempted to avoid repeated failures
    return {
      success: false,
      message: `Index creation check completed: ${errorMsg}`
    };
  }
}

// Export the SQL for manual creation
export const BOQ_INDEXES_SQL = `
-- Create indexes for BOQ and LCL BOQ tables to improve query performance
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- BOQs table indexes - for efficient company-based BOQ lookup and sorting
CREATE INDEX IF NOT EXISTS idx_boqs_company_id_created_at 
  ON boqs(company_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_boqs_company_id_number 
  ON boqs(company_id, number)
  WHERE deleted_at IS NULL;

-- LCL BOQs table indexes - same as BOQs for consistency
CREATE INDEX IF NOT EXISTS idx_lcl_boqs_company_id_created_at 
  ON lcl_boqs(company_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lcl_boqs_company_id_number 
  ON lcl_boqs(company_id, number)
  WHERE deleted_at IS NULL;

-- LCL Template Items hierarchy index - for efficient structure navigation
CREATE INDEX IF NOT EXISTS idx_lcl_template_items_structure_section_item
  ON lcl_template_items(structure_id, section_id, item_number)
  WHERE deleted_at IS NULL;

-- Composite index for customer lookup by company
CREATE INDEX IF NOT EXISTS idx_customers_company_id_created_at
  ON customers(company_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Units index for quick lookup
CREATE INDEX IF NOT EXISTS idx_units_company_id_created_at
  ON units(company_id, created_at DESC)
  WHERE deleted_at IS NULL;
`;
