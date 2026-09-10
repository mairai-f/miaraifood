import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Rosto da MIAR. Hoje reproduz o mesmo tratamento do assistente do site
 * (ícone Bot em círculo), porque o chat do site também usa ícone, não foto.
 * Para trocar por uma imagem, basta apontar MIAR_AVATAR_SRC para o arquivo:
 * o resto da interface não muda.
 */
const MIAR_AVATAR_SRC: string | null = null;

export function MiarAvatar({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  if (MIAR_AVATAR_SRC) {
    return (
      <img
        src={MIAR_AVATAR_SRC}
        alt="MIAR Gestora IA"
        className={cn('rounded-full object-cover', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-primary/15 text-primary',
        className,
      )}
    >
      <Bot className={cn('h-4 w-4', iconClassName)} />
    </span>
  );
}
