// Database entity types
export interface LCLTemplateStructure {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  structure_data: {
    sections: LCLSectionDef[];
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LCLSectionMetadata {
  parent_section_id?: string; // Reference to inherited parent section
}

export interface LCLTemplateItem {
  id: string;
  company_id: string;
  structure_id: string;
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

// Hierarchy definition types (from structure_data JSONB)
export interface LCLSectionDef {
  id: string;
  name: string;
  subsections: LCLSubsectionDef[];
  parent_section_id?: string; // Section D/E/F/G can inherit from B/C
}

export interface LCLSubsectionDef {
  id: string;
  name: string;
}

// Aggregate/view model types (built in memory from flat items + hierarchy)
export interface LCLItemWithCalculations extends LCLTemplateItem {
  amount: number; // qty * rate
}

export interface LCLSubsectionWithItems {
  subsection_id: string;
  subsection_name: string;
  items: LCLItemWithCalculations[];
  subtotal: number;
}

export interface LCLSectionWithSubsections {
  section_id: string;
  section_name: string;
  subsections: LCLSubsectionWithItems[];
  total: number;
}

export interface LCLHierarchicalData {
  structure_id: string;
  structure_name: string;
  description?: string;
  sections: LCLSectionWithSubsections[];
  grand_total: number;
}

// Form/request types
export interface CreateLCLTemplateRequest {
  company_id: string;
  name: string;
  description?: string;
  structure_data: {
    sections: LCLSectionDef[];
  };
}

export interface UpdateLCLTemplateRequest {
  name?: string;
  description?: string;
}

export interface CreateLCLItemRequest {
  structure_id: string;
  company_id: string;
  section_id: string;
  subsection_id: string;
  item_number?: string;
  description: string;
  unit: string;
  default_qty?: number;
  default_rate?: number;
  sort_order?: number;
}

export interface UpdateLCLItemRequest {
  description?: string;
  unit?: string;
  default_qty?: number;
  default_rate?: number;
  sort_order?: number;
}
