import { useEffect, useRef, useState } from 'react';
import { Loader2, Receipt, QrCode, CheckCircle2, Copy, CreditCard, Banknote } from 'lucide-react';
import { PrimaryButton, SuccessPopup } from '@workspace/menu-theme';
import { useTableSession } from '../context/TableSessionContext';
import { splitBillCents } from '../lib/bill-split';
import { miaifoodQrRequest } from '../lib/miaifood-api';

type PayState =
  | { step: 'idle' }
  | { step: 'creating' }
  | { step: 'charge'; paymentId: string; copiaECola: string; qrBase64: string; amount: number }
  | { step: 'confirming'; paymentId: string }
  | { step: 'closing' }
  | { step: 'waiting-others' }
  | { step: 'done' }
  | { step: 'error'; message: string };

/**
 * "Fechar conta" / bill split. Fetches the table's authoritative total once from
 * POST /tables/by-token/:token/bill-split, then the headcount +/- counter recomputes
 * the per-person shares LOCALLY (via the identical splitBillCents pure function —
 * see lib/bill-split.ts) as it changes, instead of round-tripping to the server on
 * every click. Defaults to the stepper's headcount answer when there is one, or 1
 * if the stepper was skipped. Display-only — no payment is actually processed here.
 *
 * "Pagar e fechar mesa" (03/09/2026): when the restaurant opted in via
 * RestaurantSettings.allowPayAtTable, offers a real Pix payment for THIS guest's own
 * share — POST /tables/by-token/:token/session/guest-pix (server computes the amount,
 * never trusts a client-supplied value), polls
 * GET .../session/guest-pix/:paymentId/status (same shape as the existing
 * GET /pix/status/:id used elsewhere, just without requiring a Bearer token — this
 * guest never has one, same anonymous guestId model as the rest of the table session),
 * then POST .../session/pay (method "app") to record the payment, and finally
 * POST .../session/close (guestId, no auth) to close — which only succeeds once every
 * guest at the table is paid. If others still owe, the table stays open and we show
 * that instead of treating it as a failure.
 */
type PayMethod = 'pix' | 'card' | 'cash';

