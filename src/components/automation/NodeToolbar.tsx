import { Zap, MessageSquare, GitBranch, Clock, Webhook, Play, Bot, Tag, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NodeToolbarProps {
  onAddNode: (nodeType: string) => void;
}

const nodeTypes = [
  {
    type: 'trigger',
    label: 'Gatilho',
    icon: Zap,
    description: 'Inicia a automação',
    color: 'text-blue-600',
  },
  {
    type: 'action',
    label: 'Ação',
    icon: MessageSquare,
    description: 'Executa uma ação',
    color: 'text-green-600',
  },
  {
    type: 'condition',
    label: 'Condição',
    icon: GitBranch,
    description: 'Adiciona lógica condicional',
    color: 'text-purple-600',
  },
  {
    type: 'delay',
    label: 'Delay',
    icon: Clock,
    description: 'Adiciona um atraso',
    color: 'text-orange-600',
  },
  {
    type: 'webhook',
    label: 'Webhook',
    icon: Webhook,
    description: 'Integração com serviços externos',
    color: 'text-indigo-600',
  },
  {
    type: 'chatbot',
    label: 'Chatbot',
    icon: Bot,
    description: 'Resposta inteligente com IA',
    color: 'text-cyan-600',
  },
  {
    type: 'classifier',
    label: 'Classificador',
    icon: Tag,
    description: 'Classifica texto com IA',
    color: 'text-pink-600',
  },
  {
    type: 'agent',
    label: 'Agente IA',
    icon: User,
    description: 'Resposta com perfil de agente',
    color: 'text-emerald-600',
  },
];

export function NodeToolbar({ onAddNode }: NodeToolbarProps) {
  return (
    <Card className="w-64">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Adicionar Nó</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <TooltipProvider>
          {nodeTypes.map((nodeType) => {
            const Icon = nodeType.icon;
            return (
              <Tooltip key={nodeType.type}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => onAddNode(nodeType.type)}
                  >
                    <Icon className={`h-4 w-4 mr-2 ${nodeType.color}`} />
                    {nodeType.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{nodeType.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}