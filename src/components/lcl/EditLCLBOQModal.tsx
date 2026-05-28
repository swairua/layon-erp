import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { lclBoqService, LCLBOQRecord } from '@/services/lclBoqService';
import { CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { useCustomers } from '@/hooks/useDatabase';
import { downloadLCLBOQPDF } from '@/utils/lclBoqPdfGenerator';
import { LCLHierarchicalData, LCLTemplateStructure } from '@/types/lclTemplate';

interface EditLCLBOQModalProps {
  isOpen: boolean;
  onClose: () => void;
  boq: LCLBOQRecord;
  onSaved: () => Promise<void>;
  templateStructure?: LCLTemplateStructure;
}

interface InlineEdit {
  qty?: number;
  rate?: number;
  description?: string;
}

interface ItemSnapshot {
  section_id: string;
  section_name?: string;
  subsection_id: string;
  subsection_name?: string;
  item_number: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
}

export function EditLCLBOQModal({
  isOpen,
  onClose,
  boq,
  onSaved,
  templateStructure,
}: EditLCLBOQModalProps) {
  const [items, setItems] = useState<ItemSnapshot[]>([]);
  const [inlineEdits, setInlineEdits] = useState<{ [itemId: string]: InlineEdit }>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'unsaved' | 'saving' | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const inlineEditsRef = useRef<{ [itemId: string]: InlineEdit }>({});
  const { toast } = useToast();
  const { currentCompany } = useCurrentCompany();
  const { data: customers } = useCustomers(currentCompany?.id || '');

  // Helper function to get section name from template or items snapshot
  const getSectionNameFromTemplate = (sectionId: string): string | undefined => {
    if (!templateStructure || !templateStructure.structure_data?.sections) {
      return undefined;
    }

    const match = sectionId?.match(/section_([a-z])/i);
    if (!match) return undefined;

    const sectionIndex = match[1].toUpperCase().charCodeAt(0) - 65; // Convert A->0, B->1, etc.
    const section = templateStructure.structure_data.sections[sectionIndex];
    return section?.name;
  };

  const extractSections = (itemsSnapshot: ItemSnapshot[]): Array<{ letter: string; name?: string }> => {
    const sectionsMap = new Map<string, { letter: string; name?: string }>();
    itemsSnapshot.forEach((item) => {
      const match = item.section_id?.match(/section_([a-z])/i);
      if (match) {
        const letter = match[1].toUpperCase();
        if (!sectionsMap.has(letter)) {
          // Use section_name from snapshot, or fallback to template
          const sectionName = item.section_name || getSectionNameFromTemplate(item.section_id);
          sectionsMap.set(letter, {
            letter,
            name: sectionName,
          });
        }
      }
    });
    return Array.from(sectionsMap.values()).sort((a, b) => a.letter.localeCompare(b.letter));
  };

  const getItemsForSection = (sectionLetter: string): ItemSnapshot[] => {
    return items.filter((item) => {
      const match = item.section_id?.match(/section_([a-z])/i);
      return match && match[1].toUpperCase() === sectionLetter;
    });
  };

  const getSectionName = (sectionLetter: string): string => {
    const sectionItem = items.find((item) => {
      const match = item.section_id?.match(/section_([a-z])/i);
      return match && match[1].toUpperCase() === sectionLetter;
    });
    // Use section_name from snapshot, or fallback to template, or use generic name
    const name = sectionItem?.section_name || getSectionNameFromTemplate(sectionItem?.section_id);
    return name ? `SECTION ${sectionLetter}: ${name}` : `SECTION ${sectionLetter}`;
  };

  const reconstructHierarchicalData = (): LCLHierarchicalData => {
    const sections: any[] = [];
    const sectionLetters = extractSections(items);

    sectionLetters.forEach((sectionObj) => {
      const sectionItems = getItemsForSection(sectionObj.letter);
      const subsectionsMap = new Map<string, ItemSnapshot[]>();

      sectionItems.forEach((item) => {
        if (!subsectionsMap.has(item.subsection_id)) {
          subsectionsMap.set(item.subsection_id, []);
        }
        subsectionsMap.get(item.subsection_id)?.push(item);
      });

      const subsections: any[] = [];
      let sectionTotal = 0;

      subsectionsMap.forEach((subsectionItems, subsectionId) => {
        let subtotal = 0;
        let preservedSubsectionName: string | undefined;

        const processedItems = subsectionItems.map((item) => {
          if (!preservedSubsectionName && item.subsection_name) {
            preservedSubsectionName = item.subsection_name;
          }
          return {
            ...item,
            amount: item.qty * item.rate,
          };
        });

        subsectionItems.forEach((item) => {
          subtotal += item.qty * item.rate;
        });

        subsections.push({
          subsection_id: subsectionId,
          subsection_name: preservedSubsectionName || subsectionId,
          items: processedItems,
          subtotal,
        });

        sectionTotal += subtotal;
      });

      sections.push({
        section_id: `section-${sectionObj.letter}`,
        section_name: sectionObj.name || `SECTION ${sectionObj.letter}`,
        subsections,
        total: sectionTotal,
      });
    });

    const grandTotal = sections.reduce((sum, sec) => sum + sec.total, 0);

    return {
      structure_id: 'reconstructed',
      structure_name: 'Bill of Quantities',
      sections,
      grand_total: grandTotal,
    };
  };

  useEffect(() => {
    if (isOpen && boq.items_snapshot) {
      setItems(boq.items_snapshot);
      setInlineEdits({});
      inlineEditsRef.current = {};
      const sections = extractSections(boq.items_snapshot);
      if (sections.length > 0) {
        setActiveSection(sections[0].letter);
      }
    }
  }, [isOpen, boq]);

  useEffect(() => {
    inlineEditsRef.current = inlineEdits;
  }, [inlineEdits]);


  const getItemAmount = (item: ItemSnapshot, itemIndex: number): number => {
    const itemId = `item-${itemIndex}`;
    const edit = inlineEdits[itemId];
    const qty = edit?.qty !== undefined ? edit.qty : item.qty;
    const rate = edit?.rate !== undefined ? edit.rate : item.rate;
    return qty * rate;
  };

  const calculateTotals = () => {
    let subtotal = 0;
    items.forEach((item, index) => {
      subtotal += getItemAmount(item, index);
    });
    return subtotal;
  };

  const handleQtyChange = (itemIndex: number, value: string) => {
    const qty = value === '' ? 0 : parseFloat(value);
    if (qty < 0) return;

    const itemId = `item-${itemIndex}`;
    const finalQty = isNaN(qty) ? 0 : qty;

    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], qty: finalQty },
    }));
    setSaveStatus('unsaved');
  };

  const handleRateChange = (itemIndex: number, value: string) => {
    const rate = value === '' ? 0 : parseFloat(value);
    if (rate < 0) return;

    const itemId = `item-${itemIndex}`;
    const finalRate = isNaN(rate) ? 0 : rate;

    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], rate: finalRate },
    }));
    setSaveStatus('unsaved');
  };

  const handleDescriptionChange = (itemIndex: number, value: string) => {
    const itemId = `item-${itemIndex}`;
    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], description: value },
    }));
    setSaveStatus('unsaved');
  };


  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const customerInfo = boq.customer_id
        ? customers?.find((c) => c.id === boq.customer_id)
        : null;

      const hierarchicalData = reconstructHierarchicalData();

      await downloadLCLBOQPDF(
        hierarchicalData,
        boq.number,
        boq.boq_date || new Date().toISOString().split('T')[0],
        customerInfo?.name || 'Unknown Customer',
        boq.project_title || '',
        {
          name: currentCompany?.name || '',
          logo_url: currentCompany?.logo_url,
          address: currentCompany?.address,
          city: currentCompany?.city,
          country: currentCompany?.country,
          phone: currentCompany?.phone,
          email: currentCompany?.email,
        }
      );

      toast({
        title: 'Success',
        description: 'PDF downloaded successfully',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to download PDF',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveAll = async () => {
    // If no unsaved changes, just close
    if (Object.keys(inlineEdits).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setSaveStatus('saving');
    try {
      // Step 1: Validate boq.id exists before attempting save
      if (!boq.id) {
        console.error('CRITICAL: Cannot save BOQ - ID is missing', { boq });
        throw new Error('Cannot save: BOQ ID is missing. This is a critical data issue. Please reload and try again.');
      }

      console.log('Starting BOQ save', {
        boqId: boq.id,
        editsCount: Object.keys(inlineEdits).length,
        itemsCount: items.length
      });

      // Apply all inline edits to items
      const updatedItems = items.map((item, idx) => {
        const itemId = `item-${idx}`;
        const edit = inlineEdits[itemId];
        if (edit) {
          const qty = edit.qty !== undefined ? edit.qty : item.qty;
          const rate = edit.rate !== undefined ? edit.rate : item.rate;
          return {
            ...item,
            qty,
            rate,
            description: edit.description !== undefined ? edit.description : item.description,
            amount: qty * rate,
          };
        }
        return item;
      });

      const savePayload = {
        ...boq,
        items_snapshot: updatedItems,
        updated_at: new Date().toISOString(),
      };

      console.log('Save payload prepared', {
        id: savePayload.id,
        itemsCount: updatedItems.length,
        sampleItem: updatedItems[0]
      });

      const result = await lclBoqService.saveLCLBOQ(savePayload);

      console.log('Save completed successfully', {
        resultId: result.id,
        updatedAt: result.updated_at
      });

      setItems(updatedItems);
      setInlineEdits({});
      inlineEditsRef.current = {};

      toast({
        title: 'Success',
        description: 'BOQ updated successfully',
      });
      await onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving BOQ:', error);
      setSaveStatus('unsaved');
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save BOQ',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const sections = extractSections(items);
  const currentSectionItems = activeSection ? getItemsForSection(activeSection) : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Edit LCL BOQ - {boq.number}</DialogTitle>
              {activeSection && (
                <p className="text-sm text-muted-foreground mt-1">
                  {getSectionName(activeSection)}
                </p>
              )}
              {boq.id && (
                <p className="text-sm text-muted-foreground mt-1">
                  editng LCL id {boq.id}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={downloading}
            >
              <Download className="h-4 w-4 mr-2" />
              {downloading ? 'Downloading...' : 'Download PDF'}
            </Button>
          </div>
          <DialogDescription>
            Edit line items below. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>

        {sections.length > 0 && (
          <div className="flex gap-2 border-b pb-2 overflow-x-auto">
            {sections.map((section) => (
              <button
                key={section.letter}
                onClick={() => setActiveSection(section.letter)}
                className={`px-3 py-2 text-sm font-medium rounded-t border-b-2 transition-colors whitespace-nowrap ${
                  activeSection === section.letter
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {section.name ? `${section.letter}: ${section.name}` : `SECTION ${section.letter}`}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {saveStatus === 'unsaved' && (
            <div className="flex items-center gap-2 p-3 rounded text-sm bg-yellow-50 text-yellow-900">
              <AlertCircle className="h-4 w-4" />
              <span>Unsaved changes</span>
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Description</TableHead>
                  <TableHead className="w-20">Unit</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-24">Rate</TableHead>
                  <TableHead className="w-24 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentSectionItems.map((item, sectionIndex) => {
                  const fullIndex = items.findIndex(
                    (i) =>
                      i.item_number === item.item_number &&
                      i.description === item.description
                  );
                  const itemId = `item-${fullIndex}`;
                  const edit = inlineEdits[itemId];
                  const qty = edit?.qty !== undefined ? edit.qty : item.qty;
                  const rate = edit?.rate !== undefined ? edit.rate : item.rate;
                  const amount = qty * rate;

                  return (
                    <TableRow key={sectionIndex}>
                      <TableCell>
                        <Input
                          value={edit?.description !== undefined ? edit.description : item.description}
                          onChange={(e) => handleDescriptionChange(fullIndex, e.target.value)}
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.unit}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={qty.toString()}
                          onChange={(e) => handleQtyChange(fullIndex, e.target.value)}
                          className="text-sm"
                          step="0.01"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={rate.toString()}
                          onChange={(e) => handleRateChange(fullIndex, e.target.value)}
                          className="text-sm"
                          step="0.01"
                          min="0"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {activeSection && (
            <div className="flex justify-end border-t pt-4">
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-2">
                  {getSectionName(activeSection)} Total
                </div>
                <div className="text-2xl font-bold">
                  {currentSectionItems
                    .reduce((sum, item, idx) => {
                      const fullIndex = items.findIndex(
                        (i) =>
                          i.item_number === item.item_number &&
                          i.description === item.description
                      );
                      const itemId = `item-${fullIndex}`;
                      const edit = inlineEdits[itemId];
                      const qty = edit?.qty !== undefined ? edit.qty : item.qty;
                      const rate = edit?.rate !== undefined ? edit.rate : item.rate;
                      return sum + qty * rate;
                    }, 0)
                    .toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={saving || Object.keys(inlineEdits).length === 0}
          >
            {saving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
