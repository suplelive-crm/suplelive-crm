import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Clock } from 'lucide-react';

interface DelayNodeProps {
  data: {
    label: string;
    config: any;
  };
}

export const DelayNode = memo(({ data }: DelayNodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-orange-50 border-2 border-orange-200 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-orange-500"
      />
      
      <div className="flex items-center space-x-2">
        <Clock className="h-4 w-4 text-orange-600" />
        <div className="text-sm font-medium text-orange-900">{data.label}</div>
      </div>
      
      {data.config.duration && (
        <div className="text-xs text-orange-700 mt-1">
          {data.config.duration} {data.config.unit}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-orange-500"
      />
    </div>
  );
});

DelayNode.displayName = 'DelayNode';