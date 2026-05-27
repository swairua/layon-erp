# Hierarchical BOQ - Quick Reference

## Architecture at a Glance

```
User Interface (React)
    ↓
FixedBOQHierarchical.tsx (Page Component)
    ↓
hierarchicalBOQService.ts (Business Logic)
    ↓
Database (Supabase PostgreSQL)
    ├── boq_fixed_structures (Templates)
    ├── boq_fixed_items_v2 (Items)
    └── boq_fixed_items_migration_log (Audit Trail)
```

## Quick Code Examples

### 1. Load & Display BOQ

```typescript
// In component
const [structure, setStructure] = useState<BOQFixedStructure | null>(null);
const [hierarchical, setHierarchical] = useState<BOQHierarchicalData | null>(null);

useEffect(() => {
  if (!structure) return;
  
  const loadData = async () => {
    const data = await hierarchicalBOQService.getHierarchicalData(structure.id);
    setHierarchical(data);
  };
  loadData();
}, [structure]);
```

### 2. Import BOQ Text

```typescript
const handleImport = async () => {
  const parseResult = parseBOQText(importText);
  
  if (!parseResult.success) {
    toast.error('Import failed');
    return;
  }

  const validation = validateBOQData(parseResult.parsed_items);
  if (!validation.valid) {
    toast.error('Validation failed');
    return;
  }

  // Convert to DB format and insert
  const items = parseResult.parsed_items.map(item => ({
    company_id: companyId,
    structure_id: selectedStructure.id,
    section_id: item.section_id,
    subsection_id: item.subsection_id,
    item_number: item.item_number,
    description: item.description,
    unit: item.unit || 'Item',
    default_qty: item.qty,
    default_rate: item.rate,
    sort_order: item.sort_order,
  }));

  await hierarchicalBOQService.insertItems(items);
  await loadHierarchicalData(); // Reload UI
};
```

### 3. Edit Item & Update Calculations

```typescript
const handleUpdateItem = async (itemId: string, updates: Partial<BOQFixedItemV2>) => {
  await hierarchicalBOQService.updateItem(itemId, updates);
  
  // Recalculate and refresh UI
  const freshData = await hierarchicalBOQService.getHierarchicalData(structure.id);
  setHierarchical(freshData); // Totals update automatically
};
```

### 4. Generate PDF

```typescript
const handleDownloadPDF = async () => {
  await generateHierarchicalBOQPDF(
    hierarchicalData,
    {
      name: currentCompany.name,
      address: currentCompany.address,
      // ... more company info
    },
    'BOQ-085',
    new Date().toISOString()
  );
  // Browser downloads PDF automatically
};
```

## Data Structures

### BOQFixedStructure
```typescript
{
  id: string;                    // UUID
  company_id: string;            // Multi-tenancy
  name: string;                  // "BOQ-085 Residential Maisonette"
  description?: string;
  structure_data: {
    sections: [
      {
        id: string;              // "SECTION_A"
        name: string;            // "FOUNDATION"
        subsections: [
          {
            id: string;          // "MATERIALS"
            name: string;        // "Subsection A: Materials"
          }
        ]
      }
    ]
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### BOQFixedItemV2
```typescript
{
  id: string;                    // UUID
  company_id: string;
  structure_id: string;          // FK
  section_id: string;            // "SECTION_A"
  subsection_id: string;         // "MATERIALS"
  item_number?: string;          // "1", "2", "A", etc.
  description: string;           // "Ballast"
  unit: string;                  // "Trucks", "Bags", etc.
  default_qty?: number;          // 7
  default_rate?: number;         // 30000
  sort_order: number;            // 0, 1, 2...
  created_at: string;
  updated_at: string;
}
```

### BOQHierarchicalData
```typescript
{
  structure: BOQFixedStructure;
  sections: [
    {
      section_id: string;
      section_name: string;
      subsections: [
        {
          subsection_id: string;
          subsection_name: string;
          items: BOQFixedItemV2[];
          subtotal: number;          // Auto-calculated
        }
      ];
      total: number;                 // Auto-calculated
    }
  ];
  grand_total: number;               // Auto-calculated
  item_count: number;
}
```

## Service Methods

### Structures
```typescript
// Create
const struct = await hierarchicalBOQService.createStructure(
  companyId, name, description, structureData
);

// Read
const structures = await hierarchicalBOQService.getStructures(companyId);
const structure = await hierarchicalBOQService.getStructure(structureId);

// Update
const updated = await hierarchicalBOQService.updateStructure(
  structureId, { name, description, structure_data }
);
```

### Items
```typescript
// Create
const items = await hierarchicalBOQService.insertItems([item1, item2, ...]);

// Read
const items = await hierarchicalBOQService.getStructureItems(structureId);
const hierarchical = await hierarchicalBOQService.getHierarchicalData(structureId);

// Update
const updated = await hierarchicalBOQService.updateItem(itemId, { 
  default_qty: 10, 
  default_rate: 5000 
});

// Delete
await hierarchicalBOQService.deleteItem(itemId);
await hierarchicalBOQService.deleteSubsectionItems(structureId, sectionId, subsectionId);
```

### Export
```typescript
// PDF export format
const pdfData = await hierarchicalBOQService.exportForPDF(structureId);
// Returns: { structure_name, sections[], grand_total }
```

### Migration
```typescript
const result = await hierarchicalBOQService.migrateFromLegacy(
  companyId,
  legacyFixedBOQItems
);
// Returns: { structure_id, migrated_count }
```

## Import Parser

### Parse Text
```typescript
import { parseBOQText, validateBOQData } from '@/utils/boqImportParser';

