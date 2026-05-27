-- =========================================================
-- UPDATE AND INSERT: LCL BOQ ADDITIONAL ITEMS
-- =========================================================
-- This script adds the missing items to the LCL Default BOQ template
-- based on the BOQ-086 specification from Layons Construction Limited

-- =========================================================
-- SECTION A: FOUNDATION - MATERIALS
-- =========================================================
-- Add items before D16 (need to renumber existing D16, D12, D10, D8 items)

-- First, update existing items in Section A to make room for new items
UPDATE lcl_template_items
SET item_number = '6'
WHERE section_id = 'section_a' 
  AND subsection_id = 'section_a_materials'
  AND description = 'D16'
  AND sort_order = 3;

UPDATE lcl_template_items
SET item_number = '7'
WHERE section_id = 'section_a' 
  AND subsection_id = 'section_a_materials'
  AND description = 'D12'
  AND sort_order = 4;

UPDATE lcl_template_items
SET item_number = '8'
WHERE section_id = 'section_a' 
  AND subsection_id = 'section_a_materials'
  AND description = 'D10'
  AND sort_order = 5;

UPDATE lcl_template_items
SET item_number = '9'
WHERE section_id = 'section_a' 
  AND subsection_id = 'section_a_materials'
  AND description = 'D8'
  AND sort_order = 6;

-- Now insert the new items for Section A Materials (before D16)
WITH section_a_struct AS (
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
  'section_a',
  'section_a_materials',
  item.item_number,
  item.description,
  item.unit,
  item.qty,
  item.rate,
  item.sort_order,
  NOW(),
  NOW()
FROM section_a_struct s
CROSS JOIN LATERAL (
  VALUES
  ('4', 'Quarry Dust', 'Trucks', 1, 30000, 3),
  ('5', 'Rock Sand', 'Trucks', 2, 30000, 4),
  ('6', 'D20', 'Pcs', 10, 1000, 5)
) AS item(item_number, description, unit, qty, rate, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM lcl_template_items li
  WHERE li.structure_id = s.id
  AND li.section_id = 'section_a'
  AND li.subsection_id = 'section_a_materials'
  AND li.description = item.description
);

-- =========================================================
-- SECTION B: GROUND FLOOR WALLING - MATERIALS
-- =========================================================

-- Update existing items in Section B Materials to make room
UPDATE lcl_template_items
SET item_number = '4'
WHERE section_id = 'section_b' 
  AND subsection_id = 'section_b_materials'
  AND description = 'Machine Cut Stones 9 by 9'
  AND sort_order = 0;

UPDATE lcl_template_items
SET item_number = '5'
WHERE section_id = 'section_b' 
  AND subsection_id = 'section_b_materials'
  AND description = 'Machine-cut 6x9'
  AND sort_order = 1;

-- Insert new items for Section B Materials (after item 1, before the existing 2)
WITH section_b_struct AS (
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
  'section_b',
  'section_b_materials',
  item.item_number,
  item.description,
  item.unit,
  item.qty,
  item.rate,
  item.sort_order,
  NOW(),
  NOW()
FROM section_b_struct s
CROSS JOIN LATERAL (
  VALUES
  ('2', 'Machine-cut 6x9', 'Pcs', 100, 60, 1),
  ('3', 'Quarry dust', 'Trucks', 1, 30000, 2),
  ('3', 'Rock sand', 'Trucks', 2, 30000, 3)
) AS item(item_number, description, unit, qty, rate, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM lcl_template_items li
  WHERE li.structure_id = s.id
  AND li.section_id = 'section_b'
  AND li.subsection_id = 'section_b_materials'
  AND li.description = item.description
);

-- Insert D20, D12, D10, D8 for Section B Materials
WITH section_b_struct AS (
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
  'section_b',
  'section_b_materials',
  item.item_number,
  item.description,
  item.unit,
  item.qty,
  item.rate,
  item.sort_order,
  NOW(),
  NOW()
FROM section_b_struct s
CROSS JOIN LATERAL (
  VALUES
  ('6', 'D20', 'Pcs', 10, 1000, 5),
  ('7', 'D16', 'Pcs', 20, 2180, 6),
  ('8', 'D12', 'Pcs', 30, 1190, 7),
  ('9', 'D10', 'Pcs', 62, 825, 8),
  ('10', 'D8', 'Pcs', 80, 530, 9)
) AS item(item_number, description, unit, qty, rate, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM lcl_template_items li
  WHERE li.structure_id = s.id
  AND li.section_id = 'section_b'
  AND li.subsection_id = 'section_b_materials'
  AND li.description = item.description
);

-- =========================================================
-- SECTION C: GROUND FLOOR SUSPENDED SLAB - MATERIALS
-- =========================================================

-- Update Sand to change from Riversand (if needed)
UPDATE lcl_template_items
SET description = 'Sand'
WHERE section_id = 'section_c' 
  AND subsection_id = 'section_c_materials'
  AND (description = 'Riversand' OR description = 'riversand');

-- Insert new items for Section C Materials (after Sand)
WITH section_c_struct AS (
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
  'section_c',
  'section_c_materials',
  item.item_number,
  item.description,
  item.unit,
  item.qty,
  item.rate,
  item.sort_order,
  NOW(),
  NOW()
FROM section_c_struct s
CROSS JOIN LATERAL (
  VALUES
  ('3', 'Quarry dust', 'Trucks', 1, 30000, 2),
  ('4', 'Rock sand', 'Trucks', 2, 30000, 3),
  ('5', 'Cutting discs', 'Pcs', 5, 500, 4),
  ('6', 'D.P.M', 'Rolls', 1, 5000, 5)
) AS item(item_number, description, unit, qty, rate, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM lcl_template_items li
  WHERE li.structure_id = s.id
  AND li.section_id = 'section_c'
  AND li.subsection_id = 'section_c_materials'
  AND li.description = item.description
);

-- =========================================================
-- End of script
-- =========================================================
