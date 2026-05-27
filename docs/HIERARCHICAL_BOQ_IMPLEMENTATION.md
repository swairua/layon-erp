# Hierarchical Fixed BOQ Implementation

## Overview

This document describes the hierarchical Fixed BOQ system implementation, which extends the flat `fixed_boq_items` table to support nested sections > subsections > items structures, matching professional BOQ formats like BOQ-085.

## Architecture

### Database Schema

#### New Tables

1. **`boq_fixed_structures`** - Defines hierarchical BOQ templates
   - `id` (UUID PK)
   - `company_id` (FK to companies)
   - `name` (VARCHAR) - Template name (e.g., "BOQ-085 Residential Maisonette")
   - `description` (TEXT)
   - `structure_data` (JSONB) - Nested section/subsection definitions
   - `is_active` (BOOLEAN)
   - `created_at`, `updated_at`

2. **`boq_fixed_items_v2`** - Hierarchical items with section/subsection mapping
   - `id` (UUID PK)
   - `company_id` (FK)
   - `structure_id` (FK to boq_fixed_structures)
   - `section_id` (TEXT) - e.g., "SECTION_A"
   - `subsection_id` (TEXT) - e.g., "MATERIALS"
   - `item_number` (VARCHAR) - Manual or auto-generated (e.g., "1", "2", "A", "B")
   - `description` (TEXT)
   - `unit` (TEXT)
   - `default_qty` (NUMERIC)
   - `default_rate` (NUMERIC)
   - `sort_order` (INTEGER)
   - `created_at`, `updated_at`

3. **`boq_fixed_items_migration_log`** - Tracks migration from legacy schema
   - For auditing and recovery purposes

#### Structure Data Format (JSONB)

```json
{
  "sections": [
    {
      "id": "SECTION_A",
      "name": "FOUNDATION",
      "subsections": [
        {
          "id": "MATERIALS",
          "name": "Subsection A: Materials"
        },
        {
          "id": "LABOR",
          "name": "Subsection B: Labor"
        }
      ]
    },
    {
      "id": "SECTION_B",
      "name": "GROUND FLOOR WALLING",
      "subsections": [
        {
          "id": "MATERIALS",
          "name": "Subsection A: Materials"
        }
      ]
    }
  ]
}
```

## Application Stack

### Services

**`src/services/hierarchicalBOQService.ts`**
- `createStructure()` - Create new structure template
- `getStructures()` - Fetch all templates for company
- `getHierarchicalData()` - Build complete hierarchical tree with calculations
- `insertItems()` - Bulk insert items
- `updateItem()` - Update single item
- `deleteItem()` - Delete item
- `migrateFromLegacy()` - Migrate from old fixed_boq_items table
- `exportForPDF()` - Export for PDF generation

### Utilities

**`src/utils/boqImportParser.ts`**
- `parseBOQText()` - Parse BOQ text with section/subsection detection
- `generateItemNumbers()` - Auto-generate numeric or alpha item numbers
- `validateBOQData()` - Validate parsed items before insertion

**`src/utils/hierarchicalBOQPdfGenerator.ts`**
- `generateHierarchicalBOQPDF()` - Generate formatted PDF with hierarchical structure
- Includes section headers, subsection tables, subtotals, and grand total

### UI Components

**`src/pages/FixedBOQHierarchical.tsx`**
- Structure selection and switching
- Import text interface (detects sections/subsections)
- Hierarchical table with expand/collapse
- Inline item editing (description, unit, qty, rate)
- Delete operations with confirmation
- PDF export
- Responsive layout

## Key Features

### 1. Hierarchical Organization
- **Sections**: Top-level groupings (e.g., "FOUNDATION", "WALLING")
- **Subsections**: Mid-level groupings (e.g., "Materials", "Labor")
- **Items**: Individual line items with qty, unit, rate

