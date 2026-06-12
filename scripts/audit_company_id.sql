-- ===============================================================================
-- COMPANY ID AUDIT SCRIPT
-- Find canonical company ID and identify inconsistencies across all tables
-- ===============================================================================

-- Step 1: Find the canonical company ID
\echo '=== STEP 1: Finding Canonical Company ID ==='
SELECT 
    id,
    name,
    created_at,
    (SELECT COUNT(*) FROM profiles WHERE company_id = companies.id) as profile_count,
    (SELECT COUNT(*) FROM customers WHERE company_id = companies.id) as customer_count,
    (SELECT COUNT(*) FROM products WHERE company_id = companies.id) as product_count,
    (SELECT COUNT(*) FROM quotations WHERE company_id = companies.id) as quotation_count,
    (SELECT COUNT(*) FROM invoices WHERE company_id = companies.id) as invoice_count,
    (SELECT COUNT(*) FROM boqs WHERE company_id = companies.id) as boq_count,
    (SELECT COUNT(*) FROM lcl_boqs WHERE company_id = companies.id) as lcl_boq_count
FROM companies
ORDER BY created_at ASC;

\echo ''
\echo '=== STEP 2: Audit Profiles Table ==='
SELECT 
    'TOTAL PROFILES' as check_name,
    COUNT(*) as record_count
FROM profiles
UNION ALL
SELECT 
    'PROFILES WITH NULL company_id' as check_name,
    COUNT(*) as record_count
FROM profiles
WHERE company_id IS NULL
UNION ALL
SELECT 
    'PROFILES WITH INVALID company_id' as check_name,
    COUNT(*) as record_count
FROM profiles
WHERE company_id NOT IN (SELECT id FROM companies);

\echo ''
\echo '=== STEP 3: Audit Customers Table ==='
SELECT 
    'TOTAL CUSTOMERS' as check_name,
    COUNT(*) as record_count
FROM customers
UNION ALL
SELECT 
    'CUSTOMERS WITH NULL company_id' as check_name,
    COUNT(*) as record_count
FROM customers
WHERE company_id IS NULL
UNION ALL
SELECT 
    'CUSTOMERS WITH INVALID company_id' as check_name,
    COUNT(*) as record_count
FROM customers
WHERE company_id NOT IN (SELECT id FROM companies);

\echo ''
\echo '=== STEP 4: Audit BOQs Table ==='
SELECT 
    'TOTAL BOQS' as check_name,
    COUNT(*) as record_count
FROM boqs
UNION ALL
SELECT 
    'BOQS WITH NULL company_id' as check_name,
    COUNT(*) as record_count
FROM boqs
WHERE company_id IS NULL
UNION ALL
SELECT 
    'BOQS WITH INVALID company_id' as check_name,
    COUNT(*) as record_count
FROM boqs
WHERE company_id NOT IN (SELECT id FROM companies);

\echo ''
\echo '=== STEP 5: Audit Quotations Table ==='
SELECT 
    'TOTAL QUOTATIONS' as check_name,
    COUNT(*) as record_count
FROM quotations
UNION ALL
SELECT 
    'QUOTATIONS WITH NULL company_id' as check_name,
    COUNT(*) as record_count
FROM quotations
WHERE company_id IS NULL
UNION ALL
SELECT 
    'QUOTATIONS WITH INVALID company_id' as check_name,
    COUNT(*) as record_count
FROM quotations
WHERE company_id NOT IN (SELECT id FROM companies);

\echo ''
\echo '=== STEP 6: Audit Invoices Table ==='
SELECT 
    'TOTAL INVOICES' as check_name,
    COUNT(*) as record_count
FROM invoices
UNION ALL
SELECT 
    'INVOICES WITH NULL company_id' as check_name,
    COUNT(*) as record_count
FROM invoices
WHERE company_id IS NULL
UNION ALL
SELECT 
    'INVOICES WITH INVALID company_id' as check_name,
    COUNT(*) as record_count
FROM invoices
WHERE company_id NOT IN (SELECT id FROM companies);

\echo ''
\echo '=== STEP 7: Audit LCL BOQs Table ==='
SELECT 
    'TOTAL LCL_BOQS' as check_name,
    COUNT(*) as record_count
FROM lcl_boqs
UNION ALL
SELECT 
    'LCL_BOQS WITH NULL company_id' as check_name,
    COUNT(*) as record_count
FROM lcl_boqs
WHERE company_id IS NULL
UNION ALL
SELECT 
    'LCL_BOQS WITH INVALID company_id' as check_name,
    COUNT(*) as record_count
FROM lcl_boqs
WHERE company_id NOT IN (SELECT id FROM companies);

\echo ''
\echo '=== STEP 8: Audit Products Table ==='
SELECT 
    'TOTAL PRODUCTS' as check_name,
    COUNT(*) as record_count
FROM products
UNION ALL
SELECT 
    'PRODUCTS WITH NULL company_id' as check_name,
    COUNT(*) as record_count
FROM products
WHERE company_id IS NULL
UNION ALL
SELECT 
    'PRODUCTS WITH INVALID company_id' as check_name,
    COUNT(*) as record_count
FROM products
WHERE company_id NOT IN (SELECT id FROM companies);

\echo ''
\echo '=== STEP 9: Audit Product Categories Table ==='
SELECT 
    'TOTAL PRODUCT_CATEGORIES' as check_name,
    COUNT(*) as record_count
FROM product_categories
UNION ALL
SELECT 
    'PRODUCT_CATEGORIES WITH NULL company_id' as check_name,
    COUNT(*) as record_count
FROM product_categories
WHERE company_id IS NULL
UNION ALL
SELECT 
    'PRODUCT_CATEGORIES WITH INVALID company_id' as check_name,
    COUNT(*) as record_count
FROM product_categories
WHERE company_id NOT IN (SELECT id FROM companies);

\echo ''
\echo '=== STEP 10: Sample Records with NULL company_id ==='
SELECT 
    'profiles'::text as table_name,
    id::text,
    email,
    full_name,
    company_id::text
FROM profiles
WHERE company_id IS NULL
LIMIT 5
UNION ALL
SELECT 
    'customers'::text as table_name,
    id::text,
    name,
    email,
    company_id::text
FROM customers
WHERE company_id IS NULL
LIMIT 5
UNION ALL
SELECT 
    'boqs'::text as table_name,
    id::text,
    boq_number,
    NULL,
    company_id::text
FROM boqs
WHERE company_id IS NULL
LIMIT 5;
