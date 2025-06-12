import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, User, Building2, CreditCard, Bell, Shield, Palette } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/use-toast';

export function SettingsPage() {
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [workspaceData, setWorkspaceData] = useState({
    name: '',
    slug: '',
  });
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sms: false,
  });
  const [loading, setLoading] = useState(false);

  const { currentWorkspace, plans } = useWorkspaceStore();
  const { user } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.user_metadata?.name || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || '',
      });
    }
    if (currentWorkspace) {
      setWorkspaceData({
        name: currentWorkspace.name,
        slug: currentWorkspace.slug,
      });
    }
  }, [user, currentWorkspace]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      // TODO: Update user profile
      toast({
        title: 'Sucesso',
        description: 'Perfil atualizado com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao atualizar perfil',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkspace = async () => {
    setLoading(true);
    try {
      // TODO: Update workspace
      toast({
        title: 'Sucesso',
        description: 'Workspace atualizado com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao atualizar workspace',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const currentPlan = plans.find(p => p.id === currentWorkspace?.plan_id);

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full space-y-6"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
            <p className="text-gray-600 mt-2">Gerencie suas preferências e configurações da conta</p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList>
              <TabsTrigger value="profile">
                <User className="mr-2 h-4 w-4" />
                Perfil
              </TabsTrigger>
              <TabsTrigger value="workspace">
                <Building2 className="mr-2 h-4 w-4" />
                Workspace
              </TabsTrigger>
              <TabsTrigger value="billing">
                <CreditCard className="mr-2 h-4 w-4" />
                Cobrança
              </TabsTrigger>
              <TabsTrigger value="notifications">
                <Bell className="mr-2 h-4 w-4" />
                Notificações
              </TabsTrigger>
              <TabsTrigger value="security">
                <Shield className="mr-2 h-4 w-4" />
                Segurança
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informações Pessoais</CardTitle>
                  <CardDescription>
                    Atualize suas informações pessoais e preferências
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome Completo</Label>
                      <Input
                        id="name"
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="timezone">Fuso Horário</Label>
                      <Select defaultValue="america/sao_paulo">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="america/sao_paulo">América/São Paulo</SelectItem>
                          <SelectItem value="america/new_york">América/Nova York</SelectItem>
                          <SelectItem value="europe/london">Europa/Londres</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={loading}>
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="workspace" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações do Workspace</CardTitle>
                  <CardDescription>
                    Gerencie as configurações do seu workspace
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="workspaceName">Nome do Workspace</Label>
                      <Input
                        id="workspaceName"
                        value={workspaceData.name}
                        onChange={(e) => setWorkspaceData({ ...workspaceData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="workspaceSlug">URL do Workspace</Label>
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500 mr-2">omnicrm.com/</span>
                        <Input
                          id="workspaceSlug"
                          value={workspaceData.slug}
                          onChange={(e) => setWorkspaceData({ ...workspaceData, slug: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleSaveWorkspace} disabled={loading}>
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Membros do Workspace</CardTitle>
                  <CardDescription>
                    Gerencie quem tem acesso ao seu workspace
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user?.email}</p>
                          <p className="text-sm text-gray-500">Proprietário</p>
                        </div>
                      </div>
                      <Badge>Admin</Badge>
                    </div>
                    <Button variant="outline" className="w-full">
                      Convidar Membro
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Plano Atual</CardTitle>
                  <CardDescription>
                    Gerencie sua assinatura e cobrança
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">{currentPlan?.name || 'Plano Não Encontrado'}</h3>
                          <p className="text-gray-600">
                            R${currentPlan?.price_monthly || 0}/mês
                          </p>
                        </div>
                        <Badge variant="outline">Ativo</Badge>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>• Canais: {currentPlan?.limits.channels === -1 ? 'Ilimitado' : currentPlan?.limits.channels}</p>
                        <p>• Usuários: {currentPlan?.limits.users === -1 ? 'Ilimitado' : currentPlan?.limits.users}</p>
                        <p>• Mensagens/mês: {currentPlan?.limits.monthly_messages === -1 ? 'Ilimitado' : currentPlan?.limits.monthly_messages?.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline">Alterar Plano</Button>
                      <Button variant="outline">Ver Faturas</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Método de Pagamento</CardTitle>
                  <CardDescription>
                    Gerencie seus métodos de pagamento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
                            VISA
                          </div>
                          <div>
                            <p className="font-medium">•••• •••• •••• 4242</p>
                            <p className="text-sm text-gray-500">Expira em 12/25</p>
                          </div>
                        </div>
                        <Badge>Padrão</Badge>
                      </div>
                    </div>
                    <Button variant="outline">Adicionar Método de Pagamento</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preferências de Notificação</CardTitle>
                  <CardDescription>
                    Configure como você quer receber notificações
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Notificações por Email</h4>
                        <p className="text-sm text-gray-600">Receba atualizações importantes por email</p>
                      </div>
                      <Switch
                        checked={notifications.email}
                        onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Notificações Push</h4>
                        <p className="text-sm text-gray-600">Receba notificações no navegador</p>
                      </div>
                      <Switch
                        checked={notifications.push}
                        onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Notificações SMS</h4>
                        <p className="text-sm text-gray-600">Receba alertas importantes por SMS</p>
                      </div>
                      <Switch
                        checked={notifications.sms}
                        onCheckedChange={(checked) => setNotifications({ ...notifications, sms: checked })}
                      />
                    </div>
                  </div>
                  <Button>Salvar Preferências</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Segurança da Conta</CardTitle>
                  <CardDescription>
                    Gerencie a segurança da sua conta
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Alterar Senha</h4>
                      <div className="space-y-2">
                        <Input type="password" placeholder="Senha atual" />
                        <Input type="password" placeholder="Nova senha" />
                        <Input type="password" placeholder="Confirmar nova senha" />
                      </div>
                      <Button className="mt-2">Alterar Senha</Button>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2">Autenticação de Dois Fatores</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Adicione uma camada extra de segurança à sua conta
                      </p>
                      <Button variant="outline">Configurar 2FA</Button>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2">Sessões Ativas</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Gerencie onde você está logado
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">Chrome - Windows</p>
                            <p className="text-sm text-gray-500">São Paulo, Brasil • Agora</p>
                          </div>
                          <Badge variant="outline">Atual</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}