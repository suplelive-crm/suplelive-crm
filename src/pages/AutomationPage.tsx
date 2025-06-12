import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Play, Pause, Settings, Trash2, Copy, Download, Upload, Zap, BarChart3, Clock, CheckCircle, XCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AutomationBuilder } from '@/components/automation/AutomationBuilder';
import { CreateWorkflowDialog } from '@/components/automation/CreateWorkflowDialog';
import { TemplateGallery } from '@/components/automation/TemplateGallery';
import { ExecutionHistory } from '@/components/automation/ExecutionHistory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAutomationStore } from '@/store/automationStore';

export function AutomationPage() {
  const {
    workflows,
    executions,
    currentWorkflow,
    loading,
    fetchWorkflows,
    fetchExecutions,
    setCurrentWorkflow,
    deleteWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    executeWorkflow,
  } = useAutomationStore();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);

  useEffect(() => {
    fetchWorkflows();
    fetchExecutions();
  }, [fetchWorkflows, fetchExecutions]);

  const handleWorkflowAction = async (action: string, workflowId: string) => {
    switch (action) {
      case 'pause':
        await pauseWorkflow(workflowId);
        break;
      case 'resume':
        await resumeWorkflow(workflowId);
        break;
      case 'execute':
        await executeWorkflow(workflowId);
        break;
      case 'delete':
        await deleteWorkflow(workflowId);
        break;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'archived': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      case 'draft': return <Clock className="h-4 w-4" />;
      case 'archived': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const activeWorkflows = workflows.filter(w => w.status === 'active').length;
  const totalExecutions = executions.length;
  const successfulExecutions = executions.filter(e => e.status === 'completed').length;
  const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full flex flex-col"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Automação</h1>
              <p className="text-gray-600 mt-2">Crie fluxos automatizados para otimizar seu atendimento</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setTemplateGalleryOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                Templates
              </Button>
              
              <CreateWorkflowDialog 
                open={createDialogOpen} 
                onOpenChange={setCreateDialogOpen}
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{workflows.length}</div>
                    <div className="text-sm text-gray-600">Total de Automações</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Play className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-green-600">{activeWorkflows}</div>
                    <div className="text-sm text-gray-600">Ativas</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{totalExecutions}</div>
                    <div className="text-sm text-gray-600">Execuções</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-orange-600" />
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{successRate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-600">Taxa de Sucesso</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-h-0">
            {currentWorkflow ? (
              <AutomationBuilder />
            ) : (
              <Tabs defaultValue="workflows\" className="h-full">
                <TabsList>
                  <TabsTrigger value="workflows">Automações</TabsTrigger>
                  <TabsTrigger value="executions">Histórico</TabsTrigger>
                  <TabsTrigger value="templates">Templates</TabsTrigger>
                </TabsList>

                <TabsContent value="workflows" className="space-y-4">
                  {workflows.length === 0 ? (
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Zap className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Nenhuma automação criada
                        </h3>
                        <p className="text-gray-500 mb-4">
                          Crie sua primeira automação para otimizar seus processos
                        </p>
                        <div className="flex gap-2 justify-center">
                          <Button onClick={() => setCreateDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nova Automação
                          </Button>
                          <Button variant="outline" onClick={() => setTemplateGalleryOpen(true)}>
                            <Download className="h-4 w-4 mr-2" />
                            Ver Templates
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {workflows.map((workflow) => (
                        <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg">{workflow.name}</CardTitle>
                                {workflow.description && (
                                  <p className="text-sm text-gray-600 mt-1">{workflow.description}</p>
                                )}
                              </div>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => setCurrentWorkflow(workflow)}>
                                    <Settings className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuItem onClick={() => handleWorkflowAction('execute', workflow.id)}>
                                    <Play className="h-4 w-4 mr-2" />
                                    Executar
                                  </DropdownMenuItem>
                                  
                                  {workflow.status === 'active' ? (
                                    <DropdownMenuItem onClick={() => handleWorkflowAction('pause', workflow.id)}>
                                      <Pause className="h-4 w-4 mr-2" />
                                      Pausar
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => handleWorkflowAction('resume', workflow.id)}>
                                      <Play className="h-4 w-4 mr-2" />
                                      Ativar
                                    </DropdownMenuItem>
                                  )}
                                  
                                  <DropdownMenuItem>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicar
                                  </DropdownMenuItem>
                                  
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Deletar
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Deletar Automação</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Tem certeza que deseja deletar a automação "{workflow.name}"? 
                                          Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleWorkflowAction('delete', workflow.id)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Deletar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardHeader>
                          
                          <CardContent>
                            <div className="flex items-center justify-between mb-3">
                              <Badge className={getStatusColor(workflow.status)}>
                                {getStatusIcon(workflow.status)}
                                <span className="ml-1 capitalize">{workflow.status}</span>
                              </Badge>
                              
                              <span className="text-sm text-gray-500">
                                {workflow.execution_count} execuções
                              </span>
                            </div>
                            
                            <div className="text-xs text-gray-500 space-y-1">
                              <div>Tipo: {workflow.trigger_type}</div>
                              <div>
                                Última execução: {workflow.last_executed 
                                  ? new Date(workflow.last_executed).toLocaleDateString('pt-BR')
                                  : 'Nunca'
                                }
                              </div>
                            </div>
                            
                            <Button 
                              className="w-full mt-3" 
                              variant="outline"
                              onClick={() => setCurrentWorkflow(workflow)}
                            >
                              Abrir Editor
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="executions">
                  <ExecutionHistory />
                </TabsContent>

                <TabsContent value="templates">
                  <TemplateGallery />
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Dialogs */}
          <TemplateGallery 
            open={templateGalleryOpen} 
            onOpenChange={setTemplateGalleryOpen}
          />
        </motion.div>
      </div>
    </DashboardLayout>
  );
}