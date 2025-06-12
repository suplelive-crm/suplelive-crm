import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Webhook } from 'lucide-react';

interface WebhookNodeProps {
  data: {
    label: string;
    config: any;
  };
}

export const WebhookNode = memo(({ data }: WebhookNodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-indigo-50 border-2 border-indigo-200 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-indigo-500"
      />
      
      <div className="flex items-center space-x-2">
        <Webhook className="h-4 w-4 text-indigo-600" />
        <div className="text-sm font-medium text-indigo-900">{data.label}</div>
      </div>
      
      {data.config.url && (
        <div className="text-xs text-indigo-700 mt-1 truncate max-w-[200px]">
          {data.config.url}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-indigo-500"
      />
    </div>
  );
});

WebhookNode.displayName = 'WebhookNode';