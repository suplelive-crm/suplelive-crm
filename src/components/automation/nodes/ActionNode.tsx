import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { MessageSquare, Webhook, Move, Plus, Bot, Tag } from 'lucide-react';

interface ActionNodeProps {
  data: {
    label: string;
    config: any;
  };
}

export const ActionNode = memo(({ data }: ActionNodeProps) => {
  const getIcon = () => {
    switch (data.config.actionType) {
      case 'send_message':
        return MessageSquare;
      case 'webhook':
        return Webhook;
      case 'move_stage':
        return Move;
      case 'chatbot_response':
        return Bot;
      case 'text_classification':
        return Tag;
      default:
        return Plus;
    }
  };

  const Icon = getIcon();

  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-green-50 border-2 border-green-200 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-green-500"
      />
      
      <div className="flex items-center space-x-2">
        <Icon className="h-4 w-4 text-green-600" />
        <div className="text-sm font-medium text-green-900">{data.label}</div>
      </div>
      
      {data.config.actionType && (
        <div className="text-xs text-green-700 mt-1">
          {data.config.actionType.replace('_', ' ')}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500"
      />
    </div>
  );
});

ActionNode.displayName = 'ActionNode';