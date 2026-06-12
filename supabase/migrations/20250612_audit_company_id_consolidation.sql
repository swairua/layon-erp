-- =============================================================================
-- PHASE 1: AUDIT - Query to diagnose company_id inconsistencies
-- =============================================================================
-- Run these SELECT statements to understand the current state before making changes

-- A) Check companies table to identify the canonical company
SELECT 'AUDIT: Companies Table' as audit_step,
  id,
  name,
  created_at,
  COUNT(*) OVER () as total_companies
FROM companies
ORDER BY created_at ASC;

-- B) Check for users with null company_id
SELECT 'AUDIT: Profiles with NULL company_id' as audit_step,
  id,
  email,
  full_name,
  role,
  company_id,
  created_at
FROM profiles
WHERE company_id IS NULL
ORDER BY created_at ASC;

-- C) Profile company_id distribution
SELECT 'AUDIT: Profiles company_id distribution' as audit_step,
  company_id,
  COUNT(*) as profile_count
FROM profiles
GROUP BY company_id
ORDER BY profile_count DESC;

-- D) Customers with mismatched or null company_id
SELECT 'AUDIT: Customers anomalies' as audit_step,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as null_company_id,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company_id,
  COUNT(DISTINCT company_id) as distinct_companies
FROM customers;

-- E) BOQs with mismatched or null company_id
SELECT 'AUDIT: BOQs anomalies' as audit_step,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as null_company_id,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company_id,
  COUNT(DISTINCT company_id) as distinct_companies
FROM boqs;

-- F) Invoices with mismatched or null company_id
SELECT 'AUDIT: Invoices anomalies' as audit_step,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as null_company_id,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company_id,
  COUNT(DISTINCT company_id) as distinct_companies
FROM invoices;

-- G) All other multi-tenant tables summary
SELECT 'AUDIT: Other tables summary' as audit_step,
  'quotations' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as null_company_id,
  COUNT(DISTINCT company_id) as distinct_companies
FROM quotations
UNION ALL
SELECT 'AUDIT: Other tables summary' as audit_step,
  'products',
  COUNT(*),
  COUNT(CASE WHEN company_id IS NULL THEN 1 END),
  COUNT(DISTINCT company_id)
FROM products
UNION ALL
SELECT 'AUDIT: Other tables summary' as audit_step,
  'payment_methods',
  COUNT(*),
  COUNT(CASE WHEN company_id IS NULL THEN 1 END),
  COUNT(DISTINCT company_id)
FROM payment_methods
UNION ALL
SELECT 'AUDIT: Other tables summary' as audit_step,
  'tax_settings',
  COUNT(*),
  COUNT(CASE WHEN company_id IS NULL THEN 1 END),
  COUNT(DISTINCT company_id)
FROM tax_settings
UNION ALL
SELECT 'AUDIT: Other tables summary' as audit_step,
  'stock_movements',
  COUNT(*),
  COUNT(CASE WHEN company_id IS NULL THEN 1 END),
  COUNT(DISTINCT company_id)
FROM stock_movements
UNION ALL
SELECT 'AUDIT: Other tables summary' as audit_step,
  'audit_logs',
  COUNT(*),
  COUNT(CASE WHEN company_id IS NULL THEN 1 END),
  COUNT(DISTINCT company_id)
FROM audit_logs;

-- =============================================================================
-- PHASE 2: CONSOLIDATION - Fix company_id across all tables to canonical ID
-- =============================================================================
-- This migration uses the first (oldest) company as the canonical company_id
-- All records without a company_id will be assigned to this canonical company

BEGIN;

-- Step 1: Get canonical company ID (oldest company)
WITH canonical_company AS (
  SELECT id FROM companies ORDER BY created_at ASC LIMIT 1
),
-- Step 2: Get all other company IDs (if multi-company exists)
other_companies AS (
  SELECT id FROM companies WHERE id != (SELECT id FROM canonical_company)
)
-- ====== PROFILES ======
-- Update NULL company_id in profiles to canonical
UPDATE profiles
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

-- Update any orphaned company_id references in profiles (to canonical)
UPDATE profiles
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== CUSTOMERS ======
-- Populate NULL company_id
UPDATE customers
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

