import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useTableSession } from '../context/TableSessionContext';

export default function WaiterCallButton() {
  const { callWaiter } = useTableSession();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const call = async () => {
    if (state === 'sending') return;
    setState('sending');
    const res = await callWaiter();
    if (res.success) {
      setState('sent');
    } else {
      setState('idle');
    }
    setTimeout(() => setState('idle'), 4000);
  };

  return (
    <button
      type="button"
      onClick={call}
      disabled={state === 'sending'}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/60 bg-amber-500/10 py-3 font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-60"
    >
      <Bell className="h-4 w-4" />
      {state === 'sent' ? 'Garçom chamado ✓' : state === 'sending' ? 'Chamando…' : 'Chamar garçom'}
    </button>
  );
}
