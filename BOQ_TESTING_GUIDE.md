# BOQ Data Accuracy Testing Guide

## Overview
This guide provides step-by-step test scenarios to verify that all BOQ schema fields are properly captured, persisted, and retrieved throughout the application lifecycle.

---

## Test 1: Create BOQ with All Fields

### Setup
- Navigate to BOQs page
- Click "Create BOQ"

### Test Steps
1. **Fill in Basic Fields**
   - BOQ Number: `TEST-001` (auto-generated)
   - Date: Today's date
   - Due Date: 30 days from today
   - Currency: KES
   - Client: Select any customer
   - Project Title: "Test Project"
   - Contractor: "Test Contractor"
   - **Tax Amount: 5000** ← NEW
   - **Status: Draft** ← NEW
   - **Attachment URL: https://example.com/test.pdf** ← NEW

2. **Add Items**
   - Section: General
   - Subsection A (Materials): 
     - Item 1: Description="Wood", Qty=10, Unit=Piece, Rate=500
     - Expected Amount: 5,000
   - Expected Subtotal: 5,000

3. **Verify Totals Display**
   - Subtotal should display: KES 5,000.00
   - **Tax should display: KES 5,000.00** ← NEW
   - **Total should display: KES 10,000.00** (Subtotal + Tax) ← NEW

4. **Add Terms & Notes**
   - Notes: "Test notes"
   - Terms: "Test terms"
   - Show Calculated Values: ✓

### Expected Results
✅ Form accepts all inputs
✅ Totals calculate correctly with tax
✅ All fields accepted without validation errors

### Verification
- Check database: `SELECT tax_amount, attachment_url, status FROM boqs WHERE number='TEST-001'`
- Expected: `tax_amount=5000, attachment_url='https://example.com/test.pdf', status='draft'`

---

## Test 2: Create → Draft → Resume

### Setup
- Start creating a new BOQ with Test 1 fields

### Test Steps
1. Fill all fields including **tax amount and attachment URL**
2. **Do NOT click Save** - instead close the modal
3. Confirm "Discard Changes" dialog appears
4. Click "Keep Editing" (or just let dialog auto-close)
5. Wait 2-3 seconds for autosave indicator
6. Verify autosave completed (check BOQSaveIndicator)

### Expected Results
✅ Draft saved automatically after 3 seconds of inactivity
✅ Last saved time displayed in indicator

### Verification
1. Close modal without saving (click X)
2. Reopen "Create BOQ" modal
3. Verify all fields restored:
   - BOQ Number, Date, Due Date, Client ✓
   - Tax Amount filled ✓
   - Attachment URL filled ✓
   - Status shows ✓
   - Sections and items restored ✓
4. **Database check:**
   ```sql
   SELECT number, tax_amount, attachment_url, status, last_autosaved_at 
   FROM boq_drafts 
   WHERE boq_id IS NULL 
   ORDER BY last_autosaved_at DESC LIMIT 1
   ```
   - Expected: All fields present and recent timestamp

---

## Test 3: Edit BOQ - All Fields Update

### Setup
- Create and save a BOQ using Test 1
- Open the BOQ in the BOQs list
- Click Edit

### Test Steps
1. **Verify All Fields Load**
   - BOQ Number loads ✓
   - Client loads ✓
   - **Tax Amount loads and displays** ✓
   - **Attachment URL loads** ✓
   - **Status loads** ✓

2. **Modify All Fields**
   - Change Tax Amount: 5000 → 7500
   - Change Attachment URL: add a different URL
   - Change Status: draft → pending
   - Modify one item quantity: 10 → 15

3. **Verify Live Totals Update**
   - Subtotal updates: 5000 → 7500 (10*500 adjusted if qty changed)
   - **Tax updates to 7500** ✓
   - **Total = Subtotal + Tax** ✓

4. **Let Autosave Trigger**
   - Wait 5+ seconds without making changes
   - Verify "Last Saved" timestamp in BOQSaveIndicator ✓

### Expected Results
✅ All fields load from database
✅ Modifications trigger autosave
✅ Totals recalculate with new tax
✅ Edit draft captures all changes

### Verification
1. Click "Save Changes" button
2. Verify success toast appears
3. Close modal and reopen same BOQ
4. Verify edited values persist:
   - Tax Amount = 7500 ✓
   - Attachment URL = updated ✓
   - Status = pending ✓
   - Items modified ✓
