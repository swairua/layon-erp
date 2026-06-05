import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { useCustomers } from '@/hooks/useDatabase';
import { lclTemplateService } from '@/services/lclTemplateService';
import { LCLHierarchicalData } from '@/types/lclTemplate';
import { LCLBOQItemEditor, LCLBOQItemEditorHandle, ItemSnapshot } from '@/components/lcl/LCLBOQItemEditor';
import { lclBoqService, LCLBOQRecord } from '@/services/lclBoqService';
import { generateNextBOQNumber } from '@/utils/boqNumberGenerator';
import { downloadLCLBOQPDF, reconstructHierarchicalDataFromSnapshot } from '@/utils/lclBoqPdfGenerator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Save } from 'lucide-react';

export default function LCLTemplate() {
  const { currentCompany, isLoading: isCompanyLoading } = useCurrentCompany();
  const companyId = currentCompany?.id || '';
  const { toast } = useToast();
  const { data: customers } = useCustomers(companyId);

  const [hierarchicalData, setHierarchicalData] =
    useState<LCLHierarchicalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // BOQ Header fields
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [projectTitle, setProjectTitle] = useState<string>('');
  const [boqNumber, setBoqNumber] = useState<string>('');
  const [boqDate, setBoqDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lclBoqRecord, setLclBoqRecord] = useState<LCLBOQRecord | null>(null);
  const editorRef = useRef<LCLBOQItemEditorHandle>(null);
  const headerAutosaveRef = useRef<NodeJS.Timeout | null>(null);

  const [initialItems, setInitialItems] = useState<ItemSnapshot[]>([]);
  const [structureId, setStructureId] = useState<string>('');

  const loadLCLBOQData = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      // Load the default LCL BOQ structure for this company
      const structures = await lclTemplateService.getStructures(companyId);
      const lclDefaultStructure = structures.find(
        (s) => s.name === 'LCL Default BOQ'
      );

      if (!lclDefaultStructure) {
        toast({
          title: 'Error',
          description:
            'LCL Default BOQ structure not found. Please contact support.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Load hierarchical data for the default structure
      const data =
        await lclTemplateService.getHierarchicalData(lclDefaultStructure.id);
      setHierarchicalData(data);
      setStructureId(lclDefaultStructure.id);

      // Load previously-added items from the most recent BOQ (saved or draft)
      try {
        const boqs = await lclBoqService.getLCLBOQs(companyId);
        // Get the most recent BOQ with items
        const latestBoq = boqs[0];
        if (latestBoq && latestBoq.items_snapshot && latestBoq.items_snapshot.length > 0) {
          setInitialItems(latestBoq.items_snapshot);
        }
      } catch (itemsError) {
        console.log('Note: Could not load previous items:', itemsError);
      }

      // Generate next BOQ number - checks both boqs and lcl_boqs tables
      try {
        const nextNumber = await generateNextBOQNumber(undefined, companyId);
        setBoqNumber(nextNumber);
      } catch (boqError) {
        // If error fetching from DB, use default
        console.log('Note: Error generating BOQ number, using default');
        setBoqNumber('BOQ-001');
      }
    } catch (error) {
      console.error('Error loading LCL BOQ:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to load LCL BOQ',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  const handleSaveLCLBOQ = async () => {
    if (!hierarchicalData || !companyId) return;

    const itemsSnapshot = editorRef.current?.getSnapshot();
    if (!itemsSnapshot || itemsSnapshot.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'No items in the BOQ. Please add items before saving.',
        variant: 'destructive',
      });
      return;
    }

    const selectedCustomer = customers?.find((c) => c.id === selectedCustomerId);
    if (!selectedCustomerId || !selectedCustomer) {
      toast({
        title: 'Validation Error',
        description: 'Please select a customer.',
        variant: 'destructive',
      });
      return;
    }

    if (!projectTitle.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a project title.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const boqData: LCLBOQRecord = {
        id: lclBoqRecord?.id,
        company_id: companyId,
        number: boqNumber,
        customer_id: selectedCustomerId,
        project_title: projectTitle,
        boq_date: boqDate,
        items_snapshot: itemsSnapshot,
        status: 'saved',
      };

      // Save to lcl_boqs table
      const saved = await lclBoqService.saveLCLBOQ(boqData);
      setLclBoqRecord(saved);
      editorRef.current?.markAsSaved();
      try { localStorage.removeItem('lcl_boq_creation_header'); } catch { /* ignore */ }

      // Create or update corresponding BOQ record in boqs table
      try {
        const customerInfo = {
          name: selectedCustomer.name,
          email: selectedCustomer.email,
          phone: selectedCustomer.phone,
          address: selectedCustomer.address,
          city: selectedCustomer.city,
          country: selectedCustomer.country,
        };

        const boqRecord = await lclBoqService.createBOQFromLCLBOQ(saved, customerInfo);

        // Store the boq_id in lcl_boqs to maintain the relationship
        if (boqRecord?.id && boqRecord.id !== saved.boq_id) {
          await lclBoqService.saveLCLBOQ({
            ...saved,
            boq_id: boqRecord.id,
          });
          // Update local state to reflect the boq_id
          setLclBoqRecord({
            ...saved,
            boq_id: boqRecord.id,
          });
        }
      } catch (boqCreateError) {
        console.error('Warning: Failed to create corresponding BOQ record:', boqCreateError);
        // Don't fail the save if BOQ creation fails, but warn the user
        toast({
          title: 'Partial Success',
          description: 'LCL BOQ saved, but failed to create corresponding BOQ record. Please contact support.',
          variant: 'destructive',
        });
        try { localStorage.removeItem('lcl_boq_creation_header'); } catch { /* ignore */ }
        return;
      }

      toast({
        title: 'Success',
        description: 'LCL BOQ and corresponding BOQ record saved successfully.',
      });
    } catch (error) {
      console.error('Error saving LCL BOQ:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save LCL BOQ. Please ensure the database is properly configured.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!hierarchicalData || !companyId) return;

    const selectedCustomer = customers?.find((c) => c.id === selectedCustomerId);
    if (!selectedCustomer) {
      toast({
        title: 'Validation Error',
        description: 'Please select a customer.',
        variant: 'destructive',
      });
      return;
    }

    if (!projectTitle.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a project title.',
        variant: 'destructive',
      });
      return;
    }

    const itemsSnapshot = editorRef.current?.getSnapshot();
    if (!itemsSnapshot || itemsSnapshot.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'No items in the BOQ. Please add items before downloading.',
        variant: 'destructive',
      });
      return;
    }

    setDownloading(true);
    try {
      const pdfData = reconstructHierarchicalDataFromSnapshot(itemsSnapshot);
      await downloadLCLBOQPDF(
        pdfData,
        boqNumber,
        boqDate,
        selectedCustomer.name,
        projectTitle,
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
        description: 'LCL BOQ PDF downloaded successfully.',
      });
    } catch (error) {
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

  useEffect(() => {
    if (isCompanyLoading) return;
    loadLCLBOQData();
  }, [loadLCLBOQData, isCompanyLoading]);

  // Autosave header fields to localStorage (2s debounce)
  useEffect(() => {
    if (headerAutosaveRef.current) {
      clearTimeout(headerAutosaveRef.current);
    }
    headerAutosaveRef.current = setTimeout(() => {
      try {
        localStorage.setItem('lcl_boq_creation_header', JSON.stringify({
          selectedCustomerId,
          projectTitle,
          boqDate,
          lastSavedAt: new Date().toISOString(),
        }));
      } catch { /* ignore */ }
    }, 2000);
    return () => {
      if (headerAutosaveRef.current) clearTimeout(headerAutosaveRef.current);
    };
  }, [selectedCustomerId, projectTitle, boqDate]);

  // Restore header fields from localStorage after data loads
  useEffect(() => {
    if (!hierarchicalData) return;
    try {
      const raw = localStorage.getItem('lcl_boq_creation_header');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.selectedCustomerId) setSelectedCustomerId(saved.selectedCustomerId);
        if (saved.projectTitle) setProjectTitle(saved.projectTitle);
        if (saved.boqDate) setBoqDate(saved.boqDate);
      }
    } catch { /* ignore */ }
  }, [hierarchicalData]);

  if (loading || isCompanyLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading LCL BOQ...</p>
      </div>
    );
  }

  if (!hierarchicalData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-4">
          Unable to load LCL BOQ structure.
        </p>
        <Button onClick={loadLCLBOQData}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">LCL BOQ</h1>
      </div>

      {/* BOQ Header Section */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold mb-4">BOQ Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger id="customer">
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project Title */}
          <div className="space-y-2">
            <Label htmlFor="projectTitle">Project Title</Label>
            <Input
              id="projectTitle"
              placeholder="e.g., Proposed Development - House Renovations"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
            />
          </div>

          {/* BOQ Number (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="boqNumber">BOQ Number</Label>
            <Input
              id="boqNumber"
              value={boqNumber}
              disabled
              className="bg-muted"
            />
          </div>

          {/* BOQ Date */}
          <div className="space-y-2">
            <Label htmlFor="boqDate">BOQ Date</Label>
            <Input
              id="boqDate"
              type="date"
              value={boqDate}
              onChange={(e) => setBoqDate(e.target.value)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSaveLCLBOQ}
            disabled={saving || !selectedCustomerId || !projectTitle.trim()}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save LCL BOQ
          </Button>
          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            disabled={downloading || !selectedCustomerId || !projectTitle.trim()}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <LCLBOQItemEditor
        ref={editorRef}
        data={hierarchicalData}
        templateStructure={undefined}
        companyId={companyId}
        initialItems={initialItems}
        structureId={structureId}
      />
    </div>
  );
}
