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

  async reorderItemsInSubsection(
    structureId: string,
    sectionId: string,
    subsectionId: string,
    reorderedItemIds: string[]
  ): Promise<LCLTemplateItem[]> {
    const items = await this.getStructureItems(structureId);
    const subsectionItems = items.filter(
      (item) =>
        item.section_id === sectionId &&
        item.subsection_id === subsectionId
    );

    const updatedItems: LCLTemplateItem[] = [];
    for (let index = 0; index < reorderedItemIds.length; index++) {
      const itemId = reorderedItemIds[index];
      const item = subsectionItems.find((i) => i.id === itemId);
      if (item) {
        const updated = await this.updateItem(itemId, {
          sort_order: index,
          item_number: String(index + 1),
        });
        updatedItems.push(updated);
      }
    }

    return updatedItems;
  }

  async updateItemsSortOrder(
    structureId: string,
    sectionId: string,
    subsectionId: string,
    itemIds: string[],
    sortOrders: number[]
  ): Promise<LCLTemplateItem[]> {
    const updatedItems: LCLTemplateItem[] = [];

    // Only update items that have valid IDs (skip items with missing IDs)
    for (let index = 0; index < itemIds.length; index++) {
      const itemId = itemIds[index];
      const sortOrder = sortOrders[index];

      // Skip empty IDs (items created locally without DB entry)
      if (!itemId) {
        continue;
      }

      const updated = await this.updateItem(itemId, {
        sort_order: sortOrder,
        item_number: String(index + 1),
      });
      updatedItems.push(updated);
    }

    return updatedItems;
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

  async renumberSectionDisplayNames(
    structureId: string,
    deletedSectionId: string
  ): Promise<LCLTemplateStructure> {
    const structure = await this.getStructure(structureId);
    const sections = structure.structure_data.sections;

    // Remove the deleted section from array
    const remainingSections = sections.filter(
      (s: any) => s.id !== deletedSectionId
    );

    if (remainingSections.length === sections.length) {
      return structure;
    }

    // Create mapping of old section IDs to new section IDs with consecutive letters
    const sectionIdMap = new Map<string, string>();
    const updatedSections = remainingSections.map((section: any, index: number) => {
      const newLetter = String.fromCharCode(65 + index);
      const oldId = section.id;
      const newId = `section_${newLetter.toLowerCase()}`;

      sectionIdMap.set(oldId, newId);

      // Extract custom name and update with new letter
      const nameMatch = section.name.match(/^(?:SECTION|Section)\s+[A-Z]:\s*(.+)$/);
      const customName = nameMatch ? nameMatch[1] : section.name;

      // Also rebuild subsection IDs to match the new section ID
      const updatedSubsections = section.subsections.map(
        (subsection: any) => {
          const oldSubsectionId = subsection.id;
          // Subsection IDs follow pattern: section_X_X_name, where X is the letter
          // Replace both occurrences: section_d_d_name -> section_c_c_name
          const oldLetter = oldId.match(/section_([a-z])/)?.[1] || '';
          const newLetter = newId.match(/section_([a-z])/)?.[1] || '';
          const newSubsectionId = oldSubsectionId.replace(
            new RegExp(oldLetter, 'g'),
            newLetter
          );
          sectionIdMap.set(oldSubsectionId, newSubsectionId);
          return {
            ...subsection,
            id: newSubsectionId,
          };
        }
      );

      return {
        ...section,
        id: newId,
        name: `SECTION ${newLetter}: ${customName}`,
        subsections: updatedSubsections,
      };
    });

    // Update all item references to use new section and subsection IDs
    const items = await this.getStructureItems(structureId);
    for (const item of items) {
      const newSectionId = sectionIdMap.get(item.section_id);
      const newSubsectionId = sectionIdMap.get(item.subsection_id);

      if (newSectionId && newSubsectionId) {
        await this.updateItem(item.id, {
          section_id: newSectionId,
          subsection_id: newSubsectionId,
        });
      } else if (newSectionId && !newSubsectionId) {
        // If subsection ID mapping not found but section ID is found, rebuild it with new letter
        const oldLetter = item.section_id.match(/section_([a-z])/)?.[1] || '';
        const newLetterFromId = newSectionId.match(/section_([a-z])/)?.[1] || '';
        const newSubId = item.subsection_id
          .replace(item.section_id, newSectionId)
          .replace(new RegExp(oldLetter, 'g'), newLetterFromId);
        await this.updateItem(item.id, {
          section_id: newSectionId,
          subsection_id: newSubId,
        });
      }
    }

    // Persist updated sections
    await this.updateStructure(structureId, {
      structure_data: {
        sections: updatedSections,
      },
    });

    return await this.getStructure(structureId);
  }

  async addSection(
    structureId: string,
    customName?: string
  ): Promise<LCLTemplateStructure> {
    const structure = await this.getStructure(structureId);
    const sections = structure.structure_data.sections;

    // Find next available letter
    const existingLetters = new Set<string>();
    sections.forEach((section: any) => {
      const match = section.id.match(/section[_-]?([a-z])/i);
      if (match) {
        existingLetters.add(match[1].toUpperCase());
      }
    });

    let nextLetter = 'A';
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      if (!existingLetters.has(letter)) {
        nextLetter = letter;
        break;
      }
    }

    // Create new section with initial subsection
    const newSectionId = `section_${nextLetter.toLowerCase()}`;
    const newSubsectionId = `${newSectionId}_${nextLetter.toLowerCase()}_name`;
    const sectionName = customName || `Section ${nextLetter}: New Section`;

    const newSection = {
      id: newSectionId,
      name: `SECTION ${nextLetter}: ${sectionName}`,
      subsections: [
        {
          id: newSubsectionId,
          name: `${nextLetter}. ${sectionName}`,
        },
      ],
    };

    const updatedSections = [...sections, newSection];

    return this.updateStructure(structureId, {
      structure_data: {
        sections: updatedSections,
      },
    });
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
