import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useTableSession } from '../context/TableSessionContext';
import { miaifoodQrRequest } from '../lib/miaifood-api';

/** "Chamar garçom" — POSTs to the new waiter-call endpoint, which broadcasts `waiter:call` via SSE. */
export default function WaiterCallButton() {
  const { qrToken, guestId } = useTableSession();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const call = async () => {
    if (!qrToken || state === 'sending') return;
    setState('sending');
    try {
      await miaifoodQrRequest({ action: 'call_waiter', token: qrToken, guestToken: guestId });
      setState('sent');
    } catch {
      setState('idle');
    }
    setTimeout(() => setState('idle'), 4000);
  };

  return (
    <button
      onClick={call}
      disabled={state === 'sending'}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/60 bg-amber-500/10 py-3 font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-60"
    >
      <Bell className="h-4 w-4" />
      {state === 'sent' ? 'Garçom chamado ✓' : state === 'sending' ? 'Chamando…' : 'Chamar garçom'}
    </button>
  );
}
