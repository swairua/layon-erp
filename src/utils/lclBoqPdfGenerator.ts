import { generatePDF } from '@/utils/pdfGenerator';
import { LCLHierarchicalData, LCLItemWithCalculations } from '@/types/lclTemplate';

const safeN = (v: number | undefined) => (typeof v === 'number' && !isNaN(v) ? v : 0);

export interface ItemSnapshot {
  section_id: string;
  subsection_id: string;
  item_number: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface LCLBOQPdfOptions {
  customTitle?: string;
  stampImageUrl?: string;
}

/**
 * Flatten LCL BOQ hierarchical structure into flat items for PDF generation
 */
function flattenLCLBOQItems(data: LCLHierarchicalData): Array<{
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  unit_of_measure?: string;
  _isSectionHeader?: boolean;
  _isSubtotal?: boolean;
}> {
  const flatItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    unit_of_measure?: string;
    _isSectionHeader?: boolean;
    _isSubtotal?: boolean;
  }> = [];

  data.sections.forEach((section, sectionIndex) => {
    // Generate section letter (A, B, C, etc.)
    const sectionLetter = String.fromCharCode(65 + sectionIndex);

    // Add section header with proper format for PDF renderer
    flatItems.push({
      description: `SECTION ${sectionLetter}: ${section.section_name}`,
      quantity: 0,
      unit_price: 0,
      line_total: 0,
      unit_of_measure: undefined,
      _isSectionHeader: true,
      _isSubtotal: false,
    });

    // Add subsections and items
    section.subsections.forEach((subsection) => {
      // Add subsection header
      flatItems.push({
        description: `Subsection ${subsection.subsection_name}`,
        quantity: 0,
        unit_price: 0,
        line_total: 0,
        unit_of_measure: undefined,
        _isSectionHeader: true,
        _isSubtotal: false,
      });

      // Add items
      subsection.items.forEach((item: LCLItemWithCalculations) => {
        const qty = safeN(item.qty);
        const rate = safeN(item.rate);
        const amount = safeN(item.amount);

        flatItems.push({
          description: item.description,
          quantity: qty,
          unit_price: rate,
          line_total: amount,
          unit_of_measure: item.unit,
          _isSectionHeader: false,
          _isSubtotal: false,
        });
      });

      // Add subsection subtotal
      flatItems.push({
        description: `Subtotal - ${subsection.subsection_name}`,
        quantity: 0,
        unit_price: 0,
        line_total: subsection.subtotal,
        unit_of_measure: undefined,
        _isSectionHeader: false,
        _isSubtotal: true,
      });
    });

    // Add section total
    flatItems.push({
      description: `Section Total - ${section.section_name}`,
      quantity: 0,
      unit_price: 0,
      line_total: section.total,
      unit_of_measure: undefined,
      _isSectionHeader: false,
      _isSubtotal: true,
    });
  });

  return flatItems;
}

/**
 * Reconstructs hierarchical data from a flat items snapshot.
 * Converts flat array of items back to the hierarchical structure expected by downloadLCLBOQPDF.
 */
export function reconstructHierarchicalDataFromSnapshot(
  flatItems: ItemSnapshot[]
): LCLHierarchicalData {
  const sectionsMap = new Map<string, Map<string, ItemSnapshot[]>>();

  flatItems.forEach((item) => {
    if (!sectionsMap.has(item.section_id)) {
      sectionsMap.set(item.section_id, new Map());
    }

    const subsectionsMap = sectionsMap.get(item.section_id)!;
    if (!subsectionsMap.has(item.subsection_id)) {
      subsectionsMap.set(item.subsection_id, []);
    }

    subsectionsMap.get(item.subsection_id)!.push(item);
  });

  const sections: any[] = [];
  let grandTotal = 0;

  sectionsMap.forEach((subsectionsMap, sectionId) => {
    const subsections: any[] = [];
    let sectionTotal = 0;

    subsectionsMap.forEach((items, subsectionId) => {
      let subtotal = 0;

      const processedItems = items.map((item) => ({
        ...item,
        qty: safeN(item.qty),
        rate: safeN(item.rate),
        amount: safeN(item.qty) * safeN(item.rate),
      }));

      processedItems.forEach((item) => {
        subtotal += item.amount;
      });

      subsections.push({
        subsection_id: subsectionId,
        subsection_name: subsectionId,
        items: processedItems,
        subtotal,
      });

      sectionTotal += subtotal;
    });

    const sectionLetter = sectionId.replace('section-', '').toUpperCase();
    sections.push({
      section_id: sectionId,
      section_name: `SECTION ${sectionLetter}`,
      subsections,
      total: sectionTotal,
    });

    grandTotal += sectionTotal;
  });

  return {
    structure_id: 'reconstructed',
    structure_name: 'Bill of Quantities',
    sections,
    grand_total: grandTotal,
  };
}

export async function downloadLCLBOQPDF(
  data: LCLHierarchicalData,
  boqNumber: string,
  boqDate: string,
  customerName: string,
  projectTitle: string,
  company?: { name: string; logo_url?: string; address?: string; city?: string; country?: string; phone?: string; email?: string },
  options?: LCLBOQPdfOptions
) {
  const flatItems = flattenLCLBOQItems(data);

  const currency = 'KES';
  const subtotal = data.grand_total;

  return await generatePDF({
    type: 'boq',
    number: boqNumber,
    date: boqDate,
    company,
    customer: {
      name: customerName,
    },
    items: flatItems,
    subtotal: subtotal,
    total_amount: subtotal,
    project_title: projectTitle,
    notes: '',
    terms_and_conditions: '',
    currency: currency,
    customTitle: options?.customTitle,
    stampImageUrl: options?.stampImageUrl,
    isLCLBOQ: true,
  });
}
