import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { BOQHierarchicalData } from '@/types/hierarchicalBOQ';

interface CompanyInfo {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
}

/**
 * Generate PDF from hierarchical BOQ structure
 */
export async function generateHierarchicalBOQPDF(
  hierarchicalData: BOQHierarchicalData,
  company: CompanyInfo,
  boqNumber?: string,
  boqDate?: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let yPosition = margin;

  // Header section
  const headerHeight = addHeader(doc, company, boqNumber, boqDate, pageWidth, yPosition);
  yPosition += headerHeight + 5;

  // Main content
  for (const section of hierarchicalData.sections) {
    // Check if we need a new page
    if (yPosition + 20 > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    // Section header
    yPosition = addSectionHeader(doc, section.section_name, pageWidth, yPosition);

    // Subsections
    for (const subsection of section.subsections) {
      if (yPosition + 15 > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }

      yPosition = addSubsectionTable(
        doc,
        subsection.subsection_name,
        subsection.items,
        pageWidth,
        yPosition
      );
      yPosition += 2;

      // Subtotal
      yPosition = addSubtotalRow(doc, subsection.subtotal, pageWidth, yPosition);
      yPosition += 3;
    }

    // Section total
    yPosition = addSectionTotal(doc, section.total, pageWidth, yPosition);
    yPosition += 5;
  }

  // Grand total
  yPosition = addGrandTotal(doc, hierarchicalData.grand_total, pageWidth, yPosition);

  // Footer
  addFooter(doc, pageHeight);

  // Download
  doc.save(`BOQ-${boqNumber || 'export'}.pdf`);
}

/**
 * Add document header with company info
 */
function addHeader(
  doc: jsPDF,
  company: CompanyInfo,
  boqNumber?: string,
  boqDate?: string,
  pageWidth?: number,
  yPos?: number
): number {
  pageWidth = pageWidth || doc.internal.pageSize.getWidth();
  yPos = yPos || 10;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  // Company name (bold, larger)
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(company.name, margin, yPos);
  yPos += 8;

  // Company address
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  if (company.address) {
    doc.text(company.address, margin, yPos);
    yPos += 4;
  }
  if (company.city) {
    doc.text(company.city, margin, yPos);
    yPos += 4;
  }

  // BOQ number and date on the right
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  if (boqNumber) {
    doc.text(`BOQ No: ${boqNumber}`, pageWidth - margin - 50, yPos - 8);
  }
  if (boqDate) {
    doc.text(`Date: ${new Date(boqDate).toLocaleDateString()}`, pageWidth - margin - 50, yPos - 4);
  }

  return yPos;
}

/**
 * Add section header
 */
function addSectionHeader(doc: jsPDF, sectionName: string, pageWidth: number, yPos: number): number {
  const margin = 10;

  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(200, 200, 200);
  doc.rect(margin, yPos, pageWidth - margin * 2, 6, 'F');
  doc.text(sectionName, margin + 2, yPos + 4.5);

  return yPos + 8;
}

/**
 * Add subsection table with items
 */
function addSubsectionTable(
  doc: jsPDF,
  subsectionName: string,
  items: any[],
  pageWidth: number,
  yPos: number
): number {
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  // Subsection title
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text(subsectionName, margin, yPos);
  yPos += 5;

  // Table headers
  const headers = ['No.', 'Description', 'Unit', 'Qty', 'Rate (KES)', 'Amount (KES)'];
  const columnWidths = [8, contentWidth * 0.4, 15, 12, 20, 20];

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(230, 230, 230);

  let xPos = margin;
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    doc.rect(xPos, yPos, columnWidths[i], 5, 'F');
    doc.text(header, xPos + 1, yPos + 3.5);
    xPos += columnWidths[i];
  }
  yPos += 5;

  // Table rows
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const qty = item.default_qty || 0;
    const rate = item.default_rate || 0;
    const amount = qty * rate;

    const rowData = [
      String(item.item_number || i + 1),
      item.description,
      item.unit || 'Item',
      qty.toFixed(2),
      rate.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ];

    xPos = margin;
    for (let j = 0; j < rowData.length; j++) {
      const cellText = rowData[j];
      const cellWidth = columnWidths[j];
      
      // Word wrap for description
      let cellYPos = yPos;
      if (j === 1) {
        const lines = doc.splitTextToSize(cellText, cellWidth - 2);
        doc.text(lines, xPos + 1, cellYPos + 2);
        cellYPos += Math.max(4, lines.length * 3);
      } else {
        doc.text(cellText, xPos + 1, cellYPos + 2);
      }

      doc.rect(xPos, yPos, cellWidth, 4);
      xPos += cellWidth;
    }

    yPos += 4;
  }

  return yPos;
}

/**
 * Add subsection subtotal
 */
function addSubtotalRow(doc: jsPDF, subtotal: number, pageWidth: number, yPos: number): number {
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(240, 240, 240);

  const totalX = margin + contentWidth - 50;
  doc.rect(margin, yPos, contentWidth, 5, 'F');
  doc.text('Subsection Total:', totalX - 30, yPos + 3.5);
  doc.text(
    `Ksh ${subtotal.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    totalX + 20,
    yPos + 3.5
  );

  return yPos + 5;
}

/**
 * Add section total
 */
function addSectionTotal(doc: jsPDF, total: number, pageWidth: number, yPos: number): number {
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(200, 200, 200);

  const totalX = margin + contentWidth - 50;
  doc.rect(margin, yPos, contentWidth, 6, 'F');
  doc.text('SECTION TOTAL:', totalX - 30, yPos + 4);
  doc.text(
    `Ksh ${total.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    totalX + 20,
    yPos + 4
  );

  return yPos + 6;
}

/**
 * Add grand total
 */
function addGrandTotal(doc: jsPDF, grandTotal: number, pageWidth: number, yPos: number): number {
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(100, 100, 100);
  doc.setTextColor(255, 255, 255);

  const totalX = margin + contentWidth - 50;
  doc.rect(margin, yPos, contentWidth, 8, 'F');
  doc.text('GRAND TOTAL:', totalX - 30, yPos + 5);
  doc.text(
    `Ksh ${grandTotal.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    totalX + 20,
    yPos + 5
  );

  doc.setTextColor(0, 0, 0);
  return yPos + 8;
}

/**
 * Add footer with page numbers
 */
function addFooter(doc: jsPDF, pageHeight: number): void {
  const pageCount = (doc as any).internal.pages.length - 1;
  const pageWidth = doc.internal.pageSize.getWidth();
  const footerY = pageHeight - 5;

  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, footerY, { align: 'center' });
  }
}
