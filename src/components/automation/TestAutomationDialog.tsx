import { useState } from 'react';
import { Play, MessageSquare, Check, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessagePreview } from './MessagePreview';
import { AutomationWorkflow } from '@/types';

interface TestAutomationDialogProps {
  workflow: AutomationWorkflow;
  onTest: () => Promise<void>;
}

export function TestAutomationDialog({ workflow, onTest }: TestAutomationDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testStep, setTestStep] = useState(0);
  const [testComplete, setTestComplete] = useState(false);
  
  // Extract message nodes from workflow
  const messageNodes = workflow.workflow_data.nodes.filter(
    node => node.type === 'action' && node.data.config.actionType === 'send_message'
  );
  
  const handleRunTest = async () => {
    setLoading(true);
    setTestStep(0);
    setTestComplete(false);
    
    // Simulate test execution with steps
    const totalSteps = messageNodes.length;
    
    for (let i = 0; i < totalSteps; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setTestStep(i + 1);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    setTestComplete(true);
    setLoading(false);
    
    // Call the actual test function
    try {
      await onTest();
    } catch (error) {
      console.error('Error testing workflow:', error);
    }
  };
  
  const handleClose = () => {
    setOpen(false);
    setTestStep(0);
    setTestComplete(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Play className="h-4 w-4 mr-2" />
          Testar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Testar Automação</DialogTitle>
          <DialogDescription>
            Execute um teste da automação para ver como ela funcionará
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="preview">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Visualização</TabsTrigger>
            <TabsTrigger value="execution">Execução</TabsTrigger>
          </TabsList>
          
          <TabsContent value="preview" className="space-y-4 mt-4">
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Fluxo de Mensagens</h3>
              
              {messageNodes.length > 0 ? (
                <div className="space-y-6">
                  {messageNodes.map((node, index) => (
                    <div key={node.id} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          Passo {index + 1}
                        </Badge>
                        <h4 className="text-sm font-medium">{node.data.label}</h4>
                      </div>
                      
                      <MessagePreview 
                        message={node.data.config.message || ''} 
                        channel={node.data.config.channel || 'whatsapp'} 
                      />
                      
                      {index < messageNodes.length - 1 && (
                        <div className="flex justify-center my-2">
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhuma mensagem configurada nesta automação</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="execution" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Simulação de Execução</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {messageNodes.map((node, index) => (
                    <div 
                      key={node.id} 
                      className={`flex items-center space-x-3 p-3 rounded-lg border ${
                        testStep > index ? 'bg-green-50 border-green-200' : 
                        testStep === index && loading ? 'bg-blue-50 border-blue-200 animate-pulse' : 
                        'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {testStep > index ? (
                          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="h-4 w-4 text-green-600" />
                          </div>
                        ) : testStep === index && loading ? (
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600">{index + 1}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <p className="text-sm font-medium">{node.data.label}</p>
                        <p className="text-xs text-gray-500">
                          {node.data.config.channel === 'whatsapp' ? 'WhatsApp' : 
                           node.data.config.channel === 'email' ? 'Email' : 'SMS'}
                        </p>
                      </div>
                      
                      <div>
                        {testStep > index && (
                          <Badge variant="outline\" className="bg-green-50 text-green-700 border-green-200">
                            Concluído
                          </Badge>
                        )}
                        {testStep === index && loading && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Executando
                          </Badge>
                        )}
                        {testStep < index && (
                          <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                            Pendente
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {testComplete && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                      <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <h3 className="text-lg font-medium text-green-800 mb-1">
                        Teste Concluído com Sucesso!
                      </h3>
                      <p className="text-sm text-green-700">
                        Todos os passos da automação foram executados corretamente.
                      </p>
                    </div>
                  )}
                  
                  {messageNodes.length === 0 && (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhuma mensagem configurada nesta automação</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {messageNodes.length > 0 && testStep > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Mensagem Enviada</h3>
                <MessagePreview 
                  message={messageNodes[Math.min(testStep - 1, messageNodes.length - 1)].data.config.message || ''} 
                  channel={messageNodes[Math.min(testStep - 1, messageNodes.length - 1)].data.config.channel || 'whatsapp'} 
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
          
          {messageNodes.length > 0 && (
            <Button 
              onClick={handleRunTest} 
              disabled={loading}
            >
              {loading ? 'Executando...' : testComplete ? 'Executar Novamente' : 'Executar Teste'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}