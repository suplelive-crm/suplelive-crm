import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Bot } from 'lucide-react';

interface ChatbotNodeProps {
  data: {
    label: string;
    config: any;
  };
}

export const ChatbotNode = memo(({ data }: ChatbotNodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-cyan-50 border-2 border-cyan-200 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-cyan-500"
      />
      
      <div className="flex items-center space-x-2">
        <Bot className="h-4 w-4 text-cyan-600" />
        <div className="text-sm font-medium text-cyan-900">{data.label}</div>
      </div>
      
      {data.config.model && (
        <div className="text-xs text-cyan-700 mt-1">
          {data.config.model}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-cyan-500"
      />
    </div>
  );
});

ChatbotNode.displayName = 'ChatbotNode';