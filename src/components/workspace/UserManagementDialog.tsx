import { useState, useEffect } from 'react';
import { Users, Shield, UserX, MoreVertical, Crown, UserPlus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';
import { ErrorHandler } from '@/lib/error-handler';
import { supabase } from '@/lib/supabase';

export function UserManagementDialog() {
  const [open, setOpen] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'operator' as 'admin' | 'operator'
  });
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    role: 'operator' as 'admin' | 'operator',
    status: 'active' as 'active' | 'pending' | 'inactive'
  });
  const [loading, setLoading] = useState(false);

  const {
    currentWorkspace,
    workspaceUsers,
    fetchWorkspaceUsers,
    registerUser,
    removeUser,
    updateUserRole
  } = useWorkspaceStore();

  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    if (open && currentWorkspace) {
      fetchWorkspaceUsers();
    }
  }, [open, currentWorkspace, fetchWorkspaceUsers]);

  const handleRegisterUser = async () => {
    if (!registerData.name.trim() || !registerData.email.trim() || !registerData.password.trim()) return;
    if (registerData.password !== registerData.confirmPassword) return;
    if (registerData.password.length < 6) return;

    // Validate workspace is selected
    if (!currentWorkspace) {
      ErrorHandler.showError('Erro', 'Nenhum workspace selecionado. Selecione um workspace antes de cadastrar usuários.');
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        name: registerData.name,
        email: registerData.email,
        password: registerData.password,
        role: registerData.role,
        workspace_id: currentWorkspace.id
      });
      
      setRegisterData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'operator'
      });
      setRegisterDialogOpen(false);
    } catch (error) {
      console.error('Error registering user:', error);
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

  const handleOpenEditDialog = (workspaceUser: any) => {
    setEditingUser(workspaceUser);
    setEditData({
      name: workspaceUser.user?.user_metadata?.name || '',
      email: workspaceUser.user?.email || '',
      role: workspaceUser.role,
      status: workspaceUser.status || 'active'
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser || !editData.name.trim() || !editData.email.trim()) return;

    setLoading(true);
    try {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      // Update role and/or status if changed
      const needsUpdate = editData.role !== editingUser.role || editData.status !== editingUser.status;

      if (needsUpdate) {
        const { error } = await supabase
          .from('workspace_users')
          .update({
            role: editData.role,
            status: editData.status
          })
          .eq('workspace_id', currentWorkspace.id)
          .eq('user_id', editingUser.user_id);

        if (error) throw error;
      }

      // TODO: Add function to update user name/email via Supabase Admin API
      ErrorHandler.showSuccess('Sucesso', 'Usuário atualizado com sucesso');
      setEditDialogOpen(false);
      setEditingUser(null);
      await fetchWorkspaceUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      ErrorHandler.showError('Erro', 'Falha ao atualizar usuário');
    } finally {
      setLoading(false);
    }
  };

  const canEditUser = (targetUserId: string, targetRole: string) => {
    // Proprietário pode editar todos
    if (isCurrentUserOwner) return true;

    // Admin pode editar operadores
    if (currentUserRole === 'admin' && targetRole === 'operator') return true;

    // Usuário pode editar apenas a si mesmo
    if (currentUser?.id === targetUserId) return true;

    return false;
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
    <Dialog open={open} onOpenChange={setOpen} modal={true}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="mr-2 h-4 w-4" />
          Gerenciar Usuários
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => {
        // Permitir interações com dropdowns e outros portals
        const target = e.target as HTMLElement;
        if (target.closest('[role="menu"]') || target.closest('[data-radix-popper-content-wrapper]')) {
          e.preventDefault();
        }
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Gerenciar Usuários - {currentWorkspace?.name}
          </DialogTitle>
          <DialogDescription>
            Gerencie os usuários e permissões do seu workspace
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Membros do Workspace</h3>
            {canManageUsers && (
              <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Cadastrar Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
                    <DialogDescription>
                      Crie uma nova conta de usuário e adicione ao workspace
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="registerName">Nome Completo *</Label>
                      <Input
                        id="registerName"
                        placeholder="João Silva"
                        value={registerData.name}
                        onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="registerEmail">Email *</Label>
                      <Input
                        id="registerEmail"
                        type="email"
                        placeholder="usuario@exemplo.com"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="registerPassword">Senha *</Label>
                      <Input
                        id="registerPassword"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirme a senha"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="registerRole">Role do Usuário *</Label>
                      <Select value={registerData.role} onValueChange={(value: 'admin' | 'operator') => setRegisterData({ ...registerData, role: value })}>
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
                    <Button variant="outline" onClick={() => setRegisterDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleRegisterUser}
                      disabled={
                        loading ||
                        !currentWorkspace ||
                        !registerData.name.trim() ||
                        !registerData.email.trim() ||
                        !registerData.password.trim() ||
                        registerData.password !== registerData.confirmPassword ||
                        registerData.password.length < 6
                      }
                    >
                      {loading ? 'Cadastrando...' : 'Cadastrar Usuário'}
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
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Workspace Users - TODOS os usuários incluindo owner */}
                  {workspaceUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="text-gray-500">
                          <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">Nenhum usuário encontrado</p>
                          <p className="text-xs mt-1">Use o botão "Cadastrar Usuário" para adicionar membros ao workspace</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    workspaceUsers.map((workspaceUser) => (
                      <TableRow key={workspaceUser.user_id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              workspaceUser.role === 'owner' ? 'bg-yellow-100' : 'bg-blue-100'
                            }`}>
                              {workspaceUser.role === 'owner' ? (
                                <Crown className="h-4 w-4 text-yellow-600" />
                              ) : (
                                <span className="text-xs font-medium text-blue-600">
                                  {workspaceUser.email?.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{workspaceUser.name}</p>
                              <p className="text-xs text-gray-500">{workspaceUser.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(workspaceUser.role, workspaceUser.role === 'owner')}</TableCell>
                        <TableCell>{getStatusBadge(workspaceUser.status)}</TableCell>
                        <TableCell>
                          {workspaceUser.created_at ? formatDate(workspaceUser.created_at) : 'Pendente'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {/* Botão Editar */}
                            {canEditUser(workspaceUser.user_id, workspaceUser.role) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditDialog(workspaceUser)}
                                title="Editar usuário"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Botão Remover (apenas para admins e owner) */}
                            {canManageUsers && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Remover do workspace"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <UserX className="h-4 w-4" />
                                  </Button>
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
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

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

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="editName">Nome Completo *</Label>
              <Input
                id="editName"
                placeholder="João Silva"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="editEmail">Email *</Label>
              <Input
                id="editEmail"
                type="email"
                placeholder="usuario@exemplo.com"
                value={editData.email}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Email não pode ser alterado
              </p>
            </div>
            {(isCurrentUserOwner || (currentUserRole === 'admin' && editingUser?.role === 'operator')) && (
              <>
                <div>
                  <Label htmlFor="editRole">Role do Usuário *</Label>
                  <Select value={editData.role} onValueChange={(value: 'admin' | 'operator') => setEditData({ ...editData, role: value })}>
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
                    {isCurrentUserOwner
                      ? 'Como proprietário, você pode alterar qualquer role'
                      : 'Como admin, você pode alterar roles de operadores'}
                  </p>
                </div>

                <div>
                  <Label htmlFor="editStatus">Status do Usuário *</Label>
                  <Select value={editData.status} onValueChange={(value: 'active' | 'pending' | 'inactive') => setEditData({ ...editData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        <div className="flex items-center">
                          <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                          Ativo
                        </div>
                      </SelectItem>
                      <SelectItem value="pending">
                        <div className="flex items-center">
                          <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
                          Pendente
                        </div>
                      </SelectItem>
                      <SelectItem value="inactive">
                        <div className="flex items-center">
                          <span className="w-2 h-2 rounded-full bg-gray-500 mr-2"></span>
                          Inativo
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Ative usuários pendentes ou desative temporariamente o acesso
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={loading || !editData.name.trim()}
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}