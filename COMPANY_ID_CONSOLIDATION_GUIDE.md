# Company ID Consolidation Guide

## Problem Statement

The system is **single-tenant** (one company) but `company_id` is inconsistent across tables:
- Some records have `NULL` company_id
- Some records reference non-existent company_id values (orphaned)
- Different tables may use different company IDs

This causes critical issues like:
- ❌ BOQs query fails with inaccessible company IDs
- ❌ RLS (Row Level Security) policies can't filter correctly
- ❌ Data integrity violations

## Solution: Three-Phase Approach

### Phase 1: Audit (Diagnostic)
**Goal:** Find the canonical company ID and document all inconsistencies

**Steps:**
1. Query `companies` table to confirm one company exists and get its ID
2. Scan all major tables for:
   - NULL company_id values
   - Mismatched/orphaned company_id references
   - Multi-company situations
3. Document baseline metrics

**Tables Audited:**
- `profiles` (may have NULL for auth users)
- `customers`
- `invoices`
- `boqs` (critical)
- `quotations`
- `products`
- `payment_methods`
- `tax_settings`
- `stock_movements`
- `audit_logs`
- And 15+ others

**Access the UI Tool:**
- Navigate to `/company-id-consolidation` page
- Click "Run Audit" to see current state
- Review issues found in each table

### Phase 2: Generate & Execute Fix
**Goal:** Create and apply a SQL migration to consolidate all records

**What the migration does:**
1. Identifies the **canonical company ID** (oldest company in database)
2. Updates all NULL company_id to canonical ID
3. Updates orphaned references to canonical ID
4. Preserves data integrity via foreign key constraints
5. Handles special cases:
   - `profiles`: Auth users may legitimately be NULL initially
   - `invoices`: Populates via customer relationship first
   - All other tables: Direct assignment to canonical ID

**Affected Tables (30+):**
- Core: `profiles`, `customers`, `products`, `invoices`, `boqs`
- Documents: `quotations`, `proforma_invoices`, `credit_notes`, `delivery_notes`
- Transactions: `payments`, `payment_methods`, `remittance_advice`, `cash_receipts`
- Configuration: `tax_settings`, `units_of_measure`, `product_categories`, `roles`
- Inventory: `stock_movements`, `lpos`
- Templates: `lcl_boqs`, `lcl_template_structures`, `lcl_template_items`
- Audit: `audit_logs`, `company_settings`, `user_invitations`, `payment_allocations`
- And more

**Migration Location:**
```
supabase/migrations/20250612_audit_company_id_consolidation.sql
```

**Two Ways to Apply:**

#### Option A: Via UI Tool (Recommended for testing)
```
1. Go to /company-id-consolidation page
2. Click "Phase 2: Consolidate" button
3. Monitor progress in toast notifications
4. Immediately see verification results
```

#### Option B: Direct Supabase SQL Editor (For production)
```sql
1. Open Supabase Dashboard: https://app.supabase.com
2. Go to SQL Editor → New Query
3. Copy migration SQL from supabase/migrations/20250612_audit_company_id_consolidation.sql
4. Paste into editor
5. Review (especially PHASE 1 AUDIT section first)
6. Execute Phases 2 & 3
7. Check verification results at end
```

### Phase 3: Verify
**Goal:** Confirm consolidation was successful and no NULL values remain

**Verification Checks:**
- ✅ Zero NULL company_id in profiles
- ✅ Zero NULL company_id in customers
- ✅ Zero NULL company_id in invoices
- ✅ Zero NULL company_id in boqs
- ✅ All records use same canonical company_id
- ✅ All company_id references exist in companies table

**Access Results:**
- UI Tool automatically shows results after Phase 2
- Or click "Re-verify" button to run fresh check
- Verification queries included in migration file (PHASE 3 VERIFY)

**Expected Output (Healthy Database):**
```
Status: ✅ Consolidation Successful!
- Profiles NULL: 0
- Customers NULL: 0
- BOQs NULL: 0
- Invoices NULL: 0
- Distinct Companies: 1 (canonical)
```

## Implementation Files

### Service Layer
**File:** `src/services/companyIdConsolidation.ts`

Functions:
- `auditCompanyIds()` - Run Phase 1
- `consolidateCompanyIds()` - Run Phase 2
- `verifyConsolidation()` - Run Phase 3

### UI Component
**File:** `src/pages/CompanyIdConsolidation.tsx`

Access via route: `/company-id-consolidation`

Three-phase flow with progress tracking:
1. Menu with options
2. Audit results display
3. Verify results display

### SQL Migration
**File:** `supabase/migrations/20250612_audit_company_id_consolidation.sql`

Contains all SQL needed:
- Phase 1: Audit SELECT statements
- Phase 2: Consolidation UPDATE statements
- Phase 3: Verification SELECT statements

## Step-by-Step Execution

