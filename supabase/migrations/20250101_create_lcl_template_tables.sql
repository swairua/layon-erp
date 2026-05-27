-- Create LCL Template Structures table
CREATE TABLE IF NOT EXISTS lcl_template_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  structure_data JSONB NOT NULL DEFAULT '{"sections": []}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- Create LCL Template Items table
CREATE TABLE IF NOT EXISTS lcl_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  structure_id UUID NOT NULL REFERENCES lcl_template_structures(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  subsection_id TEXT NOT NULL,
  item_number TEXT NOT NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  default_qty NUMERIC(10, 2) DEFAULT 0,
  default_rate NUMERIC(10, 2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create LCL Template History table for audit logging
CREATE TABLE IF NOT EXISTS lcl_template_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  structure_id UUID REFERENCES lcl_template_structures(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  changed_by TEXT DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lcl_template_structures_company_id ON lcl_template_structures(company_id);
CREATE INDEX IF NOT EXISTS idx_lcl_template_items_structure_id ON lcl_template_items(structure_id);
CREATE INDEX IF NOT EXISTS idx_lcl_template_items_section_subsection ON lcl_template_items(section_id, subsection_id);
CREATE INDEX IF NOT EXISTS idx_lcl_template_history_company_id ON lcl_template_history(company_id);

-- Insert the default LCL BOQ structure for each company
INSERT INTO lcl_template_structures (
  company_id,
  name,
  description,
  structure_data,
  is_active
) 
SELECT 
  c.id,
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
      jsonb_build_object('id', 'section_d', 'name', 'Section D: First Floor Walling and Columns', 'subsections', jsonb_build_array(
        jsonb_build_object('id', 'section_d_materials', 'name', 'Materials'),
        jsonb_build_object('id', 'section_d_labor', 'name', 'Labor')
      )),
      jsonb_build_object('id', 'section_e', 'name', 'Section E: First Floor Suspended Slab', 'subsections', jsonb_build_array(
        jsonb_build_object('id', 'section_e_materials', 'name', 'Materials'),
        jsonb_build_object('id', 'section_e_labor', 'name', 'Labor')
      )),
      jsonb_build_object('id', 'section_f', 'name', 'Section F: Second Floor Walling and Columns', 'subsections', jsonb_build_array(
        jsonb_build_object('id', 'section_f_materials', 'name', 'Materials'),
        jsonb_build_object('id', 'section_f_labor', 'name', 'Labor')
      )),
      jsonb_build_object('id', 'section_g', 'name', 'Section G: Second Floor Suspended Slab', 'subsections', jsonb_build_array(
        jsonb_build_object('id', 'section_g_materials', 'name', 'Materials'),
        jsonb_build_object('id', 'section_g_labor', 'name', 'Labor')
      ))
    )
  ),
  true
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM lcl_template_structures 
  WHERE name = 'LCL Default BOQ' AND company_id = c.id
)
ON CONFLICT DO NOTHING;

-- Seed all items for the default LCL BOQ structure
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
  sort_order
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
  item.sort_order
