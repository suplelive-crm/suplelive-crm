import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { DivideIcon as LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  index: number;
  className?: string;
  valueClassName?: string;
  iconClassName?: string;
}

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  index,
  className,
  valueClassName,
  iconClassName
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className={cn("hover:shadow-md transition-all duration-300", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className={cn("text-2xl font-bold", valueClassName)}>{value}</p>
              {trend && (
                <p className={cn(
                  "text-xs flex items-center gap-1",
                  trend.isPositive ? "text-green-600" : "text-red-600"
                )}>
                  <span className={cn(
                    "inline-block",
                    trend.isPositive ? "border-l border-b rotate-45" : "border-l border-t -rotate-45"
                  )} style={{ width: '6px', height: '6px' }}></span>
                  {trend.isPositive ? '+' : ''}{trend.value}% desde o mês passado
                </p>
              )}
            </div>
            <div className={cn(
              "flex items-center justify-center w-12 h-12 rounded-full bg-primary/10",
              iconClassName
            )}>
              <Icon className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}