/**
 * Generates the next sequential LCL BOQ number in format LCL-NNN (e.g., LCL-001, LCL-002)
 * @param existingLCLBOQs - Array of LCL BOQ objects with a 'number' property
 * @returns Next LCL BOQ number formatted as LCL-NNN
 */
export function generateNextLCLBOQNumber(existingLCLBOQs: Array<{ number: string }>): string {
  if (!existingLCLBOQs || existingLCLBOQs.length === 0) {
    return 'LCL-001';
  }

  // Extract numeric part from LCL BOQ numbers (LCL-NNN format)
  let maxNumber = 0;

  existingLCLBOQs.forEach((boq) => {
    const match = boq.number.match(/^LCL-(\d{1,3})$/);
    if (match && match[1]) {
      const numericPart = parseInt(match[1], 10);
      if (!isNaN(numericPart) && numericPart > maxNumber) {
        maxNumber = numericPart;
      }
    }
  });

  // Generate next number with leading zeros
  const nextNumber = maxNumber + 1;
  const formattedNumber = String(nextNumber).padStart(3, '0');

  return `LCL-${formattedNumber}`;
}
