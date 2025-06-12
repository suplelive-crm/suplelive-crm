import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { CheckSquare, Database, Eye, MoreVertical, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Purchase, Return, Transfer } from '@/types/tracking';
import { getTrackingUrl } from '@/lib/tracking-api';

interface KanbanBoardProps {
  activeTab: string;
  purchases: Purchase[];
  returns: Return[];
  transfers: Transfer[];
  onViewDetails: (item: Purchase | Return | Transfer) => void;
  onVerifyProduct: (purchaseId: string, productId: string) => Promise<void>;
  onAddToInventory: (id: string, type: 'purchase' | 'return' | 'transfer') => Promise<void>;
}

export function KanbanBoard({ 
  activeTab, 
  purchases, 
  returns, 
  transfers,
  onViewDetails,
  onVerifyProduct,
  onAddToInventory
}: KanbanBoardProps) {
  // Define status columns
  const statusColumns = [
    { id: 'awaiting', title: 'Aguardando' },
    { id: 'transit', title: 'Em Trânsito' },
    { id: 'delivered', title: 'Entregue' },
    { id: 'completed', title: 'Concluído' },
  ];
  
  // Group items by status
  const getItemsByStatus = () => {
    const result: Record<string, (Purchase | Return | Transfer)[]> = {
      awaiting: [],
      transit: [],
      delivered: [],
      completed: [],
    };
    
    const items = activeTab === 'purchases' 
      ? purchases 
      : activeTab === 'returns' 
        ? returns 
        : transfers;
    
    items.forEach(item => {
      const status = (item.status || '').toLowerCase();
      
      if (status.includes('aguardando')) {
        result.awaiting.push(item);
      } else if (status.includes('trânsito')) {
        result.transit.push(item);
      } else if (status.includes('entregue') && !status.includes('conferido')) {
        result.delivered.push(item);
      } else if (status.includes('conferido') || status.includes('estoque')) {
        result.completed.push(item);
      } else {
        // Default to awaiting if status doesn't match any category
        result.awaiting.push(item);
      }
    });
    
    return result;
  };
  
  const [itemsByStatus, setItemsByStatus] = useState(getItemsByStatus());
  
  // Update grouping when items change
  useEffect(() => {
    setItemsByStatus(getItemsByStatus());
  }, [purchases, returns, transfers, activeTab]);
  
  const handleDragEnd = (result: DropResult) => {
    // Implement drag and drop logic if needed
    // For now, this is just a visual representation
  };
  
  const getStatusColor = (status: string) => {
    if (status.includes('entregue') || status.includes('conferido')) {
      return 'bg-green-100 text-green-800';
    } else if (status.includes('trânsito')) {
      return 'bg-blue-100 text-blue-800';
    } else if (status.includes('aguardando')) {
      return 'bg-yellow-100 text-yellow-800';
    } else if (status.includes('problema') || status.includes('extraviado')) {
      return 'bg-red-100 text-red-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };
  
  const renderPurchaseCard = (purchase: Purchase) => {
    // Check if all products are verified
    const allProductsVerified = purchase.products?.every(p => p.isVerified) || false;
    
    // Check if purchase is already in inventory
    const isInInventory = purchase.status?.toLowerCase().includes('estoque') || false;
    
    return (
      <Card className="mb-3 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="font-medium text-sm">{purchase.storeName || 'Loja não informada'}</h4>
              {purchase.customerName && (
                <p className="text-xs text-gray-600">Cliente: {purchase.customerName}</p>
              )}
            </div>
            <Badge className={getStatusColor(purchase.status)}>
              {purchase.status || 'Não informado'}
            </Badge>
          </div>
          
          <div className="space-y-1 mb-3">
            <p className="text-xs text-gray-600">
              Data: {new Date(purchase.date).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-xs text-gray-600 flex items-center">
              <span>Rastreio: {purchase.trackingCode || 'Não informado'}</span>
              {purchase.trackingCode && (
                <a 
                  href={getTrackingUrl(purchase.carrier, purchase.trackingCode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 ml-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                </a>
              )}
            </p>
            <p className="text-xs text-gray-600">
              Produtos: {purchase.products?.length || 0} item(s)
            </p>
          </div>
          
          <div className="flex justify-between items-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onViewDetails(purchase)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Detalhes
            </Button>
            
            <div className="flex gap-2">
              {!allProductsVerified && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CheckSquare className="h-3 w-3 mr-1" />
                      Conferir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Produto</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja marcar todos os produtos desta compra como conferidos?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => {
                          if (purchase.products) {
                            purchase.products.forEach(product => {
                              onVerifyProduct(purchase.id, product.id);
                            });
                          }
                        }}
                      >
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              
              {allProductsVerified && !isInInventory && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="default" size="sm">
                      <Database className="h-3 w-3 mr-1" />
                      Lançar no Estoque
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Lançar no Estoque</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja lançar todos os produtos desta compra no estoque? Esta ação irá arquivar a compra.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => onAddToInventory(purchase.id, 'purchase')}
                      >
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              
              {allProductsVerified && (
                <Badge className="bg-blue-100 text-blue-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Conferido
                </Badge>
              )}
              
              {isInInventory && (
                <Badge className="bg-green-100 text-green-800">
                  <Database className="h-3 w-3 mr-1" />
                  No Estoque
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  const renderReturnOrTransferCard = (item: Return | Transfer, type: 'return' | 'transfer') => {
    // Check if item is already in inventory
    const isInInventory = item.status?.toLowerCase().includes('estoque') || false;
    
    return (
      <Card className="mb-3 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="font-medium text-sm">{item.customerName || 'Cliente não informado'}</h4>
              <p className="text-xs text-gray-600">Loja: {item.storeName || 'Não informada'}</p>
            </div>
            <Badge className={getStatusColor(item.status)}>
              {item.status || 'Não informado'}
            </Badge>
          </div>
          
          <div className="space-y-1 mb-3">
            <p className="text-xs text-gray-600">
              Data: {new Date(item.date).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-xs text-gray-600 flex items-center">
              <span>Rastreio: {item.trackingCode || 'Não informado'}</span>
              {item.trackingCode && (
                <a 
                  href={getTrackingUrl(item.carrier, item.trackingCode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 ml-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                </a>
              )}
            </p>
          </div>
          
          <div className="flex justify-between items-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onViewDetails(item)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Detalhes
            </Button>
            
            {!isInInventory ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="default" size="sm">
                    <Database className="h-3 w-3 mr-1" />
                    Lançar no Estoque
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Lançar no Estoque</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja lançar {type === 'return' ? 'esta devolução' : 'esta transferência'} no estoque? Esta ação irá arquivar o item.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => onAddToInventory(item.id, type)}
                    >
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Badge className="bg-green-100 text-green-800">
                <Database className="h-3 w-3 mr-1" />
                No Estoque
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };
  
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-full">
        {statusColumns.map((column) => (
          <div key={column.id} className="flex flex-col h-full">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{column.title}</span>
                  <Badge variant="outline">
                    {itemsByStatus[column.id]?.length || 0}
                  </Badge>
                </CardTitle>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-y-auto p-3">
                <Droppable droppableId={column.id}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="h-full min-h-[200px]"
                    >
                      {itemsByStatus[column.id]?.map((item, index) => (
                        <Draggable
                          key={item.id}
                          draggableId={item.id}
                          index={index}
                          isDragDisabled={true} // Disable drag for now
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              {activeTab === 'purchases' && renderPurchaseCard(item as Purchase)}
                              {activeTab === 'returns' && renderReturnOrTransferCard(item as Return, 'return')}
                              {activeTab === 'transfers' && renderReturnOrTransferCard(item as Transfer, 'transfer')}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {itemsByStatus[column.id]?.length === 0 && (
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                          Nenhum item
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}