export default function BillScreen() {
  const { qrToken, guestId, stepperAnswers, allowPayAtTable } = useTableSession();
  const [headcount, setHeadcount] = useState(stepperAnswers?.headcount ?? 1);
  const [loading, setLoading] = useState(true);
  const [totalCents, setTotalCents] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('pix');
  const [pay, setPay] = useState<PayState>({ step: 'idle' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startOtherPayment = async (method: 'card' | 'cash') => {
    if (!qrToken) return;
    const activeGuestId = guestId || 'guest-1';
    setPay({ step: 'confirming', paymentId: '' });
    try {
      const payRes = await fetch(`/api/tables/by-token/${encodeURIComponent(qrToken)}/session/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: activeGuestId, method }),
      });
      const payData = await payRes.json().catch(() => ({}));
      if (!payRes.ok) {
        setPay({ step: 'error', message: payData?.error ?? 'Não foi possível registrar a solicitação de pagamento. Chame o garçom.' });
        return;
      }

      setPay({ step: 'closing' });
      const closeRes = await fetch(`/api/tables/by-token/${encodeURIComponent(qrToken)}/session/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: activeGuestId }),
      });
      if (closeRes.status === 409) {
        setPay({ step: 'waiting-others' });
        return;
      }
      if (!closeRes.ok) {
        const closeData = await closeRes.json().catch(() => ({}));
        setPay({ step: 'error', message: closeData?.error ?? 'Não foi possível fechar a mesa. Chame o garçom.' });
        return;
      }
      setPay({ step: 'done' });
    } catch {
      setPay({ step: 'error', message: 'Falha de rede ao fechar a mesa. Chame o garçom.' });
    }
  };

  useEffect(() => {
    if (!qrToken) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    miaifoodQrRequest<{ tableTotal: number }>({ action: 'resolve', token: qrToken, guestToken: guestId })
      .then((data) => { if (!cancelled) setTotalCents(Math.round(Number(data.tableTotal) * 100)); })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [qrToken]);

  // Limpa qualquer polling pendente ao desmontar a tela.
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const sharesCents = totalCents != null ? splitBillCents(totalCents, headcount) : null;

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPix = async () => {
    if (!qrToken) return;
    const activeGuestId = guestId || 'guest-1';
    setPay({ step: 'creating' });
    try {
      const res = await fetch(`/api/tables/by-token/${encodeURIComponent(qrToken)}/session/guest-pix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: activeGuestId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPay({ step: 'error', message: data?.error ?? 'Não foi possível gerar a cobrança Pix.' });
        return;
      }
      setPay({ step: 'charge', paymentId: String(data.paymentId), copiaECola: data.copiaECola ?? '', qrBase64: data.qrBase64 ?? '', amount: data.amount ?? 0 });

      // Poll de confirmação — mesmo padrão usado em outros pontos do app pra
      // pagamento Pix assíncrono: consulta o status a cada 3s até "approved"
      // (ou até o convidado sair da tela).
      const paymentId = String(data.paymentId);
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/tables/by-token/${encodeURIComponent(qrToken)}/session/guest-pix/${encodeURIComponent(paymentId)}/status`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json() as { status?: string };
          if (statusData.status === 'approved') {
            stopPolling();
            await confirmAndClose(paymentId);
          } else if (statusData.status === 'rejected' || statusData.status === 'cancelled') {
            stopPolling();
            setPay({ step: 'error', message: 'O pagamento Pix foi recusado ou cancelado. Tente novamente.' });
          }
        } catch {
          // rede instável — mantém tentando no próximo tick
        }
      }, 3000);
    } catch {
      setPay({ step: 'error', message: 'Não foi possível conectar ao servidor.' });
    }
  };

  const confirmAndClose = async (paymentId: string) => {
    if (!qrToken || !guestId) return;
    setPay({ step: 'confirming', paymentId });
    try {
      const payRes = await fetch(`/api/tables/by-token/${encodeURIComponent(qrToken)}/session/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, method: 'app', paymentId }),
      });
      const payData = await payRes.json().catch(() => ({}));
      if (!payRes.ok) {
        setPay({ step: 'error', message: payData?.error ?? 'Pagamento confirmado no Pix, mas não foi possível registrar na conta. Chame o garçom.' });
        return;
      }

      setPay({ step: 'closing' });
      const closeRes = await fetch(`/api/tables/by-token/${encodeURIComponent(qrToken)}/session/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId }),
      });
      if (closeRes.status === 409) {
        // Sua parte foi paga — só falta o resto da mesa.
        setPay({ step: 'waiting-others' });
        return;
      }
      const closeData = await closeRes.json().catch(() => ({}));
      if (!closeRes.ok) {
        setPay({ step: 'error', message: closeData?.error ?? 'Pagamento confirmado, mas não foi possível fechar a mesa. Chame o garçom.' });
        return;
      }
      setPay({ step: 'done' });
    } catch {
      setPay({ step: 'error', message: 'Pagamento confirmado no Pix, mas houve falha de rede ao fechar a mesa. Chame o garçom.' });
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4">
      <h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: 'var(--menu-text)' }}>
        <Receipt className="h-5 w-5" style={{ color: 'var(--menu-primary)' }} /> Fechar conta
      </h2>

      <label className="text-sm opacity-70" style={{ color: 'var(--menu-text)' }}>
        Quantas pessoas vão dividir a conta?
        <div className="mt-2 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setHeadcount(h => Math.max(1, h - 1))}
            className="h-10 w-10 rounded-full text-lg font-bold"
            style={{ background: 'var(--menu-surface)', color: 'var(--menu-text)' }}
          >
            −
          </button>
          <span className="w-10 text-center text-2xl font-bold" style={{ color: 'var(--menu-text)' }}>{headcount}</span>
          <button
            type="button"
            onClick={() => setHeadcount(h => Math.min(20, h + 1))}
            className="h-10 w-10 rounded-full text-lg font-bold text-white"
            style={{ background: 'var(--menu-primary)' }}
          >
            +
          </button>
        </div>
      </label>

      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm opacity-60" style={{ color: 'var(--menu-text)' }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando total da mesa…
        </div>
      )}

      {!loading && totalCents != null && sharesCents && (
        <div className="rounded-[22px] p-4" style={{ background: 'var(--menu-surface)' }}>
          <p className="text-sm opacity-60" style={{ color: 'var(--menu-text)' }}>Total da mesa</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--menu-primary)' }}>{(totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          <div className="mt-4 space-y-2">
            {sharesCents.map((cents, i) => (
              <div key={i} className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm" style={{ background: 'var(--menu-bg)' }}>
                <span className="opacity-70" style={{ color: 'var(--menu-text)' }}>Pessoa {i + 1}</span>
                <span className="font-semibold" style={{ color: 'var(--menu-text)' }}>{(cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalCents != null && (
        <div className="rounded-[22px] p-4 flex flex-col gap-3" style={{ background: 'var(--menu-surface)' }}>
          <p className="text-sm font-bold text-white mb-1">Forma de pagamento</p>
          
          {/* Method Selectors */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPayMethod('pix')}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all ${
                payMethod === 'pix'
                  ? 'border-[var(--menu-primary)] bg-[var(--menu-primary)]/10 text-[var(--menu-primary)]'
                  : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:text-white'
              }`}
            >
              <QrCode className="h-5 w-5 mb-1" />
              Pix Online
            </button>

            <button
              type="button"
              onClick={() => setPayMethod('card')}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all ${
                payMethod === 'card'
                  ? 'border-[var(--menu-primary)] bg-[var(--menu-primary)]/10 text-[var(--menu-primary)]'
                  : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:text-white'
              }`}
            >
              <CreditCard className="h-5 w-5 mb-1" />
              Cartão
            </button>

            <button
              type="button"
              onClick={() => setPayMethod('cash')}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all ${
                payMethod === 'cash'
                  ? 'border-[var(--menu-primary)] bg-[var(--menu-primary)]/10 text-[var(--menu-primary)]'
                  : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:text-white'
              }`}
            >
              <Banknote className="h-5 w-5 mb-1" />
              Dinheiro
            </button>
          </div>

          {pay.step === 'idle' && (
            <div className="mt-2">
              {payMethod === 'pix' && (
                <PrimaryButton onClick={startPix}>
                  <QrCode className="h-4 w-4" /> Gerar QR Code Pix & Copia e Cola
                </PrimaryButton>
              )}

              {payMethod === 'card' && (
                <PrimaryButton onClick={() => startOtherPayment('card')}>
                  <CreditCard className="h-4 w-4" /> Pagar no Cartão (Maquininha na Mesa)
                </PrimaryButton>
              )}

              {payMethod === 'cash' && (
                <PrimaryButton onClick={() => startOtherPayment('cash')}>
                  <Banknote className="h-4 w-4" /> Pagar em Dinheiro (Chamar Garçom)
                </PrimaryButton>
              )}
            </div>
          )}

          {pay.step === 'creating' && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm opacity-70" style={{ color: 'var(--menu-text)' }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando cobrança Pix via Banco/API…
            </div>
          )}

          {pay.step === 'charge' && (
            <div className="flex flex-col items-center gap-3 text-center py-2">
              <p className="text-sm opacity-70" style={{ color: 'var(--menu-text)' }}>
                Sua parte: <span className="font-bold" style={{ color: 'var(--menu-primary)' }}>{(pay.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </p>
              {pay.qrBase64 && (
                <img src={`data:image/png;base64,${pay.qrBase64}`} alt="QR Code Pix" className="h-48 w-48 rounded-2xl bg-white p-2 shadow-xl" />
              )}
              {pay.copiaECola && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(pay.copiaECola)}
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-md bg-white/10 hover:bg-white/20 transition-all text-white"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar Código Pix Copia e Cola
                </button>
              )}
              <div className="flex items-center gap-2 text-xs opacity-60 mt-1" style={{ color: 'var(--menu-text)' }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aguardando confirmação bancária do pagamento…
              </div>
            </div>
          )}

          {(pay.step === 'confirming' || pay.step === 'closing') && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm opacity-70" style={{ color: 'var(--menu-text)' }}>
              <Loader2 className="h-4 w-4 animate-spin" /> {pay.step === 'confirming' ? 'Registrando forma de pagamento…' : 'Fechando a mesa…'}
            </div>
          )}

          {pay.step === 'waiting-others' && (
            <div className="flex flex-col items-center gap-1.5 text-center text-sm p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 text-emerald-400 font-bold">
              <CheckCircle2 className="h-6 w-6" />
              <p>Sua parte foi registrada com sucesso!</p>
              <span className="text-xs opacity-80 font-normal">Assim que os demais convidados da mesa pagarem, a mesa será liberada automaticamente.</span>
            </div>
          )}

          {pay.step === 'error' && (
            <div className="flex flex-col items-center gap-2 text-center py-2">
              <p className="text-sm text-red-300 font-medium">{pay.message}</p>
              <button type="button" onClick={() => setPay({ step: 'idle' })} className="text-xs font-bold text-[var(--menu-primary)] underline">Tentar de novo</button>
            </div>
          )}
        </div>
      )}

      <SuccessPopup
        open={pay.step === 'done'}
        title="Conta fechada!"
        message="Pagamento confirmado e mesa liberada. Obrigado pela preferência!"
        onClose={() => setPay({ step: 'idle' })}
      />
    </div>
  );
}
