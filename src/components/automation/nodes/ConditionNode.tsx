import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';

interface ConditionNodeProps {
  data: {
    label: string;
    config: any;
  };
}

export const ConditionNode = memo(({ data }: ConditionNodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-purple-50 border-2 border-purple-200 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-500"
      />
      
      <div className="flex items-center space-x-2">
        <GitBranch className="h-4 w-4 text-purple-600" />
        <div className="text-sm font-medium text-purple-900">{data.label}</div>
      </div>
      
      {data.config.field && (
        <div className="text-xs text-purple-700 mt-1">
          {data.config.field} {data.config.operator} {data.config.value}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '30%' }}
        className="w-3 h-3 bg-green-500"
      />
      
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '70%' }}
        className="w-3 h-3 bg-red-500"
      />
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';