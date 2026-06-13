import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Download, PlusCircle, Upload, Trash2, ChevronDown, ChevronRight, Edit2, Save, X } from 'lucide-react';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { hierarchicalBOQService } from '@/services/hierarchicalBOQService';
import { parseBOQText, validateBOQData } from '@/utils/boqImportParser';
import { generateHierarchicalBOQPDF } from '@/utils/hierarchicalBOQPdfGenerator';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import {
  BOQFixedStructure,
  BOQFixedItemV2,
  BOQHierarchicalData,
  BOQStructureData,
  BOQSectionDef,
  BOQSubsectionDef,
} from '@/types/hierarchicalBOQ';

export default function FixedBOQHierarchical() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?.id || '';

  const [structures, setStructures] = useState<BOQFixedStructure[]>([]);
  const [selectedStructure, setSelectedStructure] = useState<BOQFixedStructure | null>(null);
  const [hierarchicalData, setHierarchicalData] = useState<BOQHierarchicalData | null>(null);

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importingFile, setImportingFile] = useState(false);

  const [editingItem, setEditingItem] = useState<BOQFixedItemV2 | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; itemId?: string }>(
    { open: false }
  );
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // Load structures for company
  const loadStructures = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await hierarchicalBOQService.getStructures(companyId);
      setStructures(data);
      if (data.length > 0 && !selectedStructure) {
        setSelectedStructure(data[0]);
      }
    } catch (err) {
      console.error('Failed to load structures:', err);
      toast.error('Failed to load BOQ structures');
    } finally {
      setLoading(false);
    }
  };

  // Load hierarchical data when structure changes
  useEffect(() => {
    if (selectedStructure) {
      loadHierarchicalData();
    }
  }, [selectedStructure]);

  useEffect(() => {
    loadStructures();
  }, [companyId]);

  const loadHierarchicalData = async () => {
    if (!selectedStructure) return;
    try {
      const data = await hierarchicalBOQService.getHierarchicalData(selectedStructure.id);
      setHierarchicalData(data);
    } catch (err) {
      console.error('Failed to load hierarchical data:', err);
      toast.error('Failed to load BOQ data');
    }
  };

  const handleImportText = async () => {
    if (!companyId || !selectedStructure) {
      toast.error('Please select a structure first');
      return;
    }
    if (!importText.trim()) {
      toast.error('Paste BOQ text to import');
      return;
    }

    setImporting(true);
    try {
      const parseResult = parseBOQText(importText);

      if (!parseResult.success) {
        toast.error(`Import failed: ${parseResult.validation_errors.join(', ')}`);
        return;
      }

      // Validate the parsed data
      const validation = validateBOQData(parseResult.parsed_items);
      if (!validation.valid) {
        toast.error(`Validation failed: ${validation.errors.slice(0, 3).join(', ')}`);
        return;
      }

      // Convert to v2 items
      const itemsToInsert: Omit<BOQFixedItemV2, 'id' | 'created_at' | 'updated_at'>[] =
        parseResult.parsed_items.map((item) => ({
          company_id: companyId,
          structure_id: selectedStructure.id,
          section_id: item.section_id,
          subsection_id: item.subsection_id,
          item_number: item.item_number,
          description: item.description,
          unit: item.unit || 'Item',
          default_qty: item.qty,
          default_rate: item.rate,
          sort_order: item.sort_order,
        }));

      // Insert items
      await hierarchicalBOQService.insertItems(itemsToInsert);

      toast.success(`Imported ${parseResult.parsed_items.length} items`);
      setImportText('');
      await loadHierarchicalData();
    } catch (err) {
      console.error('Import failed:', err);
      toast.error('Import failed. Check formatting and try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleUpdateItem = async (itemId: string, updates: Partial<BOQFixedItemV2>) => {
    try {
      await hierarchicalBOQService.updateItem(itemId, updates as any);
      toast.success('Item updated');
      setEditingItem(null);
      await loadHierarchicalData();
    } catch (err) {
      console.error('Update failed:', err);
      toast.error('Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    setIsDeleting(true);
    try {
      await hierarchicalBOQService.deleteItem(itemId);
      toast.success('Item deleted');
      setDeleteDialog({ open: false });
      await loadHierarchicalData();
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!hierarchicalData || !currentCompany) {
      toast.error('No data to export');
      return;
    }

    try {
      await generateHierarchicalBOQPDF(
        hierarchicalData,
        {
          name: currentCompany.name,
          address: currentCompany.address,
          city: currentCompany.city,
          country: currentCompany.country,
          phone: currentCompany.phone,
          email: currentCompany.email,
          logo_url: currentCompany.logo_url,
        },
        `BOQ-${new Date().toISOString().slice(0, 10)}`,
        new Date().toISOString()
      );
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF');
    }
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (itemId !== draggedItemId) {
      setDragOverItemId(itemId);
    }
  };

  const handleDragLeave = () => {
    setDragOverItemId(null);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetItemId: string,
    subsectionItems: BOQFixedItemV2[],
    sectionId: string,
    subsectionId: string
  ) => {
    e.preventDefault();
    setDragOverItemId(null);

    if (!draggedItemId || draggedItemId === targetItemId || !selectedStructure) return;

    try {
      const draggedItem = subsectionItems.find((item) => item.id === draggedItemId);
      const targetItem = subsectionItems.find((item) => item.id === targetItemId);

      if (!draggedItem || !targetItem) return;

      const draggedIndex = subsectionItems.findIndex((item) => item.id === draggedItemId);
      const targetIndex = subsectionItems.findIndex((item) => item.id === targetItemId);

      const reorderedIds = [...subsectionItems.map((item) => item.id)];
      reorderedIds.splice(draggedIndex, 1);
      reorderedIds.splice(targetIndex, 0, draggedItemId);

      await hierarchicalBOQService.reorderItemsInSubsection(
        selectedStructure.id,
        sectionId,
        subsectionId,
        reorderedIds
      );

      toast.success('Items reordered');
      setDraggedItemId(null);
      await loadHierarchicalData();
    } catch (err) {
      console.error('Reorder failed:', err);
      toast.error('Failed to reorder items');
      setDraggedItemId(null);
    }
  };

  if (!companyId) {
    return <div className="p-6">Please select a company first</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Hierarchical Fixed BOQ</h1>
        <Button onClick={() => setImportingFile(true)} variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Import BOQ
        </Button>
      </div>

      {/* Structure Selection */}
      <Card>
        <CardHeader>
          <CardTitle>BOQ Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {structures.length === 0 ? (
            <p className="text-gray-500">No templates found. Create one to get started.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {structures.map((struct) => (
                <Button
                  key={struct.id}
                  variant={selectedStructure?.id === struct.id ? 'default' : 'outline'}
                  onClick={() => setSelectedStructure(struct)}
                >
                  {struct.name}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Panel */}
      {importingFile && (
        <Card>
          <CardHeader>
            <CardTitle>Import BOQ Text</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste BOQ text with sections and items..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={handleImportText} disabled={importing}>
                {importing ? 'Importing...' : 'Import'}
              </Button>
              <Button variant="outline" onClick={() => { setImportingFile(false); setImportText(''); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {selectedStructure && hierarchicalData && (
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>{selectedStructure.name}</CardTitle>
            <Button onClick={handleDownloadPDF} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sections */}
            {hierarchicalData.sections.map((section) => {
              const isExpanded = expandedSections.has(section.section_id);
              return (
                <div key={section.section_id} className="border rounded-lg overflow-hidden">
                  {/* Section Header */}
                  <div
                    className="bg-gray-100 p-4 cursor-pointer flex items-center justify-between"
                    onClick={() => toggleSection(section.section_id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                      <h3 className="font-semibold text-lg">{section.section_name}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        Ksh {section.total.toLocaleString('en-KE', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Subsections (when expanded) */}
                  {isExpanded && (
                    <div className="divide-y">
                      {section.subsections.map((subsection) => (
                        <div key={`${section.section_id}-${subsection.subsection_id}`} className="p-4">
                          <h4 className="font-semibold mb-3 text-sm text-gray-600">
                            {subsection.subsection_name}
                          </h4>

                          {/* Items Table */}
                          <Table className="text-sm mb-3">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">No.</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-16">Unit</TableHead>
                                <TableHead className="w-20 text-right">Qty</TableHead>
                                <TableHead className="w-24 text-right">Rate</TableHead>
                                <TableHead className="w-24 text-right">Amount</TableHead>
                                <TableHead className="w-16">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subsection.items.map((item, idx) => (
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
                                    draggedItemId === item.id ? 'opacity-50 bg-gray-100' : ''
                                  } ${
                                    dragOverItemId === item.id ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <TableCell>{item.item_number || idx + 1}</TableCell>
                                  <TableCell>
                                    {editingItem?.id === item.id ? (
                                      <Input
                                        value={editingItem.description}
                                        onChange={(e) =>
                                          setEditingItem({ ...editingItem, description: e.target.value })
                                        }
                                        className="text-sm"
                                      />
                                    ) : (
                                      item.description
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {editingItem?.id === item.id ? (
                                      <Input
                                        value={editingItem.unit}
                                        onChange={(e) =>
                                          setEditingItem({ ...editingItem, unit: e.target.value })
                                        }
                                        className="text-sm"
                                      />
                                    ) : (
                                      item.unit
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {editingItem?.id === item.id ? (
                                      <Input
                                        type="number"
                                        value={editingItem.default_qty || 0}
                                        onChange={(e) =>
                                          setEditingItem({
                                            ...editingItem,
                                            default_qty: parseFloat(e.target.value) || 0,
                                          })
                                        }
                                        className="text-sm text-right"
                                      />
                                    ) : (
                                      (item.default_qty || 0).toFixed(2)
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {editingItem?.id === item.id ? (
                                      <Input
                                        type="number"
                                        value={editingItem.default_rate || 0}
                                        onChange={(e) =>
                                          setEditingItem({
                                            ...editingItem,
                                            default_rate: parseFloat(e.target.value) || 0,
                                          })
                                        }
                                        className="text-sm text-right"
                                      />
                                    ) : (
                                      (item.default_rate || 0).toLocaleString('en-KE', {
                                        maximumFractionDigits: 2,
                                      })
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {(
                                      (item.default_qty || 0) * (item.default_rate || 0)
                                    ).toLocaleString('en-KE', { maximumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell className="flex gap-1">
                                    {editingItem?.id === item.id ? (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            handleUpdateItem(item.id, {
                                              description: editingItem.description,
                                              unit: editingItem.unit,
                                              default_qty: editingItem.default_qty,
                                              default_rate: editingItem.default_rate,
                                            })
                                          }
                                          className="h-6"
                                        >
                                          <Save className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setEditingItem(null)}
                                          className="h-6"
                                        >
                                          <X className="w-3 h-3" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setEditingItem(item)}
                                          className="h-6"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setDeleteDialog({ open: true, itemId: item.id })}
                                          className="h-6 text-red-600"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>

                          {/* Subsection Subtotal */}
                          <div className="text-right border-t pt-2">
                            <p className="text-sm font-semibold">
                              Subtotal:{' '}
                              Ksh{' '}
                              {subsection.subtotal.toLocaleString('en-KE', {
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Grand Total */}
            <div className="bg-gray-800 text-white p-4 rounded-lg text-right">
              <p className="text-lg font-bold">
                GRAND TOTAL: Ksh{' '}
                {hierarchicalData.grand_total.toLocaleString('en-KE', {
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <ConfirmationDialog
        open={deleteDialog.open}
        title="Delete Item"
        message="Are you sure? This cannot be undone."
        onConfirm={async () => {
          if (deleteDialog.itemId) {
            await handleDeleteItem(deleteDialog.itemId);
          }
        }}
        onCancel={() => setDeleteDialog({ open: false })}
        isLoading={isDeleting}
      />
    </div>
  );
}
