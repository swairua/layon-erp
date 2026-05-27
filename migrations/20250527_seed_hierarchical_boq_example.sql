-- This is a manual seed file for the hierarchical BOQ system
-- It demonstrates how to populate the example BOQ-085 structure
-- Run this AFTER the main schema migration

-- Note: This seed uses a placeholder company_id
-- You'll need to replace it with an actual company_id from your system
-- Or this can be modified to work with a specific company context

-- Example: Creating the BOQ-085 Residential Maisonette structure
-- Uncomment and modify the company_id before running

/*

-- Step 1: Insert the BOQ structure template
INSERT INTO boq_fixed_structures (
  company_id,
  name,
  description,
  structure_data,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,  -- REPLACE WITH ACTUAL COMPANY_ID
  'BOQ-085 Proposed Residential Maisonette',
  'Bill of Quantities for a proposed residential maisonette project by Layons Construction Ltd',
  '{
    "sections": [
      {
        "id": "SECTION_A",
        "name": "SECTION A: FOUNDATION",
        "subsections": [
          {"id": "MATERIALS", "name": "Subsection A: Materials"},
          {"id": "LABOR", "name": "Subsection B: Labor"}
        ]
      },
      {
        "id": "SECTION_B",
        "name": "SECTION B: GROUND FLOOR WALLING",
        "subsections": [
          {"id": "MATERIALS", "name": "Subsection A: Materials"},
          {"id": "LABOR", "name": "Subsection B: Labor"}
        ]
      },
      {
        "id": "SECTION_C",
        "name": "SECTION C: GROUND FLOOR SUSPENDED SLAB",
        "subsections": [
          {"id": "MATERIALS", "name": "Subsection A: Materials"},
          {"id": "LABOR", "name": "Subsection B: Labor"}
        ]
      },
      {
        "id": "SECTION_D",
        "name": "SECTION D: FIRST FLOOR WALLING AND COLUMNS",
        "subsections": [
          {"id": "MATERIALS", "name": "Subsection A: Materials"},
          {"id": "LABOR", "name": "Subsection B: Labor"}
        ]
      },
      {
        "id": "SECTION_E",
        "name": "SECTION E: FIRST FLOOR SUSPENDED SLAB",
        "subsections": [
          {"id": "MATERIALS", "name": "Subsection A: Materials"},
          {"id": "LABOR", "name": "Subsection B: Labor"}
        ]
      },
      {
        "id": "SECTION_F",
        "name": "SECTION F: SECOND FLOOR WALLING & COLUMNS",
        "subsections": [
          {"id": "MATERIALS", "name": "Subsection A: Materials"},
          {"id": "LABOR", "name": "Subsection B: Labor"}
        ]
      },
      {
        "id": "SECTION_G",
        "name": "SECTION G: SECOND FLOOR SUSPENDED SLAB",
        "subsections": [
          {"id": "MATERIALS", "name": "Subsection A: Materials"},
          {"id": "LABOR", "name": "Subsection B: Labor"}
        ]
      }
    ]
  }'::jsonb,
  true
) RETURNING id as structure_id;

-- Step 2: Copy the returned structure_id and use it below
-- Example items for SECTION A: FOUNDATION - Subsection A: Materials
INSERT INTO boq_fixed_items_v2 (
  company_id,
  structure_id,
  section_id,
  subsection_id,
  item_number,
  description,
  unit,
  default_qty,
  default_rate,
  sort_order
) VALUES
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '1', 'Ballast', 'Trucks', 7, 30000, 0),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '2', 'Sand', 'Trucks', 8, 30000, 1),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '3', 'Cement', 'Bags', 230, 850, 2),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '4', 'D16', 'Pcs', 20, 2180, 3),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '5', 'D12', 'Pcs', 30, 1190, 4),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '6', 'D10', 'Pcs', 62, 825, 5),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '7', 'D8', 'Pcs', 80, 530, 6),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '8', 'Binding Wire', 'Rolls', 3, 2700, 7),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '9', 'Hacksaw Blades', 'Pcs', 10, 100, 8),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '10', 'Nails 3"', 'Kgs', 20, 180, 9),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '11', 'Nails 4"', 'Kgs', 20, 180, 10),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '12', 'Foundation Stones', 'Ft', 2800, 60, 11),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '13', 'Hoop Iron', 'Pcs', 8, 1500, 12),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '14', 'Hardcore/Murram', 'Trucks', 14, 6000, 13),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '15', 'D.p.m', 'Rolls', 8, 1500, 14),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '16', 'B.r.c A98', 'Rolls', 3, 19000, 15),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '17', 'Plumbing Items', 'Item', 1, 10000, 16),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '18', 'Termite Treatment', 'Ltrs', 2, 1200, 17),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '19', 'Timber 6 by 1', 'Ft', 800, 25, 18),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '20', 'Profiles', 'Pcs', 40, 200, 19),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '21', 'White Wash 25kg', 'Bags', 2, 250, 20),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'MATERIALS', '22', 'Setting Out Lines', 'Pcs', 10, 60, 21);

-- Step 3: Add labor items for SECTION A
INSERT INTO boq_fixed_items_v2 (
  company_id,
  structure_id,
  section_id,
  subsection_id,
  item_number,
  description,
  unit,
  default_qty,
  default_rate,
  sort_order
) VALUES
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'LABOR', '1', 'Setting Out', 'Item', 1, 6000, 0),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'LABOR', '2', 'Bar Bending', 'Item', 1, 14000, 1),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'LABOR', '3', 'Excavation & Levelling', 'Item', 1, 40000, 2),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'LABOR', '4', 'Bases & Trenches Concreting', 'Item', 1, 24000, 3),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'LABOR', '5', 'Masonry Works', 'Item', 1, 120000, 4),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'LABOR', '6', 'Formwork', 'Item', 1, 8000, 5),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'LABOR', '7', 'Column Concreting', 'Item', 1, 14000, 6),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'LABOR', '8', 'Backfilling & Compaction', 'Item', 1, 22000, 7),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'LABOR', '9', 'Laying Of D.p.m, Termite Treatment & Laying of B.r.c', 'Item', 1, 6000, 8),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'LABOR', '10', 'Plumbing Works', 'Item', 1, 8000, 9),
  ('00000000-0000-0000-0000-000000000000'::uuid, '<STRUCTURE_ID>'::uuid, 'SECTION_A', 'LABOR', '11', 'Foundation Slab Concreting', 'Item', 1, 28000, 10);

*/

-- To use this seed file:
-- 1. Get a company_id from your companies table: SELECT id, name FROM companies LIMIT 1;
-- 2. Replace '00000000-0000-0000-0000-000000000000' with your actual company_id
-- 3. Replace '<STRUCTURE_ID>' with the id returned from the structure insert
-- 4. Uncomment the SQL and run it
-- 5. Visit /fixed-boq-hierarchical to see the imported structure
