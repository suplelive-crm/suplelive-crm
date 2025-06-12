import { useState, useEffect } from 'react';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{messages.filter(m => m.status === 'sent').length}</div>
                <div className="text-sm text-gray-600">Messages Sent</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{messages.filter(m => m.status === 'delivered').length}</div>
                <div className="text-sm text-gray-600">Delivered</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{messages.filter(m => m.status === 'pending').length}</div>
                <div className="text-sm text-gray-600">Pending</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{messages.filter(m => m.status === 'failed').length}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </CardContent>
            </Card>
          </div>

          {/* Messages Table */}
          <Card>
            <CardHeader>
              <CardTitle>Message History ({messages.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell className="font-medium">
                        {message.client?.name || 'Unknown Client'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {message.content}
                      </TableCell>
                      <TableCell>
                        <Badge variant={message.send_type === 'automated' ? 'secondary' : 'outline'}>
                          {message.send_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(message.status)}>
                          {message.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(message.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline">
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}