-- Fix orphaned references
UPDATE customers
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== INVOICES ======
-- Populate NULL company_id by customer relationship if available
UPDATE invoices inv
SET company_id = (
  SELECT c.company_id
  FROM customers c
  WHERE c.id = inv.customer_id
)
WHERE inv.company_id IS NULL AND inv.customer_id IS NOT NULL;

-- Populate remaining NULL company_id with canonical
UPDATE invoices
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

-- Fix orphaned references
UPDATE invoices
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== BOQS ======
-- Populate NULL company_id
UPDATE boqs
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

-- Fix orphaned references
UPDATE boqs
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== BOQ_DRAFTS ======
UPDATE boq_drafts
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE boq_drafts
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== QUOTATIONS ======
UPDATE quotations
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE quotations
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== PROFORMA_INVOICES ======
UPDATE proforma_invoices
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE proforma_invoices
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== CREDIT_NOTES ======
UPDATE credit_notes
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE credit_notes
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== DELIVERY_NOTES ======
UPDATE delivery_notes
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE delivery_notes
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== PAYMENTS ======
UPDATE payments
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE payments
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== PAYMENT_METHODS ======
UPDATE payment_methods
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE payment_methods
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== REMITTANCE_ADVICE ======
UPDATE remittance_advice
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE remittance_advice
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== PRODUCT_CATEGORIES ======
UPDATE product_categories
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE product_categories
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== PRODUCTS ======
UPDATE products
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE products
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== LPOS ======
UPDATE lpos
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE lpos
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== TAX_SETTINGS ======
UPDATE tax_settings
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE tax_settings
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== UNITS_OF_MEASURE ======
UPDATE units_of_measure
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE units_of_measure
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== STOCK_MOVEMENTS ======
UPDATE stock_movements
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE stock_movements
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== AUDIT_LOGS ======
UPDATE audit_logs
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE audit_logs
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== LCL_BOQS ======
UPDATE lcl_boqs
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE lcl_boqs
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== LCL_TEMPLATE_STRUCTURES ======
UPDATE lcl_template_structures
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE lcl_template_structures
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== LCL_TEMPLATE_ITEMS ======
UPDATE lcl_template_items
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE lcl_template_items
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== CASH_RECEIPTS ======
UPDATE cash_receipts
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE cash_receipts
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== USER_INVITATIONS ======
UPDATE user_invitations
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE user_invitations
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== COMPANY_SETTINGS ======
UPDATE company_settings
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE company_settings
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== PAYMENT_ALLOCATIONS ======
UPDATE payment_allocations
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE payment_allocations
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== COMPANY_SERVICES ======
UPDATE company_services
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE company_services
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== COMPANY_IMAGES ======
UPDATE company_images
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE company_images
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

-- ====== ROLES ======
UPDATE roles
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NULL;

UPDATE roles
SET company_id = (SELECT id FROM canonical_company)
WHERE company_id IS NOT NULL 
  AND company_id NOT IN (SELECT id FROM companies);

COMMIT;

-- =============================================================================
-- PHASE 3: VERIFY - Check that consolidation was successful
-- =============================================================================

SELECT 'VERIFY: Profile NULL counts' as verify_step,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as null_company_id_count,
  COUNT(*) as total_count
FROM profiles;

SELECT 'VERIFY: Customer NULL counts' as verify_step,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as null_company_id_count,
  COUNT(*) as total_count
FROM customers;

SELECT 'VERIFY: BOQ NULL counts' as verify_step,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as null_company_id_count,
  COUNT(*) as total_count
FROM boqs;

SELECT 'VERIFY: Invoice NULL counts' as verify_step,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as null_company_id_count,
  COUNT(*) as total_count
FROM invoices;

SELECT 'VERIFY: All tables use same company_id' as verify_step,
  COUNT(DISTINCT company_id) as distinct_companies
FROM (
  SELECT company_id FROM profiles WHERE company_id IS NOT NULL
  UNION ALL
  SELECT company_id FROM customers WHERE company_id IS NOT NULL
  UNION ALL
  SELECT company_id FROM invoices WHERE company_id IS NOT NULL
  UNION ALL
  SELECT company_id FROM boqs WHERE company_id IS NOT NULL
) all_tables;
