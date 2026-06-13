# BOQ Workflows Comparison Guide

## Executive Summary

This document provides a side-by-side comparison of the three BOQ workflows available in the system. Choose the workflow that best fits your project structure and workflow requirements.

## Quick Comparison Table

| Feature | Standard BOQ | Hierarchical BOQ | LCL BOQ |
|---------|--------------|-----------------|---------|
| **Structure** | Flat sections with items | Nested: Sections → Subsections → Items | Template-based with categories |
| **Complexity** | Simple/medium projects | Complex multi-section projects | Repetitive, standardized items |
| **Nesting Levels** | 2 (Sections, Items) | 3 (Sections, Subsections, Items) | 1 (Categories, Items) |
| **Draft Autosave** | Yes (boq_drafts table) | Planned | Limited |
| **Approval Workflow** | Planned (draft/pending/approved) | Planned | Basic (draft/saved) |
| **Template Support** | No | No (structure templates only) | Yes (item templates) |
| **Invoice Conversion** | Direct (boqs → invoices) | Direct | Direct with conversion |
| **PDF Generation** | Full BOQ PDF | Hierarchical PDF | Template-based PDF |
| **Import/Export** | Text import, Excel export | Text/file import | CSV template import |
| **Calculation** | Client-side | Server-side (cached) | Client-side |
| **Data Volume** | Small-medium items per BOQ | Large items per BOQ | Medium items per BOQ |
| **Primary Use Case** | General quotations | Construction/engineering | Repeatable cost lists |

## Detailed Workflow Descriptions

### 1. Standard BOQ

**Best for**: General quotations, straightforward projects, simple cost breakdowns

**Data Model**: `boqs` table + `boq_drafts` for autosave

**Structure**:
```
BOQ
├─ Section A
│  ├─ Item 1: Description, Qty, Price
│  ├─ Item 2: Description, Qty, Price
│  └─ Item 3: Description, Qty, Price
└─ Section B
   ├─ Item 4: Description, Qty, Price
   └─ Item 5: Description, Qty, Price
```

**Key Features**:
- ✅ Real-time draft autosave (every 30 seconds)
- ✅ Multiple concurrent create sessions (via draft_token)
- ✅ Seamless conversion to invoices
- ✅ Client information included (name, email, address)
- ✅ Rich T&C support with calculated values display
- ✅ Attachment URLs for supporting documents
- ❌ No deep nesting (2 levels max)
- ❌ No item grouping beyond sections
- ❌ No pre-defined templates

**Use Cases**:
- Service quotations
- Product quotes
- Simple construction estimates
- Time-based billing

**Workflow**:
```
Create → Edit (Auto-draft) → Finalize → Convert to Invoice
  ↓
  Save Draft (for later continuation)
```

**Database**:
- Main: `boqs` (company-scoped)
- Draft: `boq_drafts` (user + token scoped)
- Status: draft → pending_approval → approved → converted

### 2. Hierarchical BOQ

**Best for**: Complex construction projects, engineering proposals, multi-phase work

**Data Model**: `boq_fixed_structures` + `boq_fixed_items_v2`

**Structure**:
```
BOQ (Structure)
├─ SECTION A: Foundation Works
│  ├─ MATERIALS (Subsection)
│  │  ├─ Item: Cement 50kg bags
│  │  ├─ Item: Sand (m3)
│  │  └─ Item: Gravel (m3)
│  └─ LABOR (Subsection)
│     ├─ Item: Skilled Mason (days)
│     └─ Item: Unskilled Labour (days)
└─ SECTION B: Structural Works
   ├─ CONCRETE (Subsection)
   │  └─ Item: Concrete Grade M20 (m3)
   └─ STEEL (Subsection)
      └─ Item: Reinforcement Steel (kg)
```

**Key Features**:
- ✅ Deep hierarchical organization (3 levels)
- ✅ Section and subsection subtotals calculated server-side
- ✅ Cost breakdown visualization
- ✅ Structured for large BOQs (100+ items)
- ✅ Structure reusability across projects
- ❌ No autosave (manual save required)
- ❌ No built-in approval workflow
- ❌ Less flexible for one-off projects

