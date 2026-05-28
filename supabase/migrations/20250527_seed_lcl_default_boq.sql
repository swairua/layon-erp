-- Seed LCL Default BOQ structure with data from BOQ-085 (PROPOSED RESIDENTIAL MAISONETTE)
-- This migration creates a default LCL BOQ structure and populates it with all items from the PDF

-- Insert a special LCL BOQ structure (per company)
-- Note: This assumes a function or trigger will auto-create this for each company, or we seed it once globally
-- For now, we'll create a migration-friendly approach using a placeholder company_id

-- Structure definition with sections A-G
INSERT INTO lcl_template_structures (
  company_id,
  name,
  description,
  structure_data,
  is_active,
  created_at,
  updated_at
) 
SELECT 
  companies.id,
  'LCL Default BOQ',
  'Default BOQ structure for Layons Construction projects (BOQ-085: Proposed Residential Maisonette)',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object('id', 'section_a', 'name', 'Section A: Foundation', 'subsections', jsonb_build_array(
        jsonb_build_object('id', 'section_a_materials', 'name', 'Materials'),
        jsonb_build_object('id', 'section_a_labor', 'name', 'Labor')
      )),
      jsonb_build_object('id', 'section_b', 'name', 'Section B: Ground Floor Walling', 'subsections', jsonb_build_array(
        jsonb_build_object('id', 'section_b_materials', 'name', 'Materials'),
        jsonb_build_object('id', 'section_b_labor', 'name', 'Labor')
      )),
      jsonb_build_object('id', 'section_c', 'name', 'Section C: Ground Floor Suspended Slab', 'subsections', jsonb_build_array(
        jsonb_build_object('id', 'section_c_materials', 'name', 'Materials'),
        jsonb_build_object('id', 'section_c_labor', 'name', 'Labor')
      )),
      jsonb_build_object('id', 'section_d', 'name', 'Section D: First Floor Walling and Columns', 'parent_section_id', 'section_b', 'subsections', jsonb_build_array(
        jsonb_build_object('id', 'section_d_materials', 'name', 'Materials'),
        jsonb_build_object('id', 'section_d_labor', 'name', 'Labor')
      )),
      jsonb_build_object('id', 'section_e', 'name', 'Section E: First Floor Suspended Slab', 'parent_section_id', 'section_c', 'subsections', jsonb_build_array(
        jsonb_build_object('id', 'section_e_materials', 'name', 'Materials'),
        jsonb_build_object('id', 'section_e_labor', 'name', 'Labor')
      )),
      jsonb_build_object('id', 'section_f', 'name', 'Section F: Second Floor Walling and Columns', 'parent_section_id', 'section_b', 'subsections', jsonb_build_array(
        jsonb_build_object('id', 'section_f_materials', 'name', 'Materials'),
        jsonb_build_object('id', 'section_f_labor', 'name', 'Labor')
      )),
      jsonb_build_object('id', 'section_g', 'name', 'Section G: Second Floor Suspended Slab', 'parent_section_id', 'section_c', 'subsections', jsonb_build_array(
        jsonb_build_object('id', 'section_g_materials', 'name', 'Materials'),
        jsonb_build_object('id', 'section_g_labor', 'name', 'Labor')
      ))
    )
  ),
  true,
  NOW(),
  NOW()
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM lcl_template_structures 
  WHERE name = 'LCL Default BOQ' AND company_id = companies.id
)
ON CONFLICT DO NOTHING;

-- Helper: Get the default LCL structure IDs by company
WITH lcl_structures AS (
  SELECT id, company_id FROM lcl_template_structures 
  WHERE name = 'LCL Default BOQ'
)
INSERT INTO lcl_template_items (
  company_id,
  structure_id,
  section_id,
  subsection_id,
  item_number,
  description,
  unit,
  default_qty,
  default_rate,
  sort_order,
  created_at,
  updated_at
)
SELECT 
  s.company_id,
  s.id,
  item.section_id,
  item.subsection_id,
  item.item_number,
  item.description,
  item.unit,
  item.qty,
  item.rate,
  item.sort_order,
  NOW(),
  NOW()
