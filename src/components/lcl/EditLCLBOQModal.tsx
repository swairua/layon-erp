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
import { LCLHierarchicalData } from '@/types/lclTemplate';

interface EditLCLBOQModalProps {
  isOpen: boolean;
  onClose: () => void;
  boq: LCLBOQRecord;
  onSaved: () => Promise<void>;
}

interface InlineEdit {
  qty?: number;
  rate?: number;
  description?: string;
}

interface ItemSnapshot {
  section_id: string;
  subsection_id: string;
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
}: EditLCLBOQModalProps) {
  const [items, setItems] = useState<ItemSnapshot[]>([]);
  const [inlineEdits, setInlineEdits] = useState<{ [itemId: string]: InlineEdit }>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const debounceTimers = useRef<{ [itemId: string]: NodeJS.Timeout }>({});
  const { toast } = useToast();
  const { currentCompany } = useCurrentCompany();
  const { data: customers } = useCustomers(currentCompany?.id || '');

  const extractSections = (itemsSnapshot: ItemSnapshot[]): string[] => {
    const sectionsSet = new Set<string>();
    itemsSnapshot.forEach((item) => {
      // Extract section letter from section_id (e.g., "section_a" -> "A")
      const match = item.section_id?.match(/section_([a-z])/i);
      if (match) {
        sectionsSet.add(match[1].toUpperCase());
      }
    });
    return Array.from(sectionsSet).sort();
  };

  const getItemsForSection = (sectionLetter: string): ItemSnapshot[] => {
    return items.filter((item) => {
      const match = item.section_id?.match(/section_([a-z])/i);
      return match && match[1].toUpperCase() === sectionLetter;
    });
  };

  const reconstructHierarchicalData = (): LCLHierarchicalData => {
    const sections: any[] = [];
    const sectionLetters = extractSections(items);

    sectionLetters.forEach((letter) => {
      const sectionItems = getItemsForSection(letter);
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
        const processedItems = subsectionItems.map((item) => ({
          ...item,
          amount: item.qty * item.rate,
        }));

        subsectionItems.forEach((item) => {
          subtotal += item.qty * item.rate;
        });

        subsections.push({
          subsection_id: subsectionId,
          subsection_name: subsectionItems[0]?.description || subsectionId,
          items: processedItems,
          subtotal,
        });

        sectionTotal += subtotal;
      });

      sections.push({
        section_id: `section-${letter}`,
        section_name: `SECTION ${letter}`,
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
      setSaveStatus('saved');
      const sections = extractSections(boq.items_snapshot);
      if (sections.length > 0) {
        setActiveSection(sections[0]);
      }
    }
  }, [isOpen, boq]);

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
    const qty = parseFloat(value) || 0;
    if (qty < 0) return;

    const itemId = `item-${itemIndex}`;
    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], qty },
    }));
    setSaveStatus('unsaved');

    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
    }

    debounceTimers.current[itemId] = setTimeout(() => {
      saveInlineEdit(itemIndex, qty, inlineEdits[itemId]?.rate);
    }, 500);
  };

  const handleRateChange = (itemIndex: number, value: string) => {
    const rate = parseFloat(value) || 0;
    if (rate < 0) return;

    const itemId = `item-${itemIndex}`;
    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], rate },
    }));
    setSaveStatus('unsaved');

    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
    }

    debounceTimers.current[itemId] = setTimeout(() => {
      saveInlineEdit(itemIndex, inlineEdits[itemId]?.qty, rate);
    }, 500);
  };

  const handleDescriptionChange = (itemIndex: number, value: string) => {
    const itemId = `item-${itemIndex}`;
    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], description: value },
    }));
    setSaveStatus('unsaved');

    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
    }

    debounceTimers.current[itemId] = setTimeout(() => {
      saveInlineEdit(itemIndex, undefined, undefined, value);
    }, 500);
  };

  const saveInlineEdit = async (
    itemIndex: number,
    newQty?: number,
    newRate?: number,
    newDescription?: string
  ) => {
    setSaveStatus('saving');
    try {
      const updatedItems = items.map((item, idx) => {
        if (idx === itemIndex) {
          const itemId = `item-${itemIndex}`;
          const edit = inlineEdits[itemId];
          return {
            ...item,
            qty: newQty !== undefined ? newQty : edit?.qty !== undefined ? edit.qty : item.qty,
            rate: newRate !== undefined ? newRate : edit?.rate !== undefined ? edit.rate : item.rate,
            description: newDescription !== undefined ? newDescription : edit?.description !== undefined ? edit.description : item.description,
            amount: (newQty !== undefined ? newQty : (edit?.qty !== undefined ? edit.qty : item.qty)) * 
                   (newRate !== undefined ? newRate : (edit?.rate !== undefined ? edit.rate : item.rate)),
          };
        }
        return item;
      });

      await lclBoqService.saveLCLBOQ({
        ...boq,
        items_snapshot: updatedItems,
        updated_at: new Date().toISOString(),
      });

      setItems(updatedItems);

      // Clear the inline edits for this item after successful save
      setInlineEdits((prev) => {
        const updated = { ...prev };
        delete updated[`item-${itemIndex}`];
        return updated;
      });

      setSaveStatus('saved');
    } catch (error) {
      console.error('Error saving edit:', error);
      setSaveStatus('unsaved');
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save changes',
        variant: 'destructive',
      });
    }
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
    // If all changes are already saved, just close
    if (saveStatus === 'saved' && Object.keys(inlineEdits).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      // Apply any remaining unsaved inline edits to items
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

      // Only save if there are unsaved changes
      if (Object.keys(inlineEdits).length > 0) {
        await lclBoqService.saveLCLBOQ({
          ...boq,
          items_snapshot: updatedItems,
          updated_at: new Date().toISOString(),
        });
      }

      setInlineEdits({});
      setSaveStatus('saved');
      toast({
        title: 'Success',
        description: 'BOQ updated successfully',
      });
      await onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving BOQ:', error);
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
                  Section {activeSection}
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
          <div className="flex gap-2 border-b pb-2">
            {sections.map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`px-3 py-2 text-sm font-medium rounded-t border-b-2 transition-colors ${
                  activeSection === section
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Section {section}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {saveStatus && (
            <div
              className={`flex items-center gap-2 p-3 rounded text-sm ${
                saveStatus === 'saving'
                  ? 'bg-blue-50 text-blue-900'
                  : saveStatus === 'saved'
                    ? 'bg-green-50 text-green-900'
                    : 'bg-yellow-50 text-yellow-900'
              }`}
            >
              {saveStatus === 'saved' ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>All changes saved</span>
                </>
              ) : saveStatus === 'saving' ? (
                <>
                  <AlertCircle className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span>Unsaved changes</span>
                </>
              )}
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
                          value={qty}
                          onChange={(e) => handleQtyChange(fullIndex, e.target.value)}
                          className="text-sm"
                          step="0.01"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={rate}
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
                  Section {activeSection} Total
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
            disabled={saving || saveStatus === 'saved'}
          >
            {saving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
