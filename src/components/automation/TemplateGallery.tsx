import { useState, useEffect } from 'react';
import { Download, Eye, Star, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAutomationStore } from '@/store/automationStore';

interface TemplateGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateGallery({ open, onOpenChange }: TemplateGalleryProps) {
  const { templates, fetchTemplates, importTemplate, setCurrentWorkflow } = useAutomationStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

  const categories = [
    { value: 'all', label: 'Todos' },
    { value: 'lead_nurturing', label: 'Nutrição de Leads' },
    { value: 'sales', label: 'Vendas' },
    { value: 'customer_support', label: 'Suporte' },
    { value: 'marketing', label: 'Marketing' },
  ];

  const filteredTemplates = templates.filter(template => 
    selectedCategory === 'all' || template.category === selectedCategory
  );

  const handleImportTemplate = async (templateId: string) => {
    setLoading(templateId);
    try {
      const workflow = await importTemplate(templateId);
      if (workflow) {
        setCurrentWorkflow(workflow);
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error importing template:', error);
    } finally {
      setLoading(null);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'lead_nurturing': return 'bg-blue-100 text-blue-800';
      case 'sales': return 'bg-green-100 text-green-800';
      case 'customer_support': return 'bg-purple-100 text-purple-800';
      case 'marketing': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryLabel = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.label || category;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Galeria de Templates</DialogTitle>
          <DialogDescription>
            Escolha um template pronto para começar rapidamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center space-x-4">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {template.description}
                      </CardDescription>
                    </div>
                    <Badge className={getCategoryColor(template.category)}>
                      {getCategoryLabel(template.category)}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Star className="h-4 w-4" />
                      <span>Template Oficial</span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      
                      <Button 
                        size="sm"
                        onClick={() => handleImportTemplate(template.id)}
                        disabled={loading === template.id}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        {loading === template.id ? 'Importando...' : 'Usar Template'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhum template encontrado nesta categoria</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}