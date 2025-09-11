import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// --- Início das Simulações (Mocks) ---
// Para resolver os erros de importação, criei componentes e hooks de exemplo aqui.
// No seu projeto real, você manteria os imports originais.

// Mocks para 'lucide-react' e componentes de UI
const createIcon = () => () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle></svg>;
const ShoppingBag = createIcon(); const RotateCcw = createIcon(); const Truck = createIcon(); const Package = createIcon(); const ArrowLeftRight = createIcon(); const Filter = createIcon(); const Plus = createIcon(); const RefreshCw = createIcon(); const CheckSquare = createIcon(); const Archive = createIcon(); const Eye = createIcon(); const MoreHorizontal = createIcon(); const Calendar = createIcon(); const Search = createIcon(); const LayoutGrid = createIcon(); const LayoutList = createIcon(); const CheckCircle = createIcon(); const Database = createIcon(); const ArrowUpDown = createIcon(); const ChevronLeft = createIcon(); const ChevronRight = createIcon(); const ChevronsLeft = createIcon(); const ChevronsRight = createIcon(); const Pencil = createIcon(); const Trash2 = createIcon();

const DashboardLayout = ({ children }) => <div className="p-4 sm:p-6">{children}</div>;
const Button = ({ children, ...props }) => <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" {...props}>{children}</button>;
const Input = (props) => <input className="px-4 py-2 border rounded-md w-full" {...props} />;
const Card = ({ children }) => <div className="bg-white shadow rounded-lg overflow-hidden">{children}</div>;
const CardHeader = ({ children }) => <div className="p-4 border-b">{children}</div>;
const CardTitle = ({ children }) => <h3 className="text-lg font-semibold">{children}</h3>;
const CardContent = ({ children }) => <div className="p-4">{children}</div>;
const Tabs = ({ children }) => <div>{children}</div>;
const TabsList = ({ children }) => <div className="flex border-b">{children}</div>;
const TabsTrigger = ({ children, ...props }) => <button className="px-4 py-2 -mb-px border-b-2 border-transparent hover:border-blue-500 focus:outline-none focus:border-blue-500" {...props}>{children}</button>;
const Badge = ({ children, className }) => <span className={`px-2 py-1 text-xs font-medium rounded-full ${className}`}>{children}</span>;
const Table = ({ children }) => <table className="min-w-full divide-y divide-gray-200">{children}</table>;
const TableHeader = ({ children }) => <thead>{children}</thead>;
const TableRow = ({ children }) => <tr>{children}</tr>;
const TableHead = ({ children }) => <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{children}</th>;
const TableBody = ({ children }) => <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>;
const TableCell = ({ children, ...props }) => <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700" {...props}>{children}</td>;
const DropdownMenu = ({ children }) => <div className="relative inline-block text-left">{children}</div>;
const DropdownMenuTrigger = ({ children }) => <div>{children}</div>;
const DropdownMenuContent = ({ children }) => <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">{children}</div>;
const DropdownMenuItem = ({ children, ...props }) => <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" {...props}>{children}</a>;
const Dialog = ({ children, open }) => open ? <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"><div className="bg-white p-6 rounded-lg shadow-xl">{children}</div></div> : null;
const DialogContent = ({ children }) => <div>{children}</div>;
const DialogHeader = ({ children }) => <div className="pb-4 border-b">{children}</div>;
const DialogTitle = ({ children }) => <h2 className="text-xl font-bold">{children}</h2>;
const DialogDescription = ({ children }) => <p className="text-sm text-gray-500 mt-2">{children}</p>;
const DialogFooter = ({ children }) => <div className="pt-4 border-t flex justify-end space-x-2">{children}</div>;
const AlertDialog = ({ children, open }) => open ? <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"><div className="bg-white p-6 rounded-lg shadow-xl max-w-md">{children}</div></div> : null;
const AlertDialogContent = ({ children }) => <div>{children}</div>;
const AlertDialogHeader = ({ children }) => <div>{children}</div>;
const AlertDialogTitle = ({ children }) => <h2 className="text-xl font-bold">{children}</h2>;
const AlertDialogDescription = ({ children }) => <p className="text-sm text-gray-600 mt-2 mb-4">{children}</p>;
const AlertDialogFooter = ({ children }) => <div className="flex justify-end space-x-2">{children}</div>;
const AlertDialogAction = ({ children, ...props }) => <Button {...props}>{children}</Button>;
const AlertDialogCancel = ({ children, ...props }) => <Button variant="ghost" {...props}>{children}</Button>;
const Label = ({ children, ...props }) => <label className="text-sm font-medium" {...props}>{children}</label>;
const Select = ({ children }) => <div className="relative">{children}</div>;
const SelectTrigger = ({ children }) => <button className="w-full text-left px-4 py-2 border rounded-md bg-white">{children}</button>;
const SelectValue = ({ placeholder }) => <span>{placeholder}</span>;
const SelectContent = ({ children }) => <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">{children}</div>;
const SelectItem = ({ children, value }) => <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer">{children}</div>;
const Switch = (props) => <input type="checkbox" className="toggle-switch" {...props} />;
const useToast = () => ({ toast: (options) => console.log('Toast:', options) });

