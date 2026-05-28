-- Migration: Renumber Section B Materials items to start from 1
-- Purpose: After removing an item from Section B > Materials, renumber all remaining items
-- from 1 instead of starting at 2
--
-- Current state: Items numbered 2, 3, 4, 5, 6, 7, ...
-- Desired state: Items numbered 1, 2, 3, 4, 5, 6, ...
--
-- This migration uses a window function to renumber items sequentially while maintaining
-- the existing sort order

WITH ranked_items AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY sort_order) - 1 as new_sort_order,
    ROW_NUMBER() OVER (ORDER BY sort_order)::TEXT as new_item_number
  FROM lcl_template_items
  WHERE section_id = 'SECTION_B'
    AND subsection_id = 'MATERIALS'
  ORDER BY sort_order
)
UPDATE lcl_template_items
SET
  item_number = ranked_items.new_item_number,
  sort_order = ranked_items.new_sort_order,
  updated_at = NOW()
FROM ranked_items
WHERE lcl_template_items.id = ranked_items.id;
