import { useState, useEffect } from 'react';
import { MessageSquare, Eye, Code, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VariableSelector } from './VariableSelector';
import { MessagePreview } from './MessagePreview';

interface MessageEditorProps {
  value: string;
  onChange: (value: string) => void;
  channel: 'whatsapp' | 'email' | 'sms';
}

export function MessageEditor({ value, onChange, channel }: MessageEditorProps) {
  const [previewData, setPreviewData] = useState({
    client: {
      name: 'João Silva',
      email: 'joao.silva@exemplo.com',
      phone: '(11) 98765-4321',
    },
    stage: {
      name: 'Qualificado',
      color: '#10b981',
    },
    lead: {
      status: 'qualified',
      source: 'website',
    },
    message: {
      content: 'Olá, gostaria de mais informações',
    },
  });

  const handleInsertVariable = (variable: string) => {
    onChange(value + variable);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Mensagem</Label>
        <div className="flex items-center space-x-2">
          <VariableSelector onSelect={handleInsertVariable} />
        </div>
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite sua mensagem... Use variáveis como {{client.name}} para personalizar"
        rows={6}
      />

      <Tabs defaultValue="preview">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="variables">
            <Code className="h-4 w-4 mr-2" />
            Variáveis Usadas
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="preview" className="mt-2">
          <MessagePreview 
            message={value} 
            channel={channel} 
            previewData={previewData}
          />
        </TabsContent>
        
        <TabsContent value="variables" className="mt-2">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Variáveis Disponíveis</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white p-2 rounded border">
                <div>
                  <p className="text-sm font-medium">Nome do Cliente</p>
                  <p className="text-xs text-gray-500">{"{{client.name}}"}</p>
                </div>
                <div className="text-xs text-gray-600">
                  Valor: <span className="font-medium">João Silva</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-white p-2 rounded border">
                <div>
                  <p className="text-sm font-medium">Email do Cliente</p>
                  <p className="text-xs text-gray-500">{"{{client.email}}"}</p>
                </div>
                <div className="text-xs text-gray-600">
                  Valor: <span className="font-medium">joao.silva@exemplo.com</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-white p-2 rounded border">
                <div>
                  <p className="text-sm font-medium">Telefone do Cliente</p>
                  <p className="text-xs text-gray-500">{"{{client.phone}}"}</p>
                </div>
                <div className="text-xs text-gray-600">
                  Valor: <span className="font-medium">(11) 98765-4321</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-white p-2 rounded border">
                <div>
                  <p className="text-sm font-medium">Nome da Fase</p>
                  <p className="text-xs text-gray-500">{"{{stage.name}}"}</p>
                </div>
                <div className="text-xs text-gray-600">
                  Valor: <span className="font-medium">Qualificado</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-gray-500">
        <p>Dicas:</p>
        <ul className="list-disc pl-4 space-y-1 mt-1">
          <li>Use <code>{"{"}{"{"}{`client.name`}{"}"}{"}"}</code> para inserir o nome do cliente</li>
          <li>Pressione Enter para quebrar linhas</li>
          <li>Emojis são suportados 👍</li>
        </ul>
      </div>
    </div>
  );
}