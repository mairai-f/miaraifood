import { useParams } from 'react-router-dom';
import QrMenuShell from '@/features/qrmenu/QrMenuShell';

export default function QrMenu() {
  const { token = '' } = useParams<{ token?: string }>();

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050b14] p-6 text-center text-slate-100">
        <div className="max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
          <h1 className="text-lg font-bold">QR Code Inválido</h1>
          <p className="mt-2 text-xs text-slate-400">Escaneie o código QR da sua mesa para ver o cardápio.</p>
        </div>
      </div>
    );
  }

  return <QrMenuShell qrToken={token} />;
}
