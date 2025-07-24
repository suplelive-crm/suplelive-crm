import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { LoginForm } from '@/components/auth/LoginForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { ErrorHandler } from '@/lib/error-handler';

export function LoginPage() {
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const { signIn } = useAuthStore();
  const { workspaces, fetchWorkspaces, setCurrentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();

  const handleWorkspaceLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceSlug || !email || !password) {
      ErrorHandler.showError(
        ErrorHandler.createError(
          'Campos Obrigatórios',
          'Por favor, preencha todos os campos para continuar.'
        )
      );
      return;
    }

    setWorkspaceLoading(true);
    try {
      // First authenticate the user
      await signIn(email, password);
      
      // Then fetch workspaces and find the one with matching slug
      await fetchWorkspaces();
      const workspace = workspaces.find(w => w.slug === workspaceSlug);
      
      if (!workspace) {
        ErrorHandler.showError(
          ErrorHandler.createError(
            'Workspace Não Encontrado',
            'O workspace informado não foi encontrado ou você não tem acesso a ele. Verifique a URL e tente novamente.'
          )
        );
        return;
      }

      // Set the current workspace and redirect
      setCurrentWorkspace(workspace);
      navigate('/dashboard');
      
    } catch (error: any) {
      // Error is already handled by signIn method
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const handlePersonalLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signIn(email, password);
      
      // Fetch workspaces to check if user has any
      await fetchWorkspaces();
      
      // Get updated workspaces from store
      const updatedWorkspaces = useWorkspaceStore.getState().workspaces;
      
      // If user has workspaces, go to dashboard, otherwise go to onboarding
      if (updatedWorkspaces.length > 0) {
        setCurrentWorkspace(updatedWorkspaces[0]);
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
      
    } catch (error: any) {
      // Error is already handled by signIn method
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full h-full flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">OmniCRM</h1>
            <p className="text-gray-600">Entre na sua conta</p>
          </div>

          <Card>
            <CardContent className="p-6">
              <Tabs defaultValue="workspace" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="workspace">Workspace</TabsTrigger>
                  <TabsTrigger value="personal">Pessoal</TabsTrigger>
                </TabsList>
                
                <TabsContent value="workspace" className="space-y-4 mt-6">
                  <div className="text-center mb-4">
                    <Building2 className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                    <h3 className="text-lg font-semibold">Entrar no Workspace</h3>
                    <p className="text-sm text-gray-600">
                      Entre com a URL do seu workspace
                    </p>
                  </div>
                  
                  <form onSubmit={handleWorkspaceLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="workspaceSlug">URL do Workspace</Label>
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500 mr-2">omnicrm.com/</span>
                        <Input
                          id="workspaceSlug"
                          placeholder="minha-empresa"
                          value={workspaceSlug}
                          onChange={(e) => setWorkspaceSlug(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="workspaceEmail">Email</Label>
                      <Input
                        id="workspaceEmail"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="workspacePassword">Senha</Label>
                      <Input
                        id="workspacePassword"
                        type="password"
                        placeholder="Sua senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={workspaceLoading}>
                      {workspaceLoading ? 'Entrando...' : 'Entrar no Workspace'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="personal" className="space-y-4 mt-6">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold">Login Pessoal</h3>
                    <p className="text-sm text-gray-600">
                      Entre com sua conta pessoal
                    </p>
                  </div>
                  
                  <LoginForm onSubmit={handlePersonalLogin} loading={loading} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Não tem uma conta?{' '}
              <Link to="/signup" className="text-blue-600 hover:underline">
                Criar conta
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}