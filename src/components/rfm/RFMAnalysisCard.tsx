import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RFMAnalysis } from '@/types';
import { Clock, ShoppingCart, DollarSign } from 'lucide-react';

interface RFMAnalysisCardProps {
  analysis: RFMAnalysis;
}

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Champions':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Loyal Customers':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Potential Loyalists':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'New Customers':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'Promising':
      return 'bg-violet-100 text-violet-800 border-violet-200';
    case 'Need Attention':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'About to Sleep':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'At Risk':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'Cannot Lose Them':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'Hibernating':
      return 'bg-slate-100 text-slate-800 border-slate-200';
    case 'Lost':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getCategoryDescription = (category: string) => {
  switch (category) {
    case 'Champions':
      return 'Clientes de alto valor que compram frequentemente e recentemente';
    case 'Loyal Customers':
      return 'Clientes fiéis que compram regularmente';
    case 'Potential Loyalists':
      return 'Clientes recentes com potencial para se tornarem fiéis';
    case 'New Customers':
      return 'Clientes novos que fizeram poucas compras';
    case 'Promising':
      return 'Clientes recentes com gasto acima da média';
    case 'Need Attention':
      return 'Clientes que não compram há algum tempo';
    case 'About to Sleep':
      return 'Clientes em risco de se tornarem inativos';
    case 'At Risk':
      return 'Clientes valiosos que não compram há muito tempo';
    case 'Cannot Lose Them':
      return 'Clientes de alto valor em risco de abandono';
    case 'Hibernating':
      return 'Clientes inativos com baixo valor';
    case 'Lost':
      return 'Clientes que provavelmente não retornarão';
    default:
      return 'Análise de comportamento de compra do cliente';
  }
};

export function RFMAnalysisCard({ analysis }: RFMAnalysisCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Análise RFM</CardTitle>
            <CardDescription>Segmentação baseada no comportamento de compra</CardDescription>
          </div>
          <Badge className={getCategoryColor(analysis.category)}>
            {analysis.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {getCategoryDescription(analysis.category)}
        </p>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted/30 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-medium">Recência</h3>
            </div>
            <div className="text-2xl font-bold text-blue-600">{analysis.recency}</div>
            <div className="text-xs text-muted-foreground mt-1">Dias desde último pedido</div>
          </div>
          
          <div className="bg-muted/30 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-medium">Frequência</h3>
            </div>
            <div className="text-2xl font-bold text-green-600">{analysis.frequency}</div>
            <div className="text-xs text-muted-foreground mt-1">Total de pedidos</div>
          </div>
          
          <div className="bg-muted/30 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-medium">Monetário</h3>
            </div>
            <div className="text-2xl font-bold text-purple-600">R$ {analysis.monetary.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">Total gasto</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            <div className="text-sm font-medium">Score RFM</div>
            <div className="text-lg font-bold">{analysis.rfm_score}</div>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">R</span>ecência • <span className="font-medium">F</span>requência • <span className="font-medium">M</span>onetário
          </div>
        </div>
      </CardContent>
    </Card>
  );
}