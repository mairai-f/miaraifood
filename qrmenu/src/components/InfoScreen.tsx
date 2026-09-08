import React from 'react';
import { Clock, MapPin, CreditCard, ShieldCheck, Award, QrCode } from 'lucide-react';
import type { Restaurant } from '../types';

interface InfoScreenProps {
  restaurant: Restaurant | null;
  tableNumber: number | null;
  allowPayAtTable: boolean;
}

export default function InfoScreen({ restaurant, tableNumber, allowPayAtTable }: InfoScreenProps) {
  const name = restaurant?.name || 'MIAR QR Menu';
  const cuisine = restaurant?.segment || restaurant?.cuisine || 'Gastronomia & Bebidas';

  return (
    <div className="flex flex-col gap-4 px-4 pb-20 animate-in fade-in duration-300">
      {/* Store Bio */}
      <div className="rounded-2xl bg-[var(--menu-surface)] p-4 border border-white/10 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-400" />
          <h3 className="font-bold text-base text-[var(--menu-text)]">Sobre o restaurante</h3>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Bem-vindo ao <span className="font-bold text-white">{name}</span>! Oferecemos produtos frescos, artesanais e com atendimento de excelência. Peça direto da sua mesa ou faça o acompanhamento dos seus pedidos em tempo real.
        </p>
      </div>

      {/* Opening Hours */}
      <div className="rounded-2xl bg-[var(--menu-surface)] p-4 border border-white/10 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-emerald-400" />
          <h3 className="font-bold text-base text-[var(--menu-text)]">Horários de atendimento</h3>
        </div>
        <div className="flex items-center justify-between text-sm py-1 border-b border-white/5">
          <span className="text-zinc-400 font-medium">Segunda a Domingo</span>
          <span className="font-bold text-emerald-400">08:00 às 23:45</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Restaurante em funcionamento regular • Pedidos instantâneos</span>
        </div>
      </div>

      {/* Location / Table Info */}
      <div className="rounded-2xl bg-[var(--menu-surface)] p-4 border border-white/10 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-red-400" />
          <h3 className="font-bold text-base text-[var(--menu-text)]">Localização & Mesa</h3>
        </div>
        {tableNumber ? (
          <div className="flex items-center gap-3 bg-zinc-900/80 p-3 rounded-xl border border-white/10">
            <QrCode className="h-6 w-6 text-[var(--menu-primary)]" />
            <div>
              <p className="text-xs text-zinc-400">Você está atendido na</p>
              <p className="text-base font-extrabold text-white">Mesa {tableNumber}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Atendimento presencial no salão.</p>
        )}
      </div>

      {/* Payment Methods */}
      <div className="rounded-2xl bg-[var(--menu-surface)] p-4 border border-white/10 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-400" />
          <h3 className="font-bold text-base text-[var(--menu-text)]">Formas de pagamento aceitas</h3>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/50">
            <span className="text-zinc-200">Pix Instantâneo (QR Code)</span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Habilitado</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/50">
            <span className="text-zinc-200">Cartões de Crédito & Débito</span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Na mesa / Caixa</span>
          </div>

          {allowPayAtTable && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/50 border border-emerald-500/30">
              <span className="text-zinc-200 font-semibold">Pagamento Direto na Mesa</span>
              <span className="text-xs font-bold text-emerald-400">Liberado pelo Gestor</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
