import { useState } from 'react';

export type ConfirmVariant = 'warning' | 'danger';

export type ConfirmRequest = {
  title: string;
  message: string;
  variant: ConfirmVariant;
  confirmLabel: string;
  /** Se definido, mostra um campo de texto opcional (ex.: motivo da ação) e
   * repassa o valor digitado pro onConfirm. */
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void | Promise<void>;
};

export function ConfirmModal({
  request,
  busy,
  onCancel,
}: {
  request: ConfirmRequest | null;
  busy: boolean;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  if (!request) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className={`modal-card confirm-modal-card ${request.variant}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{request.title}</h3>
        <p className="muted-text">{request.message}</p>
        {request.reasonPlaceholder && (
          <label style={{ display: 'block', marginTop: 12 }}>
            Motivo (opcional)
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={request.reasonPlaceholder} />
          </label>
        )}
        <div className="button-row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
          <button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className={request.variant === 'warning' ? 'warning-button' : 'danger-button'}
            onClick={() => void request.onConfirm(reason.trim() || undefined)}
            disabled={busy}
          >
            {busy ? 'Aguarde...' : request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
