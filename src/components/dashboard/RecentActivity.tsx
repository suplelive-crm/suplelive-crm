import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, ShoppingCart, MessageSquare, CheckCircle, Clock } from 'lucide-react';

// Mock data - in a real app, this would come from your API
const activities = [
  {
    id: 1,
    user: 'John Doe',
    action: 'Criou novo lead',
    target: 'Volim Raba',
    time: '2 minutos atrás',
    type: 'lead',
    icon: UserPlus,
  },
  {
    id: 2,
    user: 'Jane Smith',
    action: 'Converteu lead para cliente',
    target: 'Bob Wilson',
    time: '1 hora atrás',
    type: 'conversion',
    icon: CheckCircle,
  },
  {
    id: 3,
    user: 'Mike Johnson',
    action: 'Enviou mensagem WhatsApp',
    target: 'Carol Davis',
    time: '3 horas atrás',
    type: 'message',
    icon: MessageSquare,
  },
  {
    id: 4,
    user: 'Sarah Brown',
    action: 'Criou novo pedido',
    target: 'R$ 2.450',
    time: '5 horas atrás',
    type: 'order',
    icon: ShoppingCart,
  },
  {
    id: 5,
    user: 'David Miller',
    action: 'Agendou reunião com',
    target: 'Jennifer White',
    time: '6 horas atrás',
    type: 'meeting',
    icon: Clock,
  },
];

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('');
};

const getBadgeVariant = (type: string) => {
  switch (type) {
    case 'lead': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'conversion': return 'bg-green-100 text-green-800 border-green-200';
    case 'message': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'order': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'meeting': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function RecentActivity() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Atividade Recente</CardTitle>
        <CardDescription>Últimas ações no seu CRM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {activities.map((activity) => {
          const Icon = activity.icon;
          return (
            <div key={activity.id} className="flex items-start space-x-4">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(activity.user)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center">
                  <p className="text-sm font-medium leading-none">
                    {activity.user}
                  </p>
                  <Badge className={`ml-2 ${getBadgeVariant(activity.type)}`}>
                    <Icon className="h-3 w-3 mr-1" />
                    <span className="text-xs">{activity.type}</span>
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {activity.action} <span className="font-medium">{activity.target}</span>
                </p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}