import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Building2, Users, Zap, Plus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/use-toast';

export function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);
  
  const { 
    workspaces, 
    plans, 
    fetchWorkspaces,
    fetchPlans, 
    createWorkspace, 
    setCurrentWorkspace 
  } = useWorkspaceStore();
  const { checkWorkspaceUniqueness } = useWorkspaceStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchWorkspaces();
    fetchPlans();
  }, [fetchWorkspaces, fetchPlans]);

  // Generate display slug from workspace name (for preview only)
  const displaySlug = workspaceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const handleSelectExistingWorkspace = (workspace: any) => {
    setCurrentWorkspace(workspace);
    navigate('/dashboard');
  };
  const handleCreateWorkspace = async () => {
    if (!workspaceName || !selectedPlan) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Check if workspace name/slug already exists
      const displaySlug = workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      const uniqueness = await checkWorkspaceUniqueness(workspaceName, displaySlug);
      
      if (uniqueness.nameExists) {
        toast({
          title: 'Nome já existe',
          description: `Já existe um workspace com o nome "${workspaceName}". Escolha um nome diferente.`,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      
      if (uniqueness.slugExists) {
        toast({
          title: 'URL já existe',
          description: `A URL "${displaySlug}" já está em uso. Escolha um nome diferente.`,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const newWorkspace = await createWorkspace({
        name: workspaceName,
        plan_id: selectedPlan,
      });

      // Set the newly created workspace as current
      setCurrentWorkspace(newWorkspace);

      toast({
        title: 'Sucesso!',
        description: 'Workspace criado com sucesso!',
      });

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao criar workspace',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'starter': return Users;
      case 'pro': return Building2;
      case 'enterprise': return Zap;
      default: return Users;
    }
  };

  const getPlanFeatures = (plan: any) => {
    const features = [];
    if (plan.features.whatsapp) features.push('Integração WhatsApp');
    if (plan.features.all_channels) features.push('Todos os Canais');
    if (plan.features.advanced_crm) features.push('CRM Avançado');
    if (plan.features.rfm_analysis) features.push('Análise RFM');
    if (plan.features.campaigns) features.push('Gestão de Campanhas');
    if (plan.features.custom_integrations) features.push('Integrações Personalizadas');
    if (plan.features.white_label) features.push('White Label');
    return features;
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-full max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Bem-vindo ao OmniCRM
            </h1>
            <p className="text-xl text-gray-600">
              {workspaces.length > 0 && !showCreateNew 
                ? 'Escolha um workspace ou crie um novo'
                : 'Vamos configurar seu workspace e começar'
              }
            </p>
          </motion.div>

          {/* Show existing workspaces if user has any and not creating new */}
          {workspaces.length > 0 && !showCreateNew && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="mr-2 h-5 w-5" />
                    Seus Workspaces
                  </CardTitle>
                  <CardDescription>
                    Você já possui {workspaces.length} workspace(s). Escolha um para acessar ou crie um novo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {workspaces.map((workspace) => (
                      <div
                        key={workspace.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{workspace.name}</h3>
                            <p className="text-sm text-gray-500">
                              omnicrm.com/{workspace.slug}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {workspace.plan?.name || 'Plano não encontrado'}
                              </Badge>
                              <Badge className="text-xs bg-yellow-100 text-yellow-800">
                                Proprietário
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button onClick={() => handleSelectExistingWorkspace(workspace)}>
                          <LogIn className="h-4 w-4 mr-2" />
                          Acessar
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-center pt-4 border-t">
                    <Button variant="outline" onClick={() => setShowCreateNew(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Novo Workspace
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
          {/* Show workspace creation form if no workspaces exist or user chose to create new */}
          {(workspaces.length === 0 || showCreateNew) && step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {showCreateNew && (
                <div className="text-center mb-6">
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowCreateNew(false)}
                    className="mb-4"
                  >
                    ← Voltar para meus workspaces
                  </Button>
                </div>
              )}
              
              <Card className="max-w-md mx-auto">
                <CardHeader>
                  <CardTitle>Crie Seu Workspace</CardTitle>
                  <CardDescription>
                    Configure o workspace da sua empresa para começar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="workspaceName">Nome do Workspace *</Label>
                    <Input
                      id="workspaceName"
                      placeholder="Minha Empresa"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="workspaceSlug">Preview da URL do Workspace</Label>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 mr-2">omnicrm.com/</span>
                      <Input
                        id="workspaceSlug"
                        placeholder="minha-empresa"
                        value={displaySlug}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Uma URL única será gerada automaticamente para seu workspace
                    </p>
                  </div>
                  <Button 
                    onClick={() => setStep(2)} 
                    className="w-full"
                    disabled={!workspaceName}
                  >
                    Continuar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {(workspaces.length === 0 || showCreateNew) && step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Escolha Seu Plano
                </h2>
                <p className="text-gray-600">
                  Selecione o plano que melhor atende às necessidades do seu negócio
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                  const Icon = getPlanIcon(plan.name);
                  const features = getPlanFeatures(plan);
                  const isSelected = selectedPlan === plan.id;

                  return (
                    <Card
                      key={plan.id}
                      className={`cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? 'ring-2 ring-blue-500 shadow-lg' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      <CardHeader className="text-center">
                        <div className="mx-auto mb-4">
                          <Icon className={`h-12 w-12 ${
                            isSelected ? 'text-blue-600' : 'text-gray-400'
                          }`} />
                        </div>
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                        <div className="text-3xl font-bold text-gray-900">
                          R${plan.price_monthly}
                          <span className="text-sm font-normal text-gray-500">/mês</span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 mb-6">
                          {features.slice(0, 4).map((feature, index) => (
                            <li key={index} className="flex items-center text-sm">
                              <Check className="h-4 w-4 text-green-500 mr-2" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        
                        <div className="space-y-2 text-xs text-gray-600">
                          <div className="flex justify-between">
                            <span>Canais:</span>
                            <span>{plan.limits.channels === -1 ? 'Ilimitado' : plan.limits.channels}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Usuários:</span>
                            <span>{plan.limits.users === -1 ? 'Ilimitado' : plan.limits.users}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Mensagens/mês:</span>
                            <span>{plan.limits.monthly_messages === -1 ? 'Ilimitado' : plan.limits.monthly_messages.toLocaleString()}</span>
                          </div>
                        </div>

                        {plan.name === 'Pro' && (
                          <Badge className="w-full justify-center mt-4" variant="secondary">
                            Mais Popular
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex justify-center space-x-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button 
                  onClick={handleCreateWorkspace}
                  disabled={!selectedPlan || loading}
                >
                  {loading ? 'Criando...' : 'Criar Workspace'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}