// Mocks para componentes customizados de Tracking
const CreatePurchaseDialog = ({ open }) => open ? <Dialog open={open}><DialogTitle>Criar Nova Compra</DialogTitle></Dialog> : null;
const EditPurchaseDialog = ({ open, purchase }) => open ? <Dialog open={open}><DialogTitle>Editar Compra #{purchase?.id}</DialogTitle></Dialog> : null;
const CreateReturnDialog = ({ open }) => open ? <Dialog open={open}><DialogTitle>Criar Nova Devolução</DialogTitle></Dialog> : null;
const CreateTransferDialog = ({ open }) => open ? <Dialog open={open}><DialogTitle>Criar Nova Transferência</DialogTitle></Dialog> : null;
const TrackingDetailsDialog = ({ open, item }) => open ? <Dialog open={open}><DialogTitle>Detalhes: {item?.trackingCode}</DialogTitle></Dialog> : null;
const KanbanBoard = () => <div className="p-4 bg-gray-100 rounded">Kanban Board Placeholder</div>;

// Mock para a API e Store de Tracking
const getTrackingUrl = (carrier, code) => `https://www.example.com/track?carrier=${carrier}&code=${code}`;
const useTrackingStore = () => ({
    purchases: [{ id: '1', date: new Date().toISOString(), customer_name: 'Loja Exemplo', trackingCode: 'BR12345', products: [{ name: 'Produto A' }], status: 'Em trânsito', estimated_delivery: new Date().toISOString() }],
    returns: [], transfers: [], viewMode: 'table', showArchived: false, loading: false,
    setViewMode: () => {}, setShowArchived: () => {},
    fetchPurchases: async () => {}, fetchReturns: async () => {}, fetchTransfers: async () => {},
    updateAllTrackingStatuses: async () => {}, verifyPurchaseProduct: async () => {}, addProductToInventory: async () => {},
    archivePurchase: async () => {}, archiveReturn: async () => {}, archiveTransfer: async () => {},
    findItemByTrackingCode: async () => null, deletePurchase: async () => {},
});

// --- CÓDIGO DA SUA TRACKINGPAGE.TSX ---
// #region Funções de Helper
const getItemStatusCategory = (item) => {
  const statusLower = (item.status || '').toLowerCase();
  if (statusLower.includes('saiu para entrega')) return 'Saiu para entrega';
  if (statusLower.includes('pagamento')) return 'Aguardando pagamento';
  if (statusLower.includes('problema') || statusLower.includes('não autorizada') || statusLower.includes('extraviado')) return 'Pausado/Problema';
  if (statusLower.includes('entregue') || statusLower.includes('conferido') || statusLower.includes('estoque')) return 'Entregue';
  if (statusLower.includes('trânsito') || statusLower.includes('transferência')) return 'Em trânsito';
  if (statusLower.includes('aguardando') || statusLower.includes('aguarde')) return 'Aguardando';
  return 'Outro';
};
const getStatusColor = (status) => {
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('saiu para entrega')) return 'bg-[#03A9F4] text-white';
  else if (statusLower.includes('pagamento')) return 'bg-[#FFC107] text-gray-900';
  else if (statusLower.includes('entregue')) return 'bg-green-100 text-green-800';
  else if (statusLower.includes('trânsito')) return 'bg-blue-100 text-blue-800';
  else if (statusLower.includes('aguardando')) return 'bg-yellow-100 text-yellow-800';
  else if (statusLower.includes('problema')) return 'bg-red-100 text-red-800';
  else return 'bg-gray-100 text-gray-800';
};
// #endregion

