import { useState, useEffect } from 'react';
import { Users, Plus, Mail, Shield, UserX, MoreVertical, Crown, RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';

export function UserManagementDialog() {
  const [open, setOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'operator'>('operator');
  const [loading, setLoading] = useState(false);

  const { 
    currentWorkspace, 
    workspaceUsers, 
    userInvitations,
    fetchWorkspaceUsers,
    fetchUserInvitations,
    inviteUser,
    removeUser,
    updateUserRole,
    cancelInvitation,
    resendInvitation
  } = useWorkspaceStore();
  
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    if (open && currentWorkspace) {
      fetchWorkspaceUsers();
      fetchUserInvitations();
    }
  }, [open, currentWorkspace, fetchWorkspaceUsers, fetchUserInvitations]);

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) return;

    setLoading(true);
    try {
      await inviteUser(inviteEmail, inviteRole);
      setInviteEmail('');
      setInviteRole('operator');
      setInviteDialogOpen(false);
    } catch (error) {
      console.error('Error inviting user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      await removeUser(userId);
    } catch (error) {
      console.error('Error removing user:', error);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'operator') => {
    try {
      await updateUserRole(userId, newRole);
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitation(invitationId);
    } catch (error) {
      console.error('Error canceling invitation:', error);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      await resendInvitation(invitationId);
    } catch (error) {
      console.error('Error resending invitation:', error);
    }
  };

  const getRoleBadge = (role: string, isOwner: boolean = false) => {
    if (isOwner) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
          <Crown className="h-3 w-3 mr-1" />
          Proprietário
        </Badge>
      );
    }

    switch (role) {
      case 'admin':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <Shield className="h-3 w-3 mr-1" />
            Administrador
          </Badge>
        );
      case 'operator':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <Users className="h-3 w-3 mr-1" />
            Operador
          </Badge>
        );
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800">Inativo</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isCurrentUserOwner = currentWorkspace?.owner_id === currentUser?.id;
  const currentUserRole = workspaceUsers.find(wu => wu.user_id === currentUser?.id)?.role;
  const canManageUsers = isCurrentUserOwner || currentUserRole === 'admin';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="mr-2 h-4 w-4" />
          Gerenciar Usuários
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Gerenciar Usuários - {currentWorkspace?.name}
          </DialogTitle>
          <DialogDescription>
            Gerencie os usuários e permissões do seu workspace
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">Usuários ({workspaceUsers.length})</TabsTrigger>
            <TabsTrigger value="invitations">Convites Pendentes ({userInvitations.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Membros do Workspace</h3>
              {canManageUsers && (
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Convidar Usuário
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Convidar Novo Usuário</DialogTitle>
                      <DialogDescription>
                        Convide um usuário para fazer parte do seu workspace
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="inviteEmail">Email do Usuário *</Label>
                        <Input
                          id="inviteEmail"
                          type="email"
                          placeholder="usuario@exemplo.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="inviteRole">Role do Usuário *</Label>
                        <Select value={inviteRole} onValueChange={(value: 'admin' | 'operator') => setInviteRole(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center">
                                <Shield className="h-4 w-4 mr-2" />
                                Administrador
                              </div>
                            </SelectItem>
                            <SelectItem value="operator">
                              <div className="flex items-center">
                                <Users className="h-4 w-4 mr-2" />
                                Operador
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500 mt-1">
                          Administradores podem gerenciar usuários e configurações. Operadores têm acesso às funcionalidades principais.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleInviteUser} disabled={loading || !inviteEmail.trim()}>
                        {loading ? 'Convidando...' : 'Enviar Convite'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Membro desde</TableHead>
                      {canManageUsers && <TableHead>Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Workspace Owner */}
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                            <Crown className="h-4 w-4 text-yellow-600" />
                          </div>
                          <div>
                            <p className="font-medium">{currentUser?.email}</p>
                            <p className="text-xs text-gray-500">Proprietário do workspace</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge('owner', true)}</TableCell>
                      <TableCell>{getStatusBadge('active')}</TableCell>
                      <TableCell>{formatDate(currentWorkspace?.created_at || '')}</TableCell>
                      {canManageUsers && (
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            Proprietário
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>

                    {/* Workspace Users */}
                    {workspaceUsers
                      .filter(wu => wu.user_id !== currentWorkspace?.owner_id)
                      .map((workspaceUser) => (
                        <TableRow key={workspaceUser.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-blue-600">
                                  {workspaceUser.user?.email?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">
                                  {workspaceUser.user?.user_metadata?.name || workspaceUser.user?.email}
                                </p>
                                <p className="text-xs text-gray-500">{workspaceUser.user?.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(workspaceUser.role)}</TableCell>
                          <TableCell>{getStatusBadge(workspaceUser.status)}</TableCell>
                          <TableCell>
                            {workspaceUser.joined_at ? formatDate(workspaceUser.joined_at) : 'Pendente'}
                          </TableCell>
                          {canManageUsers && (
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem 
                                    onClick={() => handleUpdateRole(
                                      workspaceUser.user_id, 
                                      workspaceUser.role === 'admin' ? 'operator' : 'admin'
                                    )}
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Alterar para {workspaceUser.role === 'admin' ? 'Operador' : 'Administrador'}
                                  </DropdownMenuItem>
                                  
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <UserX className="h-4 w-4 mr-2" />
                                        Remover do Workspace
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remover Usuário</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Tem certeza que deseja remover "{workspaceUser.user?.email}" do workspace? 
                                          O usuário perderá acesso a todos os dados e funcionalidades.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleRemoveUser(workspaceUser.user_id)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Remover
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Convites Pendentes</h3>
              <Button variant="outline" size="sm" onClick={fetchUserInvitations}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>

            {userInvitations.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum convite pendente
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Todos os convites foram aceitos ou expirados
                  </p>
                  {canManageUsers && (
                    <Button onClick={() => setInviteDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Convidar Primeiro Usuário
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Convidado por</TableHead>
                        <TableHead>Enviado em</TableHead>
                        <TableHead>Expira em</TableHead>
                        {canManageUsers && <TableHead>Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userInvitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span className="font-medium">{invitation.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                          <TableCell>{invitation.invited_by_user?.email}</TableCell>
                          <TableCell>{formatDate(invitation.created_at)}</TableCell>
                          <TableCell>
                            <span className={new Date(invitation.expires_at) < new Date() ? 'text-red-600' : 'text-gray-600'}>
                              {formatDate(invitation.expires_at)}
                            </span>
                          </TableCell>
                          {canManageUsers && (
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResendInvitation(invitation.id)}
                                >
                                  <Send className="h-4 w-4 mr-1" />
                                  Reenviar
                                </Button>
                                
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Cancelar Convite</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja cancelar o convite para "{invitation.email}"?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleCancelInvitation(invitation.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Cancelar Convite
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Sobre os Roles</h4>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex items-center space-x-2">
              <Crown className="h-4 w-4" />
              <span><strong>Proprietário:</strong> Controle total do workspace, incluindo exclusão e transferência</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span><strong>Administrador:</strong> Pode gerenciar usuários, configurações e todas as funcionalidades</span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span><strong>Operador:</strong> Acesso às funcionalidades principais (CRM, mensagens, relatórios)</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}