import { supabase } from '@/integrations/supabase/client';

/**
 * Check the actual schema of the profiles table
 * NOTE: information_schema is not exposed via Supabase REST API
 * This function is disabled as it would fail
 */
export const checkProfilesSchema = async () => {
  console.log('ℹ️ Schema checking not available via REST API');
  return null;
};

/**
 * Test profile creation with only basic fields
 */
export const testProfileCreation = async () => {
  try {
    console.log('🧪 Testing profile creation with minimal fields...');
    
    // Create a test profile with only the most basic fields
    const testId = 'test-' + Date.now();
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: testId,
        email: 'test@example.com'
      })
      .select()
      .single();

    if (error) {
      console.error('Test profile creation failed:', JSON.stringify(error, null, 2));
      return { success: false, error };
    }

    console.log('✅ Test profile created:', data);
    
    // Clean up the test profile
    await supabase.from('profiles').delete().eq('id', testId);
    console.log('🧹 Test profile cleaned up');
    
    return { success: true, data };
  } catch (error) {
    console.error('Test profile exception:', error);
    return { success: false, error };
  }
};

/**
 * Get the minimal fields that work for profile creation
 * NOTE: This function is simplified - use only confirmed fields
 */
export const getWorkingProfileFields = async (userId: string) => {
  const baseFields = {
    id: userId,
    email: 'admin@medplus.app'
  };

  console.log('✅ Using standard profile fields:', baseFields);
  return baseFields;
};
