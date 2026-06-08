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
import { AlertCircle, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { LCLHierarchicalData, LCLTemplateStructure } from '@/types/lclTemplate';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { lclBoqService } from '@/services/lclBoqService';
import { lclTemplateService } from '@/services/lclTemplateService';
import { formatNumberWithoutTrailingZeros } from '@/utils/numberFormatter';
import { getDisplaySectionName, buildSectionDisplayHeader } from '@/utils/lclSectionDisplayUtils';

export interface ItemSnapshot {
  id?: string;
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
  structureId?: string;
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
  structureId,
}: LCLBOQItemEditorProps, ref) {
  const [items, setItems] = useState<ItemSnapshot[]>([]);
  const [inlineEdits, setInlineEdits] = useState<{ [itemId: string]: InlineEdit }>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [draftPending, setDraftPending] = useState(false);
  const [addItemForm, setAddItemForm] = useState<AddItemForm | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{ type: 'section' | 'item'; id: string; label: string } | null>(null);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);
  const [editingSectionLetter, setEditingSectionLetter] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState<string>('');
  const [draggedSectionLetter, setDraggedSectionLetter] = useState<string | null>(null);
  const [dragOverSectionLetter, setDragOverSectionLetter] = useState<string | null>(null);
  const inlineEditsRef = useRef<{ [itemId: string]: InlineEdit }>({});
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    inlineEditsRef.current = inlineEdits;
  }, [inlineEdits]);

  useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      return items.map((item, idx) => {
        const edit = inlineEdits[getEditKey(item, idx)];
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
        localStorage.removeItem(getDraftKey(data?.structure_id || ''));
      } catch { /* ignore */ }
    },
  }), [items, inlineEdits, data?.structure_id]);

  const flattenHierarchyToSnapshot = (hierarchicalData: LCLHierarchicalData): ItemSnapshot[] => {
    const snapshot: ItemSnapshot[] = [];
    hierarchicalData.sections.forEach((section) => {
      section.subsections.forEach((subsection) => {
        if (subsection.items.length > 0) {
          subsection.items.forEach((item: any) => {
            snapshot.push({
              id: item.id,
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
        } else {
          // Emit a placeholder row so the subsection header still renders in the UI
          snapshot.push({
            section_id: section.section_id,
            section_name: section.section_name,
            subsection_id: subsection.subsection_id,
            subsection_name: subsection.subsection_name,
            item_number: '',
            description: '(no items)',
            unit: '',
            qty: 0,
            rate: 0,
            amount: 0,
          });
        }
      });
    });
    return snapshot;
  };

  useEffect(() => {
    let restoredItems: ItemSnapshot[] | null = null;
    let restoredEdits: { [itemId: string]: InlineEdit } | null = null;
    let restoredLastSavedAt: string | null = null;

    try {
      const raw = localStorage.getItem(getDraftKey(data?.structure_id || ''));
      if (raw) {
        const draft: AutosaveDraft = JSON.parse(raw);
        // Only restore if the draft has meaningful items (edits may be empty if user only added/removed items)
        if (draft.items?.length) {
          restoredItems = draft.items;
          restoredEdits = draft.inlineEdits || {};
          restoredLastSavedAt = draft.lastSavedAt || null;
        }
      }
    } catch { /* ignore */ }

    if (restoredItems) {
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
        localStorage.setItem(getDraftKey(data?.structure_id || ''), JSON.stringify(draft));
        setLastSavedTime(draft.lastSavedAt);
        setDraftPending(false);
      } catch (error) {
        console.error('Failed to autosave draft:', error);
      } finally {
        // Keep "Saving draft..." visible for at least 1 second for UX feedback
        setTimeout(() => {
          setIsSaving(false);
        }, 1000);
      }
    }, 5000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [draftPending, items, inlineEdits, data?.structure_id]);

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

  const getEditKey = (item: ItemSnapshot, fallbackIdx: number): string => {
    return item.id || `item-${fallbackIdx}`;
  };

  const handleQtyChange = (itemId: string, value: string) => {
    const qty = value === '' ? 0 : parseFloat(value);
    if (qty < 0) return;
    const finalQty = isNaN(qty) ? 0 : qty;
    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], qty: finalQty },
    }));
    setDraftPending(true);
  };

  const handleRateChange = (itemId: string, value: string) => {
    const rate = value === '' ? 0 : parseFloat(value);
    if (rate < 0) return;
    const finalRate = isNaN(rate) ? 0 : rate;
    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], rate: finalRate },
    }));
    setDraftPending(true);
  };

  const handleDescriptionChange = (itemId: string, value: string) => {
    setInlineEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], description: value },
    }));
    setDraftPending(true);
  };

  const handleRemoveSection = (sectionId: string, sectionName: string) => {
    setRemoveConfirm({ type: 'section', id: sectionId, label: sectionName });
  };

  const handleRemoveItem = (itemId: string, description: string) => {
    setRemoveConfirm({ type: 'item', id: itemId, label: description });
  };

  const relabelSectionsLocally = (rows: ItemSnapshot[]): ItemSnapshot[] => {
    const orderedSectionIds: string[] = [];
    const seen = new Set<string>();
    rows.forEach((r) => {
      if (!seen.has(r.section_id)) {
        seen.add(r.section_id);
        orderedSectionIds.push(r.section_id);
      }
    });

    const idMap = new Map<string, { newId: string; newLetter: string }>();
    orderedSectionIds.forEach((oldId, idx) => {
      const newLetter = String.fromCharCode(65 + idx);
      idMap.set(oldId, { newId: `section_${newLetter.toLowerCase()}`, newLetter });
    });

    return rows.map((row) => {
      const mapping = idMap.get(row.section_id);
      if (!mapping) return row;
      const { newId, newLetter } = mapping;
      const oldLetter = getSectionLetter(row.section_id).toLowerCase();
      const newSubsectionId = row.subsection_id.replace(
        new RegExp(`^section_${oldLetter}`),
        newId
      );
      const customName =
        (row.section_name || '').replace(/^SECTION\s+[A-Z]:\s*/i, '') ||
        `Section ${newLetter}`;
      return {
        ...row,
        section_id: newId,
        subsection_id: newSubsectionId,
        section_name: buildSectionDisplayHeader(newLetter, customName),
      };
    });
  };

  const confirmRemove = async () => {
    if (!removeConfirm) return;
    setDraftPending(true);
    if (removeConfirm.type === 'section') {
      // 1. Update local state immediately for snappy UI
      setItems((prev) => {
        const filtered = prev.filter((item) => item.section_id !== removeConfirm.id);
        const relabeled = relabelSectionsLocally(filtered);
        setInlineEdits((edits) => {
          const updated = { ...edits };
          prev.forEach((item) => {
            if (item.section_id === removeConfirm.id) {
              delete updated[getEditKey(item, -1)];
            }
          });
          return updated;
        });
        return relabeled;
      });

      // 2. Persist to backend with proper error handling
      if (structureId && templateStructure) {
        try {
          await lclTemplateService.renumberSectionDisplayNames(structureId, removeConfirm.id);
          const updatedStructure = await lclTemplateService.getStructure(structureId);
          const allItems = await lclTemplateService.getStructureItems(structureId);
          const cleanedSections = lclTemplateService.deleteEmptySections(
            updatedStructure.structure_data.sections,
            allItems
          );
          if (cleanedSections.length < updatedStructure.structure_data.sections.length) {
            await lclTemplateService.updateStructure(structureId, {
              structure_data: { sections: cleanedSections },
            });
          }

          // 3. Fetch fresh hierarchical data and update items to sync with backend
          const updatedHierarchy = await lclTemplateService.getHierarchicalData(structureId);
          const updatedItems = flattenHierarchyToSnapshot(updatedHierarchy);
          setItems(updatedItems);

          toast({ title: 'Success', description: `Section removed and remaining sections renumbered.` });
        } catch (error) {
          console.error('Failed to delete section:', error);
          toast({ title: 'Error', description: 'Failed to delete section. Please try again.' });
        }
      } else {
        toast({ title: 'Success', description: `Section removed and remaining sections renumbered.` });
      }
    } else {
      setItems((prev) => prev.filter((item) => getEditKey(item, -1) !== removeConfirm.id));
      setInlineEdits((edits) => {
        const updated = { ...edits };
        delete updated[removeConfirm.id];
        return updated;
      });
      toast({ title: 'Success', description: 'Item removed.' });
    }
    setRemoveConfirm(null);
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, itemIndex: number) => {
    e.stopPropagation();
    setDraggedItemIndex(itemIndex);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, itemIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItemIndex(itemIndex);
  };

  const handleDragLeave = () => {
    setDragOverItemIndex(null);
  };

  const handleDrop = (
    e: React.DragEvent<HTMLTableRowElement>,
    targetIndex: number,
    subsectionItems: ItemSnapshot[],
    sectionId: string,
    subsectionId: string,
    structureId: string
  ) => {
    e.preventDefault();

    if (draggedItemIndex === null || draggedItemIndex === targetIndex) {
      setDraggedItemIndex(null);
      setDragOverItemIndex(null);
      return;
    }

    const draggedItem = items[draggedItemIndex];

    // Only allow drops within the same subsection
    if (draggedItem.subsection_id !== subsectionId) {
      setDraggedItemIndex(null);
      setDragOverItemIndex(null);
      return;
    }

    // Find indices using direct subsectionItems reference comparison
    const draggedIdxInSubsection = subsectionItems.findIndex((item) => items.indexOf(item) === draggedItemIndex);
    const targetIdxInSubsection = subsectionItems.findIndex((item) => items.indexOf(item) === targetIndex);

    if (draggedIdxInSubsection === -1 || targetIdxInSubsection === -1) {
      setDraggedItemIndex(null);
      setDragOverItemIndex(null);
      return;
    }

    // Reorder subsection items by index
    const reordered = [...subsectionItems];
    const [movedItem] = reordered.splice(draggedIdxInSubsection, 1);
    reordered.splice(targetIdxInSubsection, 0, movedItem);

    // Renumber items in the subsection
    const renumbered = reordered.map((item, idx) => ({
      ...item,
      item_number: String(idx + 1),
    }));

    // Rebuild full items array: replace old subsection items with reordered ones
    const newItems = items.map((item) => {
      if (item.section_id === sectionId && item.subsection_id === subsectionId) {
        const idxInSubsection = subsectionItems.indexOf(item);
        if (idxInSubsection !== -1 && idxInSubsection < renumbered.length) {
          return renumbered[idxInSubsection];
        }
      }
      return item;
    });

    setItems(newItems);
    setDraftPending(true);
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);

    // Persist to database immediately
    (async () => {
      try {
        const updatedItemIds = renumbered.map((item) => item.id).filter((id): id is string => !!id);
        const newSortOrders = renumbered.map((_, idx) => idx);

        await lclTemplateService.updateItemsSortOrder(
          structureId,
          sectionId,
          subsectionId,
          updatedItemIds,
          newSortOrders
        );
        toast({ title: 'Success', description: 'Item reordered and saved.' });
      } catch (error) {
        console.error('Failed to persist reorder:', error);
        toast({
          title: 'Warning',
          description: 'Item reordered locally but failed to save to database.',
          variant: 'destructive',
        });
      }
    })();
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const handleEditSectionTitle = (sectionLetter: string, currentName: string) => {
    setEditingSectionLetter(sectionLetter);
    setEditingSectionName(getDisplaySectionName(currentName));
  };

  const handleSaveSectionTitle = async (sectionLetter: string) => {
    if (!editingSectionName.trim()) {
      return;
    }

    const newSectionName = editingSectionName;

    // If linked to a template structure, trigger renumbering on the template
    if (structureId && templateStructure) {
      try {
        // Find the section ID from the template structure that corresponds to this letter
        const section = templateStructure.structure_data.sections.find(
          (s: any) => getSectionLetter(s.id) === sectionLetter
        );

        if (section) {
          // Ensure section letters are sequential in the template
          await lclTemplateService.ensureSectionLettersAreSequential(structureId);

          // Reload data from the template
          const updatedHierarchy = await lclTemplateService.getHierarchicalData(structureId);

          // Flatten and update items with new section names from the template
          const updatedItems = flattenHierarchyToSnapshot(updatedHierarchy);
          setItems(updatedItems);
        }
      } catch (error) {
        console.error('Failed to renumber sections:', error);
        // Fall back to local renumbering if template sync fails
        applyLocalSectionRenumbering(sectionLetter, newSectionName);
      }
    } else {
      // For unlinked snapshots, use local relabeling only
      applyLocalSectionRenumbering(sectionLetter, newSectionName);
    }

    setDraftPending(true);
    setEditingSectionLetter(null);
    setEditingSectionName('');
  };

  const applyLocalSectionRenumbering = (editingSectionLetter: string, newSectionName: string) => {
    setItems((prev) => {
      // Extract all unique section letters and sort them
      const sectionLetters = new Set<string>();
      prev.forEach((item) => {
        const letter = getSectionLetter(item.section_id);
        if (letter) {
          sectionLetters.add(letter);
        }
      });

      const sortedLetters = Array.from(sectionLetters).sort();

      // Create mapping of old letters to new letters
      const letterMap = new Map<string, string>();
      sortedLetters.forEach((letter, index) => {
        const newLetter = String.fromCharCode(65 + index);
        letterMap.set(letter, newLetter);
      });

      // Update items with new section names based on renumbered letters
      const updatedItems = prev.map((item) => {
        const oldLetter = getSectionLetter(item.section_id);
        const newLetter = letterMap.get(oldLetter);

        if (newLetter && oldLetter !== newLetter) {
          return {
            ...item,
            section_name: buildSectionDisplayHeader(newLetter, newSectionName),
          };
        } else if (oldLetter === editingSectionLetter) {
          return {
            ...item,
            section_name: buildSectionDisplayHeader(oldLetter, newSectionName),
          };
        }
        return item;
      });

      return updatedItems;
    });
  };

  const handleCancelEditSection = () => {
    setEditingSectionLetter(null);
    setEditingSectionName('');
  };

  const handleDuplicateSection = (sectionLetter: string) => {
    const sourceItems = items.filter((item) => getSectionLetter(item.section_id) === sectionLetter);
    if (!sourceItems.length) {
      toast({ title: 'Nothing to duplicate', description: 'This section has no items.', variant: 'destructive' });
      return;
    }

    const existing = new Set(sectionLetters);
    let newLetter = '';
    for (let i = 0; i < 26; i++) {
      const candidate = String.fromCharCode(65 + i);
      if (!existing.has(candidate)) { newLetter = candidate; break; }
    }
    if (!newLetter) {
      toast({ title: 'Error', description: 'Maximum 26 sections allowed (A-Z).', variant: 'destructive' });
      return;
    }

    const newSectionId = `section_${newLetter.toLowerCase()}`;
    const oldLetterLc = sectionLetter.toLowerCase();
    const subsectionIdMap = new Map<string, string>();

    const cloned: ItemSnapshot[] = sourceItems.map((item) => {
      let newSubsectionId = subsectionIdMap.get(item.subsection_id);
      if (!newSubsectionId) {
        newSubsectionId = item.subsection_id.startsWith(`section_${oldLetterLc}`)
          ? item.subsection_id.replace(new RegExp(`^section_${oldLetterLc}`), newSectionId)
          : `${newSectionId}_${item.subsection_id}`;
        subsectionIdMap.set(item.subsection_id, newSubsectionId);
      }
      const customName = (item.section_name || '').replace(/^SECTION\s+[A-Z]:\s*/i, '') || `Section ${sectionLetter}`;
      return {
        ...item,
        id: crypto.randomUUID(),
        section_id: newSectionId,
        subsection_id: newSubsectionId,
        section_name: buildSectionDisplayHeader(newLetter, `${customName} (copy)`),
      };
    });

    setItems((prev) => [...prev, ...cloned]);
    setExpandedSections((prev) => new Set(prev).add(newLetter));
    setDraftPending(true);
    toast({ title: 'Success', description: `Section ${sectionLetter} duplicated as Section ${newLetter}.` });
  };


  const handleSectionDragStart = (e: React.DragEvent, letter: string) => {
    setDraggedSectionLetter(letter);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDragOver = (e: React.DragEvent, letter: string) => {
    e.preventDefault();
    if (letter !== draggedSectionLetter) {
      setDragOverSectionLetter(letter);
    }
  };

  const handleSectionDrop = (targetLetter: string) => {
    if (!draggedSectionLetter || draggedSectionLetter === targetLetter) {
      setDraggedSectionLetter(null);
      setDragOverSectionLetter(null);
      return;
    }

    const letters = [...sectionLetters];
    const fromIdx = letters.indexOf(draggedSectionLetter);
    const toIdx = letters.indexOf(targetLetter);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedSectionLetter(null);
      setDragOverSectionLetter(null);
      return;
    }
    letters.splice(fromIdx, 1);
    letters.splice(toIdx, 0, draggedSectionLetter);

    const letterMap = new Map<string, string>();
    letters.forEach((letter, idx) => letterMap.set(letter, String.fromCharCode(65 + idx)));

    setItems((prev) => prev.map((item) => {
      const oldLetter = getSectionLetter(item.section_id);
      const newLetter = letterMap.get(oldLetter);
      if (!newLetter) return item;
      const oldSectionId = item.section_id;
      const newSectionId = oldSectionId.replace(/section_[a-z]/, `section_${newLetter.toLowerCase()}`);
      const newSubsectionId = item.subsection_id.replace(/^section_[a-z]/, `section_${newLetter.toLowerCase()}`);
      const newName = item.section_name ? item.section_name.replace(/^SECTION [A-Z]:/, `SECTION ${newLetter}:`) : undefined;

      let finalName = item.section_name;
      if (oldLetter !== newLetter && newName) {
        finalName = newName;
      } else if (oldLetter !== newLetter) {
        finalName = `SECTION ${newLetter}`;
      }

      return {
        ...item,
        section_id: newSectionId,
        section_name: finalName,
        subsection_id: newSubsectionId,
      };
    }));
    setDraftPending(true);
    setDraggedSectionLetter(null);
    setDragOverSectionLetter(null);
    toast({ title: 'Success', description: 'Sections reordered and renumbered.' });
  };

  const handleSectionDragEnd = () => {
    setDraggedSectionLetter(null);
    setDragOverSectionLetter(null);
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
      id: crypto.randomUUID(),
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
        // Save draft BOQ with updated items using upsert to maintain single draft per company
        await lclBoqService.autosaveLCLBOQDraftWithUpsert({
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
  // Use only items to determine which sections to display (not data.sections, which may be stale)
  const allSectionLetters = Array.from(new Set(items.map((item) => getSectionLetter(item.section_id)))).sort();
  const sectionLetters = allSectionLetters;

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
            const itemId = getEditKey(item, fullIndex);
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
            <div
              key={sectionLetter}
              draggable
              onDragStart={(e) => handleSectionDragStart(e, sectionLetter)}
              onDragOver={(e) => handleSectionDragOver(e, sectionLetter)}
              onDrop={() => handleSectionDrop(sectionLetter)}
              onDragEnd={handleSectionDragEnd}
              className={`border border-border rounded-lg overflow-hidden cursor-grab active:cursor-grabbing transition-shadow ${
                draggedSectionLetter === sectionLetter ? 'opacity-50 shadow-md' : ''
              } ${
                dragOverSectionLetter === sectionLetter ? 'ring-2 ring-blue-400' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-4 px-4 py-3 bg-card">
                <button
                  type="button"
                  onClick={() => toggleSection(sectionLetter)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left"
                >
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  {editingSectionLetter === sectionLetter ? (
                    <Input
                      value={editingSectionName}
                      onChange={(e) => setEditingSectionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveSectionTitle(sectionLetter);
                        } else if (e.key === 'Escape') {
                          handleCancelEditSection();
                        }
                      }}
                      className="h-7 font-semibold text-sm flex-1"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSectionTitle(sectionLetter, sectionName);
                      }}
                      className="font-semibold text-sm hover:bg-muted px-2 py-1 rounded transition-colors truncate"
                      title="Click to edit section title"
                    >
                      SECTION {sectionLetter}: {getDisplaySectionName(sectionName)}
                    </button>
                  )}
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium tabular-nums">
                    {formatNumberWithoutTrailingZeros(sectionTotal)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDuplicateSection(sectionLetter)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    title="Duplicate this section"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
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
                              <TableRow
                                key={idx}
                                draggable
                                onDragStart={(e) => handleDragStart(e, ia.fullIndex)}
                                onDragOver={(e) => handleDragOver(e, ia.fullIndex)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, ia.fullIndex, entry.itemsWithAmount.map((x) => x.item), sectionId, entry.subsectionId, structureId || '')}
                                onDragEnd={handleDragEnd}
                                className={`
                                  cursor-grab active:cursor-grabbing
                                  ${draggedItemIndex === ia.fullIndex ? 'opacity-50 bg-muted' : ''}
                                  ${dragOverItemIndex === ia.fullIndex ? 'border-t-2 border-blue-500' : ''}
                                `}
                              >
                                <TableCell className="text-xs text-muted-foreground">
                                  {ia.item.item_number}
                                </TableCell>
                                <TableCell>
                                <Input
                                      value={ia.edit?.description !== undefined ? ia.edit.description : ia.item.description}
                                      onChange={(e) => handleDescriptionChange(ia.itemId, e.target.value)}
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
                                      onChange={(e) => handleQtyChange(ia.itemId, e.target.value)}
                                      className="text-sm h-8 w-16 md:w-20 lg:w-24"
                                      step="0.01"
                                      min="0"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      value={formatNumberWithoutTrailingZeros(ia.rate)}
                                      onChange={(e) => handleRateChange(ia.itemId, e.target.value)}
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
                                    onClick={() => handleRemoveItem(ia.itemId, ia.item.description)}
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
