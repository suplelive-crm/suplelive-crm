import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { useEffect } from 'react';

function App() {
  const { currentWorkspace, fetchWorkspaces } = useWorkspaceStore();
  const { user, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    }
  }, [user, fetchWorkspaces]);

  // Show loading screen while initializing auth
  const { loading } = useAuthStore();
  
  if (loading) {
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
    <Router>
      <div className="min-h-screen bg-gray-50">
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
          
          {/* Root redirect */}
          <Route 
            path="/" 
            element={
              user ? (
                currentWorkspace ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Navigate to="/onboarding" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        </Routes>
        <Toaster />
      </div>
    </Router>
  );
}

export default App;
