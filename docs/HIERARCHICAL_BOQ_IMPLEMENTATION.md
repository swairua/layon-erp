# Hierarchical BOQ Implementation

## Overview
The Hierarchical BOQ workflow manages Bills of Quantities with multi-level nesting: Sections → Subsections → Items. Supports complex project structures with cost breakdowns at each level.

## Database Schema

### Core Tables

#### `boq_fixed_structures`

Defines the hierarchical template structure (sections and subsections layout).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID | Company scope |
| `name` | VARCHAR | Structure name (e.g., "Standard Building") |
| `description` | TEXT | Structure description |
| `structure_data` | JSONB | Hierarchical section/subsection definitions |
| `is_active` | BOOLEAN | Active/archived flag |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

#### `boq_fixed_items_v2`

Individual line items within the hierarchical structure.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `structure_id` | UUID | FK to boq_fixed_structures |
| `section_id` | VARCHAR | Section identifier (e.g., "SECTION_A") |
| `subsection_id` | VARCHAR | Subsection identifier (e.g., "MATERIALS") |
| `description` | VARCHAR | Item description |
| `unit` | VARCHAR | Unit of measure (m2, m3, kg, etc.) |
| `quantity` | NUMERIC | Item quantity |
| `unit_price` | NUMERIC | Price per unit |
| `total` | NUMERIC | Calculated: quantity × unit_price |
| `notes` | TEXT | Item-specific notes |
| `sequence` | INT | Display order within subsection |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

#### `boq_fixed_items_migration_log` (optional)

Tracks migrations/versions of hierarchical data for audit purposes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `structure_id` | UUID | Structure being migrated |
| `from_version` | INT | Source version |
| `to_version` | INT | Target version |
| `changes` | JSONB | Migration details |
| `migrated_at` | TIMESTAMPTZ | Migration timestamp |

## JSONB Structure: `structure_data`

Defines the hierarchical layout without item content:

```json
{
  "sections": [
    {
      "id": "SECTION_A",
      "name": "FOUNDATION WORKS",
      "subsections": [
        {
          "id": "MATERIALS",
          "name": "Materials & Supplies"
        },
        {
          "id": "LABOR",
          "name": "Labour Costs"
        }
      ]
    },
    {
      "id": "SECTION_B",
      "name": "STRUCTURAL WORKS",
      "subsections": [
        {
          "id": "CONCRETE",
          "name": "Concrete Work"
        }
      ]
    }
  ]
}
```

## Hierarchical Data Structure

Returned by `getHierarchicalData()`:

```json
{
  "structure": {
    "id": "uuid",
    "name": "Structure Name",
    "company_id": "uuid"
  },
  "sections": [
    {
      "section_id": "SECTION_A",
      "section_name": "FOUNDATION WORKS",
      "subsections": [
        {
          "subsection_id": "MATERIALS",
          "subsection_name": "Materials & Supplies",
          "items": [
            {
              "id": "item-uuid",
              "description": "Item description",
              "unit": "m2",
              "quantity": 100,
              "unit_price": 50.00,
              "total": 5000.00,
              "notes": "Optional notes"
            }
          ],
          "subtotal": 5000.00
        }
      ],
      "total": 5000.00
    }
  ],
  "grand_total": 5000.00
}
```

## Calculation Rules

- **Item Total**: quantity × unit_price
- **Subsection Subtotal**: SUM(item totals within subsection)
- **Section Total**: SUM(subsection subtotals within section)
- **Grand Total**: SUM(section totals)

Calculations are performed server-side and cached for performance.

## Service Methods

### HierarchicalBOQService

#### Creating & Managing Structures

```typescript
// Create a new structure template
async createStructure(
  companyId: string,
  name: string,
  description: string,
  structureData: BOQStructureData
): Promise<BOQFixedStructure>

// Fetch all active structures for company
async getStructures(companyId: string): Promise<BOQFixedStructure[]>

// Get a single structure by ID
async getStructure(structureId: string): Promise<BOQFixedStructure>

// Update structure metadata/definition
async updateStructure(
  structureId: string,
  updates: Partial<{
    name: string;
    description: string;
    structure_data: BOQStructureData;
  }>
): Promise<BOQFixedStructure>
```

#### Managing Items

```typescript
// Bulk insert items
async insertItems(
  items: Omit<BOQFixedItemV2, 'id' | 'created_at' | 'updated_at'>[]
): Promise<BOQFixedItemV2[]>

// Get items for a structure
async getItems(structureId: string): Promise<BOQFixedItemV2[]>

// Update a single item
async updateItem(
  itemId: string,
  updates: Partial<BOQFixedItemV2>
): Promise<BOQFixedItemV2>

// Delete an item
async deleteItem(itemId: string): Promise<void>
```

#### Data Retrieval

```typescript
// Get complete hierarchical data with calculated totals
async getHierarchicalData(
  structureId: string
): Promise<BOQHierarchicalData>
```

## Validation Rules

- **Section IDs**: Must be unique within a structure, non-empty string
- **Subsection IDs**: Must be unique within a section
- **Item Quantities**: Must be > 0
- **Unit Prices**: Must be ≥ 0
- **Descriptions**: Non-empty strings
- **Structure Depth**: Limited to 2 levels (Sections → Subsections → Items)

## PDF Generation

The `generateHierarchicalBOQPDF()` function:
- Renders sections with subsection grouping
- Shows item details with unit prices and totals
- Displays section subtotals and grand total
- Includes company logo, dates, and client information
- Handles page breaks for large BOQs

## UI Components

### FixedBOQHierarchical.tsx

Main page component with:
- Structure selector dropdown
- Text/file import dialog
- Hierarchical item table with expand/collapse
- Item editor modal
- Delete confirmation dialog
- PDF download
- Drag-and-drop reordering (planned)

## Migration from Standard BOQ

Data migration steps:
1. Define hierarchical structure (sections/subsections)
2. Parse standard BOQ items into sections
3. Insert items into `boq_fixed_items_v2` with section/subsection IDs
4. Verify calculated totals match original BOQ
5. Archive original standard BOQ or maintain as reference

## Future Enhancements

- **Cost Breakdown**: Additional JSONB fields for material/labour separation per item
- **Margin Tracking**: Margin percentage and amount at item and section levels
- **Version Control**: Track structure and item changes with audit trail
- **Template Reuse**: Save completed BOQs as templates for future projects
- **Approval Workflow**: Multi-step approval chain with sign-off
- **Invoice Link**: Direct conversion to invoices with line-item tracking

## Integration with Other BOQ Types

- **Standard BOQ**: Can be imported into Hierarchical structure
- **LCL BOQ**: Separate workflow, independent implementation
- **Unified Reporting**: All BOQ types can be queried for dashboards/reports

## Database Indexes

```sql
CREATE INDEX idx_boq_fixed_structures_company_id 
  ON boq_fixed_structures(company_id);

CREATE INDEX idx_boq_fixed_items_v2_structure_id 
  ON boq_fixed_items_v2(structure_id);

CREATE INDEX idx_boq_fixed_items_v2_section_subsection 
  ON boq_fixed_items_v2(section_id, subsection_id);
```
