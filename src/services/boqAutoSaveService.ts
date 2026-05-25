import { supabase } from '@/integrations/supabase/client';

export interface BOQDraftData {
  boqNumber: string;
  boqDate: string;
  dueDate: string;
  clientId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  customerCountry?: string;
  projectTitle: string;
  contractor: string;
  notes: string;
  termsAndConditions: string;
  showCalculatedValuesInTerms: boolean;
  currency: string;
  sections: any[];
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
}

export interface BOQDraftRecord {
  id: string;
  company_id: string;
  user_id: string;
  number: string;
  boq_date: string;
  due_date: string;
  customer_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  client_city: string;
  client_country: string;
  contractor: string;
  project_title: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  data: any;
  terms_and_conditions: string;
  show_calculated_values_in_terms: boolean;
  created_at: string;
  updated_at: string;
  last_autosaved_at: string;
}

/**
 * Save or update a BOQ draft to the database.
 * Uses upsert logic (update if exists, insert if new).
 * Only one draft per user per company is allowed (for creating new BOQs).
 */
export async function saveBoqDraft(
  userId: string,
  companyId: string,
  formData: BOQDraftData
): Promise<{ success: boolean; error?: string; draftId?: string }> {
  try {
    if (!userId || !companyId) {
      return { success: false, error: 'User ID and Company ID are required' };
    }

    console.log(`[saveBoqDraft] Attempting upsert for company: ${companyId}, user: ${userId}`);

    // Prepare the payload matching the boq_drafts table schema
    const payload = {
      company_id: companyId,
      user_id: userId,
      boq_id: null,
      number: formData.boqNumber || null,
      boq_date: formData.boqDate || null,
      due_date: formData.dueDate || null,
      customer_id: formData.clientId || null,
      client_name: formData.customerName || null,
      client_email: formData.customerEmail || null,
      client_phone: formData.customerPhone || null,
      client_address: formData.customerAddress || null,
      client_city: formData.customerCity || null,
      client_country: formData.customerCountry || null,
      contractor: formData.contractor || null,
      project_title: formData.projectTitle || null,
      currency: formData.currency || 'KES',
      subtotal: formData.subtotal || 0,
      tax_amount: formData.taxAmount || 0,
      total_amount: formData.totalAmount || 0,
      data: {
        sections: formData.sections,
        notes: formData.notes,
      },
      terms_and_conditions: formData.termsAndConditions || null,
      show_calculated_values_in_terms: formData.showCalculatedValuesInTerms || false,
      updated_at: new Date().toISOString(),
      last_autosaved_at: new Date().toISOString(),
    };

    // Use upsert: on conflict (company_id, user_id, boq_id), update the existing draft
    const { data, error } = await supabase
      .from('boq_drafts')
      .upsert([payload], {
        onConflict: 'company_id,user_id,boq_id',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[saveBoqDraft] Upsert failed:', error);
      return { success: false, error: error.message };
    }

    console.log(`[saveBoqDraft] Successfully saved/updated draft with ID: ${data?.id}`);
    return { success: true, draftId: data?.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[saveBoqDraft] Unexpected error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Load the latest draft for a user and company.
 * Fetches the most recent draft (by updated_at) to handle duplicate edge cases.
 * Returns null if no draft exists.
 */
export async function loadBoqDraft(
  userId: string,
  companyId: string
): Promise<BOQDraftRecord | null> {
  try {
    if (!userId || !companyId) {
      console.error('User ID and Company ID are required');
      return null;
    }

    console.log(`[loadBoqDraft] Attempting to load draft for user: ${userId}, company: ${companyId}`);

    const { data, error } = await supabase
      .from('boq_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .is('boq_id', null) // Only fetch create drafts, not edit drafts
      .order('updated_at', { ascending: false }) // Get the most recent
      .limit(1); // Only fetch one row

    if (error) {
      console.error('[loadBoqDraft] Query error:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log('[loadBoqDraft] No draft found for this user/company');
      return null;
    }

    // Log if we found duplicates (shouldn't happen after constraint fix)
    if (data.length > 1) {
      console.warn(`[loadBoqDraft] Found ${data.length} draft rows (should be max 1). Using most recent.`);
    }

    console.log(`[loadBoqDraft] Successfully loaded draft, last saved at: ${data[0].updated_at}`);
    return data[0] as BOQDraftRecord;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[loadBoqDraft] Unexpected error:', errorMsg);
    return null;
  }
}

/**
 * Delete a draft from the database.
 * This is called when the user resets/clears the form.
 */
export async function deleteDraft(
  userId: string,
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId || !companyId) {
      return { success: false, error: 'User ID and Company ID are required' };
    }

    console.log(`[deleteDraft] Deleting draft for user: ${userId}, company: ${companyId}`);

    const { error } = await supabase
      .from('boq_drafts')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('boq_id', null); // Only delete create drafts

    if (error) {
      console.error('[deleteDraft] Failed to delete BOQ draft:', error);
      return { success: false, error: error.message };
    }

    console.log('[deleteDraft] Successfully deleted draft');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[deleteDraft] Error deleting BOQ draft:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Publish a draft by converting it to a finalized BOQ.
 * This moves the draft from boq_drafts to boqs table with status='draft'.
 * The draft is then deleted.
 */
export async function publishDraft(
  draftId: string,
  userId: string,
  companyId: string,
  createdByUserId?: string
): Promise<{ success: boolean; error?: string; boqId?: string }> {
  try {
    if (!draftId) {
      return { success: false, error: 'Draft ID is required' };
    }

    // Load the draft to get its data
    const { data: draft, error: fetchError } = await supabase
      .from('boq_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch draft for publishing:', fetchError);
      return { success: false, error: 'Draft not found' };
    }

    // Insert into boqs table with status='draft'
    const boqPayload = {
      company_id: draft.company_id,
      number: draft.number,
      boq_date: draft.boq_date,
      due_date: draft.due_date,
      client_name: draft.client_name,
      client_email: draft.client_email,
      client_phone: draft.client_phone,
      client_address: draft.client_address,
      client_city: draft.client_city,
      client_country: draft.client_country,
      contractor: draft.contractor,
      project_title: draft.project_title,
      currency: draft.currency,
      subtotal: draft.subtotal,
      tax_amount: draft.tax_amount,
      total_amount: draft.total_amount,
      attachment_url: null,
      data: draft.data,
      terms_and_conditions: draft.terms_and_conditions,
      created_by: createdByUserId || null,
    };

    const { data: insertedBoq, error: insertError } = await supabase
      .from('boqs')
      .insert([boqPayload])
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to publish draft:', insertError);
      return { success: false, error: insertError.message };
    }

    // Delete the draft
    const { error: deleteError } = await supabase
      .from('boq_drafts')
      .delete()
      .eq('id', draftId);

    if (deleteError) {
      console.error('Failed to delete draft after publishing:', deleteError);
      // Don't fail the operation, as the BOQ was already created
    }

    return { success: true, boqId: insertedBoq?.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error publishing draft:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Save a draft for an existing BOQ being edited.
 * This creates/updates an edit-in-progress draft with boq_id set.
 * Allows one edit draft per BOQ per user.
 */
export async function saveEditingDraft(
  userId: string,
  companyId: string,
  boqId: string,
  boqData: any
): Promise<{ success: boolean; error?: string; draftId?: string }> {
  try {
    if (!userId || !companyId || !boqId) {
      return { success: false, error: 'User ID, Company ID, and BOQ ID are required' };
    }

    const payload = {
      company_id: companyId,
      user_id: userId,
      boq_id: boqId,
      number: boqData.number || null,
      boq_date: boqData.boq_date || null,
      due_date: boqData.due_date || null,
      customer_id: boqData.customer_id || null,
      client_name: boqData.client_name || null,
      client_email: boqData.client_email || null,
      client_phone: boqData.client_phone || null,
      client_address: boqData.client_address || null,
      client_city: boqData.client_city || null,
      client_country: boqData.client_country || null,
      contractor: boqData.contractor || null,
      project_title: boqData.project_title || null,
      currency: boqData.currency || 'KES',
      subtotal: boqData.subtotal || 0,
      tax_amount: boqData.tax_amount || 0,
      total_amount: boqData.total_amount || 0,
      data: boqData.data,
      terms_and_conditions: boqData.terms_and_conditions || null,
      show_calculated_values_in_terms: boqData.show_calculated_values_in_terms || false,
      updated_at: new Date().toISOString(),
      last_autosaved_at: new Date().toISOString(),
    };

    // Use upsert: on conflict (company_id, user_id, boq_id), update the existing edit draft
    const { data, error } = await supabase
      .from('boq_drafts')
      .upsert([payload], {
        onConflict: 'company_id,user_id,boq_id',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to save editing draft:', error);
      return { success: false, error: error.message };
    }

    return { success: true, draftId: data?.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error saving editing draft:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Load an edit draft for a specific BOQ.
 * Returns null if no draft exists.
 */
export async function loadEditDraft(
  userId: string,
  companyId: string,
  boqId: string
): Promise<BOQDraftRecord | null> {
  try {
    if (!userId || !companyId || !boqId) {
      console.warn('[loadEditDraft] Missing required parameters', { userId: !!userId, companyId: !!companyId, boqId: !!boqId });
      return null;
    }

    const { data, error } = await supabase
      .from('boq_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('boq_id', boqId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - expected when no draft exists
        console.log('[loadEditDraft] No draft found for BOQ:', boqId);
        return null;
      }
      console.error('[loadEditDraft] Query error:', { code: error.code, message: error.message });
      return null;
    }

    console.log('[loadEditDraft] Successfully loaded draft for BOQ:', boqId);
    return data as BOQDraftRecord;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[loadEditDraft] Unexpected error:', errorMsg);
    return null;
  }
}

/**
 * Delete an edit draft for a specific BOQ.
 * Called after successful save to clean up.
 */
export async function deleteEditDraft(
  userId: string,
  companyId: string,
  boqId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId || !companyId || !boqId) {
      return { success: false, error: 'User ID, Company ID, and BOQ ID are required' };
    }

    const { error } = await supabase
      .from('boq_drafts')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('boq_id', boqId);

    if (error) {
      console.error('Failed to delete edit draft:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error deleting edit draft:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Check if a user has an unsaved draft for a company.
 * Returns true if draft exists (checks only create drafts with boq_id=NULL).
 */
export async function hasDraft(
  userId: string,
  companyId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('boq_drafts')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .is('boq_id', null);

    if (error) {
      console.error('Failed to check for draft:', error);
      return false;
    }

    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.error('Error checking for draft:', err);
    return false;
  }
}

/**
 * Clean up duplicate draft rows, keeping only the most recent one.
 * This handles the edge case where duplicate drafts were created
 * before the UNIQUE constraint was properly applied.
 *
 * Should only be called if duplicates are detected.
 */
export async function cleanupDuplicateDrafts(
  userId: string,
  companyId: string
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    if (!userId || !companyId) {
      return { success: false, error: 'User ID and Company ID are required' };
    }

    console.log(`[cleanupDuplicateDrafts] Checking for duplicates for user: ${userId}, company: ${companyId}`);

    // Fetch all create drafts for this user/company, sorted by updated_at DESC
    const { data: allDrafts, error: fetchError } = await supabase
      .from('boq_drafts')
      .select('id')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .is('boq_id', null)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      console.error('[cleanupDuplicateDrafts] Failed to fetch drafts:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!allDrafts || allDrafts.length <= 1) {
      console.log('[cleanupDuplicateDrafts] No duplicates found');
      return { success: true, deletedCount: 0 };
    }

    // Keep the first (most recent) and delete the rest
    const draftIdsToDelete = allDrafts.slice(1).map(d => d.id);
    console.log(`[cleanupDuplicateDrafts] Found ${draftIdsToDelete.length} duplicate drafts to delete`);

    const { error: deleteError } = await supabase
      .from('boq_drafts')
      .delete()
      .in('id', draftIdsToDelete);

    if (deleteError) {
      console.error('[cleanupDuplicateDrafts] Failed to delete duplicates:', deleteError);
      return { success: false, error: deleteError.message };
    }

    console.log(`[cleanupDuplicateDrafts] Successfully deleted ${draftIdsToDelete.length} duplicate drafts`);
    return { success: true, deletedCount: draftIdsToDelete.length };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cleanupDuplicateDrafts] Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
