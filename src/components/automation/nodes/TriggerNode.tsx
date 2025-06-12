import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Zap, MessageSquare, Bot } from 'lucide-react';

interface TriggerNodeProps {
  data: {
    label: string;
    config: any;
  };
}

export const TriggerNode = memo(({ data }: TriggerNodeProps) => {
  const getIcon = () => {
    switch (data.config.triggerType) {
      case 'message_received':
        return MessageSquare;
      case 'chatbot':
        return Bot;
      default:
        return Zap;
    }
  };

  const Icon = getIcon();

  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-blue-50 border-2 border-blue-200 min-w-[150px]">
      <div className="flex items-center space-x-2">
        <Icon className="h-4 w-4 text-blue-600" />
        <div className="text-sm font-medium text-blue-900">{data.label}</div>
      </div>
      
      {data.config.triggerType && (
        <div className="text-xs text-blue-700 mt-1">
          {data.config.triggerType.replace('_', ' ')}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500"
      />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';