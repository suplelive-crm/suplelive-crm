import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WhatsAppConfigDialog } from '@/components/whatsapp/WhatsAppConfigDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCrmStore } from '@/store/crmStore';
import { useToast } from '@/hooks/use-toast';

export function MessagesPage() {
  const { messages, clients, fetchMessages, fetchClients, sendMessage } = useCrmStore();
  const [selectedClient, setSelectedClient] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchMessages();
    fetchClients();
  }, [fetchMessages, fetchClients]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !messageContent.trim()) return;

    setLoading(true);
    try {
      await sendMessage(selectedClient, messageContent);
      setOpen(false);
      setSelectedClient('');
      setMessageContent('');
      toast({
        title: 'Success',
        description: 'Message sent successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = useMemo(() => {
    if (categoryFilter === 'all') return messages;

    return messages.filter(message => {
      switch (categoryFilter) {
        case 'welcome':
          return message.send_type === 'automated_welcome';
        case 'upsell':
          return message.send_type === 'automated_upsell';
        case 'reorder':
          return message.send_type === 'automated_reorder';
        case 'manual':
          return message.send_type === 'manual';
        case 'incoming':
          return message.send_type === 'incoming';
        case 'automated':
          return message.send_type === 'automated';
        default:
          return true;
      }
    });
  }, [messages, categoryFilter]);

  const getCategoryCounts = useMemo(() => {
    return {
      all: messages.length,
      welcome: messages.filter(m => m.send_type === 'automated_welcome').length,
      upsell: messages.filter(m => m.send_type === 'automated_upsell').length,
      reorder: messages.filter(m => m.send_type === 'automated_reorder').length,
      manual: messages.filter(m => m.send_type === 'manual').length,
      incoming: messages.filter(m => m.send_type === 'incoming').length,
      automated: messages.filter(m => m.send_type === 'automated').length,
    };
  }, [messages]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryLabel = (sendType: string) => {
    switch (sendType) {
      case 'automated_welcome': return { text: 'Boas-vindas', color: 'bg-purple-100 text-purple-800' };
      case 'automated_upsell': return { text: 'Segunda Compra', color: 'bg-blue-100 text-blue-800' };
      case 'automated_reorder': return { text: 'Recompra', color: 'bg-green-100 text-green-800' };
      case 'manual': return { text: 'Manual', color: 'bg-gray-100 text-gray-800' };
      case 'incoming': return { text: 'Recebida', color: 'bg-orange-100 text-orange-800' };
      case 'automated': return { text: 'Automação', color: 'bg-indigo-100 text-indigo-800' };
      default: return { text: sendType, color: 'bg-gray-100 text-gray-800' };
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full space-y-6"
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
              <p className="text-gray-600 mt-2">WhatsApp communication with clients</p>
            </div>
            <div className="flex gap-2">
              <WhatsAppConfigDialog />
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Send WhatsApp Message</DialogTitle>
                    <DialogDescription>
                      Send a message to a client via WhatsApp.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSendMessage}>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="client">Client *</Label>
                        <Select value={selectedClient} onValueChange={setSelectedClient}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
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
                      <div className="grid gap-2">
                        <Label htmlFor="message">Message *</Label>
                        <Textarea
                          id="message"
                          placeholder="Enter your message..."
                          value={messageContent}
                          onChange={(e) => setMessageContent(e.target.value)}
                          rows={4}
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={loading || !selectedClient || !messageContent.trim()}>
                        {loading ? 'Sending...' : 'Send Message'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Category Filter */}
          <Card>
            <CardHeader>
              <CardTitle>Filtrar por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Todas ({getCategoryCounts.all})
                  </SelectItem>
                  <SelectItem value="welcome">
                    Boas-vindas ({getCategoryCounts.welcome})
                  </SelectItem>
                  <SelectItem value="upsell">
                    Segunda Compra ({getCategoryCounts.upsell})
                  </SelectItem>
                  <SelectItem value="reorder">
                    Recompra ({getCategoryCounts.reorder})
                  </SelectItem>
                  <SelectItem value="manual">
                    Manuais ({getCategoryCounts.manual})
                  </SelectItem>
                  <SelectItem value="incoming">
                    Recebidas ({getCategoryCounts.incoming})
                  </SelectItem>
                  <SelectItem value="automated">
                    Automação Genérica ({getCategoryCounts.automated})
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Stats Cards by Category */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">{getCategoryCounts.welcome}</div>
                <div className="text-sm text-gray-600">Boas-vindas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{getCategoryCounts.upsell}</div>
                <div className="text-sm text-gray-600">Segunda Compra</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{getCategoryCounts.reorder}</div>
                <div className="text-sm text-gray-600">Recompra</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-600">{getCategoryCounts.manual}</div>
                <div className="text-sm text-gray-600">Manuais</div>
              </CardContent>
            </Card>
          </div>

          {/* Stats Cards by Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{messages.filter(m => m.status === 'sent').length}</div>
                <div className="text-sm text-gray-600">Enviadas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{messages.filter(m => m.status === 'delivered').length}</div>
                <div className="text-sm text-gray-600">Entregues</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{messages.filter(m => m.status === 'pending').length}</div>
                <div className="text-sm text-gray-600">Pendentes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{messages.filter(m => m.status === 'failed').length}</div>
                <div className="text-sm text-gray-600">Falhadas</div>
              </CardContent>
            </Card>
          </div>

          {/* Messages Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Histórico de Mensagens ({filteredMessages.length}
                {categoryFilter !== 'all' && ` de ${messages.length}`})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enviado Em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMessages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          Nenhuma mensagem encontrada para esta categoria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMessages.map((message) => {
                        const categoryInfo = getCategoryLabel(message.send_type);
                        return (
                          <TableRow key={message.id}>
                            <TableCell className="font-medium">
                              {message.client?.name || 'Cliente Desconhecido'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {message.content}
                            </TableCell>
                            <TableCell>
                              <Badge className={categoryInfo.color}>
                                {categoryInfo.text}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(message.status)}>
                                {message.status === 'sent' ? 'Enviada' :
                                 message.status === 'delivered' ? 'Entregue' :
                                 message.status === 'pending' ? 'Pendente' :
                                 message.status === 'failed' ? 'Falhou' :
                                 message.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(message.timestamp).toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline">
                                Ver
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}