5. **Database check:**
   ```sql
   SELECT tax_amount, attachment_url, status FROM boqs WHERE id='<boq-id>'
   ```

---

## Test 4: Financial Field Round-Trip

### Setup
Create BOQ with:
- Subtotal: 10,000
- Tax Amount: 2,000
- Expected Total: 12,000

### Test Steps
1. Save BOQ
2. Load BOQ → verify Subtotal=10000, Tax=2000, Total=12000
3. Edit BOQ → change Tax to 2,500
4. Save → verify Subtotal=10000, Tax=2500, Total=12500
5. Create Percentage Copy at 50%:
   - Expected: Subtotal=5000, Tax=1250, Total=6250
6. Verify percentage copy BOQ displays correctly

### Expected Results
✅ Create round-trip: Save → Load → Verify
✅ Edit round-trip: Load → Modify → Save → Verify
✅ Percentage copy preserves and scales all amounts
✅ No data loss on any transformation

### Verification
- Check all three BOQs in database
- Verify financial calculations are exact

---

## Test 5: Percentage Copy Preserves Non-Financial Fields

### Setup
- Original BOQ (TEST-001) with:
  - Tax Amount: 5000
  - Attachment URL: https://example.com/original.pdf
  - Status: approved
  - Terms: "Original terms"

### Test Steps
1. Open BOQ TEST-001
2. Click "Create Percentage Copy" → 75%
3. Verify copy details:
   - Tax Amount: 3750 (5000 * 0.75) ✓
   - **Attachment URL: https://example.com/original.pdf** ✓
   - **Status: draft** (copy is always draft) ✓
   - **Terms preserved** ✓
   - **Client info preserved** ✓

### Expected Results
✅ All non-financial fields copied to new BOQ
✅ Financial fields scaled by percentage
✅ Status reset to draft for new copy
✅ Number auto-generated and unique

---

## Test 6: BOQ to Invoice Conversion

### Setup
Create BOQ (TEST-CONV) with:
- Client: TestCo
- Items: 3 items totaling 15,000 subtotal
- Tax: 3,000
- Total: 18,000
- Status: draft
- Attachment URL: present

### Test Steps
1. Open BOQ TEST-CONV
2. Verify Status = draft ✓
3. Click "Convert to Invoice"
4. Confirm dialog and wait for processing
5. Verify success message

### Expected Results
✅ Invoice created with correct amounts
✅ All items transferred
✅ Tax amount from BOQ used: 3,000 ✓
✅ BOQ status updated to 'converted' ✓
✅ BOQ.converted_to_invoice_id populated ✓
✅ BOQ.converted_at timestamp set ✓

### Verification
1. Navigate to invoices
2. Find newly created invoice
3. Verify:
   - Invoice items match BOQ items count ✓
   - Invoice subtotal = BOQ subtotal ✓
   - Invoice tax = BOQ tax ✓
   - Invoice total = BOQ total ✓
4. Go back to BOQ
5. Verify:
   - Status = 'converted' ✓
   - Cannot convert again (button disabled) ✓
   - Linked invoice ID visible ✓

---

## Test 7: Attachment URL Display & Link

### Setup
- BOQ with Attachment URL: https://example.com/boq-docs/2024-spec.pdf

### Test Steps
1. Open BOQ in viewer/details
2. **Look for attachment section** (if UI includes it)
3. **Click attachment link** → should navigate or download

### Expected Results
✅ Attachment URL displays in BOQ details
✅ Link is clickable and correct
✅ Opens/downloads file from URL

---

## Test 8: Status Lifecycle

### Setup
- Create multiple BOQs

### Test Steps
1. **Create BOQ** → Auto-status: draft ✓
2. **Edit BOQ** → Change status: draft → pending ✓
3. **Save Edit** → Status persists ✓
4. **Edit Again** → Change status: pending → approved ✓
5. **Save** → Status = approved ✓
6. **Convert to Invoice** → Status changes to 'converted' ✓

### Expected Results
✅ Status starts as 'draft'
✅ Can change to pending/approved before conversion
✅ Changes persist on save
✅ Conversion forces status to 'converted'
✅ Cannot edit status after conversion (read-only)

---

## Test 9: Tax Calculation Verification

### Setup
Create BOQ with manual tax calculation

