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

// Função para criar páginas de exemplo
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
const DashboardPage = createPlaceholderPage('Página do Dashboard');
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

// NOTE: A simulação foi alterada para não usar `useState` internamente, o que causava o erro.
// O estado agora é gerenciado pelo componente que usa o hook.
const useWorkspaceStore = (setCurrentWorkspaceState) => {
    const fetchWorkspaces = async () => {
        console.log("Fetching workspaces (Mock)");
        return Promise.resolve(mockWorkspaces);
    };

    const setCurrentWorkspace = (workspace) => {
        console.log("Setting current workspace (Mock):", workspace);
        setCurrentWorkspaceState(workspace); // Usa a função do useState do componente pai
        if (workspace) {
            localStorage.setItem('currentWorkspaceId', workspace.id);
        }
    };
    
    return {
        workspaces: mockWorkspaces,
        fetchWorkspaces,
        setCurrentWorkspace,
    };
};

// Simula o método getState para obter o estado mais recente fora do hook
useWorkspaceStore.getState = () => ({
    workspaces: mockWorkspaces,
});

// --- Fim das Simulações (Mocks) ---


function AppContent() {
  // O estado do workspace foi movido para cá para corrigir o erro dos Hooks
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const { workspaces, fetchWorkspaces, setCurrentWorkspace: setStoreWorkspace } = useWorkspaceStore(setCurrentWorkspace);

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
          console.log('Saved workspace ID:', savedWorkspaceId);
          
          let workspaceToSet = null;
          
          if (savedWorkspaceId) {
            workspaceToSet = updatedWorkspaces.find(w => w.id === savedWorkspaceId);
            console.log('Found saved workspace:', workspaceToSet?.name);
          }
          
          if (!workspaceToSet) {
            workspaceToSet = updatedWorkspaces[0];
            console.log('Using first workspace:', workspaceToSet.name);
          }
          
          setStoreWorkspace(workspaceToSet);
          console.log('Workspace set successfully');
          
          const savedRoute = localStorage.getItem('lastVisitedRoute');
          if (location.pathname === '/' && savedRoute && savedRoute !== '/onboarding') {
            console.log('Restoring last visited route:', savedRoute);
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
  }, [user, appInitialized, fetchWorkspaces, setStoreWorkspace, navigate, location.pathname]);

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

  if (user && workspaceLoading) {
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
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      
      {/* Protected routes */}
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
      
      {/* Root redirect */}
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
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Finalizando...</p>
                </div>
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