### 2. Collapsible UI
- Click section header to expand/collapse subsections
- Saves expanded state in component memory
- Clean visual hierarchy

### 3. Smart Item Numbering
- **Auto-increment**: Items numbered 1, 2, 3... within each subsection
- **Manual override**: Edit `item_number` field directly
- **Flexible format**: Supports numeric or alphabetic (A, B, C...)

### 4. Automatic Calculations
- **Amount** = Qty × Rate (per item)
- **Subsection Subtotal** = SUM(Amount)
- **Section Total** = SUM(Subsection Subtotals)
- **Grand Total** = SUM(Section Totals)

All calculations update in real-time as you edit quantities and rates.

### 5. Text-based Import
The import parser detects:
- **Section headers**: Lines matching pattern `SECTION [A-Z]:` or `SECTION NO.`
- **Subsection headers**: Lines matching `Subsection [A-Z]:` pattern
- **Item rows**: Parsed from table format (no/description/qty/unit/rate/amount)

Example input:
```
SECTION A: FOUNDATION

Subsection A: Materials
1 Ballast 7 Trucks 30,000.00 210,000.00
2 Sand 8 Trucks 30,000.00 240,000.00

Subsection B: Labor
1 Setting Out 1 Item 6,000.00 6,000.00
```

### 6. PDF Export
Generates professional PDF with:
- Company header (name, address, contact)
- Section headers with gray background
- Subsection tables with items
- Subsection subtotals
- Section totals (bold)
- Grand total (black background with white text)
- Page numbers and footer

## Migration from Legacy System

If you're moving from the flat `fixed_boq_items` table:

```typescript
// Migrate all existing items to new structure
const result = await hierarchicalBOQService.migrateFromLegacy(
  companyId,
  legacyItems
);

// Result:
// {
//   structure_id: "uuid",
//   migrated_count: 150
// }
```

The migration:
1. Creates a default structure: "Migrated Legacy BOQ - [date]"
2. Creates single section: "Migrated Items"
3. Creates single subsection: "Items"
4. Maps all legacy items with preserved data
5. Logs migration in `boq_fixed_items_migration_log`

Old `fixed_boq_items` table remains intact for fallback/reference.

## File Structure

```
migrations/
├── 20250527_hierarchical_boq_schema.sql       # Schema tables & RLS
└── 20250527_seed_hierarchical_boq_example.sql # Example data (optional)

src/
├── pages/
│   ├── FixedBOQ.tsx                          # Legacy flat interface
│   └── FixedBOQHierarchical.tsx               # New hierarchical interface
├── services/
│   └── hierarchicalBOQService.ts              # Core business logic
├── utils/
│   ├── boqImportParser.ts                    # Text import parsing
│   └── hierarchicalBOQPdfGenerator.ts         # PDF generation
├── types/
│   └── hierarchicalBOQ.ts                    # TypeScript interfaces
└── components/
    └── layout/
        └── Sidebar.tsx                        # Navigation (updated)

docs/
└── HIERARCHICAL_BOQ_IMPLEMENTATION.md         # This file
```

## Usage

### Creating a Structure Programmatically

```typescript
import { hierarchicalBOQService } from '@/services/hierarchicalBOQService';

const structure = await hierarchicalBOQService.createStructure(
  companyId,
  'BOQ-085 Residential Maisonette',
  'Proposed residential project',
  {
    sections: [
      {
        id: 'SECTION_A',
        name: 'FOUNDATION',
        subsections: [
          { id: 'MATERIALS', name: 'Subsection A: Materials' },
          { id: 'LABOR', name: 'Subsection B: Labor' }
        ]
      }
    ]
  }
);
```

### Adding Items

```typescript
await hierarchicalBOQService.insertItems([
  {
    company_id: companyId,
    structure_id: structureId,
    section_id: 'SECTION_A',
    subsection_id: 'MATERIALS',
    item_number: '1',
    description: 'Ballast',
    unit: 'Trucks',
    default_qty: 7,
    default_rate: 30000,
    sort_order: 0
  }
  // ... more items
]);
```

