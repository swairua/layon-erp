import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
import { AlertCircle, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { LCLHierarchicalData, LCLTemplateStructure } from '@/types/lclTemplate';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { lclBoqService } from '@/services/lclBoqService';
import { formatNumberWithoutTrailingZeros } from '@/utils/numberFormatter';

export interface ItemSnapshot {
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

interface InlineEdit {
  qty?: number;
  rate?: number;
  description?: string;
}

interface AddItemForm {
  subsectionId: string;
  sectionLetter: string;
}

export interface LCLBOQItemEditorHandle {
  getSnapshot: () => ItemSnapshot[];
  markAsSaved: () => void;
}

interface LCLBOQItemEditorProps {
  data: LCLHierarchicalData;
  templateStructure?: LCLTemplateStructure;
  companyId?: string;
  initialItems?: ItemSnapshot[];
}

const getDraftKey = (structureId: string) => `lcl_boq_creation_draft_${structureId}`;

interface AutosaveDraft {
  items: ItemSnapshot[];
  inlineEdits: { [itemId: string]: InlineEdit };
  lastSavedAt: string;
}

export const LCLBOQItemEditor = forwardRef<LCLBOQItemEditorHandle, LCLBOQItemEditorProps>(function LCLBOQItemEditor({
  data,
  templateStructure,
  companyId,
  initialItems,
}: LCLBOQItemEditorProps, ref) {
  const [items, setItems] = useState<ItemSnapshot[]>([]);
  const [inlineEdits, setInlineEdits] = useState<{ [itemId: string]: InlineEdit }>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [draftPending, setDraftPending] = useState(false);
  const [addItemForm, setAddItemForm] = useState<AddItemForm | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{ type: 'section' | 'item'; id: string; label: string } | null>(null);
  const inlineEditsRef = useRef<{ [itemId: string]: InlineEdit }>({});
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    inlineEditsRef.current = inlineEdits;
  }, [inlineEdits]);

  useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      return items.map((item, idx) => {
        const edit = inlineEdits[`item-${idx}`];
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
    },
    markAsSaved: () => {
      setInlineEdits({});
      inlineEditsRef.current = {};
      setDraftPending(false);
      setLastSavedTime(new Date().toISOString());
      try {
        localStorage.removeItem(getDraftKey(data.structure_id));
      } catch { /* ignore */ }
    },
  }), [items, inlineEdits, data.structure_id]);

  const flattenHierarchyToSnapshot = (hierarchicalData: LCLHierarchicalData): ItemSnapshot[] => {
    const snapshot: ItemSnapshot[] = [];
    hierarchicalData.sections.forEach((section) => {
      section.subsections.forEach((subsection) => {
        subsection.items.forEach((item: any) => {
          snapshot.push({
            section_id: section.section_id,
            section_name: section.section_name,
            subsection_id: subsection.subsection_id,
            subsection_name: subsection.subsection_name,
            item_number: item.item_number || '',
            description: item.description,
            unit: item.unit,
            qty: item.default_qty || item.qty || 0,
            rate: item.default_rate || item.rate || 0,
            amount: item.amount || (item.default_qty || 0) * (item.default_rate || 0),
          });
        });
      });
    });
    return snapshot;
  };

  useEffect(() => {
    let restoredItems: ItemSnapshot[] | null = null;
    let restoredEdits: { [itemId: string]: InlineEdit } | null = null;
    let restoredLastSavedAt: string | null = null;

    try {
      const raw = localStorage.getItem(getDraftKey(data.structure_id));
      if (raw) {
        const draft: AutosaveDraft = JSON.parse(raw);
        if (draft.items?.length && draft.inlineEdits && Object.keys(draft.inlineEdits).length > 0) {
          restoredItems = draft.items;
          restoredEdits = draft.inlineEdits;
          restoredLastSavedAt = draft.lastSavedAt || null;
        }
      }
    } catch { /* ignore */ }

    if (restoredItems && restoredEdits) {
      setItems(restoredItems);
      setInlineEdits(restoredEdits);
      inlineEditsRef.current = restoredEdits;
      setDraftPending(true);
      if (restoredLastSavedAt) {
        setLastSavedTime(restoredLastSavedAt);
      }
    } else if (initialItems && initialItems.length > 0) {
      // Use provided initial items (from previously-saved BOQ)
      setItems(initialItems);
      setInlineEdits({});
      inlineEditsRef.current = {};
    } else {
      setItems(flattenHierarchyToSnapshot(data));
      setInlineEdits({});
      inlineEditsRef.current = {};
    }

    const letterSet = new Set<string>();
    data.sections.forEach((section) => {
      const match = section.section_id?.match(/section[_-]?([a-z])/i);
      if (match) {
        letterSet.add(match[1].toUpperCase());
      }
    });
    setExpandedSections(letterSet);
  }, [data]);

  // Autosave draft to localStorage every 5 seconds
  useEffect(() => {
    if (!draftPending) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      setIsSaving(true);
      try {
        const draft: AutosaveDraft = {
          items,
          inlineEdits,
          lastSavedAt: new Date().toISOString(),
        };
        localStorage.setItem(getDraftKey(data.structure_id), JSON.stringify(draft));
        setLastSavedTime(draft.lastSavedAt);
        setDraftPending(false);
      } catch (error) {
        console.error('Failed to autosave draft:', error);
      } finally {
        setIsSaving(false);
      }
    }, 5000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [draftPending, items, inlineEdits, data.structure_id]);

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const getSectionLetter = (sectionId: string): string => {
    const match = sectionId?.match(/section[_-]?([a-z])/i);
    return match ? match[1].toUpperCase() : 'A';
  };

  const getSectionNameFromTemplate = (sectionId: string): string | undefined => {
    if (!templateStructure || !templateStructure.structure_data?.sections) return undefined;
    const match = sectionId?.match(/section[_-]?([a-z])/i);
    if (!match) return undefined;
    const sectionIndex = match[1].toUpperCase().charCodeAt(0) - 65;
    const section = templateStructure.structure_data.sections[sectionIndex];
    return section?.name;
  };

  const toggleSection = (letter: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) {
        next.delete(letter);
      } else {
        next.add(letter);
      }
      return next;
    });
  };

  const handleQtyChange = (itemIndex: number, value: string) => {
    const qty = value === '' ? 0 : parseFloat(value);
    if (qty < 0) return;
    const finalQty = isNaN(qty) ? 0 : qty;
    setInlineEdits((prev) => ({
      ...prev,
      [`item-${itemIndex}`]: { ...prev[`item-${itemIndex}`], qty: finalQty },
    }));
    setDraftPending(true);
  };

  const handleRateChange = (itemIndex: number, value: string) => {
    const rate = value === '' ? 0 : parseFloat(value);
    if (rate < 0) return;
    const finalRate = isNaN(rate) ? 0 : rate;
    setInlineEdits((prev) => ({
      ...prev,
      [`item-${itemIndex}`]: { ...prev[`item-${itemIndex}`], rate: finalRate },
    }));
    setDraftPending(true);
  };

  const handleDescriptionChange = (itemIndex: number, value: string) => {
    setInlineEdits((prev) => ({
      ...prev,
      [`item-${itemIndex}`]: { ...prev[`item-${itemIndex}`], description: value },
    }));
    setDraftPending(true);
  };

  const handleRemoveSection = (sectionId: string, sectionName: string) => {
    setRemoveConfirm({ type: 'section', id: sectionId, label: sectionName });
  };

  const handleRemoveItem = (itemIndex: number, description: string) => {
    setRemoveConfirm({ type: 'item', id: `item-${itemIndex}`, label: description });
  };

  const confirmRemove = () => {
    if (!removeConfirm) return;
    setDraftPending(true);
    if (removeConfirm.type === 'section') {
      setItems((prev) => {
        const updatedItems = prev.filter((item) => item.section_id !== removeConfirm.id);
        // Reset inline edits for items that no longer exist
        setInlineEdits((edits) => {
          const updated = { ...edits };
          prev.forEach((item, idx) => {
            if (item.section_id === removeConfirm.id) {
              delete updated[`item-${idx}`];
            }
          });
          return updated;
        });
        return updatedItems;
      });
      toast({ title: 'Success', description: `Section removed.` });
    } else {
      const idx = parseInt(removeConfirm.id.replace('item-', ''), 10);
      setItems((prev) => prev.filter((_, i) => i !== idx));
      setInlineEdits((edits) => {
        const updated = { ...edits };
        delete updated[removeConfirm.id];
        return updated;
      });
      toast({ title: 'Success', description: 'Item removed.' });
    }
    setRemoveConfirm(null);
  };

  const handleAddItem = (subsectionId: string, sectionLetter: string) => {
    setAddItemForm({ subsectionId, sectionLetter });
    setDraftPending(true);
  };

  const confirmAddItem = async (description: string, unit: string, qty: number, rate: number) => {
    if (!addItemForm) return;
    setDraftPending(true);
    const section = data.sections.find(
      (s) => getSectionLetter(s.section_id) === addItemForm.sectionLetter
    );
    if (!section) return;
    const subsection = section.subsections.find((ss) => ss.subsection_id === addItemForm.subsectionId);
    if (!subsection) return;

    // Find the section items in the existing flat array
    const sectionItems = items.filter((item) => item.subsection_id === addItemForm.subsectionId);
    const maxNum = sectionItems.reduce((max, item) => {
      const num = parseInt(item.item_number, 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);

    const newItem: ItemSnapshot = {
      section_id: section.section_id,
      section_name: section.section_name,
      subsection_id: subsection.subsection_id,
      subsection_name: subsection.subsection_name,
      item_number: String(maxNum + 1),
      description,
      unit,
      qty,
      rate,
      amount: qty * rate,
    };

    setItems((prev) => [...prev, newItem]);
    setAddItemForm(null);

    // Persist to database immediately if companyId is provided
    if (companyId) {
      try {
        const updatedItems = [...items, newItem];
        // Save draft BOQ with updated items
        await lclBoqService.autosaveLCLBOQDraft({
          company_id: companyId,
          number: 'DRAFT',
          items_snapshot: updatedItems,
          status: 'draft',
        });
        toast({ title: 'Success', description: 'Item added and saved.' });
      } catch (error) {
        console.error('Failed to persist item:', error);
        toast({
          title: 'Warning',
          description: 'Item added locally but failed to save to database.',
          variant: 'destructive',
        });
      }
    } else {
      toast({ title: 'Success', description: 'Item added.' });
    }
  };

  // Group items by section for rendering
  const sectionLetters = Array.from(new Set(items.map((item) => getSectionLetter(item.section_id)))).sort();

  return (
    <div className="space-y-4">
      {isSaving && (
        <div className="flex items-center gap-2 p-3 rounded text-sm bg-amber-50 text-amber-900">
          <span>Saving draft...</span>
        </div>
      )}
      {!isSaving && draftPending && (
        <div className="flex items-center gap-2 p-3 rounded text-sm bg-yellow-50 text-yellow-900">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Unsaved changes</span>
        </div>
      )}
      {!isSaving && !draftPending && lastSavedTime && (
        <div className="flex items-center gap-2 p-3 rounded text-sm bg-green-50 text-green-900">
          <span>Saved at {new Date(lastSavedTime).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}

      <div className="space-y-4">
        {sectionLetters.map((sectionLetter) => {
          const sectionItems = items.filter(
            (item) => getSectionLetter(item.section_id) === sectionLetter
          );
          const isExpanded = expandedSections.has(sectionLetter);

          // Use section_name from first item or template
          const sectionName = sectionItems[0]?.section_name || getSectionNameFromTemplate(
            sectionItems[0]?.section_id
          ) || `SECTION ${sectionLetter}`;
          const sectionId = sectionItems[0]?.section_id || '';

          // Group by subsection
          const subsectionMap = new Map<string, ItemSnapshot[]>();
          sectionItems.forEach((item) => {
            if (!subsectionMap.has(item.subsection_id)) {
              subsectionMap.set(item.subsection_id, []);
            }
            subsectionMap.get(item.subsection_id)?.push(item);
          });

          const getItem = (item: ItemSnapshot, fullIndex: number) => {
            const itemId = `item-${fullIndex}`;
            const edit = inlineEdits[itemId];
            const qty = edit?.qty !== undefined ? edit.qty : item.qty;
            const rate = edit?.rate !== undefined ? edit.rate : item.rate;
            const amount = qty * rate;
            return { item, fullIndex, itemId, edit, qty, rate, amount };
          };

          let sectionTotal = 0;

          const subsectionEntries = Array.from(subsectionMap.entries()).map(([ssId, ssItems]) => {
            let subsectionName = '';
            let subtotal = 0;
            const itemsWithAmount = ssItems.map((origItem) => {
              const fullIndex = items.indexOf(origItem);
              const ia = getItem(origItem, fullIndex);
              if (!subsectionName && origItem.subsection_name) {
                subsectionName = origItem.subsection_name;
              }
              subtotal += ia.amount;
              return ia;
            });
            sectionTotal += subtotal;
            return { subsectionId: ssId, subsectionName, itemsWithAmount, subtotal };
          });

          return (
            <div key={sectionLetter} className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between gap-4 px-4 py-3 bg-card">
                <button
                  type="button"
                  onClick={() => toggleSection(sectionLetter)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left"
                >
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  <span className="font-semibold text-sm truncate">
                    SECTION {sectionLetter}: {sectionName}
                  </span>
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium tabular-nums">
                    {formatNumberWithoutTrailingZeros(sectionTotal)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveSection(sectionId, sectionName)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    title="Remove this section from the BOQ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t px-4 pb-4">
                  {subsectionEntries.map((entry) => (
                    <div key={entry.subsectionId} className="mt-4">
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        &rarr; {entry.subsectionName || entry.subsectionId}
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8">#</TableHead>
                              <TableHead className="w-1/3">Description</TableHead>
                              <TableHead className="w-16">Unit</TableHead>
                              <TableHead className="w-24">Qty</TableHead>
                              <TableHead className="w-24">Rate</TableHead>
                              <TableHead className="w-24 text-right">Amount</TableHead>
                              <TableHead className="w-8"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.itemsWithAmount.map((ia, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs text-muted-foreground">
                                  {ia.item.item_number}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={ia.edit?.description !== undefined ? ia.edit.description : ia.item.description}
                                    onChange={(e) => handleDescriptionChange(ia.fullIndex, e.target.value)}
                                    className="text-sm h-8"
                                  />
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {ia.item.unit}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={formatNumberWithoutTrailingZeros(ia.qty)}
                                    onChange={(e) => handleQtyChange(ia.fullIndex, e.target.value)}
                                    className="text-sm h-8 w-16 md:w-20 lg:w-24"
                                    step="0.01"
                                    min="0"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={formatNumberWithoutTrailingZeros(ia.rate)}
                                    onChange={(e) => handleRateChange(ia.fullIndex, e.target.value)}
                                    className="text-sm h-8 w-16 md:w-20 lg:w-24"
                                    step="0.01"
                                    min="0"
                                  />
                                </TableCell>
                                <TableCell className="text-right font-medium text-sm tabular-nums">
                                  {formatNumberWithoutTrailingZeros(ia.amount)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemoveItem(ia.fullIndex, ia.item.description)}
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    title="Remove item"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            {addItemForm?.subsectionId === entry.subsectionId && addItemForm?.sectionLetter === sectionLetter ? (
                              <AddItemRow
                                onConfirm={confirmAddItem}
                                onCancel={() => setAddItemForm(null)}
                              />
                            ) : (
                              <TableRow>
                                <TableCell colSpan={7} className="p-1">
                                  <Button
                                    size="sm"
                                    className="text-xs w-full bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => handleAddItem(entry.subsectionId, sectionLetter)}
                                  >
                                    <Plus className="h-3 w-3 mr-1" /> Add Item
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={5} className="text-right text-sm font-medium text-muted-foreground">
                                Subtotal
                              </TableCell>
                              <TableCell className="text-right font-medium text-sm tabular-nums">
                                {formatNumberWithoutTrailingZeros(entry.subtotal)}
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end mt-4 pt-2 border-t">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Section Total</div>
                      <div className="text-lg font-bold tabular-nums">
                        {formatNumberWithoutTrailingZeros(sectionTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmationDialog
        open={removeConfirm !== null}
        title={`Remove ${removeConfirm?.type === 'section' ? 'Section' : 'Item'}`}
        description={
          removeConfirm?.type === 'section'
            ? `Remove "${removeConfirm?.label}" from this BOQ? The template remains unchanged.`
            : `Remove item "${removeConfirm?.label}" from this BOQ?`
        }
        onConfirm={confirmRemove}
        onCancel={() => setRemoveConfirm(null)}
        confirmText="Remove"
        isDangerous
      />
    </div>
  );
});

function AddItemRow({
  onConfirm,
  onCancel,
}: {
  onConfirm: (description: string, unit: string, qty: number, rate: number) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState('New item');
  const [unit, setUnit] = useState('Item');
  const [qty, setQty] = useState('0');
  const [rate, setRate] = useState('0');

  return (
    <TableRow>
      <TableCell className="text-xs text-muted-foreground">+</TableCell>
      <TableCell>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="text-sm h-8"
          placeholder="Description"
        />
      </TableCell>
      <TableCell>
        <Input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="text-sm h-8"
          placeholder="Unit"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="text-sm h-8"
          step="0.01"
          min="0"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="text-sm h-8"
          step="0.01"
          min="0"
        />
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {formatNumberWithoutTrailingZeros(parseFloat(qty || '0') * parseFloat(rate || '0'))}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={() => onConfirm(description, unit, parseFloat(qty || '0'), parseFloat(rate || '0'))}
            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
          >
            Confirm
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="h-7 text-xs"
          >
            X
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
