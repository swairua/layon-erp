import { supabase } from '@/integrations/supabase/client';
import {
  BOQFixedStructure,
  BOQFixedItemV2,
  BOQStructureData,
  BOQSectionDef,
  BOQSubsectionDef,
  BOQHierarchicalData,
  BOQSectionWithSubsections,
  BOQSubsectionWithItems,
  ParsedBOQItem,
  BOQImportResult,
} from '@/types/hierarchicalBOQ';

class HierarchicalBOQService {
  /**
   * Create a new BOQ structure template
   */
  async createStructure(
    companyId: string,
    name: string,
    description: string,
    structureData: BOQStructureData
  ): Promise<BOQFixedStructure> {
    const { data, error } = await supabase
      .from('boq_fixed_structures')
      .insert({
        company_id: companyId,
        name,
        description,
        structure_data: structureData,
      })
      .select()
      .single();

    if (error) throw error;
    return data as BOQFixedStructure;
  }

  /**
   * Fetch all structures for a company
   */
  async getStructures(companyId: string): Promise<BOQFixedStructure[]> {
    const { data, error } = await supabase
      .from('boq_fixed_structures')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as BOQFixedStructure[];
  }

  /**
   * Get a single structure by ID
   */
  async getStructure(structureId: string): Promise<BOQFixedStructure> {
    const { data, error } = await supabase
      .from('boq_fixed_structures')
      .select('*')
      .eq('id', structureId)
      .single();

    if (error) throw error;
    return data as BOQFixedStructure;
  }

  /**
   * Update structure metadata
   */
  async updateStructure(
    structureId: string,
    updates: Partial<{
      name: string;
      description: string;
      structure_data: BOQStructureData;
    }>
  ): Promise<BOQFixedStructure> {
    const { data, error } = await supabase
      .from('boq_fixed_structures')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', structureId)
      .select()
      .single();

    if (error) throw error;
    return data as BOQFixedStructure;
  }

  /**
   * Insert items in bulk for a structure
   */
  async insertItems(items: Omit<BOQFixedItemV2, 'id' | 'created_at' | 'updated_at'>[]): Promise<BOQFixedItemV2[]> {
    if (items.length === 0) return [];

    const { data, error } = await supabase
      .from('boq_fixed_items_v2')
      .insert(items)
      .select();

    if (error) throw error;
    return (data || []) as BOQFixedItemV2[];
  }

  /**
   * Fetch items for a structure
   */
  async getStructureItems(structureId: string): Promise<BOQFixedItemV2[]> {
    const { data, error } = await supabase
      .from('boq_fixed_items_v2')
      .select('*')
      .eq('structure_id', structureId)
      .order('section_id', { ascending: true })
      .order('subsection_id', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data || []) as BOQFixedItemV2[];
  }

