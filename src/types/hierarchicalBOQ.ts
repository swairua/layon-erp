/**
 * Hierarchical Fixed BOQ type definitions
 */

export interface BOQSubsectionDef {
  id: string;  // e.g., "MATERIALS", "LABOR"
  name: string;  // e.g., "Subsection A: Materials"
}

export interface BOQSectionDef {
  id: string;  // e.g., "SECTION_A"
  name: string;  // e.g., "FOUNDATION"
  subsections: BOQSubsectionDef[];
}

export interface BOQStructureData {
  sections: BOQSectionDef[];
}

export interface BOQFixedStructure {
  id: string;
  company_id: string;
  name: string;  // e.g., "BOQ-085 Residential Maisonette"
  description?: string;
  structure_data: BOQStructureData;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BOQFixedItemV2 {
  id: string;
  company_id: string;
  structure_id?: string;
  section_id: string;
  subsection_id: string;
  item_number?: string;
  description: string;
  unit: string;
  default_qty?: number;
  default_rate?: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BOQItemRow {
  description: string;
  unit?: string;
  qty?: number;
  rate?: number;
  amount?: number;
}

export interface BOQSubsectionWithItems {
  subsection_id: string;
  subsection_name: string;
  items: BOQFixedItemV2[];
  subtotal: number;  // calculated: SUM(qty * rate)
}

export interface BOQSectionWithSubsections {
  section_id: string;
  section_name: string;
  subsections: BOQSubsectionWithItems[];
  total: number;  // calculated: SUM(subsection subtotals)
}

export interface BOQHierarchicalData {
  structure: BOQFixedStructure;
  sections: BOQSectionWithSubsections[];
  grand_total: number;
  item_count: number;
}

/**
 * Import parsing types
 */
export interface ParsedBOQItem {
  section_id: string;
  section_name: string;
  subsection_id: string;
  subsection_name: string;
  item_number?: string;
  description: string;
  unit?: string;
  qty?: number;
  rate?: number;
  sort_order: number;
}

export interface BOQImportResult {
  parsed_items: ParsedBOQItem[];
  detected_sections: string[];
  detected_subsections: string[];
  validation_errors: string[];
  item_count: number;
  success: boolean;
}
