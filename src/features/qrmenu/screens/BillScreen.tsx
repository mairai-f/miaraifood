import { useState, useMemo } from 'react';
import { Receipt, QrCode, CreditCard, Banknote, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useTableSession } from '../context/TableSessionContext';
import { splitBillCents } from '../lib/bill-split';
import WaiterCallButton from '../components/WaiterCallButton';

type PayMethod = 'pix' | 'card' | 'cash';

export default function BillScreen({ onBackToMenu }: { onBackToMenu: () => void }) {
  const { table, stepperAnswers, tableTotal, ownOrders, callWaiter } = useTableSession();
  const [headcount, setHeadcount] = useState(stepperAnswers?.headcount ?? 1);
  const [payMethod, setPayMethod] = useState<PayMethod>('pix');
  const [paySuccess, setPaySuccess] = useState(false);

  const totalCents = Math.round(tableTotal * 100);
  const sharesCents = useMemo(() => {
    return totalCents > 0 ? splitBillCents(totalCents, headcount) : [];
  }, [totalCents, headcount]);

  const [payError, setPayError] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  const handlePay = async () => {
    if (payLoading) return;
    setPayLoading(true);
    setPayError('');
    // O cliente não pode marcar a conta como paga. A solicitação é enviada
    // para a equipe, que confirma o recebimento no caixa/PDV.
    const result = await callWaiter();
    setPayLoading(false);
    if (!result.success) {
      setPayError(result.error || 'Não foi possível avisar a equipe.');
      return;
    }
    setPaySuccess(true);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-24 text-slate-100 min-h-screen">
      <div className="flex items-center justify-between py-3 border-b border-slate-800">
        <button
          type="button"
          onClick={onBackToMenu}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao cardápio
        </button>
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          <Receipt className="h-3.5 w-3.5" />
          Extrato da Mesa
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <Receipt className="h-5 w-5 text-emerald-400" />
          {table?.name || table?.code ? `Mesa ${table.name || table.code}` : 'Conta da Mesa'}
        </h2>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-4">
        <div>
          <p className="text-xs text-slate-400 font-medium">Total consumido na mesa</p>
          <p className="text-3xl font-extrabold text-emerald-400 mt-1">
            {tableTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        {ownOrders.length > 0 && (
          <div className="border-t border-slate-800 pt-3 space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seus Pedidos</p>
            {ownOrders.map((order) => (
              <div key={order.id} className="rounded-xl bg-slate-950 p-2.5 text-xs space-y-1">
                <div className="flex justify-between font-bold text-slate-200">
                  <span>Pedido #{order.id.slice(0, 6)}</span>
                  <span className="text-emerald-400">
                    {Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-slate-400">
                    <span>{item.quantity}x {item.product_name}</span>
                    <span>{Number(item.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Dividir a Conta</p>
        <p className="text-xs text-slate-400">Quantas pessoas vão dividir o valor total?</p>
        <div className="flex items-center gap-4 py-1">
          <button
            type="button"
            onClick={() => setHeadcount((h) => Math.max(1, h - 1))}
            className="h-10 w-10 rounded-xl bg-slate-800 font-bold text-lg text-slate-200 hover:bg-slate-700"
          >
            −
          </button>
          <span className="w-8 text-center text-2xl font-bold">{headcount}</span>
          <button
            type="button"
            onClick={() => setHeadcount((h) => Math.min(20, h + 1))}
            className="h-10 w-10 rounded-xl bg-slate-800 font-bold text-lg text-slate-200 hover:bg-slate-700"
          >
            +
          </button>
        </div>

        {sharesCents.length > 0 && (
          <div className="space-y-1.5 pt-2">
            {sharesCents.map((cents, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-slate-950 px-3 py-2 text-xs">
                <span className="text-slate-400">Pessoa {i + 1}</span>
                <span className="font-bold text-slate-200">
                  {(cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pagamento & Fechamento</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setPayMethod('pix')}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition ${
              payMethod === 'pix'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-800 bg-slate-950 text-slate-400'
            }`}
          >
            <QrCode className="h-5 w-5 mb-1" /> Pix
          </button>
          <button
            type="button"
            onClick={() => setPayMethod('card')}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition ${
              payMethod === 'card'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-800 bg-slate-950 text-slate-400'
            }`}
          >
            <CreditCard className="h-5 w-5 mb-1" /> Cartão
          </button>
          <button
            type="button"
            onClick={() => setPayMethod('cash')}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition ${
              payMethod === 'cash'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-800 bg-slate-950 text-slate-400'
            }`}
          >
            <Banknote className="h-5 w-5 mb-1" /> Dinheiro
          </button>
        </div>

        <button
          type="button"
          onClick={handlePay}
          className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition"
        >
          {payLoading ? 'Avisando a equipe…' : payMethod === 'pix' && 'Solicitar cobrança Pix'}
          {!payLoading && payMethod === 'card' && 'Solicitar maquininha na mesa'}
          {!payLoading && payMethod === 'cash' && 'Solicitar pagamento em dinheiro'}
        </button>
        {payError && <p className="text-xs text-red-300">{payError}</p>}
      </div>

      <WaiterCallButton />

      {paySuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 p-6 border border-slate-800 text-center shadow-2xl space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400 animate-pulse" />
            <div>
              <h3 className="text-lg font-bold text-slate-100">Solicitação Enviada!</h3>
              <p className="mt-1 text-xs text-slate-400">
                A equipe foi notificada para o fechamento/pagamento da sua mesa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPaySuccess(false);
                onBackToMenu();
              }}
              className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition"
            >
              Voltar ao cardápio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
