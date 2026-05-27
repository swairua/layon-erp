import { supabase } from '@/integrations/supabase/client';

export interface LCLBOQRecord {
  id?: string;
  company_id: string;
  number: string;
  customer_id?: string | null;
  project_title?: string;
  boq_date?: string;
  items_snapshot?: any;
  notes?: string;
  status?: 'draft' | 'saved';
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

class LCLBOQService {
  /**
   * Get all LCL BOQs for a company
   */
  async getLCLBOQs(companyId: string): Promise<LCLBOQRecord[]> {
    const { data, error } = await supabase
      .from('lcl_boqs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as LCLBOQRecord[];
  }

  /**
   * Get a single LCL BOQ by ID
   */
  async getLCLBOQ(id: string): Promise<LCLBOQRecord> {
    const { data, error } = await supabase
      .from('lcl_boqs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as LCLBOQRecord;
  }

  /**
   * Save a new or update existing LCL BOQ
   */
  async saveLCLBOQ(boq: LCLBOQRecord): Promise<LCLBOQRecord> {
    const { id, ...data } = boq;

    if (id) {
      // Update existing
      const { data: updated, error } = await supabase
        .from('lcl_boqs')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as LCLBOQRecord;
    } else {
      // Create new
      const { data: created, error } = await supabase
        .from('lcl_boqs')
        .insert({
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return created as LCLBOQRecord;
    }
  }

  /**
   * Delete an LCL BOQ
   */
  async deleteLCLBOQ(id: string): Promise<void> {
    const { error } = await supabase
      .from('lcl_boqs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Auto-save draft (update or create with status='draft')
   */
  async autosaveLCLBOQDraft(boq: LCLBOQRecord): Promise<LCLBOQRecord> {
    return this.saveLCLBOQ({
      ...boq,
      status: 'draft',
    });
  }

  /**
   * Save final version (update status to 'saved')
   */
  async saveLCLBOQFinal(boq: LCLBOQRecord): Promise<LCLBOQRecord> {
    return this.saveLCLBOQ({
      ...boq,
      status: 'saved',
    });
  }
}

export const lclBoqService = new LCLBOQService();
