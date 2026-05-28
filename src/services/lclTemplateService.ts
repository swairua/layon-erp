import { supabase } from '@/integrations/supabase/client';
import {
  LCLTemplateStructure,
  LCLTemplateItem,
  LCLHierarchicalData,
  LCLSectionWithSubsections,
  LCLSubsectionWithItems,
  LCLItemWithCalculations,
  CreateLCLTemplateRequest,
  UpdateLCLTemplateRequest,
  CreateLCLItemRequest,
  UpdateLCLItemRequest,
} from '@/types/lclTemplate';

export class LCLTemplateService {
  async createStructure(
    request: CreateLCLTemplateRequest
  ): Promise<LCLTemplateStructure> {
    const { data, error } = await supabase
      .from('lcl_template_structures')
      .insert({
        company_id: request.company_id,
        name: request.name,
        description: request.description || null,
        structure_data: request.structure_data,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create template: ${error.message}`);
    return data;
  }

  async getStructures(companyId: string): Promise<LCLTemplateStructure[]> {
    const { data, error } = await supabase
      .from('lcl_template_structures')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch templates: ${error.message}`);
    return data;
  }

  async getStructure(structureId: string): Promise<LCLTemplateStructure> {
    const { data, error } = await supabase
      .from('lcl_template_structures')
      .select('*')
      .eq('id', structureId)
      .single();

    if (error) throw new Error(`Failed to fetch template: ${error.message}`);
    return data;
  }

  async updateStructure(
    structureId: string,
    updates: UpdateLCLTemplateRequest
  ): Promise<LCLTemplateStructure> {
    const { data, error } = await supabase
      .from('lcl_template_structures')
      .update(updates)
      .eq('id', structureId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update template: ${error.message}`);
    return data;
  }

  async deleteStructure(structureId: string): Promise<void> {
    const { error } = await supabase
      .from('lcl_template_structures')
      .update({ is_active: false })
      .eq('id', structureId);

    if (error)
      throw new Error(`Failed to delete template: ${error.message}`);
  }

  async getStructureItems(structureId: string): Promise<LCLTemplateItem[]> {
    const { data, error } = await supabase
      .from('lcl_template_items')
      .select('*')
      .eq('structure_id', structureId)
      .order('sort_order', { ascending: true });

    if (error)
      throw new Error(`Failed to fetch template items: ${error.message}`);
    return data;
  }

  async insertItems(items: CreateLCLItemRequest[]): Promise<LCLTemplateItem[]> {
    if (items.length === 0) return [];

    const { data, error } = await supabase
      .from('lcl_template_items')
      .insert(items)
      .select();

    if (error)
      throw new Error(`Failed to insert items: ${error.message}`);
    return data;
  }

  async updateItem(
    itemId: string,
    updates: UpdateLCLItemRequest
  ): Promise<LCLTemplateItem> {
    const { data, error } = await supabase
      .from('lcl_template_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update item: ${error.message}`);
    return data;
  }

  async deleteItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from('lcl_template_items')
      .delete()
      .eq('id', itemId);

    if (error) throw new Error(`Failed to delete item: ${error.message}`);
  }

  async getHierarchicalData(
    structureId: string
  ): Promise<LCLHierarchicalData> {
    // Fetch structure metadata
    const structure = await this.getStructure(structureId);

    // Fetch all items for this structure
    const items = await this.getStructureItems(structureId);

    // Deduplicate sections to prevent duplicate key errors
    const seenSectionIds = new Set<string>();
    const uniqueSections = structure.structure_data.sections.filter((section: any) => {
      if (seenSectionIds.has(section.id)) {
        return false;
      }
      seenSectionIds.add(section.id);
      return true;
    });

    // Build hierarchical view
    const sections: LCLSectionWithSubsections[] = [];
    let grand_total = 0;

    for (const sectionDef of uniqueSections) {
      const subsections: LCLSubsectionWithItems[] = [];
      let section_total = 0;

      for (const subsectionDef of sectionDef.subsections) {
        let subsectionItems = items.filter(
          (item) =>
            item.section_id === sectionDef.id &&
            item.subsection_id === subsectionDef.id
        );

        // If this section has a parent and no items for this subsection,
        // resolve from parent
        if (subsectionItems.length === 0 && sectionDef.parent_section_id) {
          const parentSectionId = sectionDef.parent_section_id;
          // Map subsection ID to parent's equivalent (e.g., section_d_materials -> section_b_materials)
          const parentSubsectionId = subsectionDef.id.replace(
            new RegExp(`^${sectionDef.id}`),
            parentSectionId
          );

          subsectionItems = items.filter(
            (item) =>
              item.section_id === parentSectionId &&
              item.subsection_id === parentSubsectionId
          );
        }

        const itemsWithCalc: LCLItemWithCalculations[] = subsectionItems.map(
          (item) => ({
            ...item,
            amount: (item.default_qty || 0) * (item.default_rate || 0),
          })
        );

        const subtotal = itemsWithCalc.reduce(
          (sum, item) => sum + item.amount,
          0
        );

        subsections.push({
          subsection_id: subsectionDef.id,
          subsection_name: subsectionDef.name,
          items: itemsWithCalc,
          subtotal,
        });

        section_total += subtotal;
      }

      sections.push({
        section_id: sectionDef.id,
        section_name: sectionDef.name,
        subsections,
        total: section_total,
      });

      grand_total += section_total;
    }

    return {
      structure_id: structure.id,
      structure_name: structure.name,
      description: structure.description,
      sections,
      grand_total,
    };
  }

  async recordHistory(
    structureId: string,
    companyId: string,
    action: string,
    changedBy?: string
  ): Promise<void> {
    const { error } = await supabase.from('lcl_template_history').insert({
      structure_id: structureId,
      company_id: companyId,
      action,
      changed_by: changedBy || 'system',
    });

    if (error) {
      console.error('Failed to record history:', error.message);
    }
  }
}

export const lclTemplateService = new LCLTemplateService();
