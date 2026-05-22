import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { FloatingItemPreview } from '@/components/ui/floating-item-preview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Calculator, Layers } from 'lucide-react';
import { useCompanies, useCustomers, useUnits } from '@/hooks/useDatabase';
import { CreateUnitModal } from '@/components/units/CreateUnitModal';
import { BOQSaveIndicator } from '@/components/boq/BOQSaveIndicator';
import { toast } from 'sonner';
import { downloadBOQPDF, BoqDocument } from '@/utils/boqPdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { saveEditingDraft, loadEditDraft, deleteEditDraft } from '@/services/boqAutoSaveService';

// Safe UUID generator that works in all environments
const generateSafeUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 11)}`;
};

interface EditBOQModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boq: any;
  onSuccess?: () => void;
}


interface BOQItemRow {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
}

interface BOQSubsectionRow {
  id: string;
  name: string;
  label: string;
  items: BOQItemRow[];
}

interface BOQSectionRow {
  id: string;
  title: string;
  subsections: BOQSubsectionRow[];
}

const defaultItem = (): BOQItemRow => ({
  id: `item-${generateSafeUUID()}`,
  description: '',
  quantity: 1,
  unit: '',
  rate: 0,
});

const defaultSubsection = (name: string, label: string): BOQSubsectionRow => ({
  id: `subsection-${generateSafeUUID()}`,
  name,
  label,
  items: [defaultItem()],
});

const defaultSection = (): BOQSectionRow => ({
  id: `section-${generateSafeUUID()}`,
  title: 'General',
  subsections: [
    defaultSubsection('A', 'Materials'),
    defaultSubsection('B', 'Labor'),
  ],
});

export function EditBOQModal({ open, onOpenChange, boq, onSuccess }: EditBOQModalProps) {
  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];
  const { data: customers = [] } = useCustomers(currentCompany?.id);
  const { data: units = [] } = useUnits(currentCompany?.id);
  const { profile } = useAuth();

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [pendingUnitTarget, setPendingUnitTarget] = useState<{ sectionId: string; itemId: string } | null>(null);
  const [previewItem, setPreviewItem] = useState<{ sectionId: string; subsectionId: string; itemId: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const unsavedChangesRef = useRef(false);

  const [boqNumber, setBoqNumber] = useState('');
  const [boqDate, setBoqDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [contractor, setContractor] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [showCalculatedValuesInTerms, setShowCalculatedValuesInTerms] = useState(false);
  const [currency, setCurrency] = useState('KES');
  const [sections, setSections] = useState<BOQSectionRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const selectedClient = useMemo(() => customers.find(c => c.id === clientId), [customers, clientId]);

  // Autosave function
  const performAutosave = useCallback(async () => {
    if (!boq?.id || !profile?.id || !currentCompany?.id) return;

    setIsSaving(true);
    try {
      const filledSections = getFilledItems();

      let filledSubtotal = 0;
      filledSections.forEach(sec => {
        sec.subsections.forEach(sub => {
          sub.items.forEach(item => {
            filledSubtotal += (item.quantity || 0) * (item.rate || 0);
          });
        });
      });

      const draftData = {
        number: boqNumber,
        boq_date: boqDate,
        due_date: dueDate,
        customer_id: clientId,
        client_name: selectedClient?.name || '',
        client_email: selectedClient?.email || null,
        client_phone: selectedClient?.phone || null,
        client_address: selectedClient?.address || null,
        client_city: selectedClient?.city || null,
        client_country: selectedClient?.country || null,
        contractor: contractor || null,
        project_title: projectTitle || null,
        currency: currency,
        subtotal: filledSubtotal,
        tax_amount: 0,
        total_amount: filledSubtotal,
        data: {
          sections: filledSections.map(s => ({
            title: s.title,
            subsections: s.subsections.map(sub => ({
              name: sub.name,
              label: sub.label,
              items: sub.items.map(i => {
                const unitObj = units.find((u: any) => u.id === i.unit);
                return {
                  description: i.description,
                  quantity: i.quantity,
                  unit_id: i.unit || null,
                  unit_name: unitObj ? unitObj.name : i.unit || null,
                  rate: i.rate,
                };
              })
            }))
          })),
          notes: notes,
        },
        terms_and_conditions: termsAndConditions || null,
        show_calculated_values_in_terms: showCalculatedValuesInTerms,
      };

      const result = await saveEditingDraft(profile.id, currentCompany.id, boq.id, draftData);

      if (result.success) {
        setLastSavedTime(new Date().toISOString());
        setHasUnsavedChanges(false);
        unsavedChangesRef.current = false;
      } else {
        console.error('Autosave failed:', result.error);
      }
    } catch (err) {
      console.error('Error during autosave:', err);
    } finally {
      setIsSaving(false);
    }
  }, [boq?.id, profile?.id, currentCompany?.id, boqNumber, boqDate, dueDate, clientId, selectedClient, contractor, projectTitle, currency, units, notes, termsAndConditions, showCalculatedValuesInTerms]);

  // Debounce autosave to 5 seconds
  const debouncedAutosave = useDebounce(performAutosave, 5000);

  // Mark as changed and trigger autosave
  const triggerAutosave = useCallback(() => {
    setHasUnsavedChanges(true);
    unsavedChangesRef.current = true;
    debouncedAutosave();
  }, [debouncedAutosave]);

  // Handle browser unload with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (open && boq && boq.data && profile?.id && currentCompany?.id) {
      // Check if there's an edit draft for this BOQ
      const checkAndLoadDraft = async () => {
        const editDraft = await loadEditDraft(profile.id, currentCompany.id, boq.id);

        // Load from draft if it exists and is newer than published version
        const dataToUse = editDraft && new Date(editDraft.updated_at) > new Date(boq.updated_at)
          ? editDraft
          : boq;

        const boqData = dataToUse.data;
        setBoqNumber(dataToUse.number || '');
        setBoqDate(dataToUse.boq_date || '');
        setDueDate(dataToUse.due_date || '');
        setProjectTitle(boqData.project_title || '');
        setContractor(boqData.contractor || '');
        setNotes(boqData.notes || '');

        const termsToUse = dataToUse.terms_and_conditions || '';
        setTermsAndConditions(termsToUse);
        const showCalcValues = dataToUse.show_calculated_values_in_terms || false;
        setShowCalculatedValuesInTerms(showCalcValues);
        setCurrency(boqData.currency || 'KES');

        const clientIdFromBoq = customers.find(c => c.name === dataToUse.client_name)?.id;
        if (clientIdFromBoq) {
          setClientId(clientIdFromBoq);
        }

        if (boqData.sections && boqData.sections.length > 0) {
          const loadedSections: BOQSectionRow[] = boqData.sections.map((section: any) => ({
            id: `section-${generateSafeUUID()}`,
            title: section.title || 'General',
            subsections: (section.subsections || []).map((subsection: any) => ({
              id: `subsection-${generateSafeUUID()}`,
              name: subsection.name,
              label: subsection.label,
              items: (subsection.items || []).map((item: any) => ({
                id: `item-${generateSafeUUID()}`,
                description: item.description,
                quantity: item.quantity || 1,
                unit: item.unit_id || '',
                rate: item.rate || 0,
              })),
            })),
          }));
          setSections(loadedSections);
        } else {
          setSections([defaultSection()]);
        }

        // Set last saved time if we loaded a draft
        if (editDraft) {
          setLastSavedTime(editDraft.last_autosaved_at);
        }
        setHasUnsavedChanges(false);
        unsavedChangesRef.current = false;
      };

      checkAndLoadDraft();
    }
  }, [open, boq, customers, profile?.id, currentCompany?.id]);

  const addSection = () => {
    setSections(prev => [...prev, defaultSection()]);
    triggerAutosave();
  };

  const removeSection = (sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
    triggerAutosave();
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, title } : s));
    triggerAutosave();
  };

  const addItem = (sectionId: string, subsectionId: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? {
      ...s,
      subsections: s.subsections.map(sub => sub.id === subsectionId ? { ...sub, items: [...sub.items, defaultItem()] } : sub)
    } : s));
    triggerAutosave();
  };

  const removeItem = (sectionId: string, subsectionId: string, itemId: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? {
      ...s,
      subsections: s.subsections.map(sub => sub.id === subsectionId ? { ...sub, items: sub.items.filter(i => i.id !== itemId) } : sub)
    } : s));
    triggerAutosave();
  };

  const updateItem = (sectionId: string, subsectionId: string, itemId: string, field: keyof BOQItemRow, value: string | number) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        subsections: s.subsections.map(sub => {
          if (sub.id !== subsectionId) return sub;
          return {
            ...sub,
            items: sub.items.map(i => i.id === itemId ? { ...i, [field]: field === 'description' || field === 'unit' ? String(value) : Number(value) } : i)
          };
        })
      };
    }));
    triggerAutosave();
  };

  const updateSubsectionLabel = (sectionId: string, subsectionId: string, label: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? {
      ...s,
      subsections: s.subsections.map(sub => sub.id === subsectionId ? { ...sub, label } : sub)
    } : s));
    triggerAutosave();
  };

  const addSubsection = (sectionId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const nextLetter = String.fromCharCode(65 + s.subsections.length);
      return {
        ...s,
        subsections: [...s.subsections, defaultSubsection(nextLetter, `Subsection ${nextLetter}`)]
      };
    }));
    triggerAutosave();
  };

  const removeSubsection = (sectionId: string, subsectionId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        subsections: s.subsections.filter(sub => sub.id !== subsectionId)
      };
    }));
    triggerAutosave();
  };

  const formatCurrency = (amount: number) => {
    const currencyLocales: { [key: string]: { locale: string; code: string } } = {
      KES: { locale: 'en-KE', code: 'KES' },
      USD: { locale: 'en-US', code: 'USD' },
      EUR: { locale: 'en-GB', code: 'EUR' },
      GBP: { locale: 'en-GB', code: 'GBP' }
    };
    const curr = currencyLocales[currency] || currencyLocales.KES;
    return new Intl.NumberFormat(curr.locale, { style: 'currency', currency: curr.code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const calculateSubsectionTotal = (subsection: BOQSubsectionRow): number => {
    return subsection.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0);
  };

  const calculateSectionTotal = (section: BOQSectionRow): number => {
    return section.subsections.reduce((sum, sub) => sum + calculateSubsectionTotal(sub), 0);
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    sections.forEach(sec => { subtotal += calculateSectionTotal(sec); });
    return { subtotal };
  }, [sections]);

  const isItemEmpty = (item: BOQItemRow): boolean => {
    return !item.description.trim() && item.quantity === 1 && item.rate === 0;
  };

  const isItemPartiallyFilled = (item: BOQItemRow): boolean => {
    const hasDescription = item.description.trim().length > 0;
    const hasQuantity = item.quantity > 0;
    const hasRate = item.rate >= 0;
    const filledFields = [hasDescription, hasQuantity, hasRate].filter(Boolean).length;
    return filledFields > 0 && filledFields < 3;
  };

  const getFilledItems = () => {
    return sections.map(s => ({
      ...s,
      subsections: s.subsections.map(sub => ({
        ...sub,
        items: sub.items.filter(i => !isItemEmpty(i))
      }))
    }));
  };

  const validate = () => {
    if (!clientId) { toast.error('Please select a client'); return false; }
    if (!boqNumber || !boqDate) { toast.error('BOQ number and date are required'); return false; }

    const filledSections = getFilledItems();
    const hasItems = filledSections.some(s => s.subsections.some(sub => sub.items.length > 0));
    if (!hasItems) { toast.error('Add at least one item'); return false; }

    const hasPartiallyFilled = filledSections.some(s => s.subsections.some(sub => sub.items.some(i => isItemPartiallyFilled(i))));
    if (hasPartiallyFilled) { toast.error('Each item needs description, quantity > 0, and rate > 0'); return false; }

    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!selectedClient) { toast.error('Invalid client'); return; }
    if (!boq?.id) { toast.error('BOQ ID not found'); return; }

    setSubmitting(true);
    try {
      const filledSections = getFilledItems();

      // Calculate subtotal from filled items only
      let filledSubtotal = 0;
      filledSections.forEach(sec => {
        sec.subsections.forEach(sub => {
          sub.items.forEach(item => {
            filledSubtotal += (item.quantity || 0) * (item.rate || 0);
          });
        });
      });

      const doc: BoqDocument = {
        number: boqNumber,
        date: boqDate,
        currency: currency,
        client: {
          name: selectedClient.name,
          email: selectedClient.email || undefined,
          phone: selectedClient.phone || undefined,
          address: selectedClient.address || undefined,
          city: selectedClient.city || undefined,
          country: selectedClient.country || undefined,
        },
        contractor: contractor || undefined,
        project_title: projectTitle || undefined,
        sections: filledSections.map(s => ({
          title: s.title || undefined,
          subsections: s.subsections.map(sub => ({
            name: sub.name,
            label: sub.label,
            items: sub.items.map(i => {
              const unitObj = units.find((u: any) => u.id === i.unit);
              return {
                description: i.description,
                quantity: i.quantity,
                unit_id: i.unit || null,
                unit_name: unitObj ? unitObj.name : i.unit || null,
                rate: i.rate,
              };
            })
          }))
        })),
        notes: notes || undefined,
        // NOTE: Do NOT save terms to nested data - save only to top-level columns
        // This ensures single source of truth for terms_and_conditions and show_calculated_values_in_terms
      };

      const payload = {
        number: boqNumber,
        boq_date: boqDate,
        due_date: dueDate,
        client_name: selectedClient.name,
        client_email: selectedClient.email || null,
        client_phone: selectedClient.phone || null,
        client_address: selectedClient.address || null,
        client_city: selectedClient.city || null,
        client_country: selectedClient.country || null,
        contractor: contractor || null,
        project_title: projectTitle || null,
        currency: currency,
        subtotal: filledSubtotal,
        tax_amount: 0,
        total_amount: filledSubtotal,
        data: doc,
        terms_and_conditions: termsAndConditions || null,
        showCalculatedValuesInTerms: showCalculatedValuesInTerms,
      };

      const { error: updateError } = await supabase.from('boqs').update(payload).eq('id', boq.id);
      if (updateError) {
        console.error('Failed to update BOQ:', updateError);
        toast.error('Failed to update BOQ');
        return;
      }

      // Delete the edit draft since we've successfully saved
      if (profile?.id && currentCompany?.id) {
        await deleteEditDraft(profile.id, currentCompany.id, boq.id);
      }

      setHasUnsavedChanges(false);
      unsavedChangesRef.current = false;
      toast.success(`BOQ ${boqNumber} updated`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Failed to update BOQ', err);
      toast.error('Failed to update BOQ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Layers className="h-5 w-5 text-primary" />
            <span>Edit Bill of Quantities</span>
          </DialogTitle>
          <DialogDescription>
            Edit BOQ details and save changes to the database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>BOQ Number</Label>
              <Input value={boqNumber} onChange={e => { setBoqNumber(e.target.value); triggerAutosave(); }} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={boqDate} onChange={e => { setBoqDate(e.target.value); triggerAutosave(); }} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); triggerAutosave(); }} />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={val => { setCurrency(val); triggerAutosave(); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Client</Label>
            <Select value={clientId} onValueChange={val => { setClientId(val); triggerAutosave(); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Project Title</Label>
              <Input value={projectTitle} onChange={e => { setProjectTitle(e.target.value); triggerAutosave(); }} />
            </div>
            <div>
              <Label>Contractor</Label>
              <Input value={contractor} onChange={e => { setContractor(e.target.value); triggerAutosave(); }} />
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Sections & Items</CardTitle>
              <Button variant="outline" onClick={addSection}>
                <Plus className="h-4 w-4 mr-2" /> Add Section
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {sections.map((section, sIdx) => (
                <div key={section.id} className="space-y-3 border border-border rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Input value={section.title} onChange={e => updateSectionTitle(section.id, e.target.value)} placeholder="Section title" />
                    <Button variant="destructive" onClick={() => removeSection(section.id)} disabled={sections.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="ml-auto text-sm text-muted-foreground">Section {sIdx + 1}</div>
                  </div>

                  {section.subsections.map((subsection, subIdx) => (
                    <div key={subsection.id} className="space-y-3 bg-muted/30 rounded-lg p-3 border border-border/50">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold">Subsection {subsection.name}:</div>
                          <Input
                            value={subsection.label}
                            onChange={e => updateSubsectionLabel(section.id, subsection.id, e.target.value)}
                            placeholder="Enter subsection name"
                            className="w-48"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-muted-foreground">Subtotal: {formatCurrency(calculateSubsectionTotal(subsection))}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSubsection(section.id, subsection.id)}
                            disabled={section.subsections.length === 1}
                            title={section.subsections.length === 1 ? "Cannot remove the last subsection" : "Remove this subsection"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-2/5">Item Description</TableHead>
                            <TableHead className="w-20">Qty</TableHead>
                            <TableHead className="w-32">Unit</TableHead>
                            <TableHead className="w-28">Rate</TableHead>
                            <TableHead className="w-28 text-right">Amount</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subsection.items.map(row => (
                            <TableRow key={row.id} className="h-auto">
                              <TableCell className="py-3 pr-3">
                                <div className="relative">
                                  <Textarea value={row.description} onChange={e => updateItem(section.id, subsection.id, row.id, 'description', e.target.value)} onFocus={() => setPreviewItem({ sectionId: section.id, subsectionId: subsection.id, itemId: row.id })} onBlur={() => setPreviewItem(null)} placeholder="Describe item in detail..." className="text-sm px-3 py-2 min-h-16 resize-none" />
                                  {previewItem?.itemId === row.id && row.description && (
                                    <div className="fixed z-50 bg-gradient-to-b from-primary to-primary/90 text-primary-foreground px-4 py-3 rounded-lg text-sm font-medium shadow-xl border border-primary/30 pointer-events-none backdrop-blur-sm max-w-xs" style={{ left: '20px', top: '-120px' }}>
                                      <div className="font-semibold mb-2 text-primary-foreground/90">Preview</div>
                                      <div className="text-primary-foreground/95 break-words whitespace-pre-wrap">{row.description}</div>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-3 px-1">
                                <div className="relative">
                                  <Input type="number" min={0} value={row.quantity} onChange={e => updateItem(section.id, subsection.id, row.id, 'quantity', Number(e.target.value))} placeholder="0" className="h-10 text-sm text-center px-2 w-20" />
                                </div>
                              </TableCell>
                              <TableCell className="py-3 px-2">
                                <Select value={row.unit} onValueChange={(val) => {
                                  if (val === '__add_unit') {
                                    setPendingUnitTarget({ sectionId: section.id, itemId: row.id });
                                    setUnitModalOpen(true);
                                  } else {
                                    updateItem(section.id, subsection.id, row.id, 'unit', val);
                                  }
                                }}>
                                  <SelectTrigger className="h-10 text-sm">
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {units.map((u: any) => (
                                      <SelectItem key={u.id} value={u.id}>{u.name}{u.abbreviation ? ` (${u.abbreviation})` : ''}</SelectItem>
                                    ))}
                                    <SelectItem value="__add_unit">+ Add unit...</SelectItem>
                                  </SelectContent>
                                </Select>

                                <CreateUnitModal open={unitModalOpen} onOpenChange={setUnitModalOpen} onCreated={(unitName) => {
                                  if (pendingUnitTarget) {
                                    updateItem(pendingUnitTarget.sectionId, subsection.id, pendingUnitTarget.itemId, 'unit', unitName);
                                    setPendingUnitTarget(null);
                                  }
                                }} />
                              </TableCell>
                              <TableCell className="py-3 px-1">
                                <div className="relative">
                                  <Input type="number" min={0} value={row.rate} onChange={e => updateItem(section.id, subsection.id, row.id, 'rate', Number(e.target.value))} placeholder="0" className="h-10 text-sm text-center px-2 w-28" />
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-3 px-2">
                                <div className="text-sm font-medium">
                                  {formatCurrency((row.quantity || 0) * (row.rate || 0))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-3 px-1">
                                <Button variant="ghost" size="sm" onClick={() => removeItem(section.id, subsection.id, row.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={6}>
                              <Button variant="outline" size="sm" onClick={() => addItem(section.id, subsection.id)}>
                                <Plus className="h-4 w-4 mr-2" /> Add Item
                              </Button>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addSubsection(section.id)}
                    className="mb-3"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Subsection
                  </Button>

                  <div className="flex items-center justify-end gap-6 pt-2 border-t border-border">
                    <div className="text-sm font-semibold">Section Total: {formatCurrency(calculateSectionTotal(section))}</div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-end gap-6 pt-4">
                <div className="text-lg font-semibold">Subtotal: {formatCurrency(totals.subtotal)}</div>
              </div>
            </CardContent>
          </Card>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => { setNotes(e.target.value); triggerAutosave(); }} rows={4} placeholder="Any special notes or terms" />
          </div>

          <div>
            <Label>Terms and Conditions</Label>
            <Textarea
              value={termsAndConditions}
              onChange={e => { setTermsAndConditions(e.target.value); triggerAutosave(); }}
              rows={6}
            />
            <div className="flex items-center space-x-2 mt-3">
              <Checkbox
                id="showCalculatedValues"
                checked={showCalculatedValuesInTerms}
                onCheckedChange={(checked) => { setShowCalculatedValuesInTerms(checked === true); triggerAutosave(); }}
              />
              <Label htmlFor="showCalculatedValues" className="font-normal cursor-pointer">
                Show calculated values (e.g., 50% (KES 50,000))
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 flex items-center justify-between">
          <BOQSaveIndicator
            isSaving={isSaving}
            lastSavedTime={lastSavedTime}
            hasUnsavedChanges={hasUnsavedChanges}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              if (unsavedChangesRef.current) {
                setShowUnsavedDialog(true);
              } else {
                onOpenChange(false);
              }
            }}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting}>
              <Calculator className="h-4 w-4 mr-2" />
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogFooter>

        <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Are you sure you want to close without saving?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Editing</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                setShowUnsavedDialog(false);
                onOpenChange(false);
              }}>
                Discard Changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
