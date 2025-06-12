import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Bot } from 'lucide-react';

interface AgentNodeProps {
  data: {
    label: string;
    config: any;
  };
}

export const AgentNode = memo(({ data }: AgentNodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-emerald-50 border-2 border-emerald-200 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-emerald-500"
      />
      
      <div className="flex items-center space-x-2">
        <Bot className="h-4 w-4 text-emerald-600" />
        <div className="text-sm font-medium text-emerald-900">{data.label}</div>
      </div>
      
      {data.config.agentName && (
        <div className="text-xs text-emerald-700 mt-1">
          {data.config.agentName}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-emerald-500"
      />
    </div>
  );
});

AgentNode.displayName = 'AgentNode';