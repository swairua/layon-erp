import { generatePDF } from '@/utils/pdfGenerator';
import { LCLHierarchicalData, LCLItemWithCalculations } from '@/types/lclTemplate';

const safeN = (v: number | undefined) => (typeof v === 'number' && !isNaN(v) ? v : 0);

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

  data.sections.forEach((section) => {
    // Add section header
    flatItems.push({
      description: section.section_name,
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
        description: `→ ${subsection.subsection_name}`,
        quantity: 0,
        unit_price: 0,
        line_total: 0,
        unit_of_measure: undefined,
        _isSectionHeader: true,
        _isSubtotal: false,
      });

      // Add items
      subsection.items.forEach((item: LCLItemWithCalculations) => {
        const qty = safeN(item.default_qty);
        const rate = safeN(item.default_rate);
        const amount = safeN(item.amount);

        flatItems.push({
          description: `${item.item_number}. ${item.description}`,
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
  });
}
