import { supabase } from '@/integrations/supabase/client';
import { BOQData } from '@/utils/boqHelper';

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
  boq_id?: string | null;
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

  /**
   * Create a corresponding BOQ record from an LCL BOQ
   * Uses upsert logic to handle re-saves (if same number exists, update it)
   * Returns the created/updated BOQ with its ID so the relationship can be tracked
   */
  async createBOQFromLCLBOQ(
    lclBoq: LCLBOQRecord,
    customerData: { name?: string; email?: string; phone?: string; address?: string; city?: string; country?: string } | null,
    createdBy?: string
  ): Promise<BOQData> {
    // Calculate totals from items_snapshot
    const items = lclBoq.items_snapshot || [];
    let subtotal = 0;
    items.forEach((item: any) => {
      const itemTotal = (item.qty || 0) * (item.rate || 0);
      subtotal += itemTotal;
    });

    // Create hierarchical data structure for BOQ
    const boqData = {
      sections: [
        {
          title: 'Items',
          subsections: [
            {
              name: 'A',
              label: 'Items',
              items: items.map((item: any) => ({
                description: item.description,
                quantity: item.qty || 0,
                unit: item.unit || '',
                rate: item.rate || 0,
              })),
            },
          ],
        },
      ],
    };

    const boqRecord: Omit<BOQData, 'id'> = {
      number: lclBoq.number,
      company_id: lclBoq.company_id,
      boq_date: lclBoq.boq_date || new Date().toISOString().split('T')[0],
      project_title: lclBoq.project_title || '',
      client_name: customerData?.name || '',
      client_email: customerData?.email,
      client_phone: customerData?.phone,
      client_address: customerData?.address,
      client_city: customerData?.city,
      client_country: customerData?.country,
      currency: 'KES',
      subtotal,
      tax_amount: 0,
      total_amount: subtotal,
      data: boqData,
      created_by: createdBy,
    };

    // Check if BOQ already exists by boq_id (for updates)
    if (lclBoq.boq_id) {
      const { data, error } = await supabase
        .from('boqs')
        .update({
          ...boqRecord,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lclBoq.boq_id)
        .select()
        .single();

      if (error) throw error;
      return data as BOQData;
    }

    // Check if BOQ with this number already exists for this company
    const { data: existingBoq } = await supabase
      .from('boqs')
      .select('id')
      .eq('company_id', lclBoq.company_id)
      .eq('number', lclBoq.number)
      .single();

    if (existingBoq) {
      // Update existing BOQ (shouldn't happen if boq_id is set, but fallback)
      const { data, error } = await supabase
        .from('boqs')
        .update({
          ...boqRecord,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBoq.id)
        .select()
        .single();

      if (error) throw error;
      return data as BOQData;
    } else {
      // Insert new BOQ
      const { data, error } = await supabase
        .from('boqs')
        .insert([boqRecord])
        .select()
        .single();

      if (error) throw error;
      return data as BOQData;
    }
  }
}

export const lclBoqService = new LCLBOQService();
