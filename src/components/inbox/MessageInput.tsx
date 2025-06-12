import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Paperclip, Image, Video, Mic, FileText, Smile, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onSendMedia: (url: string, type: 'image' | 'video' | 'audio' | 'document', caption?: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ 
  value, 
  onChange, 
  onSend, 
  onSendMedia, 
  disabled = false,
  placeholder = "Digite sua mensagem..."
}: MessageInputProps) {
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'document'>('image');
  const [mediaCaption, setMediaCaption] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const emojis = ['😀', '😊', '👍', '❤️', '🙏', '👋', '🔥', '✅', '⭐', '🎉', '🤔', '👀', '💯', '🙌', '👏', '🤝', '💪', '🚀'];

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend();
      }
    }
  };

  const handleSendMedia = () => {
    if (mediaUrl.trim()) {
      onSendMedia(mediaUrl, mediaType, mediaCaption);
      setMediaUrl('');
      setMediaCaption('');
      setMediaDialogOpen(false);
    }
  };

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleBlur = () => {
    if (!value) {
      setIsExpanded(false);
    }
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <Mic className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-4 border-t bg-background">
      <div className="flex flex-col space-y-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            "min-h-[40px] max-h-32 resize-none transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-primary",
            isExpanded ? "min-h-[80px]" : "min-h-[40px]"
          )}
          disabled={disabled}
        />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {/* Attachment Menu */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" disabled={disabled} className="text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2">
                <div className="grid grid-cols-2 gap-1">
                  <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="justify-start">
                        <Image className="h-4 w-4 mr-2" />
                        Imagem
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Enviar Mídia</DialogTitle>
                        <DialogDescription>
                          Envie uma imagem, vídeo, áudio ou documento
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div>
                          <Label htmlFor="mediaType">Tipo de Mídia</Label>
                          <Select value={mediaType} onValueChange={(value: any) => setMediaType(value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="image">
                                <div className="flex items-center">
                                  <Image className="h-4 w-4 mr-2" />
                                  Imagem
                                </div>
                              </SelectItem>
                              <SelectItem value="video">
                                <div className="flex items-center">
                                  <Video className="h-4 w-4 mr-2" />
                                  Vídeo
                                </div>
                              </SelectItem>
                              <SelectItem value="audio">
                                <div className="flex items-center">
                                  <Mic className="h-4 w-4 mr-2" />
                                  Áudio
                                </div>
                              </SelectItem>
                              <SelectItem value="document">
                                <div className="flex items-center">
                                  <FileText className="h-4 w-4 mr-2" />
                                  Documento
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="mediaUrl">URL da Mídia</Label>
                          <Input
                            id="mediaUrl"
                            value={mediaUrl}
                            onChange={(e) => setMediaUrl(e.target.value)}
                            placeholder="https://exemplo.com/arquivo.jpg"
                          />
                        </div>
                        <div>
                          <Label htmlFor="mediaCaption">Legenda (Opcional)</Label>
                          <Textarea
                            id="mediaCaption"
                            value={mediaCaption}
                            onChange={(e) => setMediaCaption(e.target.value)}
                            placeholder="Digite uma legenda para a mídia..."
                            rows={2}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setMediaDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSendMedia} disabled={!mediaUrl.trim()}>
                          {getMediaIcon(mediaType)}
                          <span className="ml-2">
                            Enviar {
                              mediaType === 'image' ? 'Imagem' : 
                              mediaType === 'video' ? 'Vídeo' : 
                              mediaType === 'audio' ? 'Áudio' : 'Documento'
                            }
                          </span>
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Button variant="ghost" size="sm" className="justify-start" onClick={() => {
                    setMediaType('video');
                    setMediaDialogOpen(true);
                  }}>
                    <Video className="h-4 w-4 mr-2" />
                    Vídeo
                  </Button>
                  
                  <Button variant="ghost" size="sm" className="justify-start" onClick={() => {
                    setMediaType('audio');
                    setMediaDialogOpen(true);
                  }}>
                    <Mic className="h-4 w-4 mr-2" />
                    Áudio
                  </Button>
                  
                  <Button variant="ghost" size="sm" className="justify-start" onClick={() => {
                    setMediaType('document');
                    setMediaDialogOpen(true);
                  }}>
                    <FileText className="h-4 w-4 mr-2" />
                    Documento
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Emoji Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" disabled={disabled} className="text-muted-foreground hover:text-foreground">
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2">
                <div className="grid grid-cols-6 gap-1">
                  {emojis.map((emoji) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => onChange(value + emoji)}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Send Button */}
          <Button 
            onClick={onSend} 
            disabled={!value.trim() || disabled}
            size="sm"
            className={cn(
              "transition-all",
              value.trim() ? "opacity-100" : "opacity-70"
            )}
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </Button>
        </div>
      </div>
      
      {disabled && (
        <div className="mt-2 text-center">
          <p className="text-sm text-muted-foreground">
            Conecte uma instância WhatsApp nas Integrações para enviar mensagens
          </p>
        </div>
      )}
    </div>
  );
}