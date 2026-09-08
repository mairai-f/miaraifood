import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  actionName: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  title = 'Confirmação de Operação Sensível',
  actionName,
  description = 'Esta ação afetará diretamente os registros do sistema e não poderá ser desfeita.',
  confirmText = 'Continuar e Executar Ação',
  cancelText = 'Cancelar',
  onConfirm,
  onClose,
  loading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06100A]/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-[#0B1A10] p-6 shadow-2xl space-y-5 border-t-4 border-t-rose-500 select-none">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-6 w-6 text-rose-500 animate-pulse" />
            </div>
            <div>
              <h3 className="font-manrope font-extrabold text-base text-rose-300">
                {title}
              </h3>
              <p className="text-[11px] text-[#8FA396]">Alerta de Ação Crítica</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8FA396] hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Confirmation Body */}
        <div className="rounded-2xl border border-rose-500/20 bg-[#06100A]/80 p-4 space-y-2">
          <p className="text-xs text-[#F2F7F3] leading-relaxed">
            Você tem certeza que você quer fazer: <br />
            <strong className="text-rose-400 font-bold text-sm block mt-1">
              "{actionName}"
            </strong>
          </p>
          <p className="text-[11px] text-[#8FA396] leading-relaxed pt-1 border-t border-slate-800">
            {description}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-[#8FA396] hover:text-white hover:bg-slate-800 transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-rose-500 active:scale-95 transition-all shadow-[0_4px_14px_rgba(225,29,72,0.4)] disabled:opacity-50"
          >
            {loading ? (
              <span>Executando...</span>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
