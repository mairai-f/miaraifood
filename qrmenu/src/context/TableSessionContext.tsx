import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { lsGet, lsSet, guestKey, stepperKey } from '../lib/storage';
import type { Restaurant, StepperAnswers } from '../types';
import { miaifoodQrRequest } from '../lib/miaifood-api';

interface TableSessionState {
  ready: boolean;
  error: string | null;
  qrToken: string | null;
  restaurantId: string | null;
  tableId: string | null;
  tableNumber: number | null;
  guestId: string | null;
  restaurant: Restaurant | null;
  stepperAnswers: StepperAnswers | null;
  setStepperAnswers: (a: StepperAnswers | null) => void;
  /** Dono habilitou "pagar na mesa" (RestaurantSettings.allowPayAtTable) — controla se
   * BillScreen oferece "pagar e fechar mesa" (Pix) ou só o resumo informativo. */
  allowPayAtTable: boolean;
}

const TableSessionContext = createContext<TableSessionState | null>(null);

export function useTableSession(): TableSessionState {
  const ctx = useContext(TableSessionContext);
  if (!ctx) throw new Error('useTableSession must be used inside TableSessionProvider');
  return ctx;
}

/**
 * Resolves `?restaurantId=<companyId>&qr=<qrToken>` from the URL, looks up the table by
 * token (GET /api/tables/by-token/:token — same endpoint artifacts/cliente's App.tsx uses),
 * then joins (or rejoins, if this guest already scanned before) a per-guest seat in the
 * table's session (POST /api/tables/by-token/:token/session/join). Multiple guests at the
 * same table each get their own guestId/cart — no merged cart.
 */
export function TableSessionProvider({ children }: { children: ReactNode }) {
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [restaurantIdParam, setRestaurantIdParam] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [resolvedRestaurantId, setResolvedRestaurantId] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepperAnswers, setStepperAnswersState] = useState<StepperAnswers | null>(null);
  const [allowPayAtTable, setAllowPayAtTable] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let token = params.get('qr') || window.location.pathname.split('/qrmenu/')[1]?.split('/')[0];
    if (token) {
      sessionStorage.setItem('miar_qr_token', token);
    } else {
      token = sessionStorage.getItem('miar_qr_token');
    }
    const rid = params.get('restaurantId') ?? params.get('companyId');
    setQrToken(token);
    setRestaurantIdParam(rid);
    if (!token) { setError('QR code inválido: faltando o parâmetro "qr" na URL.'); return; }
    setStepperAnswersState(lsGet<StepperAnswers | null>(stepperKey(token), null));
  }, []);

  useEffect(() => {
    if (!qrToken) return;
    miaifoodQrRequest<{ table: { code: string }; establishmentName: string; sessionOpen: boolean }>({ action: 'resolve', token: qrToken })
      .then((payload) => {
        setTableId(qrToken);
        setTableNumber(Number(payload.table.code.replace(/\D/g, '')) || null);
        setResolvedRestaurantId(qrToken);
        setRestaurant({ id: qrToken, name: payload.establishmentName });
        setAllowPayAtTable(false);
      }).catch((reason: Error) => setError(reason.message));
  }, [qrToken]);

  useEffect(() => {
    if (!qrToken || !tableId) return;
    const key = guestKey(qrToken);
    const rememberedGuestId = lsGet<string | null>(key, null);
    let cancelled = false;
    if (rememberedGuestId) { setGuestId(rememberedGuestId); return; }
    miaifoodQrRequest<{ guestToken: string }>({ action: 'start_guest', token: qrToken })
      .then((payload) => { if (!cancelled && payload.guestToken) { setGuestId(payload.guestToken); lsSet(key, payload.guestToken); } })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; };
  }, [qrToken, tableId]);

  const effectiveRestaurantId = resolvedRestaurantId ?? restaurantIdParam;

  // A identidade da loja ja vem da Edge Function no resolve acima.

  const setStepperAnswers = (a: StepperAnswers | null) => {
    setStepperAnswersState(a);
    if (qrToken) lsSet(stepperKey(qrToken), a);
  };

  const ready = Boolean(qrToken && tableId && guestId && effectiveRestaurantId);

  return (
    <TableSessionContext.Provider
      value={{
        ready,
        error,
        qrToken,
        restaurantId: effectiveRestaurantId,
        tableId,
        tableNumber,
        guestId,
        restaurant,
        stepperAnswers,
        setStepperAnswers,
        allowPayAtTable,
      }}
    >
      {children}
    </TableSessionContext.Provider>
  );
}
