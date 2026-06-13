# LCL BOQ Template Data Model

## Overview
The LCL (Level Cost List) BOQ workflow provides template-based BOQ creation. Templates define standard item structures that can be reused across projects, enabling rapid and consistent BOQ generation.

## Database Schema

### Main Table: `lcl_boqs`

Stores LCL BOQs with template-based item structure.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID | Company scope |
| `number` | VARCHAR | Unique LCL BOQ number (e.g., LCLBOQ-001) |
| `customer_id` | UUID | FK to customers table (optional) |
| `project_title` | VARCHAR | Project/item name |
| `boq_date` | DATE | BOQ creation date |
| `items_snapshot` | JSONB | Snapshot of template items at creation time |
| `notes` | TEXT | Additional notes |
| `status` | VARCHAR | draft, saved (in-progress or finalized) |
| `boq_id` | UUID | FK to boqs table (if converted to standard BOQ) |
| `created_by` | UUID | User who created (optional) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### Template Table: `lcl_template_items`

Defines reusable template items for LCL BOQ creation.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID | Company scope |
| `item_code` | VARCHAR | Unique item code (e.g., "MAT-001") |
| `item_name` | VARCHAR | Item display name |
| `description` | TEXT | Detailed item description |
| `unit` | VARCHAR | Unit of measure (m2, m3, kg, etc.) |
| `category` | VARCHAR | Item category for organization |
| `is_active` | BOOLEAN | Active/archived flag |
| `default_quantity` | NUMERIC | Default quantity when used in BOQ |
| `default_unit_price` | NUMERIC | Default price per unit |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

## JSONB Structures

### `items_snapshot` in `lcl_boqs`

Captures a snapshot of template items at the moment of BOQ creation:

```json
{
  "snapshot_version": "1.0",
  "items": [
    {
      "id": "item-uuid",
      "item_code": "MAT-001",
      "item_name": "Cement (50kg bag)",
      "description": "Portland cement - Grade 42.5",
      "unit": "bags",
      "category": "Materials",
      "quantity": 100,
      "unit_price": 450.00,
      "total": 45000.00,
      "snapshot_date": "2025-06-13T10:30:00Z"
    },
    {
      "id": "item-uuid-2",
      "item_code": "LAB-001",
      "item_name": "Skilled Labour (Mason)",
      "description": "Skilled masonry work",
      "unit": "days",
      "category": "Labour",
      "quantity": 50,
      "unit_price": 1500.00,
      "total": 75000.00,
      "snapshot_date": "2025-06-13T10:30:00Z"
    }
  ],
  "subtotal": 120000.00,
  "tax_rate": 0.16,
  "tax_amount": 19200.00,
  "grand_total": 139200.00
}
```

### Template Item Metadata

`lcl_template_items` stores the base definitions:

```json
{
  "item_code": "MAT-001",
  "item_name": "Cement (50kg bag)",
  "description": "Portland cement - Grade 42.5",
  "unit": "bags",
  "category": "Materials",
  "default_quantity": 100,
  "default_unit_price": 450.00
}
```

## Workflow: Creating BOQ from Template

1. **Template Selection**: User chooses which template items to include
2. **Quantity/Price Override**: Optionally adjust quantities and unit prices
3. **Snapshot Creation**: Items frozen in `items_snapshot` JSONB at BOQ creation
4. **Save BOQ**: Stored in `lcl_boqs` with `status='draft'` or `status='saved'`
5. **Conversion (optional)**: Convert to standard BOQ via `convertLCLBOQToInvoice()`

## Template Item Categories

Standard categories for organization:

- **Materials**: Raw materials, supplies
- **Labour**: Worker wages, contractor costs
- **Equipment**: Tool rental, machinery
- **Services**: Consulting, specialized work
- **Transport**: Shipping, logistics
- **Other**: Miscellaneous costs

## Validation Rules

### Template Items (`lcl_template_items`)

- **item_code**: Unique within company, non-empty
- **item_name**: Required, non-empty
- **unit**: Valid unit abbreviation (m, m2, m3, kg, l, days, etc.)
- **default_quantity**: ≥ 0
- **default_unit_price**: ≥ 0

### BOQs (`lcl_boqs`)

- **number**: Unique within company, formatted as LCLBOQ-NNN
- **items_snapshot**: Non-empty array with ≥ 1 item
- **item quantities**: ≥ 0
- **item prices**: ≥ 0
- **totals**: Match sum of (quantity × unit_price)

