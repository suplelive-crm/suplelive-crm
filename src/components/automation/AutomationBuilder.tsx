import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ArrowLeft, Save, Play, Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TriggerNode } from './nodes/TriggerNode';
import { ActionNode } from './nodes/ActionNode';
import { ConditionNode } from './nodes/ConditionNode';
import { DelayNode } from './nodes/DelayNode';
import { WebhookNode } from './nodes/WebhookNode';
import { ChatbotNode } from './nodes/ChatbotNode';
import { ClassifierNode } from './nodes/ClassifierNode';
import { AgentNode } from './nodes/AgentNode';
import { NodeToolbar } from './NodeToolbar';
import { NodeConfigPanel } from './NodeConfigPanel';
import { TestAutomationDialog } from './TestAutomationDialog';
import { useAutomationStore } from '@/store/automationStore';
import { useToast } from '@/hooks/use-toast';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  delay: DelayNode,
  webhook: WebhookNode,
  chatbot: ChatbotNode,
  classifier: ClassifierNode,
  agent: AgentNode,
};

export function AutomationBuilder() {
  const {
    currentWorkflow,
    setCurrentWorkflow,
    updateWorkflow,
    updateWorkflowData,
    addNode,
    updateNode,
    deleteNode,
    addConnection,
    deleteConnection,
    executeWorkflow,
  } = useAutomationStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const { toast } = useToast();

  // Load workflow data when currentWorkflow changes
  useEffect(() => {
    if (currentWorkflow?.workflow_data) {
      const workflowNodes = (currentWorkflow.workflow_data.nodes || []).map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      }));

      const workflowEdges = (currentWorkflow.workflow_data.connections || []).map(conn => ({
        id: conn.id,
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle,
      }));

      setNodes(workflowNodes);
      setEdges(workflowEdges);
      setIsActive(currentWorkflow.status === 'active');
    }
  }, [currentWorkflow, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        id: `edge-${Date.now()}`,
        source: params.source!,
        target: params.target!,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
      };

      setEdges((eds) => addEdge(newEdge, eds));
      
      if (currentWorkflow) {
        addConnection(currentWorkflow.id, newEdge);
      }
    },
    [setEdges, currentWorkflow, addConnection]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setShowNodeConfig(true);
  }, []);

  const handleAddNode = (nodeType: string) => {
    if (!currentWorkflow) return;

    const newNode = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node`,
        config: {},
        nodeType,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    addNode(currentWorkflow.id, newNode);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!currentWorkflow) return;

    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    
    deleteNode(currentWorkflow.id, nodeId);
    
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      setShowNodeConfig(false);
    }
  };

  const handleUpdateNode = (nodeId: string, data: any) => {
    if (!currentWorkflow) return;

    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      )
    );

    updateNode(currentWorkflow.id, nodeId, { data });
  };

  const handleSaveWorkflow = async () => {
    if (!currentWorkflow) return;

    const workflowData = {
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type!,
        position: node.position,
        data: node.data,
      })),
      connections: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })),
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    await updateWorkflowData(currentWorkflow.id, workflowData);
    toast({
      title: "Automação salva",
      description: "Todas as alterações foram salvas com sucesso",
    });
  };

  const handleToggleActive = async () => {
    if (!currentWorkflow) return;
    
    const newStatus = isActive ? 'draft' : 'active';
    await updateWorkflow(currentWorkflow.id, { status: newStatus });
    setIsActive(!isActive);
    
    toast({
      title: isActive ? "Automação desativada" : "Automação ativada",
      description: isActive 
        ? "A automação não será mais executada automaticamente" 
        : "A automação será executada automaticamente quando o gatilho for acionado",
    });
  };

  const handleTestWorkflow = async () => {
    if (!currentWorkflow) return;
    
    try {
      await executeWorkflow(currentWorkflow.id);
    } catch (error) {
      console.error('Error testing workflow:', error);
    }
  };

  if (!currentWorkflow) {
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentWorkflow(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          
          <div>
            <h2 className="text-lg font-semibold">{currentWorkflow.name}</h2>
            <div className="flex items-center space-x-2">
              <Badge variant={currentWorkflow.status === 'active' ? 'default' : 'secondary'}>
                {currentWorkflow.status}
              </Badge>
              <span className="text-sm text-gray-500">
                {currentWorkflow.execution_count} execuções
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch 
              checked={isActive}
              onCheckedChange={handleToggleActive}
              id="active-status"
            />
            <Label htmlFor="active-status" className="text-sm">
              {isActive ? 'Ativo' : 'Inativo'}
            </Label>
          </div>
          
          <Button variant="outline" onClick={handleSaveWorkflow}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
          
          <TestAutomationDialog 
            workflow={currentWorkflow}
            onTest={handleTestWorkflow}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Flow Editor */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <MiniMap />
            <Background variant="dots" gap={12} size={1} />
            
            <Panel position="top-left">
              <NodeToolbar onAddNode={handleAddNode} />
            </Panel>
          </ReactFlow>
        </div>

        {/* Node Configuration Panel */}
        {showNodeConfig && selectedNode && (
          <div className="w-80 border-l border-gray-200 bg-white">
            <NodeConfigPanel
              node={selectedNode}
              onUpdate={(data) => handleUpdateNode(selectedNode.id, data)}
              onDelete={() => handleDeleteNode(selectedNode.id)}
              onClose={() => setShowNodeConfig(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}