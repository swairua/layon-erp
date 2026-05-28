-- Add Section H: Roofing to LCL Default BOQ structure
-- This migration adds Section H (Roofing) with Materials and Labor subsections to the existing BOQ template

-- Helper: Get the default LCL structure IDs by company
WITH lcl_structures AS (
  SELECT id, company_id FROM lcl_template_structures
  WHERE name = 'LCL Default BOQ'
    AND NOT (structure_data->'sections' @> jsonb_build_array(jsonb_build_object('id', 'section_h')))
),
update_structures AS (
  -- Update existing structures to append Section H (only if it doesn't already exist)
  UPDATE lcl_template_structures
  SET structure_data = jsonb_set(
    structure_data,
    '{sections}',
    structure_data->'sections' || jsonb_build_array(
      jsonb_build_object(
        'id', 'section_h',
        'name', 'Section H: Roofing',
        'subsections', jsonb_build_array(
          jsonb_build_object('id', 'section_h_materials', 'name', 'Materials'),
          jsonb_build_object('id', 'section_h_labor', 'name', 'Labor')
        )
      )
    )
  ),
  updated_at = NOW()
  WHERE id IN (SELECT id FROM lcl_structures)
  RETURNING id, company_id
)
-- Insert Section H items
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
  us.company_id,
  us.id,
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
FROM update_structures us,
LATERAL (
  -- SECTION H: ROOFING - MATERIALS
  SELECT 'section_h', 'section_h_materials', '1', 'Timber 4 by 2', 'Ft', 4800, 35.00, 0 UNION ALL
  SELECT 'section_h', 'section_h_materials', '2', 'Timber 3 by 2', 'Ft', 3900, 27.00, 1 UNION ALL
  SELECT 'section_h', 'section_h_materials', '3', 'Timber 2 by 2', 'Ft', 2000, 18.00, 2 UNION ALL
  SELECT 'section_h', 'section_h_materials', '4', 'Fascia 10 by 1', 'Ft', 300, 110.00, 3 UNION ALL
  SELECT 'section_h', 'section_h_materials', '5', 'Nails 4"', 'Kgs', 100, 180.00, 4 UNION ALL
  SELECT 'section_h', 'section_h_materials', '6', 'Nails 3"', 'Kgs', 50, 180.00, 5 UNION ALL
  SELECT 'section_h', 'section_h_materials', '7', 'Nails 2"', 'Kgs', 10, 180.00, 6 UNION ALL
  SELECT 'section_h', 'section_h_materials', '8', 'Nails 5"', 'Kgs', 20, 180.00, 7 UNION ALL
  SELECT 'section_h', 'section_h_materials', '9', 'Roofing Nails', 'Kgs', 50, 250.00, 8 UNION ALL
  SELECT 'section_h', 'section_h_materials', '10', 'Mabati Vitalile', 'Linear Metres', 650, 750.00, 9 UNION ALL
  SELECT 'section_h', 'section_h_materials', '11', 'Ridge caps', 'Pcs', 45, 700.00, 10 UNION ALL
  SELECT 'section_h', 'section_h_materials', '12', 'Valley Trays', 'Pcs', 15, 700.00, 11 UNION ALL
  SELECT 'section_h', 'section_h_materials', '13', 'Rubber Washers', 'Pkts', 50, 150.00, 12 UNION ALL
  SELECT 'section_h', 'section_h_materials', '14', 'Paint', 'Gal', 2, 1300.00, 13 UNION ALL
  SELECT 'section_h', 'section_h_materials', '15', 'Brushes', 'Gal', 1, 300.00, 14 UNION ALL
  
  -- SECTION H: ROOFING - LABOR
  SELECT 'section_h', 'section_h_labor', '1', 'Roofing & Blundering Ceiling Joists', 'Item', 1, 250000.00, 0
) AS item(section_id, subsection_id, item_number, description, unit, qty, rate, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM lcl_template_items 
  WHERE structure_id = us.id AND section_id = item.section_id AND subsection_id = item.subsection_id AND item_number = item.item_number
)
ON CONFLICT DO NOTHING;
