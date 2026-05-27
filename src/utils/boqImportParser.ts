import { ParsedBOQItem, BOQImportResult } from '@/types/hierarchicalBOQ';

/**
 * Parse BOQ text with hierarchical structure
 * Detects sections, subsections, and items from formatted text
 */
export function parseBOQText(text: string): BOQImportResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const parsed_items: ParsedBOQItem[] = [];
  const detected_sections = new Set<string>();
  const detected_subsections = new Set<string>();
  const validation_errors: string[] = [];

  let currentSection = '';
  let currentSectionId = '';
  let currentSubsection = '';
  let currentSubsectionId = '';
  let sort_order = 0;

  // Patterns for parsing
  const sectionPattern = /^(SECTION\s+[A-Z]|SECTION NO\.|BILL NO\.):?\s*(.*?)$/i;
  const subsectionPattern = /^(Subsection\s+[A-Z]|Subsection\s+[A-Z]:|[A-Z]\s*[-:]\s*)?([A-Za-z\s]+)?\s*$/i;
  const headerPattern = /^(NO|NO\.|NUMBER|ITEM)\s+(DESCRIPTION|DESC)/i;

  // Track if we're in a data section
  let inDataSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line) continue;

    // Check for section header
    const sectionMatch = line.match(sectionPattern);
    if (sectionMatch) {
      currentSection = sectionMatch[2] || sectionMatch[1];
      currentSectionId = `SECTION_${String.fromCharCode(65 + detected_sections.size)}`;
      detected_sections.add(currentSection);
      currentSubsection = '';
      currentSubsectionId = '';
      inDataSection = false;
      continue;
    }

    // Check for subsection header (e.g., "Subsection A: Materials")
    if (line.match(/^Subsection\s+[A-Z]/i)) {
      const subMatch = line.match(/Subsection\s+[A-Z]:\s*(.*?)$/i);
      currentSubsection = subMatch ? subMatch[1] : line;
      currentSubsectionId = currentSubsection.toUpperCase().replace(/\s+/g, '_');
      detected_subsections.add(currentSubsection);
      inDataSection = false;
      continue;
    }

    // Check for header row (NO, DESCRIPTION, QTY, UNIT, RATE, AMOUNT)
    if (headerPattern.test(line)) {
      inDataSection = true;
      continue;
    }

    // Skip total lines
    if (/^(Subsection|SECTION)\s+(Total|Subtotal):/i.test(line)) {
      inDataSection = false;
      continue;
    }

    // Parse data rows when in data section
    if (inDataSection && currentSection && currentSubsection) {
      const item = parseItemRow(line);
      if (item) {
        if (!currentSection) {
          validation_errors.push(`Item "${item.description}" has no section`);
          continue;
        }
        if (!currentSubsection) {
          validation_errors.push(`Item "${item.description}" has no subsection`);
          continue;
        }

        parsed_items.push({
          section_id: currentSectionId,
          section_name: currentSection,
          subsection_id: currentSubsectionId,
          subsection_name: currentSubsection,
          item_number: item.item_number || String(parsed_items.filter(
            (p) => p.section_id === currentSectionId && p.subsection_id === currentSubsectionId
          ).length + 1),
          description: item.description,
          unit: item.unit,
          qty: item.qty,
          rate: item.rate,
          sort_order: sort_order++,
        });
      }
    }
  }

  const success = parsed_items.length > 0;

  return {
    parsed_items,
    detected_sections: Array.from(detected_sections),
    detected_subsections: Array.from(detected_subsections),
    validation_errors,
    item_count: parsed_items.length,
    success,
  };
}

/**
 * Parse a single item row from BOQ table
 * Expected format: NO | DESCRIPTION | QTY | UNIT | RATE | AMOUNT
 */
function parseItemRow(line: string): {
  item_number?: string;
  description: string;
  unit?: string;
  qty?: number;
  rate?: number;
} | null {
  // Split by pipe or multiple spaces
  const parts = line.split(/\s{2,}|\|/).map((p) => p.trim());

  if (parts.length < 2) return null;

  // Try to extract structured data
  let item_number = '';
  let description = '';
  let unit = '';
  let qty = 0;
  let rate = 0;

  // First column is typically the item number
  const firstPart = parts[0];
  if (/^\d+$/.test(firstPart)) {
    item_number = firstPart;
  } else {
    description = firstPart;
  }

  // Middle parts are description, unit
  if (description === '' && parts.length > 1) {
    description = parts[1];
  } else if (parts.length > 2) {
    description = [description, parts[1]].filter((p) => p).join(' ');
  }

  // Extract numbers from the remaining parts (qty, rate, amount)
  for (let i = 2; i < parts.length; i++) {
    const val = parseNumberFromString(parts[i]);
    if (val !== null) {
      if (qty === 0) qty = val;
      else if (rate === 0) rate = val;
    }
  }

  // Clean up description by removing trailing numbers
  description = description.replace(/\s+\d+[\d,]*(?:\.\d+)?.*$/, '').trim();

  if (!description) return null;

  return {
    item_number: item_number || undefined,
    description,
    unit: unit || 'Item',
    qty: qty || undefined,
    rate: rate || undefined,
  };
}

/**
 * Parse a number from a string (e.g., "100", "1,234.56", "230 Bags")
 */
function parseNumberFromString(str: string): number | null {
  const match = str.match(/(\d+(?:[,\s]\d{3})*(?:\.\d+)?)/);
  if (!match) return null;
  const numStr = match[1].replace(/[,\s]/g, '');
  const num = parseFloat(numStr);
  return isFinite(num) ? num : null;
}

/**
 * Generate auto-increment item numbers for a subsection
 */
export function generateItemNumbers(itemCount: number, style: 'numeric' | 'alpha' = 'numeric'): string[] {
  const numbers: string[] = [];
  if (style === 'numeric') {
    for (let i = 1; i <= itemCount; i++) {
      numbers.push(String(i));
    }
  } else {
    for (let i = 0; i < itemCount; i++) {
      numbers.push(String.fromCharCode(65 + i));  // A, B, C, ...
    }
  }
  return numbers;
}

/**
 * Validate parsed BOQ data before insertion
 */
export function validateBOQData(items: ParsedBOQItem[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (items.length === 0) {
    errors.push('No items to import');
  }

  for (const item of items) {
    if (!item.section_id || !item.section_name) {
      errors.push(`Item "${item.description}" missing section`);
    }
    if (!item.subsection_id || !item.subsection_name) {
      errors.push(`Item "${item.description}" missing subsection`);
    }
    if (!item.description || item.description.trim().length === 0) {
      errors.push('Found item with empty description');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
