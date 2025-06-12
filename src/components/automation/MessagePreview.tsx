import { useState } from 'react';
import { MessageSquare, Mail, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MessagePreviewProps {
  message: string;
  channel: 'whatsapp' | 'email' | 'sms';
  previewData?: Record<string, any>;
}

export function MessagePreview({ message, channel, previewData }: MessagePreviewProps) {
  // Default preview data if not provided
  const defaultData = {
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
  };

  const data = previewData || defaultData;

  const renderPreviewText = () => {
    let previewText = message;
    
    // Replace all variables with their preview values
    Object.entries(data).forEach(([category, values]) => {
      Object.entries(values).forEach(([key, val]) => {
        const regex = new RegExp(`{{${category}\\.${key}}}`, 'g');
        previewText = previewText.replace(regex, val as string);
      });
    });
    
    return previewText;
  };

  const renderWhatsAppPreview = () => {
    const previewText = renderPreviewText();
    
    return (
      <div className="max-w-xs mx-auto">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-green-600 text-white px-4 py-2 flex items-center">
            <MessageSquare className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">WhatsApp</span>
          </div>
          <div className="p-4">
            <div className="flex justify-end mb-4">
              <div className="bg-green-100 text-gray-800 rounded-lg p-3 max-w-[80%]">
                <p className="text-sm whitespace-pre-wrap">{previewText}</p>
                <div className="flex justify-end mt-1">
                  <span className="text-xs text-gray-500">12:30</span>
                  <span className="text-xs text-green-600 ml-1">✓✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEmailPreview = () => {
    const previewText = renderPreviewText();
    
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-2">
            <h3 className="text-sm font-medium">Assunto: Mensagem Automática</h3>
          </div>
          <div className="p-4">
            <p className="text-sm whitespace-pre-wrap">{previewText}</p>
            <div className="mt-4 pt-4 border-t text-xs text-gray-500">
              <p>Enviado por OmniCRM</p>
              <p>Para cancelar o recebimento, clique aqui</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSMSPreview = () => {
    const previewText = renderPreviewText();
    
    return (
      <div className="max-w-xs mx-auto">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-purple-600 text-white px-4 py-2">
            <span className="text-sm font-medium">SMS</span>
          </div>
          <div className="p-4">
            <p className="text-sm whitespace-pre-wrap">{previewText}</p>
            <div className="text-xs text-gray-500 mt-2">
              <span>Enviado: 12:30</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-100 p-4 rounded-lg">
      {channel === 'whatsapp' && renderWhatsAppPreview()}
      {channel === 'email' && renderEmailPreview()}
      {channel === 'sms' && renderSMSPreview()}
    </div>
  );
}