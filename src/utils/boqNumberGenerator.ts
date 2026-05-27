import { supabase } from '@/integrations/supabase/client';

/**
 * Generates the next sequential BOQ number in format BOQ-NNN (e.g., BOQ-001, BOQ-002)
 * Can be used synchronously with existingBOQs array, or asynchronously with companyId
 * @param existingBOQs - Array of BOQ objects with a 'number' property
 * @param companyId - Optional: Company ID to fetch existing BOQs from database (async mode)
 * @returns Next BOQ number formatted as BOQ-NNN (or Promise<string> if using companyId)
 */
export function generateNextBOQNumber(existingBOQs: Array<{ number: string }>): string;
export function generateNextBOQNumber(
  existingBOQs: Array<{ number: string }> | undefined,
  companyId: string
): Promise<string>;
export function generateNextBOQNumber(
  existingBOQs?: Array<{ number: string }>,
  companyId?: string
): string | Promise<string> {
  // Synchronous mode: if existingBOQs provided and no companyId
  if (existingBOQs && !companyId) {
    return generateNextBOQNumberSync(existingBOQs);
  }

  // Async mode: if companyId provided
  if (companyId) {
    return generateNextBOQNumberAsync(existingBOQs, companyId);
  }

  // Default: empty array
  return generateNextBOQNumberSync([]);
}

/**
 * Synchronous version - uses provided array only
 */
function generateNextBOQNumberSync(existingBOQs: Array<{ number: string }>): string {
  if (!existingBOQs || existingBOQs.length === 0) {
    return 'BOQ-001';
  }

  let maxNumber = 0;

  existingBOQs.forEach((boq) => {
    const match = boq.number.match(/^BOQ-(\d{1,3})$/);
    if (match && match[1]) {
      const numericPart = parseInt(match[1], 10);
      if (!isNaN(numericPart) && numericPart > maxNumber) {
        maxNumber = numericPart;
      }
    }
  });

  const nextNumber = maxNumber + 1;
  const formattedNumber = String(nextNumber).padStart(3, '0');
  return `BOQ-${formattedNumber}`;
}

/**
 * Asynchronous version - fetches from both boqs and lcl_boqs tables
 */
async function generateNextBOQNumberAsync(
  existingBOQs: Array<{ number: string }> | undefined,
  companyId: string
): Promise<string> {
  let allBOQs: Array<{ number: string }> = existingBOQs || [];

  try {
    const [boqsResult, lclBoqsResult] = await Promise.all([
      supabase
        .from('boqs')
        .select('number')
        .eq('company_id', companyId),
      supabase
        .from('lcl_boqs')
        .select('number')
        .eq('company_id', companyId),
    ]);

    allBOQs = [
      ...(boqsResult.data || []),
      ...(lclBoqsResult.data || []),
    ];
  } catch (error) {
    console.error('Error fetching BOQ numbers:', error);
    allBOQs = existingBOQs || [];
  }

  return generateNextBOQNumberSync(allBOQs);
}
