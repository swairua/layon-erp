import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Trash2, Check, X, Edit2 } from 'lucide-react';
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
  const debounceTimers = useRef<{ [itemId: string]: NodeJS.Timeout }>({});
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

  const handleInlineQtyChange = (itemId: string, value: string) => {
    const qty = parseFloat(value) || 0;
    if (qty < 0) return;

    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], qty },
    }));

    // Debounce save
    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
    }

    debounceTimers.current[itemId] = setTimeout(() => {
      saveInlineEdit(itemId, qty, inlineEdits[itemId]?.rate);
    }, 500);
  };

  const handleInlineRateChange = (itemId: string, value: string) => {
    const rate = parseFloat(value) || 0;
    if (rate < 0) return;

    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], rate },
    }));

    // Debounce save
    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
    }

    debounceTimers.current[itemId] = setTimeout(() => {
      saveInlineEdit(itemId, inlineEdits[itemId]?.qty, rate);
    }, 500);
  };

  const saveInlineEdit = async (itemId: string, newQty?: number, newRate?: number) => {
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

      if (!currentItem) return;

      await lclTemplateService.updateItem(itemId, {
        description: currentItem.description,
        unit: currentItem.unit,
        default_qty: qtyToSave !== undefined ? qtyToSave : currentItem.default_qty,
        default_rate: rateToSave !== undefined ? rateToSave : currentItem.default_rate,
      });

      // Clear the inline edit after successful save
      setInlineEdits((prev) => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });

      await onDataUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save changes',
        variant: 'destructive',
      });
    }
  };

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach((timer) => clearTimeout(timer));
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

  const amount =
    (editingItem?.qty || 0) * (editingItem?.rate || 0);

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">{data.structure_name}</h2>
        {data.description && (
          <p className="text-sm text-muted-foreground mb-3">
            {data.description}
          </p>
        )}
        <div className="text-right">
          <p className="text-sm font-medium">
            Grand Total (KES):{' '}
            <span className="text-lg font-bold">
              Ksh{getGrandTotal().toLocaleString('en-KE', { maximumFractionDigits: 2 })}
            </span>
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {data.sections.map((section) => (
          <div key={section.section_id} className="border border-border rounded-lg">
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.section_id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors"
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
                Section Total (KES): Ksh{totals[section.section_id]?.section.toLocaleString('en-KE', { maximumFractionDigits: 2 })}
              </p>
            </button>

            {/* Subsections and items */}
            {expandedSections.has(section.section_id) && (
              <div className="border-t border-border">
                {section.subsections.map((subsection) => (
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
                        Subtotal (KES): Ksh{totals[section.section_id]?.subsections[subsection.subsection_id]?.toLocaleString('en-KE', { maximumFractionDigits: 2 })}
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
                            {subsection.items.map((item) => (
                              <TableRow
                                key={item.id}
                                className={
                                  editingItem?.itemId === item.id
                                    ? 'bg-muted'
                                    : ''
                                }
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
                                      value={editingItem.qty}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          qty: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      disabled={loading}
                                      className="h-7 text-right text-xs md:text-xs px-0.5 py-0 w-full"
                                      step="0.01"
                                    />
                                  ) : (
                                    <Input
                                      type="number"
                                      value={inlineEdits[item.id]?.qty !== undefined ? inlineEdits[item.id].qty : item.default_qty || 0}
                                      onChange={(e) => handleInlineQtyChange(item.id, e.target.value)}
                                      disabled={loading}
                                      className="h-7 text-right text-xs md:text-xs px-0.5 py-0 w-full"
                                      step="0.01"
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {editingItem?.itemId === item.id ? (
                                    <Input
                                      type="number"
                                      value={editingItem.rate}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          rate: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      disabled={loading}
                                      className="h-7 text-right text-xs md:text-xs px-0.5 py-0 w-full"
                                      step="0.01"
                                    />
                                  ) : (
                                    <Input
                                      type="number"
                                      value={inlineEdits[item.id]?.rate !== undefined ? inlineEdits[item.id].rate : item.default_rate || 0}
                                      onChange={(e) => handleInlineRateChange(item.id, e.target.value)}
                                      disabled={loading}
                                      className="h-7 text-right text-xs md:text-xs px-0.5 py-0 w-full"
                                      step="0.01"
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-sm font-semibold">
                                  {editingItem?.itemId === item.id
                                    ? amount.toLocaleString('en-KE', { maximumFractionDigits: 2 })
                                    : getItemAmount(item).toLocaleString('en-KE', {
                                        maximumFractionDigits: 2,
                                      })}
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
                                    value={editingItem.qty}
                                    onChange={(e) =>
                                      setEditingItem({
                                        ...editingItem,
                                        qty: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    disabled={loading}
                                    className="h-10 text-right text-base md:text-base px-2 py-1"
                                    placeholder="0.00"
                                    step="0.01"
                                  />
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  <Input
                                    type="number"
                                    value={editingItem.rate}
                                    onChange={(e) =>
                                      setEditingItem({
                                        ...editingItem,
                                        rate: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    disabled={loading}
                                    className="h-10 text-right text-base md:text-base px-2 py-1"
                                    placeholder="0.00"
                                    step="0.01"
                                  />
                                </TableCell>
                                <TableCell className="text-right text-sm font-semibold">
                                  {amount.toLocaleString('en-KE', { maximumFractionDigits: 2 })}
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
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
