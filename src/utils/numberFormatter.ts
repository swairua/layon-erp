/**
 * Formats a number to remove trailing zeros and unnecessary decimals
 * Examples: 10.00 → "10", 10.50 → "10.5", 1500.50 → "1500.5"
 */
export const formatNumberWithoutTrailingZeros = (value: number | string | undefined): string => {
  if (value === undefined || value === null || value === '') return '';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '';
  
  // Convert to fixed 2 decimals, then remove trailing zeros
  const formatted = numValue.toFixed(2);
  return formatted.replace(/\.?0+$/, '');
};