**Use Cases**:
- Building construction estimates
- Civil engineering projects
- Large infrastructure BOQs
- Multi-phase project planning
- Professional engineering firms

**Workflow**:
```
Define Structure → Add Items → Calculate Totals → Convert to Invoice
                (Sections/Subsections)
```

**Database**:
- Structures: `boq_fixed_structures` (templates)
- Items: `boq_fixed_items_v2` (actual data)
- Audit: `boq_fixed_items_migration_log` (optional)

### 3. LCL BOQ (Level Cost List)

**Best for**: Standardized item reuse, template-based quotes, rapid BOQ generation

**Data Model**: `lcl_boqs` + `lcl_template_items`

**Structure**:
```
LCL BOQ (Snapshot from template)
├─ Materials (Category)
│  ├─ Item: Cement 50kg bags (Qty, Price)
│  ├─ Item: Sand m3 (Qty, Price)
│  └─ Item: Gravel m3 (Qty, Price)
├─ Labour (Category)
│  ├─ Item: Skilled Mason (Qty, Price)
│  └─ Item: Unskilled Labour (Qty, Price)
└─ Equipment (Category)
   └─ Item: Equipment Rental (Qty, Price)

Template Items (Reusable)
├─ MAT-001: Cement (default qty, price)
├─ MAT-002: Sand (default qty, price)
├─ LAB-001: Skilled Mason (default qty, price)
└─ EQU-001: Equipment Rental (default qty, price)
```

**Key Features**:
- ✅ Pre-defined item library (templates)
- ✅ Rapid BOQ creation (select items from template)
- ✅ Consistent item codes and descriptions
- ✅ Category-based organization
- ✅ Item snapshots for audit trail
- ✅ Bulk import from CSV
- ❌ Less flexible for custom items
- ❌ Limited nesting (2 levels)
- ❌ No deep hierarchy support

**Use Cases**:
- Contractors with standard cost lists
- Manufacturers with product catalogs
- Services with repeatable pricing
- Rapid quote generation
- Multi-project consistency

**Workflow**:
```
Create Template Items → Select Items → Create BOQ (Snapshot) → Convert
                                           ↓
                                     Adjust Qty/Price
```

**Database**:
- Templates: `lcl_template_items` (master data)
- BOQs: `lcl_boqs` (instances with snapshots)
- Status: draft → saved

## Choosing the Right Workflow

### Decision Tree

```
Is this a one-off, unique project?
├─ YES → Standard BOQ
│        (flexible, autosave, no templates)
└─ NO → Do you have repeating items?
        ├─ YES → LCL BOQ
        │        (templates, rapid creation)
        └─ NO → Is it heavily hierarchical?
                ├─ YES → Hierarchical BOQ
                │        (3-level nesting, complex)
                └─ NO → Standard BOQ
                        (simple, straightforward)
```

### Scenario Examples

**Scenario 1**: Client requests a quote for 5 different services
→ **Use**: Standard BOQ
- Quick to create
- Auto-saves as you work
- Easy to convert to invoice

**Scenario 2**: Construction company estimating a 50-story building
→ **Use**: Hierarchical BOQ
- Sections for each floor/phase
- Subsections for materials, labor, equipment
- Clear breakdown of costs
- Reusable structure for similar projects

**Scenario 3**: Contracting firm with 200+ standard items they always use
→ **Use**: LCL BOQ
- Create template items once
- Select 20-30 items from template
- BOQ generated in minutes
- Consistent pricing across all projects

**Scenario 4**: Service provider with 3-4 standard packages
→ **Use**: LCL BOQ
- Package A: 10 standard items (email, support, hosting)
- Package B: 15 standard items (all of A + plus design, reporting)
- Create new BOQ by selecting template package

## Data Relationships

### Linking Between Workflows

