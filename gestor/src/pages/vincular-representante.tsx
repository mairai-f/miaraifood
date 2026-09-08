import { useState, type FormEvent } from 'react';
import { ArrowLeft, Link2, ShieldCheck } from 'lucide-react';
import { useLocation } from 'wouter';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token') ?? '';
}

export default function VincularRepresentante() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const redeem = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/representantes/vinculos/resgatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; establishment?: string };
      if (!response.ok) throw new Error(data.error ?? 'Não foi possível confirmar o vínculo.');
      setMessage(`Estabelecimento vinculado: ${data.establishment ?? 'confirmado'}.`);
      setCode('');
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : 'Falha de conexão.');
    } finally {
      setLoading(false);
    }
  };

  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100"><div className="mx-auto w-full max-w-xl"><button type="button" onClick={() => setLocation('/painel')} className="mb-8 flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Voltar ao painel</button><section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300"><Link2 size={21} /></div><h1 className="text-2xl font-bold">Vincular representante</h1><p className="mt-2 text-sm text-slate-400">Informe o código recebido do representante. Antes de confirmar, confira se o estabelecimento e o representante correspondem ao acordo comercial.</p><form onSubmit={redeem} className="mt-7 space-y-4"><label className="block text-sm text-slate-300">Código de vinculação<input required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="REP-XXXXXXXXXXXX" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono tracking-widest text-slate-100 outline-none focus:border-emerald-400" /></label>{error && <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}{message && <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</p>}<button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60"><Link2 size={17} /> {loading ? 'Confirmando...' : 'Confirmar vínculo'}</button></form><p className="mt-6 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} /> Código de uso único, com validade e auditoria.</p></section></div></main>;
}
