import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanAccess } from '@/contexts/PlanContext';
import type { UserRole } from '@/lib/access';
import {
  START_GUIDED_TOUR_EVENT,
  buildGuidedTourSeenKey,
  hasSeenGuidedTour,
  isGuidedTourEligiblePlan,
  markGuidedTourSeen,
} from '@/lib/guidedTour';

type GuidedTourStep = {
  id: string;
  path: string;
  target?: string;
  optionalTarget?: boolean;
  title: string;
  body: string;
  roles?: UserRole[];
  requiredFeature?: string;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const tourSteps: GuidedTourStep[] = [
  {
    id: 'dashboard-nav',
    path: '/',
    target: 'nav-dashboard',
    title: 'Comece pelo painel',
    body: 'Aqui fica o resumo da loja: clientes, devedores, dividas abertas e pagamentos do dia.',
    requiredFeature: 'dashboard.view',
  },
  {
    id: 'dashboard-stats',
    path: '/',
    target: 'dashboard-stats',
    title: 'Indicadores rapidos',
    body: 'Use estes cards para encontrar clientes, focar nos devedores e ver quanto entrou hoje.',
    requiredFeature: 'dashboard.view',
  },
  {
    id: 'dashboard-clients',
    path: '/',
    target: 'dashboard-clients-list',
    title: 'Clientes e dividas',
    body: 'A lista ordena os clientes por saldo e leva direto para o historico de fiado de cada pessoa.',
    requiredFeature: 'dashboard.view',
  },
  {
    id: 'pdv-nav',
    path: '/',
    target: 'nav-pdv',
    title: 'PDV para vender',
    body: 'O PDV e a rotina do caixa: abrir caixa, buscar produto, montar carrinho, receber e imprimir cupom nao fiscal.',
    requiredFeature: 'pdv.use',
  },
  {
    id: 'pdv-open-cash',
    path: '/pdv',
    target: 'pdv-open-cash',
    optionalTarget: true,
    title: 'Abra o caixa',
    body: 'No primeiro uso do dia, informe o valor inicial. Depois disso o caixa fica liberado para vender.',
    requiredFeature: 'pdv.use',
  },
  {
    id: 'pdv-actions',
    path: '/pdv',
    target: 'pdv-actions',
    title: 'Comandos de caixa',
    body: 'Aqui estao busca de vendas, saida de caixa, saldo atual e fechamento. Os numeros tambem funcionam pelo teclado.',
    requiredFeature: 'pdv.use',
  },
  {
    id: 'pdv-search',
    path: '/pdv',
    target: 'pdv-search',
    title: 'Busque e adicione produtos',
    body: 'Digite nome, codigo ou use leitor de codigo de barras. Espaco foca a busca; Enter adiciona o item selecionado.',
    requiredFeature: 'pdv.use',
  },
  {
    id: 'pdv-products',
    path: '/pdv',
    target: 'pdv-products',
    title: 'Grade de produtos',
    body: 'Clique ou use o teclado para montar a venda rapidamente. Produtos com estoque baixo avisam aqui mesmo.',
    requiredFeature: 'pdv.use',
  },
  {
    id: 'pdv-cart',
    path: '/pdv',
    target: 'pdv-cart',
    title: 'Carrinho e ajustes',
    body: 'No carrinho voce altera quantidade, remove itens e, como admin, ajusta preco quando precisar.',
    requiredFeature: 'pdv.use',
  },
  {
    id: 'pdv-finish',
    path: '/pdv',
    target: 'pdv-checkout',
    title: 'Finalize e imprima',
    body: 'Finalizar abre as formas de pagamento. Para fiado, use 3 e selecione o cliente; o cupom nao fiscal segue disponivel para impressao.',
    requiredFeature: 'pdv.use',
  },
  {
    id: 'clients-nav',
    path: '/',
    target: 'nav-clients',
    title: 'Clientes e fiado',
    body: 'Este modulo concentra cadastro de clientes, limite de credito, saldos e historico de dividas.',
    requiredFeature: 'clients.manage',
  },
  {
    id: 'clients-new',
    path: '/clientes',
    target: 'clients-new',
    title: 'Cadastre clientes',
    body: 'Cadastre nome, WhatsApp e limite de credito para deixar o fiado controlado desde a primeira compra.',
    requiredFeature: 'clients.manage',
  },
  {
    id: 'clients-search',
    path: '/clientes',
    target: 'clients-search',
    title: 'Encontre rapidamente',
    body: 'Use a busca para localizar cliente no balcao e abrir o detalhe com compras, pagamentos e saldo.',
    requiredFeature: 'clients.manage',
  },
  {
    id: 'products-nav',
    path: '/',
    target: 'nav-products',
    title: 'Produtos e precos',
    body: 'Produtos alimentam o PDV, estoque, relatorios e margem. Mantenha preco, custo e codigo sempre atualizados.',
    requiredFeature: 'products.manage',
  },
  {
    id: 'products-new',
    path: '/produtos',
    target: 'products-new',
    title: 'Cadastre produtos',
    body: 'Informe preco, custo, categoria, codigo de barras e estoque minimo para que o PDV e os alertas funcionem bem.',
    requiredFeature: 'products.manage',
  },
  {
    id: 'products-list',
    path: '/produtos',
    target: 'products-list',
    title: 'Margem e estoque',
    body: 'Cada card mostra preco, custo, markup, margem e estoque. Alteracoes sensiveis podem exigir aprovacao do gerente.',
    requiredFeature: 'products.manage',
  },
  {
    id: 'stock-nav',
    path: '/',
    target: 'nav-stock',
    title: 'Estoque',
    body: 'Use o estoque para registrar entradas, saidas, ajustes e acompanhar produtos abaixo do minimo.',
    roles: ['admin'],
    requiredFeature: 'stock.manage',
  },
  {
    id: 'stock-move',
    path: '/estoque',
    target: 'stock-move',
    title: 'Movimentar estoque',
    body: 'Toda compra, perda ou ajuste pode ser registrado com motivo, criando um historico operacional.',
    roles: ['admin'],
    requiredFeature: 'stock.manage',
  },
  {
    id: 'reports-nav',
    path: '/',
    target: 'nav-reports',
    title: 'Relatorios',
    body: 'Relatorios ajudam a enxergar faturamento, lucro, produtos vendidos, inadimplencia e fiado por periodo.',
    roles: ['admin'],
    requiredFeature: 'reports.view',
  },
  {
    id: 'reports-filters',
    path: '/relatorios',
    target: 'reports-filters',
    title: 'Filtre por periodo',
    body: 'Ajuste as datas para analisar uma semana, mes ou fechamento especifico, e exporte CSV quando precisar.',
    roles: ['admin'],
    requiredFeature: 'reports.view',
  },
  {
    id: 'reports-rankings',
    path: '/relatorios',
    target: 'reports-rankings',
    title: 'Rankings importantes',
    body: 'Veja produtos mais vendidos, formas de pagamento, clientes que mais compram no fiado e produtos parados.',
    roles: ['admin'],
    requiredFeature: 'reports.view',
  },
  {
    id: 'financial-nav',
    path: '/',
    target: 'nav-financial',
    title: 'Financeiro',
    body: 'No financeiro voce acompanha entradas, saidas, saldo e valores a receber de fiado.',
    roles: ['admin'],
    requiredFeature: 'financial.manage',
  },
  {
    id: 'financial-expense',
    path: '/financeiro',
    target: 'financial-expense',
    title: 'Registre despesas',
    body: 'Lance aluguel, fornecedor, manutencao e outros custos para que o saldo do periodo fique mais fiel.',
    roles: ['admin'],
    requiredFeature: 'financial.manage',
  },
  {
    id: 'settings-nav',
    path: '/',
    target: 'account-settings',
    title: 'Configuracoes e suporte',
    body: 'O administrador acessa configuracoes, backup, desktop, operadores e tambem pode abrir este tutorial de novo.',
    roles: ['admin'],
    requiredFeature: 'settings.manage',
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getElementRect = (tourId: string): TargetRect | null => {
  const element = document.querySelector(`[data-tour-id="${tourId}"]`) as HTMLElement | null;
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

export function GuidedTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, user, ownerUserId } = useAuth();
  const { hasFeature, loading: planLoading, planId } = usePlanAccess();
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  const eligiblePlan = isGuidedTourEligiblePlan(planId);
  const seenKey = user?.id && planId
    ? buildGuidedTourSeenKey(user.id, ownerUserId, planId)
    : null;

  const availableSteps = useMemo(
    () => tourSteps.filter(step => {
      if (step.roles && !step.roles.includes(role)) return false;
      if (step.requiredFeature && !hasFeature(step.requiredFeature)) return false;
      return true;
    }),
    [hasFeature, role],
  );

  const currentStep = availableSteps[currentIndex] ?? null;
  const totalSteps = availableSteps.length;

  const finishTour = useCallback(() => {
    if (seenKey) {
      markGuidedTourSeen(seenKey);
    }

    setRunning(false);
    setCurrentIndex(0);
    setTargetRect(null);
  }, [seenKey]);

  const startTour = useCallback(() => {
    if (!eligiblePlan || totalSteps === 0) return;
    setCurrentIndex(0);
    setTargetRect(null);
    setRunning(true);
  }, [eligiblePlan, totalSteps]);

  const goToNext = useCallback(() => {
    setTargetRect(null);
    setCurrentIndex(index => {
      if (index >= totalSteps - 1) {
        if (seenKey) {
          markGuidedTourSeen(seenKey);
        }
        setRunning(false);
        return 0;
      }

      return index + 1;
    });
  }, [seenKey, totalSteps]);

  const goToPrevious = useCallback(() => {
    setTargetRect(null);
    setCurrentIndex(index => Math.max(0, index - 1));
  }, []);

  useEffect(() => {
    const handleStart = () => startTour();
    window.addEventListener(START_GUIDED_TOUR_EVENT, handleStart);
    return () => window.removeEventListener(START_GUIDED_TOUR_EVENT, handleStart);
  }, [startTour]);

  useEffect(() => {
    if (planLoading || !eligiblePlan || !seenKey || running || totalSteps === 0) return;
    if (hasSeenGuidedTour(seenKey)) return;

    const timer = window.setTimeout(() => {
      setCurrentIndex(0);
      setRunning(true);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [eligiblePlan, planLoading, running, seenKey, totalSteps]);

  useEffect(() => {
    if (!running) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finishTour();
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        goToNext();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finishTour, goToNext, goToPrevious, running]);

  useEffect(() => {
    if (!running || !currentStep) return;

    if (location.pathname !== currentStep.path) {
      navigate(currentStep.path);
      setTargetRect(null);
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    let attempts = 0;

    const locateTarget = () => {
      if (cancelled) return;

      if (!currentStep.target) {
        setTargetRect(null);
        return;
      }

      const element = document.querySelector(`[data-tour-id="${currentStep.target}"]`) as HTMLElement | null;
      if (element) {
        element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      }

      window.setTimeout(() => {
        if (cancelled) return;
        const rect = getElementRect(currentStep.target as string);
        if (rect) {
          setTargetRect(rect);
          return;
        }

        attempts += 1;
        if (attempts < 18) {
          timeoutId = window.setTimeout(locateTarget, 120);
          return;
        }

        if (currentStep.optionalTarget) {
          goToNext();
          return;
        }

        setTargetRect(null);
      }, element ? 280 : 0);
    };

    locateTarget();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [currentStep, goToNext, location.pathname, navigate, running]);

  useEffect(() => {
    if (!running || !currentStep?.target) return;

    const handleResize = () => {
      const rect = getElementRect(currentStep.target as string);
      setTargetRect(rect);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [currentStep?.target, running]);

  if (!running || !currentStep) return null;

  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight;
  const cardWidth = Math.min(380, Math.max(280, viewportWidth - 32));
  const cardHeight = 230;
  const hasTarget = Boolean(targetRect);
  const targetCenterX = targetRect ? targetRect.left + targetRect.width / 2 : viewportWidth / 2;
  const showBelow = targetRect ? targetRect.top + targetRect.height + cardHeight + 24 < viewportHeight : false;
  const showAbove = targetRect ? targetRect.top - cardHeight - 24 > 0 : false;
  const placement = showBelow || !showAbove ? 'bottom' : 'top';
  const cardLeft = clamp(targetCenterX - cardWidth / 2, 16, viewportWidth - cardWidth - 16);
  const cardTop = targetRect
    ? placement === 'bottom'
      ? clamp(targetRect.top + targetRect.height + 14, 16, viewportHeight - cardHeight - 16)
      : clamp(targetRect.top - cardHeight - 14, 16, viewportHeight - cardHeight - 16)
    : clamp(viewportHeight / 2 - cardHeight / 2, 16, viewportHeight - cardHeight - 16);
  const arrowLeft = clamp(targetCenterX - cardLeft - 6, 18, cardWidth - 30);

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" />

      {hasTarget && targetRect && (
        <div
          className="pointer-events-none absolute rounded-lg border-2 border-primary bg-primary/10"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: '0 0 0 9999px hsl(var(--background) / 0.62), 0 0 24px hsl(var(--primary) / 0.45)',
          }}
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        className="absolute rounded-lg border border-border bg-card p-4 text-card-foreground shadow-2xl"
        style={{
          left: cardLeft,
          top: cardTop,
          width: cardWidth,
          minHeight: cardHeight,
        }}
      >
        {hasTarget && (
          <div
            className={`absolute h-3 w-3 rotate-45 border-border bg-card ${
              placement === 'bottom' ? '-top-1.5 border-l border-t' : '-bottom-1.5 border-b border-r'
            }`}
            style={{ left: arrowLeft }}
          />
        )}

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">
              Tour HappyCash {currentIndex + 1}/{totalSteps}
            </p>
            <h2 id="guided-tour-title" className="mt-1 text-lg font-semibold leading-tight">
              {currentStep.title}
            </h2>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={finishTour}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {currentStep.body}
        </p>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((currentIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={finishTour}>
            Pular
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={goToPrevious} disabled={currentIndex === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button type="button" onClick={goToNext}>
              {currentIndex >= totalSteps - 1 ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Concluir
                </>
              ) : (
                <>
                  Proximo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
