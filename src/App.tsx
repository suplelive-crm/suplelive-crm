import { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { Toaster } from '@/components/ui/sonner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { SignUpPage } from '@/pages/SignUpPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { InboxPage } from '@/pages/InboxPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { KanbanPage } from '@/pages/KanbanPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';
import { AutomationPage } from '@/pages/AutomationPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TrackingPage } from '@/pages/TrackingPage';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';

function AppContent() {
  const { currentWorkspace, workspaces, fetchWorkspaces, setCurrentWorkspace } =
    useWorkspaceStore();
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
            workspaceToSet = updatedWorkspaces.find(
              (w) => w.id === savedWorkspaceId
            );
            console.log('Found saved workspace:', workspaceToSet?.name);
          }

          if (!workspaceToSet) {
            workspaceToSet = updatedWorkspaces[0];
            console.log('Using first workspace:', workspaceToSet.name);
          }

          setCurrentWorkspace(workspaceToSet);
          console.log('Workspace set successfully');

          const savedRoute = localStorage.getItem('lastVisitedRoute');
          if (
            location.pathname === '/' &&
            savedRoute &&
            savedRoute !== '/onboarding'
          ) {
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
  }, [user, appInitialized, fetchWorkspaces, setCurrentWorkspace, navigate, location.pathname]);

  useEffect(() => {
    if (
      user &&
      currentWorkspace &&
      location.pathname !== '/' &&
      location.pathname !== '/onboarding'
    ) {
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

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      {/* Protected routes */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {!currentWorkspace ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <DashboardPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/inbox"
        element={
          <ProtectedRoute>
            {!currentWorkspace ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <InboxPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            {!currentWorkspace ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <ClientsPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/kanban"
        element={
          <ProtectedRoute>
            {!currentWorkspace ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <KanbanPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            {!currentWorkspace ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <OrdersPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            {!currentWorkspace ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <MessagesPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns"
        element={
          <ProtectedRoute>
            {!currentWorkspace ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <CampaignsPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <ProtectedRoute>
            {!currentWorkspace ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <IntegrationsPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/automation"
        element={
          <ProtectedRoute>
            {!currentWorkspace ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <AutomationPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            {!currentWorkspace ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <AnalyticsPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            {!currentWorkspace ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <SettingsPage />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/tracking"
        element={
          <ProtectedRoute>
            {!currentWorkspace ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <TrackingPage />
            )}
          </ProtectedRoute>
        }
      />

      {/* Root redirect - CORREÇÃO APLICADA AQUI */}
      <Route
        path="/"
        element={
          user ? (
            currentWorkspace ? (
              (() => {
                const savedRoute = localStorage.getItem('lastVisitedRoute');
                const targetRoute =
                  savedRoute && savedRoute !== '/onboarding'
                    ? savedRoute
                    : '/dashboard';
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
                 <p className="text-gray-600">Finalizando...</p>
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

