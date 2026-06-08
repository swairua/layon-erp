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

interface CachedNumber {
  number: number;
  timestamp: number;
}

const numberCache = new Map<string, CachedNumber>();
const CACHE_TTL_MS = 30 * 1000; // 30 second cache

function getCachedNumber(companyId: string): number | null {
  const cached = numberCache.get(companyId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.number;
  }
  numberCache.delete(companyId);
  return null;
}

function setCachedNumber(companyId: string, number: number): void {
  numberCache.set(companyId, { number, timestamp: Date.now() });
}

function invalidateCache(companyId: string): void {
  numberCache.delete(companyId);
}

/**
 * Asynchronous version - fetches all numbers and finds max in JavaScript
 * to avoid lexicographic sorting issues from Supabase
 */
async function generateNextBOQNumberAsync(
  existingBOQs: Array<{ number: string }> | undefined,
  companyId: string
): Promise<string> {
  // Check cache first
  const cachedMax = getCachedNumber(companyId);
  if (cachedMax !== null) {
    const nextNumber = cachedMax + 1;
    const formattedNumber = String(nextNumber).padStart(3, '0');
    return `BOQ-${formattedNumber}`;
  }

  let maxNumber = 0;

  const extractNumber = (boqNumber: string): number => {
    const match = boqNumber.match(/^BOQ-(\d{1,3})$/);
    return match ? parseInt(match[1], 10) : 0;
  };

  try {
    // Fetch all numbers (no ordering) and find max in JavaScript
    // to avoid lexicographic sorting issues in Supabase
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

    // Find numeric maximum across all results
    if (boqsResult.data && boqsResult.data.length > 0) {
      boqsResult.data.forEach((row) => {
        const num = extractNumber(row.number);
        if (num > maxNumber) {
          maxNumber = num;
        }
      });
    }

    if (lclBoqsResult.data && lclBoqsResult.data.length > 0) {
      lclBoqsResult.data.forEach((row) => {
        const num = extractNumber(row.number);
        if (num > maxNumber) {
          maxNumber = num;
        }
      });
    }
  } catch (error) {
    console.error('Error fetching BOQ numbers:', error);
    maxNumber = 0;
  }

  // Apply local BOQs if provided (for drafts or unsaved items)
  if (existingBOQs && existingBOQs.length > 0) {
    existingBOQs.forEach((boq) => {
      const num = extractNumber(boq.number);
      if (num > maxNumber) {
        maxNumber = num;
      }
    });
  }

  // Cache the result for 30 seconds
  setCachedNumber(companyId, maxNumber);

  const nextNumber = maxNumber + 1;
  const formattedNumber = String(nextNumber).padStart(3, '0');
  return `BOQ-${formattedNumber}`;
}

// Export cache invalidation for use after BOQ creation
export { invalidateCache as invalidateBOQNumberCache };
