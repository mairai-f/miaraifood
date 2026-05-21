import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'scheduled' | 'completed' | 'cancelled';
  className?: string;
}

const statusStyles = {
  scheduled: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

const statusLabels = {
  scheduled: 'Agendado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
