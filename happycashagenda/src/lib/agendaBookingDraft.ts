export type AgendaBookingStep = 'service' | 'barber' | 'datetime' | 'confirm';
export type AgendaBookingFlow = 'appointment' | 'queue';

export interface AgendaBookingDraft {
  returnPath: string;
  storeSlug: string | null;
  step: AgendaBookingStep;
  bookingFlow: AgendaBookingFlow;
  serviceIds: string[];
  barberId: string | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
  clientName: string;
  clientPhone: string;
}

const AGENDA_BOOKING_DRAFT_STORAGE_KEY = 'happycash:agenda:booking-draft';

const isBrowser = () => typeof window !== 'undefined';

export function readAgendaBookingDraft(): AgendaBookingDraft | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.sessionStorage.getItem(AGENDA_BOOKING_DRAFT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AgendaBookingDraft>;
    if (!parsed || typeof parsed !== 'object') return null;

    if (!parsed.returnPath || !Array.isArray(parsed.serviceIds)) {
      return null;
    }

    return {
      returnPath: parsed.returnPath,
      storeSlug: parsed.storeSlug?.trim() || null,
      step: parsed.step === 'barber' || parsed.step === 'datetime' || parsed.step === 'confirm' ? parsed.step : 'service',
      bookingFlow: parsed.bookingFlow === 'queue' ? 'queue' : 'appointment',
      serviceIds: parsed.serviceIds.filter((serviceId): serviceId is string => typeof serviceId === 'string'),
      barberId: parsed.barberId?.trim() || null,
      appointmentDate: parsed.appointmentDate?.trim() || null,
      appointmentTime: parsed.appointmentTime?.trim() || null,
      clientName: parsed.clientName?.trim() || '',
      clientPhone: parsed.clientPhone?.trim() || '',
    };
  } catch {
    return null;
  }
}

export function saveAgendaBookingDraft(draft: AgendaBookingDraft) {
  if (!isBrowser()) return;

  window.sessionStorage.setItem(
    AGENDA_BOOKING_DRAFT_STORAGE_KEY,
    JSON.stringify(draft),
  );
}

export function clearAgendaBookingDraft() {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(AGENDA_BOOKING_DRAFT_STORAGE_KEY);
}