FROM lcl_structures s,
LATERAL (
  -- SECTION A: FOUNDATION - MATERIALS
  SELECT 'section_a', 'section_a_materials', '1', 'Ballast', 'Trucks', 7::numeric, 30000::numeric, 0 UNION ALL
  SELECT 'section_a', 'section_a_materials', '2', 'Sand', 'Trucks', 8::numeric, 30000::numeric, 1 UNION ALL
  SELECT 'section_a', 'section_a_materials', '3', 'Cement', 'Bags', 230::numeric, 850::numeric, 2 UNION ALL
  SELECT 'section_a', 'section_a_materials', '4', 'D16', 'Pcs', 20::numeric, 2180::numeric, 3 UNION ALL
  SELECT 'section_a', 'section_a_materials', '5', 'D12', 'Pcs', 30::numeric, 1190::numeric, 4 UNION ALL
  SELECT 'section_a', 'section_a_materials', '6', 'D10', 'Pcs', 62::numeric, 825::numeric, 5 UNION ALL
  SELECT 'section_a', 'section_a_materials', '7', 'D8', 'Pcs', 80::numeric, 530::numeric, 6 UNION ALL
  SELECT 'section_a', 'section_a_materials', '8', 'Binding Wire', 'Rolls', 3::numeric, 2700::numeric, 7 UNION ALL
  SELECT 'section_a', 'section_a_materials', '9', 'Hacksaw Blades', 'Pcs', 10::numeric, 100::numeric, 8 UNION ALL
  SELECT 'section_a', 'section_a_materials', '10', 'Nails 3"', 'Kgs', 20::numeric, 180::numeric, 9 UNION ALL
  SELECT 'section_a', 'section_a_materials', '11', 'Nails 4"', 'Kgs', 20::numeric, 180::numeric, 10 UNION ALL
  SELECT 'section_a', 'section_a_materials', '12', 'Foundation Stones', 'Ft', 2800::numeric, 60::numeric, 11 UNION ALL
  SELECT 'section_a', 'section_a_materials', '13', 'Hoop Iron', 'Pcs', 8::numeric, 1500::numeric, 12 UNION ALL
  SELECT 'section_a', 'section_a_materials', '14', 'Hardcore/Murram', 'Trucks', 14::numeric, 6000::numeric, 13 UNION ALL
  SELECT 'section_a', 'section_a_materials', '15', 'D.p.m', 'Rolls', 8::numeric, 1500::numeric, 14 UNION ALL
  SELECT 'section_a', 'section_a_materials', '16', 'B.r.c A98', 'Rolls', 3::numeric, 19000::numeric, 15 UNION ALL
  SELECT 'section_a', 'section_a_materials', '17', 'Plumbing Items', 'Item', 1::numeric, 10000::numeric, 16 UNION ALL
  SELECT 'section_a', 'section_a_materials', '18', 'Termite Treatment', 'Ltrs', 2::numeric, 1200::numeric, 17 UNION ALL
  SELECT 'section_a', 'section_a_materials', '19', 'Timber 6 by 1', 'Ft', 800::numeric, 25::numeric, 18 UNION ALL
  SELECT 'section_a', 'section_a_materials', '20', 'Profiles', 'Pcs', 40::numeric, 200::numeric, 19 UNION ALL
  SELECT 'section_a', 'section_a_materials', '21', 'White Wash 25kg', 'Bags', 2::numeric, 250::numeric, 20 UNION ALL
  SELECT 'section_a', 'section_a_materials', '22', 'Setting Out Lines', 'Pcs', 10::numeric, 60::numeric, 21 UNION ALL
  
  -- SECTION A: FOUNDATION - LABOR
  SELECT 'section_a', 'section_a_labor', '1', 'Setting Out', 'Item', 1::numeric, 6000::numeric, 0 UNION ALL
  SELECT 'section_a', 'section_a_labor', '2', 'Bar Bending', 'Item', 1::numeric, 14000::numeric, 1 UNION ALL
  SELECT 'section_a', 'section_a_labor', '3', 'Excavation & Levelling', 'Item', 1::numeric, 40000::numeric, 2 UNION ALL
  SELECT 'section_a', 'section_a_labor', '4', 'Bases & Trenches Concreting', 'Item', 1::numeric, 24000::numeric, 3 UNION ALL
  SELECT 'section_a', 'section_a_labor', '5', 'Masonry Works', 'Item', 1::numeric, 120000::numeric, 4 UNION ALL
  SELECT 'section_a', 'section_a_labor', '6', 'Formwork', 'Item', 1::numeric, 8000::numeric, 5 UNION ALL
  SELECT 'section_a', 'section_a_labor', '7', 'Column Concreting', 'Item', 1::numeric, 14000::numeric, 6 UNION ALL
  SELECT 'section_a', 'section_a_labor', '8', 'Backfilling & Compaction', 'Item', 1::numeric, 22000::numeric, 7 UNION ALL
  SELECT 'section_a', 'section_a_labor', '9', 'Laying Of D.p.m, Termite Treatment & Laying of B.r.c', 'Item', 1::numeric, 6000::numeric, 8 UNION ALL
  SELECT 'section_a', 'section_a_labor', '10', 'Plumbing Works', 'Item', 1::numeric, 8000::numeric, 9 UNION ALL
  SELECT 'section_a', 'section_a_labor', '11', 'Foundation Slab Concreting', 'Item', 1::numeric, 28000::numeric, 10 UNION ALL
  
  -- SECTION B: GROUND FLOOR WALLING - MATERIALS
  SELECT 'section_b', 'section_b_materials', '1', 'Machine Cut Stones 9 by 9', 'Pcs', 2800::numeric, 60::numeric, 0 UNION ALL
  SELECT 'section_b', 'section_b_materials', '2', 'Riversand', 'Trucks', 2::numeric, 30000::numeric, 1 UNION ALL
  SELECT 'section_b', 'section_b_materials', '3', 'Ballast', 'Trucks', 1::numeric, 30000::numeric, 2 UNION ALL
  SELECT 'section_b', 'section_b_materials', '4', 'Cement', 'Bags', 90::numeric, 850::numeric, 3 UNION ALL
  SELECT 'section_b', 'section_b_materials', '5', 'D 16', 'Pcs', 27::numeric, 2180::numeric, 4 UNION ALL
  SELECT 'section_b', 'section_b_materials', '6', 'D8', 'Pcs', 20::numeric, 530::numeric, 5 UNION ALL
  SELECT 'section_b', 'section_b_materials', '7', 'Binding Wire', 'Rolls', 1::numeric, 2700::numeric, 6 UNION ALL
  SELECT 'section_b', 'section_b_materials', '8', 'Hacksaw Blades', 'Pcs', 10::numeric, 100::numeric, 7 UNION ALL
  SELECT 'section_b', 'section_b_materials', '9', 'Timber 6x1', 'Ft', 1000::numeric, 25::numeric, 8 UNION ALL
  SELECT 'section_b', 'section_b_materials', '10', 'Nails 3"', 'Kgs', 5::numeric, 180::numeric, 9 UNION ALL
  SELECT 'section_b', 'section_b_materials', '11', 'Nails 4"', 'Kgs', 5::numeric, 180::numeric, 10 UNION ALL
  
  -- SECTION B: GROUND FLOOR WALLING - LABOR
  SELECT 'section_b', 'section_b_labor', '1', 'Setting & Levelling', 'Item', 1::numeric, 12000::numeric, 0 UNION ALL
  SELECT 'section_b', 'section_b_labor', '2', 'Bar Bending', 'Item', 1::numeric, 14000::numeric, 1 UNION ALL
  SELECT 'section_b', 'section_b_labor', '3', 'Masonry works', 'Item', 1::numeric, 140000::numeric, 2 UNION ALL
  SELECT 'section_b', 'section_b_labor', '4', 'Column Formwork', 'Item', 1::numeric, 12000::numeric, 3 UNION ALL
  SELECT 'section_b', 'section_b_labor', '5', 'Column Concreting', 'Item', 1::numeric, 16000::numeric, 4 UNION ALL
  
  -- SECTION C: GROUND FLOOR SUSPENDED SLAB - MATERIALS
  SELECT 'section_c', 'section_c_materials', '1', 'Timber 3x2', 'Ft', 2000::numeric, 25::numeric, 0 UNION ALL
  SELECT 'section_c', 'section_c_materials', '2', 'Timber 6x1', 'Ft', 1500::numeric, 25::numeric, 1 UNION ALL
  SELECT 'section_c', 'section_c_materials', '3', 'Profiles', 'Pcs', 250::numeric, 180::numeric, 2 UNION ALL
  SELECT 'section_c', 'section_c_materials', '4', 'Trappers', 'Pcs', 180::numeric, 120::numeric, 3 UNION ALL
  SELECT 'section_c', 'section_c_materials', '5', 'Nails 4"', 'Bags', 1::numeric, 8000::numeric, 4 UNION ALL
  SELECT 'section_c', 'section_c_materials', '6', 'Nails 3"', 'Bags', 1::numeric, 8000::numeric, 5 UNION ALL
  SELECT 'section_c', 'section_c_materials', '7', 'D16', 'Pcs', 12::numeric, 2180::numeric, 6 UNION ALL
  SELECT 'section_c', 'section_c_materials', '8', 'D12', 'Pcs', 70::numeric, 1190::numeric, 7 UNION ALL
  SELECT 'section_c', 'section_c_materials', '9', 'D10', 'Pcs', 320::numeric, 825::numeric, 8 UNION ALL
  SELECT 'section_c', 'section_c_materials', '10', 'D8', 'Pcs', 90::numeric, 530::numeric, 9 UNION ALL
  SELECT 'section_c', 'section_c_materials', '11', 'Binding Wire', 'Rolls', 5::numeric, 2700::numeric, 10 UNION ALL
  SELECT 'section_c', 'section_c_materials', '12', 'Blades', 'Pcs', 20::numeric, 100::numeric, 11 UNION ALL
  SELECT 'section_c', 'section_c_materials', '13', 'Ballast', 'Trucks', 6::numeric, 30000::numeric, 12 UNION ALL
  SELECT 'section_c', 'section_c_materials', '14', 'Riversand', 'Trucks', 4::numeric, 30000::numeric, 13 UNION ALL
  SELECT 'section_c', 'section_c_materials', '15', 'Cement', 'Bags', 180::numeric, 850::numeric, 14 UNION ALL
  SELECT 'section_c', 'section_c_materials', '16', 'Electrical Items', 'Item', 1::numeric, 15000::numeric, 15 UNION ALL
  SELECT 'section_c', 'section_c_materials', '17', 'Plumbing Items', 'Item', 1::numeric, 10000::numeric, 16 UNION ALL
  
  -- SECTION C: GROUND FLOOR SUSPENDED SLAB - LABOR
  SELECT 'section_c', 'section_c_labor', '1', 'Formwork', 'Item', 1::numeric, 70000::numeric, 0 UNION ALL
  SELECT 'section_c', 'section_c_labor', '2', 'Bar Bending', 'Item', 1::numeric, 60000::numeric, 1 UNION ALL
  SELECT 'section_c', 'section_c_labor', '3', 'Electrical Works', 'Item', 1::numeric, 18000::numeric, 2 UNION ALL
  SELECT 'section_c', 'section_c_labor', '4', 'Plumbing Works', 'Item', 1::numeric, 10000::numeric, 3 UNION ALL
  SELECT 'section_c', 'section_c_labor', '5', 'Concreting', 'Item', 1::numeric, 40000::numeric, 4 UNION ALL
  
  -- SECTION D: FIRST FLOOR WALLING AND COLUMNS - MATERIALS
  SELECT 'section_d', 'section_d_materials', '1', 'Machine Cut Stones 9 by 9', 'Pcs', 2800::numeric, 60::numeric, 0 UNION ALL
  SELECT 'section_d', 'section_d_materials', '2', 'Riversand', 'Trucks', 2::numeric, 30000::numeric, 1 UNION ALL
  SELECT 'section_d', 'section_d_materials', '3', 'Ballast', 'Trucks', 1::numeric, 30000::numeric, 2 UNION ALL
  SELECT 'section_d', 'section_d_materials', '4', 'Cement', 'Bags', 90::numeric, 850::numeric, 3 UNION ALL
  SELECT 'section_d', 'section_d_materials', '5', 'D 16', 'Pcs', 27::numeric, 2180::numeric, 4 UNION ALL
  SELECT 'section_d', 'section_d_materials', '6', 'D8', 'Pcs', 20::numeric, 530::numeric, 5 UNION ALL
  SELECT 'section_d', 'section_d_materials', '7', 'Binding wire', 'Rolls', 1::numeric, 2700::numeric, 6 UNION ALL
  SELECT 'section_d', 'section_d_materials', '8', 'Hacksaw Blades', 'Pcs', 10::numeric, 100::numeric, 7 UNION ALL
  SELECT 'section_d', 'section_d_materials', '9', 'Timber 6x1', 'Ft', 1000::numeric, 25::numeric, 8 UNION ALL
  SELECT 'section_d', 'section_d_materials', '10', 'Nails 3"', 'Kgs', 5::numeric, 180::numeric, 9 UNION ALL
  SELECT 'section_d', 'section_d_materials', '11', 'Nails 4"', 'Kgs', 5::numeric, 180::numeric, 10 UNION ALL
  
  -- SECTION D: FIRST FLOOR WALLING AND COLUMNS - LABOR
  SELECT 'section_d', 'section_d_labor', '1', 'Setting & Levelling', 'Item', 1::numeric, 12000::numeric, 0 UNION ALL
  SELECT 'section_d', 'section_d_labor', '2', 'Bar Bending', 'Item', 1::numeric, 14000::numeric, 1 UNION ALL
  SELECT 'section_d', 'section_d_labor', '3', 'Masonry Works', 'Item', 1::numeric, 150000::numeric, 2 UNION ALL
  SELECT 'section_d', 'section_d_labor', '4', 'Column Formwork', 'Item', 1::numeric, 12000::numeric, 3 UNION ALL
  SELECT 'section_d', 'section_d_labor', '5', 'Column Concreting', 'Item', 1::numeric, 16000::numeric, 4 UNION ALL
  
  -- SECTION E: FIRST FLOOR SUSPENDED SLAB - MATERIALS
  SELECT 'section_e', 'section_e_materials', '1', 'Timber 3x2', 'Ft', 2000::numeric, 25::numeric, 0 UNION ALL
  SELECT 'section_e', 'section_e_materials', '2', 'Timber 6x1', 'Ft', 1500::numeric, 25::numeric, 1 UNION ALL
  SELECT 'section_e', 'section_e_materials', '3', 'Profiles', 'Pcs', 250::numeric, 180::numeric, 2 UNION ALL
  SELECT 'section_e', 'section_e_materials', '4', 'Trappers', 'Pcs', 180::numeric, 120::numeric, 3 UNION ALL
  SELECT 'section_e', 'section_e_materials', '5', 'Nails 4"', 'Bags', 1::numeric, 8000::numeric, 4 UNION ALL
  SELECT 'section_e', 'section_e_materials', '6', 'Nails 3"', 'Bags', 1::numeric, 8000::numeric, 5 UNION ALL
  SELECT 'section_e', 'section_e_materials', '7', 'D16', 'Item', 12::numeric, 2180::numeric, 6 UNION ALL
  SELECT 'section_e', 'section_e_materials', '8', 'D12', 'Item', 70::numeric, 1190::numeric, 7 UNION ALL
  SELECT 'section_e', 'section_e_materials', '9', 'D10', 'Item', 320::numeric, 825::numeric, 8 UNION ALL
  SELECT 'section_e', 'section_e_materials', '10', 'D8', 'Item', 80::numeric, 530::numeric, 9 UNION ALL
  SELECT 'section_e', 'section_e_materials', '11', 'Binding Wire', 'Item', 5::numeric, 2700::numeric, 10 UNION ALL
  SELECT 'section_e', 'section_e_materials', '12', 'Blades', 'Item', 20::numeric, 100::numeric, 11 UNION ALL
  SELECT 'section_e', 'section_e_materials', '13', 'Ballast', 'Item', 6::numeric, 30000::numeric, 12 UNION ALL
  SELECT 'section_e', 'section_e_materials', '14', 'Riversand', 'Item', 4::numeric, 30000::numeric, 13 UNION ALL
  SELECT 'section_e', 'section_e_materials', '15', 'Cement', 'Bags', 180::numeric, 850::numeric, 14 UNION ALL
  SELECT 'section_e', 'section_e_materials', '16', 'Electrical Items', 'Item', 1::numeric, 15000::numeric, 15 UNION ALL
  SELECT 'section_e', 'section_e_materials', '17', 'Plumbing Items', 'Item', 1::numeric, 10000::numeric, 16 UNION ALL
  
  -- SECTION E: FIRST FLOOR SUSPENDED SLAB - LABOR
  SELECT 'section_e', 'section_e_labor', '1', 'Formwork', 'Item', 1::numeric, 70000::numeric, 0 UNION ALL
  SELECT 'section_e', 'section_e_labor', '2', 'Bar Bending', 'Item', 1::numeric, 60000::numeric, 1 UNION ALL
  SELECT 'section_e', 'section_e_labor', '3', 'Electrical Works', 'Item', 1::numeric, 18000::numeric, 2 UNION ALL
  SELECT 'section_e', 'section_e_labor', '4', 'Plumbing Works', 'Item', 1::numeric, 10000::numeric, 3 UNION ALL
  SELECT 'section_e', 'section_e_labor', '5', 'Concreting', 'Item', 1::numeric, 40000::numeric, 4 UNION ALL
  
  -- SECTION F: SECOND FLOOR WALLING AND COLUMNS - MATERIALS
  SELECT 'section_f', 'section_f_materials', '1', 'Machine Cut Stones 9x9', 'Pcs', 1400::numeric, 60::numeric, 0 UNION ALL
  SELECT 'section_f', 'section_f_materials', '2', 'Riversand', 'Trucks', 1::numeric, 30000::numeric, 1 UNION ALL
  SELECT 'section_f', 'section_f_materials', '3', 'Ballast', 'Trucks', 1::numeric, 30000::numeric, 2 UNION ALL
  SELECT 'section_f', 'section_f_materials', '4', 'Cement', 'Bags', 60::numeric, 850::numeric, 3 UNION ALL
  SELECT 'section_f', 'section_f_materials', '5', 'D16', 'Pcs', 14::numeric, 2180::numeric, 4 UNION ALL
  SELECT 'section_f', 'section_f_materials', '6', 'D8', 'Pcs', 10::numeric, 530::numeric, 5 UNION ALL
  SELECT 'section_f', 'section_f_materials', '7', 'Binding Wire', 'Rolls', 1::numeric, 2700::numeric, 6 UNION ALL
  SELECT 'section_f', 'section_f_materials', '8', 'Blades', 'Pcs', 5::numeric, 100::numeric, 7 UNION ALL
  SELECT 'section_f', 'section_f_materials', '9', 'Timber 6X1', 'Ft', 500::numeric, 25::numeric, 8 UNION ALL
  SELECT 'section_f', 'section_f_materials', '10', 'Nails 3"', 'Kgs', 3::numeric, 180::numeric, 9 UNION ALL
  SELECT 'section_f', 'section_f_materials', '11', 'Nails 4"', 'Kgs', 3::numeric, 180::numeric, 10 UNION ALL
  
  -- SECTION F: SECOND FLOOR WALLING AND COLUMNS - LABOR
  SELECT 'section_f', 'section_f_labor', '1', 'Setting & Levelling', 'Item', 6::numeric, 12000::numeric, 0 UNION ALL
  SELECT 'section_f', 'section_f_labor', '2', 'Bar Bending', 'Item', 7::numeric, 14000::numeric, 1 UNION ALL
  SELECT 'section_f', 'section_f_labor', '3', 'Masonry Works', 'Item', 70::numeric, 140000::numeric, 2 UNION ALL
  SELECT 'section_f', 'section_f_labor', '4', 'Column Formwork', 'Item', 6::numeric, 12000::numeric, 3 UNION ALL
  SELECT 'section_f', 'section_f_labor', '5', 'Column Concreting', 'Item', 8::numeric, 16000::numeric, 4 UNION ALL
  
  -- SECTION G: SECOND FLOOR SUSPENDED SLAB - MATERIALS
  SELECT 'section_g', 'section_g_materials', '1', 'Timber 3x2', 'Ft', 0::numeric, 25::numeric, 0 UNION ALL
  SELECT 'section_g', 'section_g_materials', '2', 'Timber 6x1', 'Ft', 0::numeric, 25::numeric, 1 UNION ALL
  SELECT 'section_g', 'section_g_materials', '3', 'Profiles', 'Pcs', 250::numeric, 180::numeric, 2 UNION ALL
  SELECT 'section_g', 'section_g_materials', '4', 'Trappers', 'Pcs', 90::numeric, 180::numeric, 3 UNION ALL
  SELECT 'section_g', 'section_g_materials', '5', 'Nails 4"', 'Kgs', 10::numeric, 8000::numeric, 4 UNION ALL
  SELECT 'section_g', 'section_g_materials', '6', 'Nails 3"', 'Kgs', 10::numeric, 8000::numeric, 5 UNION ALL
  SELECT 'section_g', 'section_g_materials', '7', 'D16', 'Pcs', 6::numeric, 2180::numeric, 6 UNION ALL
  SELECT 'section_g', 'section_g_materials', '8', 'D12', 'Pcs', 35::numeric, 1180::numeric, 7 UNION ALL
  SELECT 'section_g', 'section_g_materials', '9', 'D10', 'Pcs', 160::numeric, 825::numeric, 8 UNION ALL
  SELECT 'section_g', 'section_g_materials', '10', 'D8', 'Pcs', 40::numeric, 530::numeric, 9 UNION ALL
  SELECT 'section_g', 'section_g_materials', '11', 'Binding Wire', 'Pcs', 2::numeric, 2700::numeric, 10 UNION ALL
  SELECT 'section_g', 'section_g_materials', '12', 'Blades', 'Pcs', 10::numeric, 100::numeric, 11 UNION ALL
  SELECT 'section_g', 'section_g_materials', '13', 'Ballast', 'Trucks', 3::numeric, 30000::numeric, 12 UNION ALL
  SELECT 'section_g', 'section_g_materials', '14', 'Riversand', 'Trucks', 2::numeric, 30000::numeric, 13 UNION ALL
  SELECT 'section_g', 'section_g_materials', '15', 'Cement', 'Bags', 90::numeric, 850::numeric, 14 UNION ALL
  SELECT 'section_g', 'section_g_materials', '16', 'Electrical Items', 'Item', 1::numeric, 7500::numeric, 15 UNION ALL
  SELECT 'section_g', 'section_g_materials', '17', 'Plumbing Items', 'Item', 1::numeric, 5000::numeric, 16 UNION ALL
  
  -- SECTION G: SECOND FLOOR SUSPENDED SLAB - LABOR
  SELECT 'section_g', 'section_g_labor', '1', 'Formwork', 'Item', 1::numeric, 35000::numeric, 0 UNION ALL
  SELECT 'section_g', 'section_g_labor', '2', 'Bar Bending', 'Item', 1::numeric, 30000::numeric, 1 UNION ALL
  SELECT 'section_g', 'section_g_labor', '3', 'Electrical Works', 'Item', 1::numeric, 90000::numeric, 2 UNION ALL
  SELECT 'section_g', 'section_g_labor', '4', 'Plumbing Works', 'Item', 1::numeric, 5000::numeric, 3 UNION ALL
  SELECT 'section_g', 'section_g_labor', '5', 'Concreting', 'Item', 1::numeric, 30000::numeric, 4
) AS item(section_id, subsection_id, item_number, description, unit, qty, rate, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM lcl_template_items 
  WHERE structure_id = s.id AND section_id = item.section_id AND subsection_id = item.subsection_id AND item_number = item.item_number
)
ON CONFLICT DO NOTHING;
