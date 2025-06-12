import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Play, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAutomationStore } from '@/store/automationStore';

export function ExecutionHistory() {
  const { executions, fetchExecutions } = useAutomationStore();
  const [selectedExecution, setSelectedExecution] = useState<any>(null);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      case 'running': return <Clock className="h-4 w-4" />;
      default: return <Play className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'failed': return 'Falhou';
      case 'running': return 'Executando';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const duration = end.getTime() - start.getTime();
    
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    return `${Math.round(duration / 60000)}m`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Execuções ({executions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma execução encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Automação</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Iniciado</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell className="font-medium">
                      {execution.workflow?.name || 'Automação Deletada'}
                    </TableCell>
                    <TableCell>
                      {execution.client?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(execution.status)}>
                        {getStatusIcon(execution.status)}
                        <span className="ml-1">{getStatusText(execution.status)}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDuration(execution.started_at, execution.completed_at)}
                    </TableCell>
                    <TableCell>
                      {new Date(execution.started_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedExecution(execution)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Detalhes
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Detalhes da Execução</DialogTitle>
                            <DialogDescription>
                              Informações detalhadas sobre a execução da automação
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedExecution && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-medium">Automação</h4>
                                  <p className="text-sm text-gray-600">
                                    {selectedExecution.workflow?.name || 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <h4 className="font-medium">Status</h4>
                                  <Badge className={getStatusColor(selectedExecution.status)}>
                                    {getStatusText(selectedExecution.status)}
                                  </Badge>
                                </div>
                                <div>
                                  <h4 className="font-medium">Cliente</h4>
                                  <p className="text-sm text-gray-600">
                                    {selectedExecution.client?.name || 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <h4 className="font-medium">Duração</h4>
                                  <p className="text-sm text-gray-600">
                                    {formatDuration(selectedExecution.started_at, selectedExecution.completed_at)}
                                  </p>
                                </div>
                              </div>
                              
                              {selectedExecution.error_message && (
                                <div>
                                  <h4 className="font-medium text-red-600">Erro</h4>
                                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                                    {selectedExecution.error_message}
                                  </p>
                                </div>
                              )}
                              
                              <div>
                                <h4 className="font-medium">Dados do Gatilho</h4>
                                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
                                  {JSON.stringify(selectedExecution.trigger_data, null, 2)}
                                </pre>
                              </div>
                              
                              <div>
                                <h4 className="font-medium">Dados da Execução</h4>
                                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
                                  {JSON.stringify(selectedExecution.execution_data, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}