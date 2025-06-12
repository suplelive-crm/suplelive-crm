import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '@/lib/utils';

// Mock data - in a real app, this would come from your API
const data = [
  { name: 'Jan', revenue: 4000, orders: 24 },
  { name: 'Fev', revenue: 3000, orders: 18 },
  { name: 'Mar', revenue: 5000, orders: 32 },
  { name: 'Abr', revenue: 4500, orders: 28 },
  { name: 'Mai', revenue: 6000, orders: 38 },
  { name: 'Jun', revenue: 5500, orders: 35 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background p-3 border rounded-lg shadow-sm">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-sm text-blue-600">
          Receita: <span className="font-medium">R$ {payload[0].value.toLocaleString()}</span>
        </p>
        <p className="text-sm text-emerald-600">
          Pedidos: <span className="font-medium">{payload[1].value}</span>
        </p>
      </div>
    );
  }

  return null;
};

export function RevenueChart() {
  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            className="text-xs text-muted-foreground"
          />
          <YAxis 
            yAxisId="left"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(value) => `R$ ${value}`}
            className="text-xs text-muted-foreground"
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            className="text-xs text-muted-foreground"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: 10 }}
            formatter={(value) => <span className="text-sm">{value === 'revenue' ? 'Receita' : 'Pedidos'}</span>}
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="revenue" 
            stroke="hsl(var(--chart-1))" 
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 2 }}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="orders" 
            stroke="hsl(var(--chart-2))" 
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2 }}
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}