### Step 1: Run Audit (15 seconds)
```bash
# Via UI: Go to /company-id-consolidation
# Click "Run Audit"
# Review all tables for issues

# Via SQL: Run Phase 1 SELECT statements from migration
```

**Expected Output:**
- Canonical Company ID (should be UUID of first company)
- Count of records with NULL company_id per table
- Distribution of company_ids in use

**Decision Point:**
- If no issues found: Consolidation not needed
- If issues found: Proceed to Phase 2

### Step 2: Consolidate (1-3 seconds)
```bash
# Via UI: Click "Phase 2: Consolidate"
# System updates all NULL/orphaned company_ids

# Via SQL: Execute Phase 2 UPDATE statements
```

**What Happens:**
- All NULL company_id → canonical ID
- All orphaned references → canonical ID
- Foreign key constraints preserved
- No data loss

### Step 3: Verify (5 seconds)
```bash
# Via UI: Automatic after Phase 2
# Or click "Re-verify" anytime

# Via SQL: Execute Phase 3 verification queries
```

**Success Criteria:**
- All NULL counts = 0
- Distinct companies = 1
- isHealthy = true

## Testing the Fix

After consolidation, verify the BOQs page works:

### 1. Load BOQs Page
```
Navigate to /boqs
- Should load without errors
- Should show list of BOQs with correct company_id
```

### 2. Check Debug Output
Look at browser console (F12):
```javascript
// Should see:
✅ BOQs loaded: 5 records
✅ Company ID: [canonical-uuid]
✅ Query successful
```

### 3. Create New Record
```
1. Go to Create BOQ modal
2. Fill in details
3. Submit
4. Verify it appears in list with correct company_id
```

### 4. RLS Policies
```
- BOQ queries should respect RLS
- Should only see records from canonical company
- Auth context should match company_id
```

## Rollback Procedure (If Needed)

If consolidation causes issues:

### Option 1: Restore from Backup
1. Supabase Dashboard → Backups → Select point-in-time
2. Restore to before migration timestamp
3. Investigate root cause

### Option 2: Manual Undo (Manual)
If backup not available, manually restore specific records (complex - avoid if possible)

## Troubleshooting

### Issue: "No companies found"
**Cause:** Companies table is empty
**Solution:** Create a company first via UI

### Issue: Some tables not updated
**Cause:** Table doesn't have company_id column
**Solution:** Add column via migration (see RLSErrorDialog component)

### Issue: Foreign key constraint violations
**Cause:** company_id references non-existent company
**Solution:** Run Phase 2 again (includes orphan fix)

### Issue: BOQs still fail after consolidation
**Cause:** Other RLS policies or missing columns
**Solution:** Check browser console for actual error, then apply specific fix

## Architecture Notes

### Why Consolidate to Oldest Company?
- Single-tenant system should use one canonical company
- Oldest company has most historical data
- No business logic depends on specific company ID
- Ensures consistency across all tables

### Data Integrity Safeguards
- Foreign key constraints ON DELETE CASCADE preserved
- UPDATE statements validate company_id exists before assignment
- Verification phase confirms no orphans remain
- Audit phase documents before/after state

### Performance Considerations
- Updates use indexes on company_id columns
- Batch operations grouped by table
- No transactions lock for extended periods
- Suitable for single-tenant system (no multi-company complexity)

### RLS Policy Implications
- After consolidation, all RLS policies check same company_id
- No cross-company data leakage possible
- Auth context must match canonical company_id
- Profiles with NULL company_id won't see any restricted data (auth requirement)

## Related Components

### Used By These Pages
- `src/pages/BOQs.tsx` - Main BOQ listing (benefits most from fix)
- `src/pages/Invoices.tsx` - Invoice management
- `src/pages/Customers.tsx` - Customer records
- Any page with `.eq('company_id', currentCompany.id)` queries

### Related Fixes
- `src/components/RLSErrorDialog.tsx` - RLS policy issues
- `src/components/ManualSQLSetup.tsx` - Manual SQL operations
- `src/services/adminFixData.ts` - Admin-level fixes
- `src/pages/DatabaseFix.tsx` - RLS-specific diagnostics

## Success Criteria

✅ **Consolidation is successful when:**
1. Audit phase shows all issues
2. Phase 2 updates run without errors
3. Phase 3 verification shows:
   - Zero NULL company_ids in all tables
   - All records use canonical company_id
   - isHealthy = true
4. BOQs page loads and shows correct data
5. No RLS errors in browser console
6. Create/update operations work correctly

## Questions or Issues?

If consolidation doesn't resolve the issue:
1. Check browser console (F12) for specific error
2. Run audit again to see if new issues appear
3. Review `/company-id-consolidation` verification results
4. Check specific table schemas in Supabase SQL editor
5. Look for custom RLS policies that override default behavior

---

**Last Updated:** 2025-06-12  
**Status:** Ready for deployment  
**Single-Tenant Only:** Yes  
