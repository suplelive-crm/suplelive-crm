import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Phone, Mail, Tag, Plus, Edit2, Save, X, Calendar, MapPin, Building, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Client } from '@/types';
import { useCrmStore } from '@/store/crmStore';

interface ContactInfoPanelProps {
  client: Client | null;
  onClose: () => void;
}

interface EditingState {
  contact: boolean;
  tags: boolean;
  details: boolean;
  notes: boolean;
}

export function ContactInfoPanel({ client, onClose }: ContactInfoPanelProps) {
  const [editing, setEditing] = useState<EditingState>({
    contact: false,
    tags: false,
    details: false,
    notes: false,
  });
  
  const [contactData, setContactData] = useState({
    name: client?.name || '',
    phone: client?.phone || '',
    email: client?.email || '',
  });
  
  const [newTag, setNewTag] = useState('');
  const [tags, setTags] = useState<string[]>(client?.tags || []);
  
  const [detailsData, setDetailsData] = useState({
    company: '',
    position: '',
    address: '',
  });
  
  const [notes, setNotes] = useState('');
  
  const { updateClient } = useCrmStore();

  if (!client) return null;

  const handleSaveContact = async () => {
    try {
      await updateClient(client.id, {
        name: contactData.name,
        phone: contactData.phone,
        email: contactData.email,
      });
      setEditing({ ...editing, contact: false });
    } catch (error) {
      console.error('Error updating contact:', error);
    }
  };

  const handleSaveTags = async () => {
    try {
      await updateClient(client.id, { tags });
      setEditing({ ...editing, tags: false });
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="w-80 border-l border-gray-200 bg-white flex flex-col"
    >
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Informações do Contato</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Avatar e Nome */}
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <User className="h-10 w-10 text-blue-600" />
          </div>
          <h4 className="text-lg font-semibold">{client.name}</h4>
        </div>

        {/* Informações de Contato */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Contato</CardTitle>
              {!editing.contact ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, contact: true })}>
                  <Edit2 className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm" onClick={handleSaveContact}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, contact: false })}>
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-500" />
              {editing.contact ? (
                <Input
                  value={contactData.name}
                  onChange={(e) => setContactData({ ...contactData, name: e.target.value })}
                  placeholder="Nome"
                  className="text-sm"
                />
              ) : (
                <span className="text-sm">{client.name}</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-gray-500" />
              {editing.contact ? (
                <Input
                  value={contactData.phone}
                  onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                  placeholder="Telefone"
                  className="text-sm"
                />
              ) : (
                <span className="text-sm">{client.phone || 'Não informado'}</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-gray-500" />
              {editing.contact ? (
                <Input
                  value={contactData.email}
                  onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                  placeholder="Email"
                  className="text-sm"
                />
              ) : (
                <span className="text-sm">{client.email || 'Não informado'}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Tags</CardTitle>
              {!editing.tags ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, tags: true })}>
                  <Edit2 className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm" onClick={handleSaveTags}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, tags: false })}>
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                  {editing.tags && (
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            {editing.tags && (
              <div className="flex space-x-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Nova tag"
                  className="text-sm"
                  onKeyPress={(e) => handleKeyPress(e, handleAddTag)}
                />
                <Button size="sm" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalhes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Detalhes</CardTitle>
              {!editing.details ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, details: true })}>
                  <Edit2 className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, details: false })}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, details: false })}>
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2">
              <Building className="h-4 w-4 text-gray-500" />
              {editing.details ? (
                <Input
                  value={detailsData.company}
                  onChange={(e) => setDetailsData({ ...detailsData, company: e.target.value })}
                  placeholder="Empresa"
                  className="text-sm"
                />
              ) : (
                <span className="text-sm">{detailsData.company || 'Não informado'}</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-500" />
              {editing.details ? (
                <Input
                  value={detailsData.position}
                  onChange={(e) => setDetailsData({ ...detailsData, position: e.target.value })}
                  placeholder="Cargo"
                  className="text-sm"
                />
              ) : (
                <span className="text-sm">{detailsData.position || 'Não informado'}</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              {editing.details ? (
                <Input
                  value={detailsData.address}
                  onChange={(e) => setDetailsData({ ...detailsData, address: e.target.value })}
                  placeholder="Endereço"
                  className="text-sm"
                />
              ) : (
                <span className="text-sm">{detailsData.address || 'Não informado'}</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm">
                Cliente desde: {new Date(client.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Estatísticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total de Pedidos:</span>
              <span className="font-medium">{client.total_orders || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total Gasto:</span>
              <span className="font-medium">R$ {(client.total_spent || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Último Pedido:</span>
              <span className="font-medium">
                {client.last_order_date 
                  ? new Date(client.last_order_date).toLocaleDateString('pt-BR')
                  : 'Nunca'
                }
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Notas */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Notas</CardTitle>
              {!editing.notes ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, notes: true })}>
                  <Edit2 className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, notes: false })}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, notes: false })}>
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editing.notes ? (
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione notas sobre este contato..."
                rows={3}
                className="text-sm"
              />
            ) : (
              <p className="text-sm text-gray-600">
                {notes || 'Nenhuma nota adicionada'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}