### Fetching Hierarchical Data

```typescript
const data = await hierarchicalBOQService.getHierarchicalData(structureId);

// data.sections[0].section_name = "FOUNDATION"
// data.sections[0].subsections[0].subtotal = 1209150.00
// data.grand_total = 16123890.00
```

### Exporting to PDF

```typescript
import { generateHierarchicalBOQPDF } from '@/utils/hierarchicalBOQPdfGenerator';

await generateHierarchicalBOQPDF(
  hierarchicalData,
  {
    name: 'Company Name',
    address: '123 Main St',
    city: 'Nairobi',
    country: 'Kenya',
    phone: '+254-123-456789',
    email: 'info@company.com'
  },
  'BOQ-085',
  new Date().toISOString()
);
// Browser downloads PDF: BOQ-085.pdf
```

## Testing Checklist

- [ ] Migration runs without errors
- [ ] New tables are created with correct indexes
- [ ] Can create structure with multiple sections/subsections
- [ ] Can import text with section/subsection detection
- [ ] Item editing updates all calculations correctly
- [ ] Item deletion removes from database and UI
- [ ] Section expand/collapse works
- [ ] PDF export generates valid PDF with correct layout
- [ ] Grand total calculation is accurate
- [ ] Multiple companies have isolated data
- [ ] RLS policies prevent cross-company data leakage

## Performance Considerations

1. **Indexes**: Created on `company_id`, `structure_id`, `section_id + subsection_id`
2. **Pagination**: For structures with 10,000+ items, consider:
   - Lazy-loading items by section
   - Server-side pagination
   - Virtual scrolling in UI
3. **Calculations**: All totals are computed in-memory (fast for typical BOQ sizes)
4. **PDF Generation**: May slow down for 100+ pages; consider chunking

## Backward Compatibility

- Legacy `fixed_boq_items` table remains untouched
- Old Fixed BOQ page (`/fixed-boq`) continues to work
- New hierarchical page (`/fixed-boq-hierarchical`) is separate
- Sidebar shows both options under "Fixed BOQ" dropdown

## Known Limitations

1. **No nested subsections**: Only 2 levels (section > subsection > items)
2. **Item numbering**: Auto-increment resets per subsection (not global)
3. **Manual structure creation**: UI only supports import; structure CRUD via API/code
4. **PDF styling**: Fixed layout; custom branding limited
5. **Concurrent edits**: No real-time synchronization (reload required)

## Future Enhancements

- [ ] UI for creating/editing structure templates
- [ ] Custom item numbering schemes (A.1, 1.1, etc.)
- [ ] Real-time collaborative editing
- [ ] Template library (save/reuse common structures)
- [ ] Import from Excel/CSV with auto-detection
- [ ] Section/subsection templates (copy from library)
- [ ] Budget tracking (target vs. actual cost)
- [ ] Approval workflows
- [ ] Export to Excel with formatting

## Troubleshooting

### Import produces no items
- Ensure text uses plain (unformatted) format
- Check section headers match pattern: `SECTION [A-Z]:` or `SECTION NO.`
- Subsections must start with: `Subsection [A-Z]:`
- Items must have multiple columns separated by spaces/pipes

### PDF not downloading
- Check browser console for errors
- Ensure company info is loaded
- Try smaller BOQ first (100 items)

### Missing calculations
- Verify `default_qty` and `default_rate` are numbers (not NULL)
- Reload page to refresh calculations

### Cross-company data visible
- Check RLS policies in database
- Verify `company_id` matches current user's company

## Support

For issues or questions:
1. Check the types in `src/types/hierarchicalBOQ.ts`
2. Review the service methods in `src/services/hierarchicalBOQService.ts`
3. Test manually via `/fixed-boq-hierarchical` page
4. Check Supabase logs for SQL errors
