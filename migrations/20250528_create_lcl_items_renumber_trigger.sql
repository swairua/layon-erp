-- Migration: Create trigger for automatic LCL template item renumbering
-- Purpose: When an item is deleted from lcl_template_items, automatically renumber
--          all remaining items in the same section_id and subsection_id
--
-- Rationale: Instead of handling renumbering in the application layer (JavaScript),
--          use a PostgreSQL trigger to ensure consistency and atomicity.
--          The database guarantees renumbering happens immediately with the delete.

-- Create the trigger function
CREATE OR REPLACE FUNCTION renumber_lcl_template_items_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Renumber items in the same section and subsection after deletion
  WITH reordered AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        ORDER BY sort_order, created_at, id
      ) AS new_item_number,
      ROW_NUMBER() OVER (
        ORDER BY sort_order, created_at, id
      ) - 1 AS new_sort_order
    FROM lcl_template_items
    WHERE section_id = OLD.section_id
      AND subsection_id = OLD.subsection_id
  )
  UPDATE lcl_template_items li
  SET
    item_number = reordered.new_item_number::text,
    sort_order = reordered.new_sort_order,
    updated_at = NOW()
  FROM reordered
  WHERE li.id = reordered.id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger that fires AFTER DELETE
DROP TRIGGER IF EXISTS lcl_template_items_renumber_on_delete ON lcl_template_items;

CREATE TRIGGER lcl_template_items_renumber_on_delete
AFTER DELETE ON lcl_template_items
FOR EACH ROW
EXECUTE FUNCTION renumber_lcl_template_items_on_delete();
