import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Download,
  PlusCircle,
  Trash2,
  Edit2,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { CreateTemplateDialog } from '@/components/lclTemplate/CreateTemplateDialog';
import { LCLTemplateEditor } from '@/components/lclTemplate/LCLTemplateEditor';
import { lclTemplateService } from '@/services/lclTemplateService';
import {
  LCLTemplateStructure,
  LCLHierarchicalData,
  LCLSectionDef,
} from '@/types/lclTemplate';

// Default section structure based on BOQ-085 (PROPOSED RESIDENTIAL MAISONETTE)
const DEFAULT_SECTIONS: LCLSectionDef[] = [
  {
    id: 'foundation',
    name: 'Section A: Foundation',
    subsections: [
      { id: 'foundation_materials', name: 'Materials' },
      { id: 'foundation_labor', name: 'Labor' },
    ],
  },
  {
    id: 'ground_floor_walling',
    name: 'Section B: Ground Floor Walling',
    subsections: [
      { id: 'gfw_materials', name: 'Materials' },
      { id: 'gfw_labor', name: 'Labor' },
    ],
  },
  {
    id: 'ground_floor_slab',
    name: 'Section C: Ground Floor Suspended Slab',
    subsections: [
      { id: 'gfs_materials', name: 'Materials' },
      { id: 'gfs_labor', name: 'Labor' },
    ],
  },
  {
    id: 'first_floor_walling',
    name: 'Section D: First Floor Walling & Columns',
    subsections: [
      { id: 'ffw_materials', name: 'Materials' },
      { id: 'ffw_labor', name: 'Labor' },
    ],
  },
  {
    id: 'first_floor_slab',
    name: 'Section E: First Floor Suspended Slab',
    subsections: [
      { id: 'ffs_materials', name: 'Materials' },
      { id: 'ffs_labor', name: 'Labor' },
    ],
  },
  {
    id: 'second_floor_walling',
    name: 'Section F: Second Floor Walling & Columns',
    subsections: [
      { id: 'sfw_materials', name: 'Materials' },
      { id: 'sfw_labor', name: 'Labor' },
    ],
  },
  {
    id: 'second_floor_slab',
    name: 'Section G: Second Floor Suspended Slab',
    subsections: [
      { id: 'sfs_materials', name: 'Materials' },
      { id: 'sfs_labor', name: 'Labor' },
    ],
  },
];

type PageView = 'list' | 'editor';

export default function LCLTemplate() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?.id || '';
  const { toast } = useToast();

  const [pageView, setPageView] = useState<PageView>('list');
  const [templates, setTemplates] = useState<LCLTemplateStructure[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<LCLTemplateStructure | null>(null);
  const [hierarchicalData, setHierarchicalData] =
    useState<LCLHierarchicalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] =
    useState<LCLTemplateStructure | null>(null);

  const loadTemplates = async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      const data = await lclTemplateService.getStructures(companyId);
      setTemplates(data);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to load templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateData = async (template: LCLTemplateStructure) => {
    setLoading(true);
    try {
      const data = await lclTemplateService.getHierarchicalData(template.id);
      setHierarchicalData(data);
      setSelectedTemplate(template);
      setPageView('editor');
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to load template',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateCreated = async (template: LCLTemplateStructure) => {
    await loadTemplates();
    await loadTemplateData(template);
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    setLoading(true);
    try {
      await lclTemplateService.deleteStructure(templateToDelete.id);
      toast({
        title: 'Success',
        description: 'Template deleted successfully.',
      });
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
      await loadTemplates();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to delete template',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDataUpdated = async () => {
    if (!selectedTemplate) return;
    const data = await lclTemplateService.getHierarchicalData(
      selectedTemplate.id
    );
    setHierarchicalData(data);
  };

  useEffect(() => {
    loadTemplates();
  }, [companyId]);

  if (pageView === 'editor' && selectedTemplate && hierarchicalData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">LCL Template Editor</h1>
          <Button
            variant="outline"
            onClick={() => {
              setPageView('list');
              setSelectedTemplate(null);
              setHierarchicalData(null);
            }}
            disabled={loading}
          >
            ← Back to List
          </Button>
        </div>

        <LCLTemplateEditor
          data={hierarchicalData}
          onDataUpdated={handleDataUpdated}
          companyId={companyId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">LCL Templates</h1>
        <Button onClick={() => setCreateDialogOpen(true)} disabled={loading}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Create New Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                No templates created yet.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Create Your First Template
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">
                        {template.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {template.description || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(template.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadTemplateData(template)}
                            disabled={loading}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setTemplateToDelete(template);
                              setDeleteConfirmOpen(true);
                            }}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTemplateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        companyId={companyId}
        onTemplateCreated={handleTemplateCreated}
        defaultSections={DEFAULT_SECTIONS}
      />

      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Template"
        description={`Are you sure you want to delete "${templateToDelete?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteTemplate}
        isDangerous
      />
    </div>
  );
}