function useTable(data, defaultSortKey, defaultRowsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [sortConfig, setSortConfig] = useState({ key: defaultSortKey, direction: 'descending' });
  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const totalRows = sortedData.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };
  const changePage = (page) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };
  const changeRowsPerPage = (newSize) => { setRowsPerPage(newSize); setCurrentPage(1); };
  useEffect(() => { setCurrentPage(1); setSortConfig({ key: defaultSortKey, direction: 'descending' }); }, [data, defaultSortKey]);
  return { paginatedData, requestSort, sortConfig, currentPage, totalPages, changePage, rowsPerPage, changeRowsPerPage, totalRows };
}

function TrackingPage() {
  const {
    purchases, returns, transfers, viewMode, showArchived, loading,
    setViewMode, setShowArchived, fetchPurchases, fetchReturns, fetchTransfers,
    deletePurchase
  } = useTrackingStore();
  const [activeTab, setActiveTab] = useState('purchases');
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createPurchaseOpen, setCreatePurchaseOpen] = useState(false);
  const [createReturnOpen, setCreateReturnOpen] = useState(false);
  const [createTransferOpen, setCreateTransferOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState(null);
  const [isEditPurchaseOpen, setIsEditPurchaseOpen] = useState(false);
  const [purchaseToEdit, setPurchaseToEdit] = useState(null);
  const [purchaseToDelete, setPurchaseToDelete] = useState(null);
  const { toast } = useToast();

  useEffect(() => { fetchPurchases(); fetchReturns(); fetchTransfers(); }, [fetchPurchases, fetchReturns, fetchTransfers]);
  const filteredData = useMemo(() => {
    let dataToFilter = [];
    if (activeTab === 'purchases') dataToFilter = purchases;
    if (activeTab === 'returns') dataToFilter = returns;
    if (activeTab === 'transfers') dataToFilter = transfers;
    return dataToFilter; // Simplificado para o mock
  }, [purchases, returns, transfers, activeTab]);

  const { paginatedData, requestSort, sortConfig, currentPage, totalPages, changePage, rowsPerPage, changeRowsPerPage, totalRows } = useTable(filteredData, 'date');
  const handleRefreshTracking = () => { toast({ title: "Atualizando..." }); };
  const handleViewDetails = (item) => { setSelectedItem(item); setDetailsOpen(true); };
  const handleEditPurchase = (purchase) => { setPurchaseToEdit(purchase); setIsEditPurchaseOpen(true); };
  const handleDeletePurchaseConfirm = async () => { if (!purchaseToDelete) return; await deletePurchase(purchaseToDelete.id); toast({ title: "Sucesso!" }); setPurchaseToDelete(null); };
  const handleEditPurchaseClose = (isOpen) => { setIsEditPurchaseOpen(isOpen); if (!isOpen) setPurchaseToEdit(null); };

  const SortableHeader = ({ tKey, label }) => <TableHead><Button variant="ghost" onClick={() => requestSort(tKey)}>{label} <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>;
  const renderTableView = () => (
    <Card>
      <CardHeader><CardTitle>Rastreamentos</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><SortableHeader tKey="date" label="Data" /><SortableHeader tKey="customer_name" label="Loja/Cliente" /><SortableHeader tKey="trackingCode" label="Rastreio" /><SortableHeader tKey="status" label="Status" /><TableHead>Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {paginatedData.map(item => (
              <TableRow key={item.id}>
                <TableCell>{new Date(item.date).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>{item.customer_name}</TableCell>
                <TableCell>{item.trackingCode}</TableCell>
                <TableCell><Badge className={getStatusColor(item.status)}>{item.status}</Badge></TableCell>
                <TableCell><div className="flex space-x-2"><Button variant="outline" size="sm" onClick={() => handleEditPurchase(item)}><Pencil /></Button><Button variant="outline" size="sm" onClick={() => handleViewDetails(item)}><Eye /></Button><Button variant="destructive" size="sm" onClick={() => setPurchaseToDelete(item)}><Trash2 /></Button></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {/* Paginação aqui */}
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-3xl font-bold">Acompanhamento</h1><p className="text-gray-600">Gerencie compras, devoluções e transferências</p></div>
          <DropdownMenu>
            <DropdownMenuTrigger><Button><Plus className="mr-2" />Adicionar</Button></DropdownMenuTrigger>
            <DropdownMenuContent><DropdownMenuItem onClick={() => setCreatePurchaseOpen(true)}>Nova Compra</DropdownMenuItem><DropdownMenuItem onClick={() => setCreateReturnOpen(true)}>Nova Devolução</DropdownMenuItem><DropdownMenuItem onClick={() => setCreateTransferOpen(true)}>Nova Transferência</DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}><TabsList><TabsTrigger value="purchases">Compras</TabsTrigger><TabsTrigger value="returns">Devoluções</TabsTrigger><TabsTrigger value="transfers">Transferências</TabsTrigger></TabsList></Tabs>
        <div>{renderTableView()}</div>
      </motion.div>
      <CreatePurchaseDialog open={createPurchaseOpen} onOpenChange={setCreatePurchaseOpen} />
      <CreateReturnDialog open={createReturnOpen} onOpenChange={setCreateReturnOpen} />
      <CreateTransferDialog open={createTransferOpen} onOpenChange={setCreateTransferOpen} />
      <TrackingDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} item={selectedItem} />
      <EditPurchaseDialog open={isEditPurchaseOpen} onOpenChange={handleEditPurchaseClose} purchase={purchaseToEdit} />
      <AlertDialog open={!!purchaseToDelete} onOpenChange={(isOpen) => !isOpen && setPurchaseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Você tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita e excluirá permanentemente o pedido.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeletePurchaseConfirm}>Sim, deletar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}


// --- FIM DO CÓDIGO DA TRACKINGPAGE ---

// Função para criar páginas de exemplo (exceto TrackingPage)
const createPlaceholderPage = (name) => () => (
    <div className="flex items-center justify-center min-h-screen"><div className="p-8 bg-white rounded-lg shadow-md"><h1 className="text-2xl font-bold text-gray-800">{name}</h1></div></div>
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

// Simulação do Zustand Store para autenticação
const useAuthStore = () => ({
  user: { email: 'usuario@exemplo.com', uid: '12345' }, // Simula um usuário logado
  loading: false,
  initialize: async () => { console.log("Auth Store Initialized (Mock)"); return Promise.resolve(); },
});

// Simulação do Zustand Store para Workspaces
const mockWorkspaces = [{ id: 'ws_1', name: 'Workspace Pessoal' }, { id: 'ws_2', name: 'Projeto Secreto' }];
const useWorkspaceStore = (setCurrentWorkspaceState) => {
    const fetchWorkspaces = async () => Promise.resolve(mockWorkspaces);
    const setCurrentWorkspace = (workspace) => {
        setCurrentWorkspaceState(workspace);
        if (workspace) localStorage.setItem('currentWorkspaceId', workspace.id);
    };
    return { workspaces: mockWorkspaces, fetchWorkspaces, setCurrentWorkspace };
};
useWorkspaceStore.getState = () => ({ workspaces: mockWorkspaces });

// --- Início da lógica principal do App ---

function AppContent() {
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
      setWorkspaceLoading(true);
      try {
        await fetchWorkspaces();
        const updatedWorkspaces = useWorkspaceStore.getState().workspaces;
        if (updatedWorkspaces.length > 0) {
          const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
          let workspaceToSet = updatedWorkspaces.find(w => w.id === savedWorkspaceId) || updatedWorkspaces[0];
          setStoreWorkspace(workspaceToSet);
          const savedRoute = localStorage.getItem('lastVisitedRoute');
          if (location.pathname === '/' && savedRoute && savedRoute !== '/onboarding') {
            navigate(savedRoute, { replace: true });
          }
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

  if (authLoading || (user && workspaceLoading)) {
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
            ) : !appInitialized ? (
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">...Carregando</div>
            ) : workspaces.length === 0 ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">...Finalizando</div>
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
      try { await initialize(); }
      catch (error) { console.error('Error initializing auth:', error); }
      finally { setAuthInitialized(true); }
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