FROM lcl_structures s,
LATERAL (
  -- SECTION A: FOUNDATION - MATERIALS
  SELECT 'section_a', 'section_a_materials', '1', 'Ballast', 'Trucks', 7, 30000, 0 UNION ALL
  SELECT 'section_a', 'section_a_materials', '2', 'Sand', 'Trucks', 8, 30000, 1 UNION ALL
  SELECT 'section_a', 'section_a_materials', '3', 'Cement', 'Bags', 230, 850, 2 UNION ALL
  SELECT 'section_a', 'section_a_materials', '4', 'Quarry dust', 'Trucks', 20, 2180, 3 UNION ALL
  SELECT 'section_a', 'section_a_materials', '5', 'Rock sand', 'Trucks', 2, 30000, 4 UNION ALL
  SELECT 'section_a', 'section_a_materials', '6', 'D20', 'Pcs', 5, 2700, 5 UNION ALL
  SELECT 'section_a', 'section_a_materials', '7', 'D12', 'Pcs', 30, 1190, 6 UNION ALL
  SELECT 'section_a', 'section_a_materials', '8', 'D10', 'Pcs', 62, 825, 7 UNION ALL
  SELECT 'section_a', 'section_a_materials', '9', 'D8', 'Pcs', 80, 530, 8 UNION ALL
  SELECT 'section_a', 'section_a_materials', '10', 'Binding Wire', 'Rolls', 3, 2700, 9 UNION ALL
  SELECT 'section_a', 'section_a_materials', '11', 'Hacksaw Blades', 'Pcs', 10, 100, 10 UNION ALL
  SELECT 'section_a', 'section_a_materials', '12', 'Nails 3"', 'Kgs', 20, 180, 11 UNION ALL
  SELECT 'section_a', 'section_a_materials', '13', 'Nails 4"', 'Kgs', 20, 180, 12 UNION ALL
  SELECT 'section_a', 'section_a_materials', '14', 'Foundation Stones', 'Ft', 2800, 60, 13 UNION ALL
  SELECT 'section_a', 'section_a_materials', '15', 'Hoop Iron', 'Pcs', 8, 1500, 14 UNION ALL
  SELECT 'section_a', 'section_a_materials', '16', 'Hardcore/Murram', 'Trucks', 14, 6000, 15 UNION ALL
  SELECT 'section_a', 'section_a_materials', '17', 'D.p.m', 'Rolls', 8, 1500, 16 UNION ALL
  SELECT 'section_a', 'section_a_materials', '18', 'B.r.c A98', 'Rolls', 3, 19000, 17 UNION ALL
  SELECT 'section_a', 'section_a_materials', '19', 'Plumbing Items', 'Item', 1, 10000, 18 UNION ALL
  SELECT 'section_a', 'section_a_materials', '20', 'Termite Treatment', 'Ltrs', 2, 1200, 19 UNION ALL
  SELECT 'section_a', 'section_a_materials', '21', 'Timber 6 by 1', 'Ft', 800, 25, 20 UNION ALL
  SELECT 'section_a', 'section_a_materials', '22', 'Profiles', 'Pcs', 40, 200, 21 UNION ALL
  SELECT 'section_a', 'section_a_materials', '23', 'White Wash 25kg', 'Bags', 2, 250, 22 UNION ALL
  SELECT 'section_a', 'section_a_materials', '24', 'Setting Out Lines', 'Pcs', 10, 60, 23 UNION ALL
  
  -- SECTION A: FOUNDATION - LABOR
  SELECT 'section_a', 'section_a_labor', '1', 'Setting Out', 'Item', 1, 6000, 0 UNION ALL
  SELECT 'section_a', 'section_a_labor', '2', 'Bar Bending', 'Item', 1, 14000, 1 UNION ALL
  SELECT 'section_a', 'section_a_labor', '3', 'Excavation & Levelling', 'Item', 1, 40000, 2 UNION ALL
  SELECT 'section_a', 'section_a_labor', '4', 'Bases & Trenches Concreting', 'Item', 1, 24000, 3 UNION ALL
  SELECT 'section_a', 'section_a_labor', '5', 'Masonry Works', 'Item', 1, 120000, 4 UNION ALL
  SELECT 'section_a', 'section_a_labor', '6', 'Formwork', 'Item', 1, 8000, 5 UNION ALL
  SELECT 'section_a', 'section_a_labor', '7', 'Column Concreting', 'Item', 1, 14000, 6 UNION ALL
  SELECT 'section_a', 'section_a_labor', '8', 'Backfilling & Compaction', 'Item', 1, 22000, 7 UNION ALL
  SELECT 'section_a', 'section_a_labor', '9', 'Laying Of D.p.m, Termite Treatment & Laying of B.r.c', 'Item', 1, 6000, 8 UNION ALL
  SELECT 'section_a', 'section_a_labor', '10', 'Plumbing Works', 'Item', 1, 8000, 9 UNION ALL
  SELECT 'section_a', 'section_a_labor', '11', 'Foundation Slab Concreting', 'Item', 1, 28000, 10 UNION ALL
  
  -- SECTION B: GROUND FLOOR WALLING - MATERIALS
  SELECT 'section_b', 'section_b_materials', '1', 'Machine Cut Stones 6 by 9', 'Pcs', 2800, 60, 0 UNION ALL
  SELECT 'section_b', 'section_b_materials', '2', 'Machine-cut 6x9', 'Pcs', 100, 60, 1 UNION ALL
  SELECT 'section_b', 'section_b_materials', '3', 'Quarry dust', 'Trucks', 1, 30000, 2 UNION ALL
  SELECT 'section_b', 'section_b_materials', '4', 'Rock sand', 'Trucks', 2, 30000, 3 UNION ALL
  SELECT 'section_b', 'section_b_materials', '5', 'Sand', 'Trucks', 2, 30000, 4 UNION ALL
  SELECT 'section_b', 'section_b_materials', '6', 'Cement', 'Bags', 90, 850, 5 UNION ALL
  SELECT 'section_b', 'section_b_materials', '7', 'D20', 'Pcs', 5, 2700, 6 UNION ALL
  SELECT 'section_b', 'section_b_materials', '8', 'D16', 'Pcs', 27, 2180, 7 UNION ALL
  SELECT 'section_b', 'section_b_materials', '9', 'D12', 'Pcs', 15, 1190, 8 UNION ALL
  SELECT 'section_b', 'section_b_materials', '10', 'D10', 'Pcs', 20, 825, 9 UNION ALL
  SELECT 'section_b', 'section_b_materials', '11', 'D8', 'Pcs', 20, 530, 10 UNION ALL
  SELECT 'section_b', 'section_b_materials', '12', 'Binding Wire', 'Rolls', 1, 2700, 11 UNION ALL
  SELECT 'section_b', 'section_b_materials', '13', 'Hacksaw Blades', 'Pcs', 10, 100, 12 UNION ALL
  SELECT 'section_b', 'section_b_materials', '14', 'Timber 6x1', 'Ft', 1000, 25, 13 UNION ALL
  SELECT 'section_b', 'section_b_materials', '15', 'Nails 3"', 'Kgs', 5, 180, 14 UNION ALL
  SELECT 'section_b', 'section_b_materials', '16', 'Nails 4"', 'Kgs', 5, 180, 15 UNION ALL
  
  -- SECTION B: GROUND FLOOR WALLING - LABOR
  SELECT 'section_b', 'section_b_labor', '1', 'Setting & Levelling', 'Item', 1, 12000, 0 UNION ALL
  SELECT 'section_b', 'section_b_labor', '2', 'Bar Bending', 'Item', 1, 14000, 1 UNION ALL
  SELECT 'section_b', 'section_b_labor', '3', 'Masonry works', 'Item', 1, 140000, 2 UNION ALL
  SELECT 'section_b', 'section_b_labor', '4', 'Column Formwork', 'Item', 1, 12000, 3 UNION ALL
  SELECT 'section_b', 'section_b_labor', '5', 'Column Concreting', 'Item', 1, 16000, 4 UNION ALL
  
  -- SECTION C: GROUND FLOOR SUSPENDED SLAB - MATERIALS
  SELECT 'section_c', 'section_c_materials', '1', 'Quarry dust', 'Trucks', 1, 30000, 0 UNION ALL
  SELECT 'section_c', 'section_c_materials', '2', 'Rock sand', 'Trucks', 2, 30000, 1 UNION ALL
  SELECT 'section_c', 'section_c_materials', '3', 'Timber 3x2', 'Ft', 2000, 25, 2 UNION ALL
  SELECT 'section_c', 'section_c_materials', '4', 'Timber 6x1', 'Ft', 1500, 25, 3 UNION ALL
  SELECT 'section_c', 'section_c_materials', '5', 'Profiles', 'Pcs', 250, 180, 4 UNION ALL
  SELECT 'section_c', 'section_c_materials', '6', 'Trappers', 'Pcs', 180, 120, 5 UNION ALL
  SELECT 'section_c', 'section_c_materials', '7', 'Nails 4"', 'Bags', 1, 8000, 6 UNION ALL
  SELECT 'section_c', 'section_c_materials', '8', 'Nails 3"', 'Bags', 1, 8000, 7 UNION ALL
  SELECT 'section_c', 'section_c_materials', '9', 'D16', 'Pcs', 12, 2180, 8 UNION ALL
  SELECT 'section_c', 'section_c_materials', '10', 'D12', 'Pcs', 70, 1190, 9 UNION ALL
  SELECT 'section_c', 'section_c_materials', '11', 'D10', 'Pcs', 320, 825, 10 UNION ALL
  SELECT 'section_c', 'section_c_materials', '12', 'D8', 'Pcs', 90, 530, 11 UNION ALL
  SELECT 'section_c', 'section_c_materials', '13', 'Binding Wire', 'Rolls', 5, 2700, 12 UNION ALL
  SELECT 'section_c', 'section_c_materials', '14', 'Blades', 'Pcs', 20, 100, 13 UNION ALL
  SELECT 'section_c', 'section_c_materials', '15', 'Cutting disks', 'Pcs', 10, 150, 14 UNION ALL
  SELECT 'section_c', 'section_c_materials', '16', 'D.P.M', 'Rolls', 8, 1500, 15 UNION ALL
  SELECT 'section_c', 'section_c_materials', '17', 'Ballast', 'Trucks', 6, 30000, 16 UNION ALL
  SELECT 'section_c', 'section_c_materials', '18', 'Cement', 'Bags', 180, 850, 17 UNION ALL
  SELECT 'section_c', 'section_c_materials', '19', 'Electrical Items', 'Item', 1, 15000, 18 UNION ALL
  SELECT 'section_c', 'section_c_materials', '20', 'Plumbing Items', 'Item', 1, 10000, 19 UNION ALL
  
  -- SECTION C: GROUND FLOOR SUSPENDED SLAB - LABOR
  SELECT 'section_c', 'section_c_labor', '1', 'Formwork', 'Item', 1, 70000, 0 UNION ALL
  SELECT 'section_c', 'section_c_labor', '2', 'Bar Bending', 'Item', 1, 60000, 1 UNION ALL
  SELECT 'section_c', 'section_c_labor', '3', 'Electrical Works', 'Item', 1, 18000, 2 UNION ALL
  SELECT 'section_c', 'section_c_labor', '4', 'Plumbing Works', 'Item', 1, 10000, 3 UNION ALL
  SELECT 'section_c', 'section_c_labor', '5', 'Concreting', 'Item', 1, 40000, 4 UNION ALL
  
) AS item(section_id, subsection_id, item_number, description, unit, qty, rate, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM lcl_template_items 
  WHERE structure_id = s.id AND section_id = item.section_id AND subsection_id = item.subsection_id AND item_number = item.item_number
);
