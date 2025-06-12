import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Phone, Mail, MessageSquare, Plus, RefreshCw, Info, Filter, Archive, MoreVertical, CheckCircle, XCircle, Clock } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ContactInfoPanel } from '@/components/inbox/ContactInfoPanel';
import { MessageInput } from '@/components/inbox/MessageInput';
import { MessageBubble } from '@/components/inbox/MessageBubble';
import { SectorSelector } from '@/components/inbox/SectorSelector';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useConversationStore } from '@/store/conversationStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useCrmStore } from '@/store/crmStore';
import { useSectorStore } from '@/store/sectorStore';

export function InboxPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedChannelType, setSelectedChannelType] = useState('whatsapp');
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  
  const { 
    conversations, 
    activeConversation, 
    messages, 
    loading,
    fetchConversations,
    setActiveConversation,
    sendMessage,
    createConversation,
    updateConversationStatus
  } = useConversationStore();
  
  const { whatsappInstances, sendWhatsAppMedia } = useWorkspaceStore();
  const { clients, fetchClients } = useCrmStore();
  const { sectors, fetchSectors } = useSectorStore();

  useEffect(() => {
    fetchConversations();
    fetchClients();
    fetchSectors();
    
    // Set up auto-refresh for conversations every 30 seconds
    const interval = setInterval(() => {
      fetchConversations();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchConversations, fetchClients, fetchSectors]);

  const filteredConversations = conversations.filter(conversation => {
    const matchesSearch = conversation.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         conversation.channel_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || conversation.status === statusFilter;
    const matchesSector = sectorFilter === 'all' || conversation.sector_id === sectorFilter;
    return matchesSearch && matchesStatus && matchesSector;
  });

  const handleSendMessage = async () => {
    if (!activeConversation || !messageText.trim()) return;

    try {
      await sendMessage(activeConversation.id, messageText);
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSendMedia = async (url: string, type: 'image' | 'video' | 'audio' | 'document', caption?: string) => {
    if (!activeConversation) return;

    try {
      // Send media via WhatsApp if it's a WhatsApp conversation
      if (activeConversation.channel_type === 'whatsapp' && activeConversation.client?.phone) {
        const connectedInstance = whatsappInstances.find(i => i.status === 'connected');
        if (connectedInstance) {
          await sendWhatsAppMedia(connectedInstance.id, activeConversation.client.phone, url, type, caption);
        }
      }

      // Also save as message in database
      const content = caption ? `[${type.charAt(0).toUpperCase() + type.slice(1)}] ${caption}` : `[${type.charAt(0).toUpperCase() + type.slice(1)}]`;
      await sendMessage(activeConversation.id, content);
    } catch (error) {
      console.error('Error sending media:', error);
    }
  };

  const handleCreateConversation = async () => {
    if (!selectedClient || !selectedChannelType) return;

    try {
      const conversation = await createConversation(selectedClient, selectedChannelType);
      if (conversation) {
        setActiveConversation(conversation);
        setNewConversationOpen(false);
        setSelectedClient('');
        setSelectedChannelType('whatsapp');
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleRefreshConversations = () => {
    fetchConversations();
  };

  const handleUpdateStatus = async (status: 'open' | 'closed' | 'pending') => {
    if (!activeConversation) return;
    await updateConversationStatus(activeConversation.id, status);
  };

  const getChannelIcon = (channelType: string) => {
    switch (channelType) {
      case 'whatsapp': return MessageSquare;
      case 'email': return Mail;
      case 'phone': return Phone;
      default: return MessageSquare;
    }
  };

  const getChannelColor = (channelType: string) => {
    switch (channelType) {
      case 'whatsapp': return 'bg-green-100 text-green-800';
      case 'email': return 'bg-blue-100 text-blue-800';
      case 'phone': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'closed': return <XCircle className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const connectedWhatsAppInstances = whatsappInstances.filter(i => i.status === 'connected');

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-full flex"
        >
          {/* Conversations Sidebar */}
          <div className="w-80 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshConversations}
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Nova
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nova Conversa</DialogTitle>
                        <DialogDescription>
                          Inicie uma nova conversa com um cliente
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="client">Cliente</Label>
                          <Select value={selectedClient} onValueChange={setSelectedClient}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um cliente" />
                            </SelectTrigger>
                            <SelectContent>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name} {client.phone && `(${client.phone})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="channel">Canal</Label>
                          <Select value={selectedChannelType} onValueChange={setSelectedChannelType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="whatsapp">
                                <div className="flex items-center">
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  WhatsApp
                                </div>
                              </SelectItem>
                              <SelectItem value="email">
                                <div className="flex items-center">
                                  <Mail className="h-4 w-4 mr-2" />
                                  Email
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          onClick={handleCreateConversation}
                          disabled={!selectedClient || !selectedChannelType}
                        >
                          Criar Conversa
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              
              {connectedWhatsAppInstances.length === 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Conecte uma instância WhatsApp nas Integrações para enviar mensagens
                  </p>
                </div>
              )}
              
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar conversas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        Filtros
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="open">Aberto</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="closed">Fechado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Setor</Label>
                          <Select value={sectorFilter} onValueChange={setSectorFilter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos os Setores</SelectItem>
                              {sectors.map((sector) => (
                                <SelectItem key={sector.id} value={sector.id}>
                                  <div className="flex items-center">
                                    <div 
                                      className="w-3 h-3 rounded-full mr-2" 
                                      style={{ backgroundColor: sector.color }}
                                    />
                                    {sector.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2">
                {filteredConversations.map((conversation) => {
                  const ChannelIcon = getChannelIcon(conversation.channel_type);
                  const isActive = activeConversation?.id === conversation.id;

                  return (
                    <Card
                      key={conversation.id}
                      className={`mb-2 cursor-pointer transition-colors ${
                        isActive ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setActiveConversation(conversation)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start space-x-3">
                          <Avatar>
                            <AvatarFallback>
                              {conversation.client?.name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-gray-900 truncate">
                                {conversation.client?.name || 'Contato Desconhecido'}
                              </h3>
                              <div className="flex items-center space-x-1">
                                {conversation.unread_count > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {conversation.unread_count}
                                  </Badge>
                                )}
                                <span className="text-xs text-gray-500">
                                  {formatTime(conversation.last_message_at)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge className={`text-xs ${getChannelColor(conversation.channel_type)}`}>
                                <ChannelIcon className="h-3 w-3 mr-1" />
                                {conversation.channel_type}
                              </Badge>
                              <Badge variant="outline" className={`text-xs ${getStatusColor(conversation.status)}`}>
                                {conversation.status}
                              </Badge>
                              
                              {conversation.sector && (
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: conversation.sector.color }}
                                  title={conversation.sector.name}
                                />
                              )}
                            </div>
                            {conversation.client?.phone && (
                              <p className="text-xs text-gray-500 mt-1">
                                {conversation.client.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {filteredConversations.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhuma conversa encontrada</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col ${showContactInfo ? '' : 'mr-0'}`}>
            {activeConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>
                          {activeConversation.client?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {activeConversation.client?.name || 'Contato Desconhecido'}
                        </h2>
                        <div className="flex items-center space-x-2">
                          <Badge className={`text-xs ${getChannelColor(activeConversation.channel_type)}`}>
                            {activeConversation.channel_type}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getStatusColor(activeConversation.status)}`}
                          >
                            {getStatusIcon(activeConversation.status)}
                            <span className="ml-1">{activeConversation.status}</span>
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {activeConversation.client?.phone || activeConversation.client?.email}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <SectorSelector />
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setShowContactInfo(!showContactInfo)}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                          <div className="space-y-1">
                            {activeConversation.status === 'open' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full justify-start"
                                onClick={() => handleUpdateStatus('pending')}
                              >
                                <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                                Marcar Pendente
                              </Button>
                            )}
                            
                            {activeConversation.status === 'pending' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full justify-start"
                                onClick={() => handleUpdateStatus('open')}
                              >
                                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                Marcar Aberto
                              </Button>
                            )}
                            
                            {activeConversation.status !== 'closed' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full justify-start"
                                onClick={() => handleUpdateStatus('closed')}
                              >
                                <XCircle className="h-4 w-4 mr-2 text-red-500" />
                                Fechar Conversa
                              </Button>
                            )}
                            
                            {activeConversation.status === 'closed' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full justify-start"
                                onClick={() => handleUpdateStatus('open')}
                              >
                                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                Reabrir Conversa
                              </Button>
                            )}
                            
                            <Button variant="ghost" size="sm" className="w-full justify-start">
                              <Archive className="h-4 w-4 mr-2" />
                              Arquivar
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-2">
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isOwn={message.sender_type === 'user'}
                      />
                    ))}
                    
                    {loading && (
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Message Input */}
                {connectedWhatsAppInstances.length === 0 && activeConversation.channel_type === 'whatsapp' ? (
                  <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 mb-2">
                        Conecte uma instância WhatsApp para enviar mensagens
                      </p>
                      <Button variant="outline" size="sm" onClick={() => window.location.href = '/integrations'}>
                        Ir para Integrações
                      </Button>
                    </div>
                  </div>
                ) : (
                  <MessageInput
                    value={messageText}
                    onChange={setMessageText}
                    onSend={handleSendMessage}
                    onSendMedia={handleSendMedia}
                    disabled={connectedWhatsAppInstances.length === 0 && activeConversation.channel_type === 'whatsapp'}
                  />
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Selecione uma conversa
                  </h3>
                  <p className="text-gray-500">
                    Escolha uma conversa da barra lateral para começar a conversar
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Contact Info Panel */}
          <AnimatePresence>
            {showContactInfo && activeConversation?.client && (
              <ContactInfoPanel
                client={activeConversation.client}
                onClose={() => setShowContactInfo(false)}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}