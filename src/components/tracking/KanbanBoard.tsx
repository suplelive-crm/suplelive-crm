import { useMemo } from 'react';
import { CheckSquare, Database, Eye, CheckCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

// =================================================================
// 1. LÓGICA DE STATUS UNIFICADA E DEFINIÇÃO DAS COLUNAS
// =================================================================
const KANBAN_COLUMNS = ['Aguardando', 'Em Trânsito', 'Atrasado', 'Com problemas', 'Entregue', 'Concluído'] as const;
type KanbanColumn = typeof KANBAN_COLUMNS[number];

const getItemKanbanColumn = (item: Purchase | Return | Transfer): KanbanColumn => {
    const statusLower = (item.status || '').toLowerCase();

    // 1. Concluído (Prioridade máxima): item já processado e lançado no estoque.
    if (statusLower.includes('estoque')) {
        return 'Concluído';
    }

    // 2. Entregue: Objeto entregue ou conferido, mas ainda não lançado no estoque.
    if (statusLower.includes('entregue') || statusLower.includes('conferido')) {
        return 'Entregue';
    }

    // 3. Com problemas: Agrega vários status problemáticos.
    if (
        statusLower.includes('problema') ||
        statusLower.includes('PROBLEMA') ||
        statusLower.includes('não autorizada') ||
        statusLower.includes('necessidade de apresentar') ||
        statusLower.includes('extraviado') ||
        statusLower.includes('pausado')
    ) {
        return 'Com problemas';
    }
    
    // 4. Atrasado: Deve ser verificado antes de "Em Trânsito".
    const isFinalStatus = statusLower.includes('entregue') || statusLower.includes('conferido') || statusLower.includes('estoque');
    if (!isFinalStatus && item.estimated_delivery && new Date(item.estimated_delivery) < new Date()) {
        return 'Atrasado';
    }

    // 5. Em Trânsito: Itens em movimento.
    if (statusLower.includes('trânsito') || statusLower.includes('transferência')) {
        return 'Em Trânsito';
    }

    // 6. Aguardando: Itens que aguardam postagem, coleta ou são o fallback.
    return 'Aguardando';
};

// =================================================================
// 2. COMPONENTE DO CARTÃO KANBAN
// =================================================================
interface KanbanCardProps {
  item: Purchase | Return | Transfer;
  onViewDetails: (item: Purchase | Return | Transfer) => void;
  onVerifyProduct: (purchaseId: string, productId: string) => Promise<void>;
  onAddToInventory: (id: string, type: 'purchase' | 'return' | 'transfer') => Promise<void>;
}

const KanbanCard = ({ item, onViewDetails, onVerifyProduct, onAddToInventory }: KanbanCardProps) => {
  const isPurchase = 'products' in item;
  const isInInventory = item.status?.toLowerCase().includes('estoque') || false;
  const allProductsVerified = isPurchase ? (item as Purchase).products?.every(p => p.isVerified) || false : false;

  return (
    <Card className="mb-4 hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-3">
        <div className="flex justify-between items-start mb-2">
          <span className="font-semibold text-sm pr-2 break-words">
            {isPurchase ? (item as Purchase).storeName : (item as Return | Transfer).customerName || 'Não identificado'}
          </span>
          <Badge variant={isPurchase ? 'default' : (item as Return).type === 'return' ? 'secondary' : 'outline'}>
            {isPurchase ? 'Compra' : (item as Return).type === 'return' ? 'Dev.' : 'Transf.'}
          </Badge>
        </div>

        <div className="space-y-1 text-xs text-gray-600 mb-3">
          <p>Data: {new Date(item.date).toLocaleDateString('pt-BR')}</p>
          <p className="flex items-center gap-1">
            <span>Rastreio: {item.trackingCode || 'N/A'}</span>
            {item.trackingCode && (
              <a href={getTrackingUrl(item.carrier, item.trackingCode)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                <ExternalLink size={12} />
              </a>
            )}
          </p>
          {isPurchase && <p>Produtos: {(item as Purchase).products?.length || 0}</p>}
        </div>

        <div className="flex flex-wrap gap-2 items-center justify-end">
          <Button variant="outline" size="sm" onClick={() => onViewDetails(item)}>
            <Eye className="h-4 w-4" />
          </Button>

          {isPurchase && !allProductsVerified && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm"><CheckSquare className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Conferir Produtos</AlertDialogTitle><AlertDialogDescription>Marcar todos os produtos como conferidos?</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => (item as Purchase).products.forEach(p => onVerifyProduct(item.id, p.id))}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {(allProductsVerified || !isPurchase) && !isInInventory && (
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" size="sm"><Database className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Lançar no Estoque</AlertDialogTitle><AlertDialogDescription>Esta ação irá arquivar o item. Tem certeza?</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onAddToInventory(item.id, isPurchase ? 'purchase' : (item as Return).type)}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {allProductsVerified && !isInInventory && (
             <Badge variant="outline" className="text-blue-600 border-blue-600"><CheckCircle className="h-3 w-3 mr-1" />Conferido</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};


// =================================================================
// 3. COMPONENTE PRINCIPAL DO KANBAN BOARD
// =================================================================

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

  const items = useMemo(() => {
    switch (activeTab) {
      case 'purchases': return purchases;
      case 'returns': return returns;
      case 'transfers': return transfers;
      default: return [];
    }
  }, [activeTab, purchases, returns, transfers]);

  const groupedItems = useMemo(() => {
    const initialGroups: Record<KanbanColumn, (Purchase | Return | Transfer)[]> = {
      'Aguardando': [], 'Em Trânsito': [], 'Atrasado': [], 'Com problemas': [], 'Entregue': [], 'Concluído': []
    };
    
    return items.reduce((acc, item) => {
      const column = getItemKanbanColumn(item);
      if (acc[column]) {
        acc[column].push(item);
      }
      return acc;
    }, initialGroups);
  }, [items]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5 w-full">
      {KANBAN_COLUMNS.map((column) => (
        <div key={column} className="bg-gray-100/70 rounded-xl flex flex-col">
          {/* Cabeçalho da Coluna */}
          <div className="p-3 border-b border-gray-200 sticky top-0 bg-gray-100/70 rounded-t-xl z-10 backdrop-blur-sm">
             <h2 className="font-bold text-gray-900 text-md flex items-center justify-between">
              <span>{column}</span>
              <span className="text-sm font-medium bg-gray-300/80 text-gray-800 rounded-full h-6 w-6 flex items-center justify-center">
                {groupedItems[column].length}
              </span>
            </h2>
          </div>
          {/* Corpo da Coluna com os Cartões */}
          <div className="flex-grow p-2 overflow-y-auto">
            {groupedItems[column].length > 0 ? (
              groupedItems[column].map(item => (
                <KanbanCard 
                  key={item.id} 
                  item={item} 
                  onViewDetails={onViewDetails}
                  onVerifyProduct={onVerifyProduct}
                  onAddToInventory={onAddToInventory}
                />
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs p-4">
                Nenhum item nesta etapa.
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}