import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

// --- Início das Simulações (Mocks) ---
// Para resolver os erros de importação, criei componentes e hooks de exemplo aqui.
// No seu projeto real, você manteria os imports originais.

const Toaster = () => <div id="toaster-placeholder" style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 100 }}></div>;

const ProtectedRoute = ({ children }) => {
  // Em um app real, isso verificaria se o usuário está autenticado.
  // Para este exemplo, ele simplesmente renderiza os componentes filhos.
  return children;
};

// Páginas de exemplo
const createPlaceholderPage = (name) => () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-gray-800">{name}</h1>
    </div>
  </div>
);

const LoginPage = createPlaceholderPage('Página de Login');
const SignUpPage = createPlaceholderPage('Página de Cadastro');
const OnboardingPage = createPlaceholderPage('Página de Onboarding');
// --- ✨ Funcionalidade com Gemini API na Página do Dashboard ---
const DashboardPage = () => {
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateSummary = async () => {
        setIsLoading(true);
        setSummary('');

        const apiKey = ""; // A chave será injetada pelo ambiente.
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const weeklyData = "5 novos clientes, 12 pedidos concluídos, 3 novos tickets de suporte abertos e 8 campanhas de marketing enviadas.";
        const userPrompt = `Você é um assistente de negócios para um CRM. Sua tarefa é criar um resumo semanal conciso e encorajador. Seja otimista, mas profissional. Use os seguintes dados: ${weeklyData}. Responda em português.`;

        const payload = {
            contents: [{ parts: [{ text: userPrompt }] }],
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const candidate = result.candidates?.[0];
            const text = candidate?.content?.parts?.[0]?.text;

            if (text) {
                setSummary(text);
            } else {
                setSummary("Não foi possível gerar o resumo. A resposta da IA estava vazia.");
            }

        } catch (error) {
            console.error("Erro ao chamar a API Gemini:", error);
            setSummary("Ocorreu um erro ao gerar o resumo. Por favor, tente novamente mais tarde.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-2xl p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h1 className="text-3xl font-bold text-center text-gray-800">Dashboard</h1>
                
                <div className="text-center">
                    <button 
                        onClick={handleGenerateSummary}
                        disabled={isLoading}
                        className="px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-300"
                    >
                        {isLoading ? 'Gerando...' : '✨ Gerar Resumo Semanal com IA'}
                    </button>
                </div>

                {isLoading && (
                    <div className="flex justify-center items-center p-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                )}
                
                {summary && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Resumo da IA:</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{summary}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
const InboxPage = createPlaceholderPage('Página de Inbox');
const ClientsPage = createPlaceholderPage('Página de Clientes');
const KanbanPage = createPlaceholderPage('Página Kanban');
const OrdersPage = createPlaceholderPage('Página de Pedidos');
const MessagesPage = createPlaceholderPage('Página de Mensagens');
const CampaignsPage = createPlaceholderPage('Página de Campanhas');
const IntegrationsPage = createPlaceholderPage('Página de Integrações');
const AutomationPage = createPlaceholderPage('Página de Automação');
const AnalyticsPage = createPlaceholderPage('Página de Analytics');
const SettingsPage = createPlaceholderPage('Página de Configurações');
const TrackingPage = createPlaceholderPage('Página de Rastreamento');


// Simulação do Zustand Store para autenticação
const useAuthStore = () => ({
  user: { email: 'usuario@exemplo.com', uid: '12345' }, // Simula um usuário logado
  loading: false,
  initialize: async () => {
    console.log("Auth Store Initialized (Mock)");
    return Promise.resolve();
  },
});

// Simulação do Zustand Store para Workspaces
const mockWorkspaces = [
  { id: 'ws_1', name: 'Workspace Pessoal' },
  { id: 'ws_2', name: 'Projeto Secreto' },
];

const useWorkspaceStore = () => {
    const [currentWorkspace, setCurrentWorkspaceState] = useState(null);
    
    const fetchWorkspaces = async () => {
        console.log("Fetching workspaces (Mock)");
        return Promise.resolve(mockWorkspaces);
    };

    const setCurrentWorkspace = (workspace) => {
        console.log("Setting current workspace (Mock):", workspace);
        setCurrentWorkspaceState(workspace);
        if (workspace) {
            localStorage.setItem('currentWorkspaceId', workspace.id);
        }
    };
    
    // Simula o método getState para obter o estado mais recente fora do hook
    useWorkspaceStore.getState = () => ({
        workspaces: mockWorkspaces,
    });

    return {
        currentWorkspace,
        workspaces: mockWorkspaces,
        fetchWorkspaces,
        setCurrentWorkspace,
    };
};

// --- Fim das Simulações (Mocks) ---


function AppContent() {
  const { currentWorkspace, workspaces, fetchWorkspaces, setCurrentWorkspace } = useWorkspaceStore();
  const { user, loading: authLoading } = useAuthStore();
  const [appInitialized, setAppInitialized] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const initializeApp = async () => {
      if (!user || appInitialized) return;

      console.log('Initializing app for user:', user.email);
      setWorkspaceLoading(true);

      try {
        await fetchWorkspaces();
        const updatedWorkspaces = useWorkspaceStore.getState().workspaces;
        console.log('Fetched workspaces:', updatedWorkspaces.length);

        if (updatedWorkspaces.length > 0) {
          const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
          let workspaceToSet = null;
          
          if (savedWorkspaceId) {
            workspaceToSet = updatedWorkspaces.find(w => w.id === savedWorkspaceId);
          }
          
          if (!workspaceToSet) {
            workspaceToSet = updatedWorkspaces[0];
          }
          
          setCurrentWorkspace(workspaceToSet);
          
          const savedRoute = localStorage.getItem('lastVisitedRoute');
          if (location.pathname === '/' && savedRoute && savedRoute !== '/onboarding') {
            navigate(savedRoute, { replace: true });
          }
        } else {
          console.log('No workspaces found, user needs onboarding');
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setWorkspaceLoading(false);
        setAppInitialized(true);
      }
    };

    initializeApp();
  }, [user, appInitialized, fetchWorkspaces, setCurrentWorkspace, navigate, location.pathname]);

  useEffect(() => {
    if (user && currentWorkspace && location.pathname !== '/' && location.pathname !== '/onboarding') {
      localStorage.setItem('lastVisitedRoute', location.pathname);
    }
  }, [location.pathname, user, currentWorkspace]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (user && (workspaceLoading || (location.pathname === '/' && !appInitialized))) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute>{!currentWorkspace ? <Navigate to="/onboarding" replace /> : <DashboardPage />}</ProtectedRoute>} />
      <Route path="/inbox" element={<ProtectedRoute>{!currentWorkspace ? <Navigate to="/onboarding" replace /> : <InboxPage />}</ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute>{!currentWorkspace ? <Navigate to="/onboarding" replace /> : <ClientsPage />}</ProtectedRoute>} />
      <Route path="/kanban" element={<ProtectedRoute>{!currentWorkspace ? <Navigate to="/onboarding" replace /> : <KanbanPage />}</ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute>{!currentWorkspace ? <Navigate to="/onboarding" replace /> : <OrdersPage />}</ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute>{!currentWorkspace ? <Navigate to="/onboarding" replace /> : <MessagesPage />}</ProtectedRoute>} />
      <Route path="/campaigns" element={<ProtectedRoute>{!currentWorkspace ? <Navigate to="/onboarding" replace /> : <CampaignsPage />}</ProtectedRoute>} />
      <Route path="/integrations" element={<ProtectedRoute>{!currentWorkspace ? <Navigate to="/onboarding" replace /> : <IntegrationsPage />}</ProtectedRoute>} />
      <Route path="/automation" element={<ProtectedRoute>{!currentWorkspace ? <Navigate to="/onboarding" replace /> : <AutomationPage />}</ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute>{!currentWorkspace ? <Navigate to="/onboarding" replace /> : <AnalyticsPage />}</ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute>{!currentWorkspace ? <Navigate to="/onboarding" replace /> : <SettingsPage />}</ProtectedRoute>} />
      <Route path="/tracking" element={<ProtectedRoute>{!currentWorkspace ? <Navigate to="/onboarding" replace /> : <TrackingPage />}</ProtectedRoute>} />
      
      <Route
        path="/"
        element={
          user ? (
            currentWorkspace ? (
              (() => {
                const savedRoute = localStorage.getItem('lastVisitedRoute');
                const targetRoute = savedRoute && savedRoute !== '/onboarding' ? savedRoute : '/dashboard';
                return <Navigate to={targetRoute} replace />;
              })()
            ) : workspaceLoading || !appInitialized ? (
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Carregando workspace...</p>
                </div>
              </div>
            ) : workspaces.length === 0 ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                 <p className="text-gray-600">Selecionando workspace...</p>
              </div>
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

function App() {
  const { initialize } = useAuthStore();
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await initialize();
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setAuthInitialized(true);
      }
    };
    
    initAuth();
  }, [initialize]);

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Inicializando...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <AppContent />
        <Toaster />
      </div>
    </Router>
  );
}

export default App;