const result = parseBOQText(userProvidedText);

if (result.success) {
  // result.parsed_items: ParsedBOQItem[]
  // result.detected_sections: string[]
  // result.detected_subsections: string[]
  
  const validation = validateBOQData(result.parsed_items);
  if (validation.valid) {
    // Ready to insert
  } else {
    console.error(validation.errors);
  }
}
```

### Expected Text Format

```
SECTION A: FOUNDATION

Subsection A: Materials
NO  DESCRIPTION                QTY  UNIT    RATE        AMOUNT
1   Ballast                    7    Trucks  30,000.00   210,000.00
2   Sand                       8    Trucks  30,000.00   240,000.00

Subsection B: Labor
1   Setting Out                1    Item    6,000.00    6,000.00

SECTION B: GROUND FLOOR WALLING

Subsection A: Materials
1   Machine Cut Stones 9x9     2800 Pcs     60.00       168,000.00
```

## UI Components

### FixedBOQHierarchical.tsx Features
- ✅ Structure dropdown selector
- ✅ Import text modal
- ✅ Collapsible sections
- ✅ Inline item editor (all fields editable)
- ✅ Delete with confirmation
- ✅ Real-time total calculations
- ✅ PDF export button

### Key Component State
```typescript
const [structures, setStructures] = useState<BOQFixedStructure[]>([]);
const [selectedStructure, setSelectedStructure] = useState<BOQFixedStructure | null>(null);
const [hierarchicalData, setHierarchicalData] = useState<BOQHierarchicalData | null>(null);
const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
const [editingItem, setEditingItem] = useState<BOQFixedItemV2 | null>(null);
```

## Database Tables

### boq_fixed_structures
```sql
CREATE TABLE boq_fixed_structures (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  structure_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_boq_fixed_structures_company ON boq_fixed_structures(company_id);
```

### boq_fixed_items_v2
```sql
CREATE TABLE boq_fixed_items_v2 (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  structure_id UUID REFERENCES boq_fixed_structures(id),
  section_id TEXT NOT NULL,
  subsection_id TEXT NOT NULL,
  item_number VARCHAR(50),
  description TEXT NOT NULL,
  unit TEXT DEFAULT 'Item',
  default_qty NUMERIC(12,2),
  default_rate NUMERIC(12,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_boq_fixed_items_v2_company ON boq_fixed_items_v2(company_id);
CREATE INDEX idx_boq_fixed_items_v2_structure ON boq_fixed_items_v2(structure_id);
CREATE INDEX idx_boq_fixed_items_v2_section_subsection ON boq_fixed_items_v2(section_id, subsection_id);
```

## Routes & Navigation

### URL
- **New Page**: `/fixed-boq-hierarchical`
- **Legacy**: `/fixed-boq` (still works)

### Sidebar Navigation
```
Fixed BOQ
├── Standard → /fixed-boq
└── Hierarchical → /fixed-boq-hierarchical
```

## Calculation Logic

All calculations are **real-time** and update as user edits:

```typescript
// For each item
const amount = (default_qty || 0) * (default_rate || 0);

// For each subsection
const subtotal = items.reduce((sum, item) => {
  return sum + ((item.default_qty || 0) * (item.default_rate || 0));
}, 0);

// For each section
const total = subsections.reduce((sum, sub) => sum + sub.subtotal, 0);

// Grand total
const grandTotal = sections.reduce((sum, sec) => sum + sec.total, 0);
```

## Error Handling

### Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "No structure selected" | User didn't choose structure | Show structure selector |
| "Import failed: No items" | Bad text format | Check section/subsection headers |
| "Validation failed" | Missing required fields | Ensure all items have description |
| "Database error" | RLS policy denied | Check company_id matches |

## Performance Tips

- ✅ Indexes created on `company_id`, `structure_id`, `section_id + subsection_id`
- ✅ Lazy-load page component with Suspense
- ✅ Memoize calculations with `useMemo()`
- ✅ Consider pagination for 10,000+ items
- ✅ PDF generation may be slow for 100+ pages

## Testing

```typescript
// Test structure creation
const struct = await hierarchicalBOQService.createStructure(...);
assert(struct.id !== undefined);

// Test item insertion
const items = await hierarchicalBOQService.insertItems([...]);
assert(items.length > 0);

// Test hierarchical data
const data = await hierarchicalBOQService.getHierarchicalData(struct.id);
assert(data.grand_total > 0);

// Test calculations
assert(data.sections[0].total === expectedTotal);
assert(data.grand_total === expectedGrandTotal);
```

## Files at a Glance

| File | Purpose | Lines |
|------|---------|-------|
| `migrations/20250527_hierarchical_boq_schema.sql` | DB schema | 112 |
| `src/types/hierarchicalBOQ.ts` | TypeScript types | 100 |
| `src/services/hierarchicalBOQService.ts` | Business logic | 343 |
| `src/utils/boqImportParser.ts` | Text import parsing | 226 |
| `src/utils/hierarchicalBOQPdfGenerator.ts` | PDF generation | 310 |
| `src/pages/FixedBOQHierarchical.tsx` | UI component | 490 |
| **TOTAL** | | **1,581** |

---

**Need more details?** See `docs/HIERARCHICAL_BOQ_IMPLEMENTATION.md` for complete documentation.
