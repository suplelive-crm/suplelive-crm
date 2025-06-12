import { useState } from 'react';
import { Code, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VariableSelectorProps {
  onSelect: (variable: string) => void;
}

interface Variable {
  name: string;
  description: string;
  example: string;
  code: string;
  category: string;
}

export function VariableSelector({ onSelect }: VariableSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const variables: Variable[] = [
    // Cliente
    { 
      name: 'Nome do Cliente', 
      description: 'Nome completo do cliente', 
      example: 'João Silva', 
      code: '{{client.name}}',
      category: 'Cliente'
    },
    { 
      name: 'Email do Cliente', 
      description: 'Endereço de email do cliente', 
      example: 'joao.silva@exemplo.com', 
      code: '{{client.email}}',
      category: 'Cliente'
    },
    { 
      name: 'Telefone do Cliente', 
      description: 'Número de telefone do cliente', 
      example: '(11) 98765-4321', 
      code: '{{client.phone}}',
      category: 'Cliente'
    },
    
    // Kanban
    { 
      name: 'Nome da Fase', 
      description: 'Nome da fase atual no Kanban', 
      example: 'Qualificado', 
      code: '{{stage.name}}',
      category: 'Kanban'
    },
    { 
      name: 'Cor da Fase', 
      description: 'Cor da fase atual no Kanban', 
      example: '#10b981', 
      code: '{{stage.color}}',
      category: 'Kanban'
    },
    
    // Lead
    { 
      name: 'Status do Lead', 
      description: 'Status atual do lead', 
      example: 'qualified', 
      code: '{{lead.status}}',
      category: 'Lead'
    },
    { 
      name: 'Origem do Lead', 
      description: 'Origem do lead', 
      example: 'website', 
      code: '{{lead.source}}',
      category: 'Lead'
    },
    
    // Mensagem
    { 
      name: 'Conteúdo da Mensagem', 
      description: 'Conteúdo da mensagem recebida', 
      example: 'Olá, gostaria de mais informações', 
      code: '{{message.content}}',
      category: 'Mensagem'
    },
    
    // Empresa
    { 
      name: 'Nome da Empresa', 
      description: 'Nome da sua empresa', 
      example: 'Minha Empresa', 
      code: '{{company.name}}',
      category: 'Empresa'
    },
    { 
      name: 'Telefone da Empresa', 
      description: 'Telefone de contato da empresa', 
      example: '(11) 3333-4444', 
      code: '{{company.phone}}',
      category: 'Empresa'
    },
    
    // Data e Hora
    { 
      name: 'Data Atual', 
      description: 'Data atual no formato DD/MM/AAAA', 
      example: '01/06/2025', 
      code: '{{date.today}}',
      category: 'Data e Hora'
    },
    { 
      name: 'Hora Atual', 
      description: 'Hora atual no formato HH:MM', 
      example: '14:30', 
      code: '{{date.time}}',
      category: 'Data e Hora'
    },
  ];

  const filteredVariables = variables.filter(variable => 
    variable.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    variable.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    variable.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    variable.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group variables by category
  const groupedVariables: Record<string, Variable[]> = {};
  filteredVariables.forEach(variable => {
    if (!groupedVariables[variable.category]) {
      groupedVariables[variable.category] = [];
    }
    groupedVariables[variable.category].push(variable);
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Code className="h-4 w-4 mr-2" />
          Inserir Variável
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar variáveis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <ScrollArea className="h-60">
            <div className="space-y-4">
              {Object.entries(groupedVariables).map(([category, vars]) => (
                <div key={category}>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">{category}</h4>
                  <div className="space-y-2">
                    {vars.map((variable) => (
                      <Card 
                        key={variable.code} 
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => onSelect(variable.code)}
                      >
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{variable.name}</p>
                              <p className="text-xs text-gray-500">{variable.description}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {variable.code}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            <span className="font-medium">Exemplo:</span> {variable.example}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
              
              {filteredVariables.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">Nenhuma variável encontrada</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}