import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Trash2, Check, X, Edit2, Trash } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { lclTemplateService } from '@/services/lclTemplateService';
import {
  LCLHierarchicalData,
  LCLItemWithCalculations,
  LCLTemplateItem,
} from '@/types/lclTemplate';
import { LCL_TEMPLATE_UNITS } from '@/utils/lclTemplateUnits';
import {
  saveDraftToLocalStorage,
  loadDraftFromLocalStorage,
  clearDraftFromLocalStorage,
} from '@/utils/lclTemplateAutosaveUtils';
import { formatNumberWithoutTrailingZeros } from '@/utils/numberFormatter';
import { LCLTemplateSaveIndicator } from './LCLTemplateSaveIndicator';

interface LCLTemplateEditorProps {
  data: LCLHierarchicalData;
  onDataUpdated: () => Promise<void>;
  companyId: string;
}

interface EditingState {
  itemId?: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
}

interface InlineEdit {
  qty?: number;
  rate?: number;
}

export function LCLTemplateEditor({
  data,
  onDataUpdated,
  companyId,
}: LCLTemplateEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(data.sections.map((s) => s.section_id))
  );
  const [expandedSubsections, setExpandedSubsections] = useState<Set<string>>(
    new Set()
  );
  const [editingItem, setEditingItem] = useState<EditingState | null>(null);
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [inlineEdits, setInlineEdits] = useState<{ [itemId: string]: InlineEdit }>({});
  const [loading, setLoading] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const debounceTimers = useRef<{ [itemId: string]: NodeJS.Timeout }>({});
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestInlineEditsRef = useRef<{ [itemId: string]: InlineEdit }>({});
  const { toast } = useToast();

  // Calculate item amount with inline edits
  const getItemAmount = (item: LCLItemWithCalculations): number => {
    const edit = inlineEdits[item.id];
    const qty = edit?.qty !== undefined ? edit.qty : (item.default_qty || 0);
    const rate = edit?.rate !== undefined ? edit.rate : (item.default_rate || 0);
    return qty * rate;
  };

  // Calculate totals with inline edits
  const calculateTotals = () => {
    const totals: { [sectionId: string]: { section: number; subsections: { [subId: string]: number } } } = {};

    data.sections.forEach((section) => {
      let sectionTotal = 0;
      const subsectionTotals: { [subId: string]: number } = {};

      section.subsections.forEach((subsection) => {
        let subtotal = 0;
        subsection.items.forEach((item) => {
          subtotal += getItemAmount(item);
        });
        subsectionTotals[subsection.subsection_id] = subtotal;
        sectionTotal += subtotal;
      });

      totals[section.section_id] = {
        section: sectionTotal,
        subsections: subsectionTotals,
      };
    });

    return totals;
  };

  const totals = calculateTotals();

  const getGrandTotal = (): number => {
    return Object.values(totals).reduce((sum, t) => sum + t.section, 0);
  };

  // Flatten hierarchy into a list with header markers (like PDF generator)
  interface FlatItem {
    id: string;
    type: 'sectionHeader' | 'subsectionHeader' | 'item' | 'subtotal' | 'sectionTotal';
    description: string;
    quantity?: number;
    unit_price?: number;
    line_total?: number;
    unit_of_measure?: string;
    item?: LCLItemWithCalculations;
    sectionId?: string;
    subsectionId?: string;
    sectionLetter?: string;
    sectionName?: string;
    subsectionName?: string;
  }

  const flattenedItems: FlatItem[] = [];
  data.sections.forEach((section, sectionIndex) => {
    const sectionLetter = String.fromCharCode(65 + sectionIndex);

    // Add section header
    flattenedItems.push({
      id: `section-header-${section.section_id}`,
      type: 'sectionHeader',
      description: `SECTION ${sectionLetter}: ${section.section_name}`,
      sectionLetter,
      sectionName: section.section_name,
      sectionId: section.section_id,
    });

    // Add subsections and items
    section.subsections.forEach((subsection) => {
      // Add subsection header
      flattenedItems.push({
        id: `subsection-header-${subsection.subsection_id}`,
        type: 'subsectionHeader',
        description: `→ ${subsection.subsection_name}`,
        subsectionName: subsection.subsection_name,
        subsectionId: subsection.subsection_id,
        sectionId: section.section_id,
      });

      // Add items
      subsection.items.forEach((item) => {
        flattenedItems.push({
          id: item.id,
          type: 'item',
          description: item.description,
          quantity: inlineEdits[item.id]?.qty !== undefined ? inlineEdits[item.id].qty : (item.default_qty || 0),
          unit_price: inlineEdits[item.id]?.rate !== undefined ? inlineEdits[item.id].rate : (item.default_rate || 0),
          line_total: getItemAmount(item),
          unit_of_measure: item.unit,
          item,
          sectionId: section.section_id,
          subsectionId: subsection.subsection_id,
        });
      });

      // Add subsection subtotal
      const subtotal = totals[section.section_id]?.subsections[subsection.subsection_id] || 0;
      flattenedItems.push({
        id: `subtotal-${subsection.subsection_id}`,
        type: 'subtotal',
        description: `Subtotal - ${subsection.subsection_name}`,
        line_total: subtotal,
        sectionId: section.section_id,
        subsectionId: subsection.subsection_id,
      });
    });

    // Add section total
    const sectionTotal = totals[section.section_id]?.section || 0;
    flattenedItems.push({
      id: `section-total-${section.section_id}`,
      type: 'sectionTotal',
      description: `SECTION ${sectionLetter} TOTAL: ${section.section_name}`,
      line_total: sectionTotal,
      sectionId: section.section_id,
    });
  });

  const handleInlineQtyChange = (itemId: string, value: string) => {
    const qty = parseFloat(value) || 0;
    if (qty < 0) return;

    setInlineEdits((prev) => {
      const newEdits = {
        ...prev,
        [itemId]: { ...prev[itemId], qty },
      };

      // Save first edit to localStorage immediately for recovery
      if (Object.keys(prev).length === 0) {
        console.log(`[EDIT] First edit added - itemId: ${itemId}, qty: ${qty}, setting hasUnsavedChanges=true`);
        setHasUnsavedChanges(true);
        try {
          saveDraftToLocalStorage(data.structure_id, newEdits);
        } catch (error) {
          console.error('Failed to save first edit:', error);
        }
      } else {
        console.log(`[EDIT] Qty changed - itemId: ${itemId}, qty: ${qty}, total edits: ${Object.keys(prev).length}`);
      }

      // Debounce save - read both qty and rate from latest ref when timer executes
      if (debounceTimers.current[itemId]) {
        clearTimeout(debounceTimers.current[itemId]);
      }

      debounceTimers.current[itemId] = setTimeout(() => {
        console.log(`[DEBOUNCE] Timer fired for itemId: ${itemId}`);
        const latestQty = latestInlineEditsRef.current[itemId]?.qty ?? qty;
        const latestRate = latestInlineEditsRef.current[itemId]?.rate;
        saveInlineEdit(itemId, latestQty, latestRate);
      }, 500);

      return newEdits;
    });
  };

  const handleInlineRateChange = (itemId: string, value: string) => {
    const rate = parseFloat(value) || 0;
    if (rate < 0) return;

    setInlineEdits((prev) => {
      const newEdits = {
        ...prev,
        [itemId]: { ...prev[itemId], rate },
      };

      // Save first edit to localStorage immediately for recovery
      if (Object.keys(prev).length === 0) {
        console.log(`[EDIT] First edit added - itemId: ${itemId}, rate: ${rate}, setting hasUnsavedChanges=true`);
        setHasUnsavedChanges(true);
        try {
          saveDraftToLocalStorage(data.structure_id, newEdits);
        } catch (error) {
          console.error('Failed to save first edit:', error);
        }
      } else {
        console.log(`[EDIT] Rate changed - itemId: ${itemId}, rate: ${rate}, total edits: ${Object.keys(prev).length}`);
      }

      // Debounce save - read both qty and rate from latest ref when timer executes
      if (debounceTimers.current[itemId]) {
        clearTimeout(debounceTimers.current[itemId]);
      }

      debounceTimers.current[itemId] = setTimeout(() => {
        console.log(`[DEBOUNCE] Timer fired for itemId: ${itemId}`);
        const latestQty = latestInlineEditsRef.current[itemId]?.qty;
        const latestRate = latestInlineEditsRef.current[itemId]?.rate ?? rate;
        saveInlineEdit(itemId, latestQty, latestRate);
      }, 500);

      return newEdits;
    });
  };

  const saveInlineEdit = async (itemId: string, newQty?: number, newRate?: number) => {
    console.log(`[SAVE] saveInlineEdit starting for itemId: ${itemId}, newQty: ${newQty}, newRate: ${newRate}`);
    try {
      const edit = inlineEdits[itemId];
      const qtyToSave = newQty !== undefined ? newQty : edit?.qty;
      const rateToSave = newRate !== undefined ? newRate : edit?.rate;

      // Find the item to get current values
      let currentItem: LCLItemWithCalculations | null = null;
      for (const section of data.sections) {
        for (const subsection of section.subsections) {
          const item = subsection.items.find((i) => i.id === itemId);
          if (item) {
            currentItem = item;
            break;
          }
        }
        if (currentItem) break;
      }

      if (!currentItem) {
        console.log(`[SAVE] Item not found: ${itemId}`);
        return;
      }

      await lclTemplateService.updateItem(itemId, {
        description: currentItem.description,
        unit: currentItem.unit,
        default_qty: qtyToSave !== undefined ? qtyToSave : currentItem.default_qty,
        default_rate: rateToSave !== undefined ? rateToSave : currentItem.default_rate,
      });

      console.log(`[SAVE] Database save completed for itemId: ${itemId}`);

      // Clear the inline edit after successful save
      setInlineEdits((prev) => {
        const updated = { ...prev };
        delete updated[itemId];
        console.log(`[SAVE] Removing edit from state for itemId: ${itemId}, remaining edits: ${Object.keys(updated).length}`);

        // Clear draft if no more unsaved edits
        if (Object.keys(updated).length === 0) {
          console.log(`[SAVE] No more edits, clearing draft and setting hasUnsavedChanges=false`);
          clearDraftFromLocalStorage(data.structure_id);
          setHasUnsavedChanges(false);
          setLastSavedTime(new Date().toISOString());
        }

        return updated;
      });

      await onDataUpdated();
    } catch (error) {
      console.error(`[SAVE] Error saving itemId: ${itemId}`, error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save changes',
        variant: 'destructive',
      });
    }
  };

  // Keep latest edits ref in sync with state for debounce callbacks
  useEffect(() => {
    latestInlineEditsRef.current = inlineEdits;
  }, [inlineEdits]);


  // Load draft from localStorage on mount
  useEffect(() => {
    const draft = loadDraftFromLocalStorage(data.structure_id);
    if (draft && Object.keys(draft).length > 0) {
      setInlineEdits(draft);
      setHasUnsavedChanges(true);
      toast({
        title: 'Draft Restored',
        description: 'Your unsaved changes have been restored.',
      });
    }
  }, [data.structure_id, toast]);

  // Autosave inline edits every 5 seconds
  useEffect(() => {
    if (Object.keys(inlineEdits).length === 0) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      setIsSaving(true);
      try {
        saveDraftToLocalStorage(data.structure_id, inlineEdits);
        setLastSavedTime(new Date().toISOString());
        setHasUnsavedChanges(false);
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
  }, [inlineEdits, data.structure_id]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach((timer) => clearTimeout(timer));
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const toggleSubsection = (subsectionId: string) => {
    const newExpanded = new Set(expandedSubsections);
    if (newExpanded.has(subsectionId)) {
      newExpanded.delete(subsectionId);
    } else {
      newExpanded.add(subsectionId);
    }
    setExpandedSubsections(newExpanded);
  };

  const startEditingItem = (item: LCLItemWithCalculations) => {
    setEditingItem({
      itemId: item.id,
      description: item.description,
      unit: item.unit,
      qty: item.default_qty || 0,
      rate: item.default_rate || 0,
    });
  };

  const startAddingItem = (subsectionId: string) => {
    setAddingItemTo(subsectionId);
    setEditingItem({
      description: '',
      unit: 'Item',
      qty: 0,
      rate: 0,
    });
  };

  const handleSaveItem = async () => {
    if (!editingItem) return;

    if (!editingItem.description.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Item description is required.',
        variant: 'destructive',
      });
      return;
    }

    if (editingItem.qty < 0 || editingItem.rate < 0) {
      toast({
        title: 'Validation Error',
        description: 'Quantity and rate must be non-negative.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (editingItem.itemId) {
        // Update existing item
        await lclTemplateService.updateItem(editingItem.itemId, {
          description: editingItem.description,
          unit: editingItem.unit,
          default_qty: editingItem.qty,
          default_rate: editingItem.rate,
        });
      } else {
        // Create new item
        const subsectionId = addingItemTo;
        if (!subsectionId) throw new Error('Subsection not found');

        // Find section and subsection IDs from hierarchy
        let foundSection = null;
        let foundSubsection = null;

        for (const section of data.sections) {
          for (const subsection of section.subsections) {
            if (subsection.subsection_id === subsectionId) {
              foundSection = section;
              foundSubsection = subsection;
              break;
            }
          }
          if (foundSection) break;
        }

        if (!foundSection || !foundSubsection) {
          throw new Error('Invalid section/subsection');
        }

        // Determine next item number
        const existingItems = foundSubsection.items;
        const nextNumber = existingItems.length + 1;

        await lclTemplateService.insertItems([
          {
            structure_id: data.structure_id,
            company_id: companyId,
            section_id: foundSection.section_id,
            subsection_id: foundSubsection.subsection_id,
            item_number: nextNumber.toString(),
            description: editingItem.description,
            unit: editingItem.unit,
            default_qty: editingItem.qty,
            default_rate: editingItem.rate,
            sort_order: existingItems.length,
          },
        ]);
      }

      toast({
        title: 'Success',
        description: editingItem.itemId
          ? 'Item updated successfully.'
          : 'Item added successfully.',
      });

      setEditingItem(null);
      setAddingItemTo(null);
      await onDataUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save item',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    setLoading(true);
    try {
      await lclTemplateService.deleteItem(itemId);
      toast({
        title: 'Success',
        description: 'Item deleted successfully.',
      });

      // Remove from inline edits if present
      setInlineEdits((prev) => {
        const updated = { ...prev };
        delete updated[itemId];

        // Clear draft if no more unsaved edits
        if (Object.keys(updated).length === 0) {
          clearDraftFromLocalStorage(data.structure_id);
        }

        return updated;
      });

      await onDataUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete item',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSection = async (sectionId: string, sectionName: string) => {
    if (!window.confirm(`Remove "${sectionName}" from this BOQ? The template remains unchanged.`)) return;

    setLoading(true);
    try {
      const section = data.sections.find((s) => s.section_id === sectionId);
      if (!section) return;

      for (const subsection of section.subsections) {
        for (const item of subsection.items) {
          await lclTemplateService.deleteItem(item.id);
        }
      }

      toast({
        title: 'Success',
        description: 'Section removed successfully.',
      });

      // Clear inline edits for deleted items
      setInlineEdits((prev) => {
        const updated = { ...prev };
        section.subsections.forEach((subsection) => {
          subsection.items.forEach((item) => {
            delete updated[item.id];
          });
        });

        // Clear draft if no more unsaved edits
        if (Object.keys(updated).length === 0) {
          clearDraftFromLocalStorage(data.structure_id);
        }

        return updated;
      });

      await onDataUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete section',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItemId(itemId);
  };

  const handleDragLeave = () => {
    setDragOverItemId(null);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetItemId: string,
    subsectionItems: LCLItemWithCalculations[],
    sectionId: string,
    subsectionId: string
  ) => {
    e.preventDefault();
    setDragOverItemId(null);

    if (!draggedItemId || draggedItemId === targetItemId) return;

    try {
      const draggedItem = subsectionItems.find((item) => item.id === draggedItemId);
      const targetItem = subsectionItems.find((item) => item.id === targetItemId);

      if (!draggedItem || !targetItem) return;

      const draggedIndex = subsectionItems.findIndex((item) => item.id === draggedItemId);
      const targetIndex = subsectionItems.findIndex((item) => item.id === targetItemId);

      const reorderedIds = [...subsectionItems.map((item) => item.id)];
      reorderedIds.splice(draggedIndex, 1);
      reorderedIds.splice(targetIndex, 0, draggedItemId);

      setLoading(true);
      await lclTemplateService.reorderItemsInSubsection(
        data.structure_id,
        sectionId,
        subsectionId,
        reorderedIds
      );

      toast({
        title: 'Success',
        description: 'Items reordered successfully.',
      });
      setDraggedItemId(null);
      await onDataUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to reorder items',
        variant: 'destructive',
      });
      setDraggedItemId(null);
    } finally {
      setLoading(false);
    }
  };

  const amount =
    (editingItem?.qty || 0) * (editingItem?.rate || 0);

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-lg font-semibold">{data.structure_name}</h2>
          <LCLTemplateSaveIndicator
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedTime={lastSavedTime}
          />
        </div>
        {data.description && (
          <p className="text-sm text-muted-foreground mb-3">
            {data.description}
          </p>
        )}
        <div className="text-right">
          <p className="text-sm font-medium">
            Grand Total (KES):{' '}
            <span className="text-lg font-bold">
              Ksh{formatNumberWithoutTrailingZeros(getGrandTotal())}
            </span>
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {data.sections.map((section) => (
          <div key={section.section_id} className="border border-border rounded-lg">
            {/* Section header */}
            <div className="flex items-center justify-between p-4 hover:bg-muted transition-colors border-b border-border">
              <button
                onClick={() => toggleSection(section.section_id)}
                className="flex-1 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  {expandedSections.has(section.section_id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <h3 className="font-semibold">{section.section_name}</h3>
                  {(() => {
                    const inheritanceMap: { [key: string]: string } = {
                      'section_d': 'section_b',
                      'section_e': 'section_c',
                      'section_f': 'section_b',
                      'section_g': 'section_c'
                    };
                    const parentSectionId = inheritanceMap[section.section_id];
                    const parentName = parentSectionId ?
                      data.sections.find(s => s.section_id === parentSectionId)?.section_name :
                      null;
                    return parentName ? (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Inherits from {parentName}
                      </span>
                    ) : null;
                  })()}
                </div>
                <p className="text-sm font-medium">
                  Section Total (KES): Ksh{formatNumberWithoutTrailingZeros(totals[section.section_id]?.section || 0)}
                </p>
              </button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteSection(section.section_id, section.section_name)}
                disabled={loading}
                className="h-8 w-8 p-0 ml-2"
                title="Remove section from BOQ"
              >
                <Trash className="h-4 w-4 text-red-600" />
              </Button>
            </div>

            {/* Subsections and items */}
            {expandedSections.has(section.section_id) && (
              <div className="border-t border-border">
                {section.subsections.map((subsection, subsectionIndex) => {
                  const sectionLetter = String.fromCharCode(65 + data.sections.findIndex(s => s.section_id === section.section_id));
                  const isFirstSubsection = subsectionIndex === 0;

                  return (
                  <div key={subsection.subsection_id}>
                    {/* Subsection header */}
                    <button
                      onClick={() =>
                        toggleSubsection(subsection.subsection_id)
                      }
                      className="w-full flex items-center justify-between px-6 py-3 bg-muted/50 hover:bg-muted transition-colors border-b border-border"
                    >
                      <div className="flex items-center gap-2">
                        {expandedSubsections.has(subsection.subsection_id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <p className="font-medium text-sm">
                          {subsection.subsection_name}
                        </p>
                      </div>
                      <p className="text-sm">
                        Subtotal (KES): Ksh{formatNumber(totals[section.section_id]?.subsections[subsection.subsection_id] || 0)}
                      </p>
                    </button>

                    {/* Items table */}
                    {expandedSubsections.has(subsection.subsection_id) && (
                      <div className="px-6 py-4">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="w-24">Unit</TableHead>
                              <TableHead className="w-20">Qty</TableHead>
                              <TableHead className="w-24">Rate</TableHead>
                              <TableHead className="w-24">Amount</TableHead>
                              <TableHead className="w-16">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {/* Section header - shown only for first subsection */}
                            {isFirstSubsection && (
                              <TableRow className="bg-gray-100 hover:bg-gray-100 cursor-default">
                                <TableCell colSpan={7} className="text-sm font-bold text-gray-700 py-2">
                                  {section.section_name}
                                </TableCell>
                              </TableRow>
                            )}

                            {/* Subsection header */}
                            <TableRow className="bg-gray-50 hover:bg-gray-50 cursor-default">
                              <TableCell colSpan={7} className="text-sm font-semibold py-2 pl-8">
                                → {subsection.subsection_name}
                              </TableCell>
                            </TableRow>

                            {subsection.items.map((item) => (
                              <TableRow
                                key={item.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, item.id)}
                                onDragOver={(e) => handleDragOver(e, item.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) =>
                                  handleDrop(e, item.id, subsection.items, section.section_id, subsection.subsection_id)
                                }
                                className={`cursor-move transition-colors ${
                                  editingItem?.itemId === item.id
                                    ? 'bg-muted'
                                    : ''
                                } ${
                                  draggedItemId === item.id ? 'opacity-50 bg-gray-100' : ''
                                } ${
                                  dragOverItemId === item.id ? 'bg-blue-50' : ''
                                }`}
                              >
                                <TableCell className="text-sm">
                                  {item.item_number || '-'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {editingItem?.itemId === item.id ? (
                                    <Input
                                      value={editingItem.description}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          description: e.target.value,
                                        })
                                      }
                                      disabled={loading}
                                      className="h-8 text-sm"
                                    />
                                  ) : (
                                    item.description
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {editingItem?.itemId === item.id ? (
                                    <Select
                                      value={editingItem.unit}
                                      onValueChange={(value) =>
                                        setEditingItem({
                                          ...editingItem,
                                          unit: value,
                                        })
                                      }
                                      disabled={loading}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {LCL_TEMPLATE_UNITS.map((u) => (
                                          <SelectItem key={u} value={u}>
                                            {u}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    item.unit
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {editingItem?.itemId === item.id ? (
                                    <Input
                                      type="number"
                                      value={formatNumberWithoutTrailingZeros(editingItem.qty || '')}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          qty: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      disabled={loading}
                                      className="h-7 text-right text-xs md:text-xs px-0.5 py-0 w-16 md:w-20 lg:w-24"
                                      step="0.01"
                                    />
                                  ) : (
                                    <Input
                                      type="number"
                                      value={formatNumberWithoutTrailingZeros(inlineEdits[item.id]?.qty !== undefined ? inlineEdits[item.id].qty || '' : (item.default_qty || ''))}
                                      onChange={(e) => handleInlineQtyChange(item.id, e.target.value)}
                                      disabled={loading}
                                      className="h-7 text-right text-xs md:text-xs px-0.5 py-0 w-16 md:w-20 lg:w-24"
                                      step="0.01"
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {editingItem?.itemId === item.id ? (
                                    <Input
                                      type="number"
                                      value={formatNumberWithoutTrailingZeros(editingItem.rate || '')}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          rate: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      disabled={loading}
                                      className="h-7 text-right text-xs md:text-xs px-0.5 py-0 w-16 md:w-20 lg:w-24"
                                      step="0.01"
                                    />
                                  ) : (
                                    <Input
                                      type="number"
                                      value={formatNumberWithoutTrailingZeros(inlineEdits[item.id]?.rate !== undefined ? inlineEdits[item.id].rate || '' : (item.default_rate || ''))}
                                      onChange={(e) => handleInlineRateChange(item.id, e.target.value)}
                                      disabled={loading}
                                      className="h-7 text-right text-xs md:text-xs px-0.5 py-0 w-16 md:w-20 lg:w-24"
                                      step="0.01"
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-sm font-semibold">
                                  {editingItem?.itemId === item.id
                                    ? formatNumberWithoutTrailingZeros(amount)
                                    : formatNumberWithoutTrailingZeros(getItemAmount(item))}
                                </TableCell>
                                <TableCell>
                                  {editingItem?.itemId === item.id ? (
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleSaveItem}
                                        disabled={loading}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Check className="h-4 w-4 text-green-600" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingItem(null)}
                                        disabled={loading}
                                        className="h-8 w-8 p-0"
                                      >
                                        <X className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => startEditingItem(item)}
                                        disabled={loading}
                                        className="h-8 w-8 p-0"
                                        title="Edit description & unit"
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteItem(item.id)}
                                        disabled={loading}
                                        className="h-8 w-8 p-0"
                                        title="Delete item"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}

                            {/* Subsection subtotal */}
                            <TableRow className="bg-gray-100 hover:bg-gray-100 cursor-default font-semibold">
                              <TableCell colSpan={5} className="text-sm py-2"></TableCell>
                              <TableCell className="text-right text-sm font-semibold py-2">
                                Ksh{formatNumberWithoutTrailingZeros(totals[section.section_id]?.subsections[subsection.subsection_id] || 0)}
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>

                            {/* Add new item row */}
                            {addingItemTo === subsection.subsection_id &&
                            editingItem ? (
                              <TableRow className="bg-muted">
                                <TableCell className="text-sm">
                                  {subsection.items.length + 1}
                                </TableCell>
                                <TableCell className="text-sm">
                                  <Input
                                    value={editingItem.description}
                                    onChange={(e) =>
                                      setEditingItem({
                                        ...editingItem,
                                        description: e.target.value,
                                      })
                                    }
                                    disabled={loading}
                                    className="h-8 text-sm"
                                    placeholder="Description"
                                  />
                                </TableCell>
                                <TableCell className="text-sm">
                                  <Select
                                    value={editingItem.unit}
                                    onValueChange={(value) =>
                                      setEditingItem({
                                        ...editingItem,
                                        unit: value,
                                      })
                                    }
                                    disabled={loading}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {LCL_TEMPLATE_UNITS.map((u) => (
                                        <SelectItem key={u} value={u}>
                                          {u}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  <Input
                                    type="number"
                                    value={formatNumberWithoutTrailingZeros(editingItem.qty)}
                                    onChange={(e) =>
                                      setEditingItem({
                                        ...editingItem,
                                        qty: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    disabled={loading}
                                    className="h-10 text-right text-base md:text-base px-2 py-1 w-20 md:w-24 lg:w-32"
                                    placeholder="0"
                                    step="0.01"
                                  />
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  <Input
                                    type="number"
                                    value={formatNumberWithoutTrailingZeros(editingItem.rate)}
                                    onChange={(e) =>
                                      setEditingItem({
                                        ...editingItem,
                                        rate: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    disabled={loading}
                                    className="h-10 text-right text-base md:text-base px-2 py-1 w-20 md:w-24 lg:w-32"
                                    placeholder="0"
                                    step="0.01"
                                  />
                                </TableCell>
                                <TableCell className="text-right text-sm font-semibold">
                                  {formatNumberWithoutTrailingZeros(amount)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleSaveItem}
                                      disabled={loading}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Check className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingItem(null);
                                        setAddingItemTo(null);
                                      }}
                                      disabled={loading}
                                      className="h-8 w-8 p-0"
                                    >
                                      <X className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : (
                              <TableRow>
                                <TableCell colSpan={7}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      startAddingItem(subsection.subsection_id)
                                    }
                                    disabled={loading}
                                    className="w-full"
                                  >
                                    + Add Item
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
