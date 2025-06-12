import { useState } from 'react';
import { Download, Play, Pause, Volume2, Check, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Message } from '@/types';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Check className="h-3 w-3" />;
      case 'delivered': return <Check className="h-3 w-3" />;
      case 'read': return <Check className="h-3 w-3 text-blue-500" />;
      case 'failed': return <AlertCircle className="h-3 w-3 text-red-500" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent': return 'Enviado';
      case 'delivered': return 'Entregue';
      case 'read': return 'Lido';
      case 'failed': return 'Falhou';
      case 'pending': return 'Pendente';
      default: return status;
    }
  };

  const renderMediaContent = () => {
    const metadata = message.metadata || {};
    
    if (message.content.includes('[Imagem]') || metadata.mediaType === 'image') {
      return (
        <div className="mb-2">
          {metadata.mediaUrl ? (
            <img 
              src={metadata.mediaUrl} 
              alt="Imagem" 
              className="max-w-xs rounded-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-48 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-gray-500 text-sm">Imagem</span>
            </div>
          )}
        </div>
      );
    }

    if (message.content.includes('[Vídeo]') || metadata.mediaType === 'video') {
      return (
        <div className="mb-2">
          {metadata.mediaUrl ? (
            <video 
              src={metadata.mediaUrl} 
              controls 
              className="max-w-xs rounded-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-48 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
              <Play className="h-8 w-8 text-gray-500" />
            </div>
          )}
        </div>
      );
    }

    if (message.content.includes('[Áudio]') || metadata.mediaType === 'audio') {
      return (
        <div className="mb-2 flex items-center space-x-2 p-2 bg-gray-100 rounded-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Volume2 className="h-4 w-4 text-gray-500" />
          <div className="flex-1 h-1 bg-gray-300 rounded">
            <div className="h-1 bg-primary rounded w-1/3"></div>
          </div>
          <span className="text-xs text-gray-500">0:30</span>
        </div>
      );
    }

    if (message.content.includes('[Documento]') || metadata.mediaType === 'document') {
      const fileName = message.content.match(/\[Documento: (.+)\]/)?.[1] || 'documento';
      return (
        <div className="mb-2 flex items-center space-x-2 p-2 bg-gray-100 rounded-lg">
          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
            <span className="text-xs font-bold text-blue-600">DOC</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{fileName}</p>
            <p className="text-xs text-gray-500">Documento</p>
          </div>
          <Button variant="ghost" size="sm">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return null;
  };

  const hasMedia = message.content.includes('[') && message.content.includes(']');
  const textContent = hasMedia ? 
    message.content.replace(/\[.*?\]/g, '').trim() : 
    message.content;

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={cn(
          "max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-sm",
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {/* Media Content */}
        {renderMediaContent()}
        
        {/* Text Content */}
        {textContent && (
          <p className="text-sm whitespace-pre-wrap">{textContent}</p>
        )}
        
        {/* Message Info */}
        <div className="flex items-center justify-between mt-1">
          <p className={cn(
            "text-xs",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {formatTime(message.timestamp)}
          </p>
          
          {isOwn && (
            <div className="flex items-center space-x-1">
              {message.send_type === 'automated' && (
                <Badge variant="outline" className="text-xs bg-primary/20 text-primary-foreground border-primary/30">
                  Auto
                </Badge>
              )}
              <div className="flex items-center" title={getStatusText(message.status)}>
                {getStatusIcon(message.status)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}