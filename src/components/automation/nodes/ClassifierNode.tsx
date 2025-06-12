import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Tag } from 'lucide-react';

interface ClassifierNodeProps {
  data: {
    label: string;
    config: any;
  };
}

export const ClassifierNode = memo(({ data }: ClassifierNodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-pink-50 border-2 border-pink-200 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-pink-500"
      />
      
      <div className="flex items-center space-x-2">
        <Tag className="h-4 w-4 text-pink-600" />
        <div className="text-sm font-medium text-pink-900">{data.label}</div>
      </div>
      
      {data.config.categories && (
        <div className="text-xs text-pink-700 mt-1">
          {typeof data.config.categories === 'string' 
            ? data.config.categories.split(',').slice(0, 3).join(', ') + (data.config.categories.split(',').length > 3 ? '...' : '')
            : 'Classificador de texto'}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-pink-500"
      />
    </div>
  );
});

ClassifierNode.displayName = 'ClassifierNode';