### Test Steps
1. Items subtotal = 10,000
2. Enter Tax Amount = 1,500
3. Verify Total = 11,500 ✓
4. **Change item quantity** → Subtotal updates to 12,000
5. Verify Total updates: 12,000 + 1,500 = 13,500 ✓
6. **Change Tax to 2,000**
7. Verify Total: 12,000 + 2,000 = 14,000 ✓

### Expected Results
✅ Tax and subtotal independent
✅ Total = Subtotal + Tax always
✅ Changes to items update only subtotal
✅ Changes to tax update total independently

---

## Test 10: Missing Field Detection

### Setup
Test each previously missing field

### Test Steps
1. **Verify Tax Amount captured**
   - Create BOQ with tax
   - Check database: `tax_amount` column
   - Expected: NOT NULL, correct value

2. **Verify Attachment URL captured**
   - Create BOQ with URL
   - Check database: `attachment_url` column
   - Expected: NOT NULL, correct URL

3. **Verify Status captured**
   - Create BOQ, check `status` column
   - Expected: 'draft'

### Expected Results
✅ All fields present in database
✅ No NULL values when set in form
✅ No data loss or truncation

---

## Test 11: Form Validation

### Setup
- Open Create or Edit BOQ modal

### Test Steps
1. **Leave Tax blank** → Save should work, tax defaults to 0
2. **Leave Attachment URL blank** → Save should work, URL is NULL
3. **Leave Status unselected** → Should default to 'draft'
4. **Required fields still required:**
   - Clear BOQ Number → Error appears ✓
   - Clear Client → Error appears ✓
   - Remove all items → Error appears ✓

### Expected Results
✅ New optional fields are truly optional
✅ Required fields still enforced
✅ Defaults applied when needed

---

## Regression Tests

### RT1: Existing BOQ List Display
- Open BOQs page
- Verify all BOQs display
- No errors in console ✓
- Can still filter/search ✓
- Can still edit existing BOQs ✓

### RT2: PDF Export
- Create BOQ with tax and attachment URL
- Click "Export PDF" or download BOQ
- **PDF should display:**
  - ✓ All sections and items
  - ✓ Subtotal
  - **✓ Tax amount** (NEW)
  - **✓ Total** (NEW)
  - **✓ Attachment reference** (if implemented)

### RT3: BOQ Copy (Non-Percentage)
- Create "Copy BOQ" (duplicate, not percentage)
- Verify all fields copied including:
  - **✓ Tax amount**
  - **✓ Attachment URL**
  - **✓ Terms**

---

## Testing Checklist

### Phase 1: Data Capture ✓
- [ ] Tax amount captured in create form
- [ ] Attachment URL captured in create form
- [ ] Status captured in create form
- [ ] All fields captured in edit form
- [ ] Form displays all fields correctly

### Phase 2: Persistence ✓
- [ ] Tax saved to database on create
- [ ] Attachment URL saved to database on create
- [ ] Status saved to database on create
- [ ] All fields updated on edit
- [ ] Edit draft captures all changes
- [ ] Database columns non-null when populated

### Phase 3: Retrieval ✓
- [ ] Tax loads from database on edit
- [ ] Attachment URL loads on edit
- [ ] Status loads on edit
- [ ] Draft recovery includes all fields
- [ ] Form displays loaded values

### Phase 4: Calculations ✓
- [ ] Totals recalculate when tax changes
- [ ] Totals recalculate when items change
- [ ] Percentage copy scales tax correctly
- [ ] Percentage copy preserves URL
- [ ] Conversion uses tax amount

### Phase 5: Conversions ✓
- [ ] BOQ to invoice preserves tax
- [ ] BOQ status updates to 'converted'
- [ ] converted_to_invoice_id set
- [ ] converted_at timestamp set
- [ ] Percentage copy sets status='draft'

### Phase 6: No Regressions ✓
- [ ] Existing BOQs still display
- [ ] Existing features still work
- [ ] No console errors
- [ ] No database errors
- [ ] PDF export works
- [ ] BOQ copy works

---

## Success Criteria

✅ All test scenarios pass
✅ No data loss in any workflow
✅ All schema fields properly handled
✅ Tax amount always correctly calculated
✅ Status lifecycle maintained
✅ Attachment URLs preserved
✅ No regressions in existing features
✅ Database matches implementation
