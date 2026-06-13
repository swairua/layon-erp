# Standard BOQ Data Model

## Overview
The Standard BOQ workflow handles traditional Bill of Quantities with full draft management, autosave capabilities, and seamless conversion to invoices.

## Database Schema

### Main Table: `boqs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `company_id` | UUID | FK to companies table (company scoped) |
| `number` | VARCHAR | Unique BOQ number (e.g., BOQ-001) |
| `boq_date` | DATE | BOQ creation date |
| `due_date` | DATE | Payment/delivery due date |
| `client_name` | VARCHAR | Primary client name |
| `client_email` | VARCHAR | Client email address |
| `client_phone` | VARCHAR | Client phone number |
| `client_address` | VARCHAR | Client street address |
| `client_city` | VARCHAR | Client city |
| `client_country` | VARCHAR | Client country |
| `contractor` | VARCHAR | Contractor/supplier name |
| `project_title` | VARCHAR | Project/item description |
| `currency` | VARCHAR | Currency code (e.g., KES) |
| `subtotal` | NUMERIC | Pre-tax total amount |
| `tax_amount` | NUMERIC | Tax/VAT amount |
| `total_amount` | NUMERIC | Final total (subtotal + tax) |
| `data` | JSONB | Sections, items, and line-item details |
| `attachment_url` | VARCHAR | URL to supporting attachment |
| `status` | VARCHAR | draft, pending_approval, approved, converted, rejected |
| `converted_to_invoice_id` | UUID | FK to invoices table (if converted) |
| `converted_at` | TIMESTAMPTZ | Timestamp of conversion to invoice |
| `terms_and_conditions` | TEXT | T&Cs text |
| `showCalculatedValuesInTerms` | BOOLEAN | Display calculation details in T&Cs |
| `created_by` | UUID | FK to profiles (user who created) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### Related Table: `boq_drafts`

Draft autosave records for in-progress BOQs. Allows multiple concurrent create sessions per user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID | Company scope |
| `user_id` | UUID | User creating the draft |
| `boq_id` | UUID | FK to boqs (NULL for new drafts) |
| `draft_token` | VARCHAR | Unique token for concurrent draft sessions |
| `number` | VARCHAR | BOQ number |
| `boq_date` | DATE | BOQ date |
| `due_date` | DATE | Due date |
| `customer_id` | UUID | Customer reference |
| `client_name` | VARCHAR | Client name |
| `client_email` | VARCHAR | Client email |
| `client_phone` | VARCHAR | Client phone |
| `client_address` | VARCHAR | Client address |
| `client_city` | VARCHAR | Client city |
| `client_country` | VARCHAR | Client country |
| `contractor` | VARCHAR | Contractor |
| `project_title` | VARCHAR | Project title |
| `currency` | VARCHAR | Currency |
| `subtotal` | NUMERIC | Subtotal |
| `tax_amount` | NUMERIC | Tax amount |
| `total_amount` | NUMERIC | Total amount |
| `data` | JSONB | Sections and items data |
| `terms_and_conditions` | TEXT | T&Cs |
| `showCalculatedValuesInTerms` | BOOLEAN | Show calculated values flag |
| `status` | VARCHAR | draft |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |
| `last_autosaved_at` | TIMESTAMPTZ | Last autosave timestamp |

## JSONB Data Structure

The `data` column in both `boqs` and `boq_drafts` stores:

```json
{
  "sections": [
    {
      "title": "Section A: Demolitions",
      "subsections": [
        {
          "name": "A",
          "items": [
            {
              "description": "Item description",
              "unit": "m2",
              "quantity": 100,
              "unit_price": 50.00,
              "total": 5000.00
            }
          ]
        }
      ]
    }
  ],
  "notes": "Additional project notes"
}
```

## Validation Rules

- **BOQ Number**: Must be unique within company, formatted as BOQ-NNN
- **Dates**: boq_date ≤ due_date
- **Amounts**: subtotal ≥ 0, tax_amount ≥ 0, total_amount = subtotal + tax_amount
- **Client Name**: Required, non-empty
- **Status**: One of: draft, pending_approval, approved, converted, rejected

## Workflow States

```
draft
  ├─→ pending_approval (manual approval trigger)
  │   └─→ approved
  │       └─→ converted (to invoice)
  │       └─→ draft (if reopened)
  └─→ converted (direct conversion without approval)
```

## Integration Points

### BOQ → Invoice Conversion
- Creates a new invoice record from BOQ data
- Sets `converted_to_invoice_id` and `converted_at`
- Status moves to "converted"
- Invoice inherits client info, amounts, and line items

### Draft Autosave
- Automatically saves work-in-progress to `boq_drafts` every 30 seconds
- Supports multiple concurrent create sessions via `draft_token`
- Draft can be continued/published later or abandoned

### Audit Trail
- Creation tracked via `created_by` and `created_at`
- Updates tracked via `updated_at`
- Delete operations logged to `audit_logs` table

## Database Indexes

```sql
CREATE INDEX idx_boqs_company_id_created_at 
  ON boqs(company_id, created_at DESC);

CREATE INDEX idx_boqs_company_id_number 
  ON boqs(company_id, number);
```

Optimizes:
- List queries filtered by company
- Number uniqueness checks
- Recent BOQs retrieval

## Relationships

```
companies (1) ──← (many) boqs
profiles (1) ──← (many) boqs (created_by)
invoices (1) ←── (many) boqs (converted_to_invoice_id)
boqs (1) ──← (many) boq_drafts
```

## Future Enhancement: Approval Workflow Fields

Planned fields to enable formal approval chains:

- `approved_by` (UUID) - User who approved
- `approval_date` (TIMESTAMPTZ) - Approval timestamp
- `approval_notes` (TEXT) - Approval comments
- `revision_number` (INT) - Track BOQ versions
- `previous_version_id` (UUID) - Link to prior version
- `locked_by` (UUID) - User who locked (prevents editing)
- `locked_at` (TIMESTAMPTZ) - Lock timestamp
