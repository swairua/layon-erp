-- Remove "D 16" (with space) from Section B Materials
-- Keep "D16" (without space)

DELETE FROM lcl_template_items
WHERE section_id = 'section_b'
  AND subsection_id = 'section_b_materials'
  AND description = 'D 16'
  AND unit = 'Pcs'
  AND default_qty = 27
  AND default_rate = 2180;
