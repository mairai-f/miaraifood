import { formatDateTime } from '../../shared/locale/format';

export interface SubscriptionTimingLike {
  status: string;
  trial_ends_at?: string | null;
  current_period_ends_at?: string | null;
}

export const activeSubscriptionStatuses = new Set(['trialing', 'active', 'past_due']);

export const getSubscriptionEndAt = (subscription: SubscriptionTimingLike | null | undefined) => {
  if (!subscription) return null;

  if (subscription.status === 'trialing') {
    return subscription.trial_ends_at ?? subscription.current_period_ends_at ?? null;
  }

  return subscription.current_period_ends_at ?? subscription.trial_ends_at ?? null;
};

export const isCurrentSubscription = (subscription: SubscriptionTimingLike | null | undefined) => {
  if (!subscription || !activeSubscriptionStatuses.has(subscription.status)) return false;

  const endAt = getSubscriptionEndAt(subscription);
  if (!endAt) return true;

  return new Date(endAt).getTime() > Date.now();
};

export const getSubscriptionStatusLabel = (subscription: SubscriptionTimingLike | null | undefined) => {
  if (!subscription) return 'Sem plano ativo';
  if (subscription.status === 'pending') return 'Aguardando pagamento';
  if (subscription.status === 'trialing') return 'Demo ativa';
  if (subscription.status === 'active') return 'Plano ativo';
  if (subscription.status === 'past_due') return 'Pagamento pendente';
  if (subscription.status === 'expired') return 'Plano expirado';
  if (subscription.status === 'canceled') return 'Plano cancelado';
  return subscription.status;
};

export const getSubscriptionCountdown = (subscription: SubscriptionTimingLike | null | undefined) => {
  if (subscription?.status === 'pending') {
    return {
      endAt: null,
      endAtLabel: null,
      remainingLabel: 'Aguardando pagamento do Pix para liberar o plano.',
      markerLabel: 'Pix pendente',
      badgeVariant: 'secondary' as const,
      isExpired: false,
      isExpiringSoon: false,
    };
  }

  const endAt = getSubscriptionEndAt(subscription);

  if (!subscription || !endAt) {
    return {
      endAt: null,
      endAtLabel: null,
      remainingLabel: null,
      markerLabel: null,
      badgeVariant: 'outline' as const,
      isExpired: false,
      isExpiringSoon: false,
    };
  }

  const diffMs = new Date(endAt).getTime() - Date.now();
  const endAtLabel = formatDateTime(endAt);

  if (diffMs <= 0) {
    return {
      endAt,
      endAtLabel,
      remainingLabel: 'Periodo encerrado.',
      markerLabel: 'Expirado',
      badgeVariant: 'destructive' as const,
      isExpired: true,
      isExpiringSoon: true,
    };
  }

  if (subscription.status === 'trialing') {
    const totalMinutes = Math.ceil(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const compactTime = `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;

    return {
      endAt,
      endAtLabel,
      remainingLabel: `Restam ${compactTime} na demo.`,
      markerLabel: `Demo: ${compactTime}`,
      badgeVariant: totalMinutes <= 60 ? 'destructive' as const : 'secondary' as const,
      isExpired: false,
      isExpiringSoon: totalMinutes <= 180,
    };
  }

  const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const markerLabel = totalDays === 1 ? '1 dia restante' : `${totalDays} dias restantes`;

  return {
    endAt,
    endAtLabel,
    remainingLabel: `Restam ${totalDays} dia${totalDays === 1 ? '' : 's'} neste ciclo.`,
    markerLabel,
    badgeVariant: totalDays <= 3 ? 'destructive' as const : totalDays <= 7 ? 'secondary' as const : 'outline' as const,
    isExpired: false,
    isExpiringSoon: totalDays <= 7,
  };
};