## Service Methods

### LCLBoqService

```typescript
// Get all LCL BOQs for company
async getLCLBOQs(companyId: string): Promise<LCLBOQRecord[]>

// Get latest LCL BOQ
async getLCLBOQLatest(companyId: string): Promise<LCLBOQRecord | null>

// Get single LCL BOQ by ID
async getLCLBOQ(id: string): Promise<LCLBOQRecord>

// Save new or update existing
async saveLCLBOQ(boq: LCLBOQRecord): Promise<LCLBOQRecord>

// Auto-save draft (status='draft')
async autosaveLCLBOQDraft(boq: LCLBOQRecord): Promise<LCLBOQRecord>

// Delete LCL BOQ
async deleteLCLBOQ(id: string): Promise<void>

// Convert to standard BOQ (creates boqs record)
async convertLCLBOQToInvoice(
  lclBoqId: string,
  companyId: string
): Promise<string> // Returns created invoice/BOQ ID
```

### LCLTemplateService

```typescript
// Get all template items for company
async getTemplateItems(
  companyId: string,
  filters?: { category?: string; isActive?: boolean }
): Promise<LCLTemplateItem[]>

// Get single template item
async getTemplateItem(id: string): Promise<LCLTemplateItem>

// Create new template item
async createTemplateItem(
  companyId: string,
  item: Omit<LCLTemplateItem, 'id' | 'created_at' | 'updated_at'>
): Promise<LCLTemplateItem>

// Update template item
async updateTemplateItem(
  id: string,
  updates: Partial<LCLTemplateItem>
): Promise<LCLTemplateItem>

// Bulk create items (import)
async bulkCreateTemplateItems(
  companyId: string,
  items: Omit<LCLTemplateItem, 'id' | 'created_at' | 'updated_at'>[]
): Promise<LCLTemplateItem[]>

// Archive/delete template item
async deleteTemplateItem(id: string): Promise<void>
```

## PDF Generation

The `generateLCLBOQPDF()` function:
- Renders template-based item list with snapshot quantities/prices
- Groups items by category
- Shows item codes, descriptions, units, quantities, prices
- Displays subtotal, tax calculation, grand total
- Includes company branding and metadata

## Integration Points

### Invoice Conversion
- `convertLCLBOQToInvoice()` creates a standard invoice
- Sets `boq_id` reference in `lcl_boqs` table
- Inherits items snapshot as invoice line items

### Audit Trail
- Creation tracked via `created_by` and `created_at`
- All changes logged via `updated_at`
- Delete operations audited in `audit_logs`

### Reporting
- Template usage analytics (which items used most)
- BOQ cost trends (average BOQ value)
- Template performance (time saved vs manual entry)

## Database Indexes

```sql
CREATE INDEX idx_lcl_boqs_company_id_created_at 
  ON lcl_boqs(company_id, created_at DESC);

CREATE INDEX idx_lcl_boqs_company_id_number 
  ON lcl_boqs(company_id, number);

CREATE INDEX idx_lcl_template_items_company_id 
  ON lcl_template_items(company_id);

CREATE INDEX idx_lcl_template_items_category 
  ON lcl_template_items(company_id, category);
```

## Data Migration

### Importing Template Items from CSV

Expected CSV format:
```
item_code,item_name,description,unit,category,default_quantity,default_unit_price
MAT-001,Cement,Portland cement - 42.5,bags,Materials,100,450.00
LAB-001,Labour,Skilled mason,days,Labour,50,1500.00
```

## Future Enhancements

- **Template Versioning**: Track changes to template items over time
- **Item Variants**: Support multiple sizes/grades of same item
- **Bulk Pricing**: Volume discounts at quantity thresholds
- **BOQ History**: Version control of completed BOQs
- **Approval Workflow**: Multi-step approval for BOQs before conversion
- **Linked Projects**: Associate BOQs with projects for tracking
- **Cost Analysis**: Compare quoted vs. actual costs post-project

## UI Components

### LCLTemplate.tsx
- Template item management (CRUD)
- Bulk import dialog
- Item categorization and filtering
- Search and sorting

### LCLBOQList.tsx
- View all LCL BOQs
- Filter by status, date range
- Create new BOQ from template
- Edit BOQ quantities/prices
- Convert to invoice
- Download PDF
- Delete BOQ
