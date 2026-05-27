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
import { CheckCircle2, AlertCircle } from 'lucide-react';

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
  const debounceTimers = useRef<{ [itemId: string]: NodeJS.Timeout }>({});
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && boq.items_snapshot) {
      setItems(boq.items_snapshot);
      setInlineEdits({});
      setSaveStatus('saved');
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit LCL BOQ - {boq.number}</DialogTitle>
          <DialogDescription>
            Edit line items below. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>

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
                {items.map((item, index) => {
                  const itemId = `item-${index}`;
                  const edit = inlineEdits[itemId];
                  const qty = edit?.qty !== undefined ? edit.qty : item.qty;
                  const rate = edit?.rate !== undefined ? edit.rate : item.rate;
                  const amount = qty * rate;

                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={edit?.description !== undefined ? edit.description : item.description}
                          onChange={(e) => handleDescriptionChange(index, e.target.value)}
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
                          onChange={(e) => handleQtyChange(index, e.target.value)}
                          className="text-sm"
                          step="0.01"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={rate}
                          onChange={(e) => handleRateChange(index, e.target.value)}
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

          <div className="flex justify-end border-t pt-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-2">Total Amount</div>
              <div className="text-2xl font-bold">
                {calculateTotals().toFixed(2)}
              </div>
            </div>
          </div>
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