  /**
   * Build hierarchical structure with items and calculated totals
   */
  async getHierarchicalData(structureId: string): Promise<BOQHierarchicalData> {
    const structure = await this.getStructure(structureId);
    const items = await this.getStructureItems(structureId);

    const sections: BOQSectionWithSubsections[] = [];
    let grand_total = 0;

    const sectionDefs = structure.structure_data?.sections ?? [];
    for (const sectionDef of sectionDefs) {
      const subsections: BOQSubsectionWithItems[] = [];
      let section_total = 0;

      for (const subsectionDef of sectionDef.subsections) {
        const subsectionItems = items.filter(
          (item) =>
            item.section_id === sectionDef.id &&
            item.subsection_id === subsectionDef.id
        );

        const subtotal = subsectionItems.reduce((sum, item) => {
          const qty = item.default_qty || 0;
          const rate = item.default_rate || 0;
          return sum + qty * rate;
        }, 0);

        subsections.push({
          subsection_id: subsectionDef.id,
          subsection_name: subsectionDef.name,
          items: subsectionItems,
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
      structure,
      sections,
      grand_total,
      item_count: items.length,
    };
  }

  /**
   * Update a single item
   */
  async updateItem(
    itemId: string,
    updates: Partial<{
      description: string;
      unit: string;
      default_qty: number;
      default_rate: number;
      item_number: string;
      sort_order: number;
    }>
  ): Promise<BOQFixedItemV2> {
    const { data, error } = await supabase
      .from('boq_fixed_items_v2')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data as BOQFixedItemV2;
  }

  /**
   * Delete an item
   */
  async deleteItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from('boq_fixed_items_v2')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  }

  /**
   * Delete all items for a subsection
   */
  async deleteSubsectionItems(structureId: string, sectionId: string, subsectionId: string): Promise<void> {
    const { error } = await supabase
      .from('boq_fixed_items_v2')
      .delete()
      .eq('structure_id', structureId)
      .eq('section_id', sectionId)
      .eq('subsection_id', subsectionId);

    if (error) throw error;
  }

  /**
   * Migrate old fixed_boq_items to new v2 structure
   * Creates a default structure and imports existing items
   */
  async migrateFromLegacy(
    companyId: string,
    legacyItems: any[]
  ): Promise<{ structure_id: string; migrated_count: number }> {
    // Create default structure
    const defaultStructure: BOQStructureData = {
      sections: [
        {
          id: 'SECTION_LEGACY',
          name: 'Migrated Items',
          subsections: [
            { id: 'ITEMS', name: 'Items' },
          ],
        },
      ],
    };

    const structure = await this.createStructure(
      companyId,
      `Migrated Legacy BOQ - ${new Date().toISOString().slice(0, 10)}`,
      'Auto-generated from legacy fixed_boq_items',
      defaultStructure
    );

    // Convert legacy items to v2 format
    const v2Items: Omit<BOQFixedItemV2, 'id' | 'created_at' | 'updated_at'>[] = legacyItems.map((item, index) => ({
      company_id: companyId,
      structure_id: structure.id,
      section_id: 'SECTION_LEGACY',
      subsection_id: 'ITEMS',
      item_number: item.item_code || String(index + 1),
      description: item.description,
      unit: item.unit || 'Item',
      default_qty: item.default_qty,
      default_rate: item.default_rate,
      sort_order: index,
    }));

    await this.insertItems(v2Items);

    // Log migration
    await supabase.from('boq_fixed_items_migration_log').insert({
      company_id: companyId,
      old_item_count: legacyItems.length,
      new_item_count: v2Items.length,
      structure_id: structure.id,
      status: 'completed',
      migrated_at: new Date().toISOString(),
    });

    return {
      structure_id: structure.id,
      migrated_count: v2Items.length,
    };
  }

  /**
   * Reorder items in a subsection and update sort_order and item_number
   */
  async reorderItemsInSubsection(
    structureId: string,
    sectionId: string,
    subsectionId: string,
    reorderedItemIds: string[]
  ): Promise<BOQFixedItemV2[]> {
    const items = await this.getStructureItems(structureId);
    const subsectionItems = items.filter(
      (item) =>
        item.section_id === sectionId &&
        item.subsection_id === subsectionId
    );

    const updates: { id: string; sort_order: number; item_number: string }[] = [];

    reorderedItemIds.forEach((itemId, index) => {
      const item = subsectionItems.find((i) => i.id === itemId);
      if (item) {
        updates.push({
          id: itemId,
          sort_order: index,
          item_number: String(index + 1),
        });
      }
    });

    const updatedItems = await Promise.all(
      updates.map(update =>
        this.updateItem(update.id, {
          sort_order: update.sort_order,
          item_number: update.item_number,
        })
      )
    );

    return updatedItems;
  }

  /**
   * Export hierarchical data for PDF generation
   */
  async exportForPDF(structureId: string): Promise<{
    structure_name: string;
    sections: Array<{
      section_name: string;
      subsections: Array<{
        subsection_name: string;
        items: Array<{
          item_number?: string;
          description: string;
          unit: string;
          qty: number;
          rate: number;
          amount: number;
        }>;
        subtotal: number;
      }>;
      total: number;
    }>;
    grand_total: number;
  }> {
    const hierarchical = await this.getHierarchicalData(structureId);

    return {
      structure_name: hierarchical.structure.name,
      sections: hierarchical.sections.map((section) => ({
        section_name: section.section_name,
        subsections: section.subsections.map((subsection) => ({
          subsection_name: subsection.subsection_name,
          items: subsection.items.map((item) => ({
            item_number: item.item_number,
            description: item.description,
            unit: item.unit,
            qty: item.default_qty || 0,
            rate: item.default_rate || 0,
            amount: (item.default_qty || 0) * (item.default_rate || 0),
          })),
          subtotal: subsection.subtotal,
        })),
        total: section.total,
      })),
      grand_total: hierarchical.grand_total,
    };
  }
}

export const hierarchicalBOQService = new HierarchicalBOQService();