```
┌─────────────────────────────────────────────────┐
│              Invoice (final)                     │
│         (all three workflows convert)            │
└──────────────────────┬──────────────────────────┘
                       │
            ┌──────────┼──────────┐
            ↓          ↓          ↓
        ┌────────┐ ┌──────────┐ ┌────────┐
        │ BOQs   │ │Hierarchy │ │LCL BOQ │
        │(flat)  │ │(nested)  │ │(template)
        └────────┘ └──────────┘ └────────┘
            ↓          ↓          ↓
        Draft      Structure   Template
        Save       Definition  Items
```

### Migration Paths

**Standard → Hierarchical**:
- Parse flat items into hierarchical structure
- Group items by section/subsection
- Recalculate totals

**Standard → LCL**:
- Extract unique items
- Create template items in `lcl_template_items`
- Use for future BOQs

**Hierarchical → LCL**:
- Extract leaf items with category grouping
- Create template items
- Future BOQs based on templates

## Field Mapping Across Workflows

| Field | Standard BOQ | Hierarchical BOQ | LCL BOQ |
|-------|--------------|------------------|---------|
| Company Scope | company_id | company_id | company_id |
| BOQ Number | number | (structure_id) | number |
| Date | boq_date | (item created_at) | boq_date |
| Client Info | client_* fields | ❌ Not included | customer_id only |
| Items | data.sections[] | boq_fixed_items_v2 | items_snapshot |
| Quantities | item.quantity | item.quantity | item.quantity |
| Unit Price | item.unit_price | item.unit_price | item.unit_price |
| Totals | subtotal, tax_amount, total_amount | Calculated server-side | Calculated from snapshot |
| Status | draft/approved/converted | ❌ (planned) | draft/saved |
| Approval | ❌ (planned fields) | ❌ (planned) | Basic workflow |

## Performance Considerations

### Query Performance

**Standard BOQ**:
- Fast for <100 items
- Indexes on company_id, number
- JSONB queries for section-level filtering

**Hierarchical BOQ**:
- Fast for any item count (server-side calc)
- Indexes on structure_id, section/subsection
- Efficient grouping queries

**LCL BOQ**:
- Fastest (simple table scans)
- Indexes on company_id, category
- No complex calculations

### Storage

**Standard BOQ**: ~1-2KB per item (JSONB)
**Hierarchical BOQ**: ~500B per item (normalized)
**LCL BOQ**: ~300B per item + template overhead

## Integration Points

All three workflows integrate with:
- **Invoices**: Direct conversion (all types)
- **Audit Logs**: All create/update/delete actions tracked
- **PDF Generator**: Workflow-specific rendering
- **Reporting**: Company-level aggregation
- **Customers**: Customer reference (Standard & LCL only)

## Recommended Best Practices

### Standard BOQ
- Use for one-off, custom projects
- Leverage autosave to avoid data loss
- Create from scratch or previous quote template
- Convert directly to invoice when approved

### Hierarchical BOQ
- Define reusable structures upfront
- Use subsections for major cost categories
- Name subsections for clarity (MATERIALS, LABOR, etc.)
- Review calculated totals before conversion

### LCL BOQ
- Maintain clean, non-duplicate template items
- Use consistent item codes (MAT-, LAB-, EQU-, etc.)
- Establish category guidelines
- Review and update template prices regularly
- Bulk import for large item library

## Future Roadmap

### Q3 2025
- [ ] Standard BOQ: Approval workflow (pending → approved states)
- [ ] Hierarchical BOQ: Autosave support
- [ ] All BOQs: Email notifications

### Q4 2025
- [ ] All BOQs: Version control and audit trail UI
- [ ] Hierarchical BOQ: Approval workflow
- [ ] LCL BOQ: Variant pricing (volume discounts)

### 2026
- [ ] Cross-workflow migration tools
- [ ] Unified BOQ dashboard
- [ ] AI-powered item suggestions (LCL templates)
- [ ] Mobile app support (read-only initially)
