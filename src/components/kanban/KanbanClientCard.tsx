import { useState } from 'react';
import { User, Phone, Mail, MoreVertical, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { KanbanClientAssignment } from '@/types';
import { useKanbanStore } from '@/store/kanbanStore';

interface KanbanClientCardProps {
  assignment: KanbanClientAssignment;
}

export function KanbanClientCard({ assignment }: KanbanClientCardProps) {
  const { removeClientFromBoard } = useKanbanStore();
  const { client } = assignment;

  if (!client) return null;

  const handleRemoveClient = async () => {
    await removeClientFromBoard(assignment.id);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Card className="cursor-grab hover:cursor-grabbing hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-blue-600">
                {getInitials(client.name)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {client.name}
              </h4>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <X className="h-4 w-4 mr-2" />
                    Remover do Quadro
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover Cliente</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover "{client.name}" deste quadro Kanban?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveClient}>
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="space-y-1">
          {client.phone && (
            <div className="flex items-center space-x-1 text-xs text-gray-600">
              <Phone className="h-3 w-3" />
              <span className="truncate">{client.phone}</span>
            </div>
          )}
          
          {client.email && (
            <div className="flex items-center space-x-1 text-xs text-gray-600">
              <Mail className="h-3 w-3" />
              <span className="truncate">{client.email}</span>
            </div>
          )}
        </div>
        
        {client.tags && client.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {client.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {client.tags.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{client.tags.length - 2}
              </Badge>
            )}
          </div>
        )}
        
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span>Pedidos: {client.total_orders || 0}</span>
          <span>R$ {(client.total_spent || 0).toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}