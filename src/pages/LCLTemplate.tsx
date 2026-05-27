import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { LCLTemplateEditor } from '@/components/lclTemplate/LCLTemplateEditor';
import { lclTemplateService } from '@/services/lclTemplateService';
import { LCLHierarchicalData } from '@/types/lclTemplate';

export default function LCLTemplate() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?.id || '';
  const { toast } = useToast();

  const [hierarchicalData, setHierarchicalData] =
    useState<LCLHierarchicalData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLCLBOQData = async () => {
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
        return;
      }

      // Load hierarchical data for the default structure
      const data =
        await lclTemplateService.getHierarchicalData(lclDefaultStructure.id);
      setHierarchicalData(data);
    } catch (error) {
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
  };

  const handleDataUpdated = async () => {
    // Reload the data after any updates
    if (!companyId) return;

    try {
      const structures = await lclTemplateService.getStructures(companyId);
      const lclDefaultStructure = structures.find(
        (s) => s.name === 'LCL Default BOQ'
      );

      if (lclDefaultStructure) {
        const data = await lclTemplateService.getHierarchicalData(
          lclDefaultStructure.id
        );
        setHierarchicalData(data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to refresh data',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadLCLBOQData();
  }, [companyId]);

  if (loading) {
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

      <LCLTemplateEditor
        data={hierarchicalData}
        onDataUpdated={handleDataUpdated}
        companyId={companyId}
      />
    </div>
  );
}
