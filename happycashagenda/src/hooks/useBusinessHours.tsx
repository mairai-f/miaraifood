import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BusinessHour {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

const CLOSING_TOLERANCE_MINUTES = 20; // Tolerância após o horário de fechamento

export function useBusinessHours(storeAccountId?: string) {
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCurrentlyOpen, setIsCurrentlyOpen] = useState(false);

  const fetchBusinessHours = useCallback(async () => {
    if (!storeAccountId) {
      setBusinessHours([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('business_hours')
      .select('*')
      .eq('store_account_id', storeAccountId)
      .order('day_of_week');

    if (!error && data) {
      setBusinessHours(data);
    }
    setLoading(false);
  }, [storeAccountId]);

  useEffect(() => {
    void fetchBusinessHours();
  }, [fetchBusinessHours]);

  useEffect(() => {
    const checkIfOpen = () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const currentTime = now.toTimeString().slice(0, 5);

      const todayHours = businessHours.find(h => h.day_of_week === dayOfWeek);
      if (todayHours && todayHours.is_open) {
        const isOpen = currentTime >= todayHours.open_time && currentTime <= todayHours.close_time;
        setIsCurrentlyOpen(isOpen);
      } else {
        setIsCurrentlyOpen(false);
      }
    };

    checkIfOpen();
    const interval = setInterval(checkIfOpen, 60000);
    return () => clearInterval(interval);
  }, [businessHours]);

  const getHoursForDay = (dayOfWeek: number) => {
    return businessHours.find(h => h.day_of_week === dayOfWeek);
  };

  /**
   * Verifica se um serviço com determinada duração pode ser agendado em um horário específico
   * Retorna: { canBook: boolean, reason?: string }
   */
  const canBookServiceAtTime = (
    date: Date,
    timeSlot: string,
    serviceDuration: number
  ): { canBook: boolean; reason?: string; suggestion?: string } => {
    const dayOfWeek = date.getDay();
    const hours = getHoursForDay(dayOfWeek);

    if (!hours || !hours.is_open) {
      return { canBook: false, reason: 'Estabelecimento fechado neste dia.' };
    }

    const [slotHour, slotMin] = timeSlot.split(':').map(Number);
    const [closeHour, closeMin] = hours.close_time.split(':').map(Number);

    const slotStartMinutes = slotHour * 60 + slotMin;
    const serviceEndMinutes = slotStartMinutes + serviceDuration;
    const closeMinutes = closeHour * 60 + closeMin;
    const maxAllowedEndMinutes = closeMinutes + CLOSING_TOLERANCE_MINUTES;

    if (serviceEndMinutes > maxAllowedEndMinutes) {
      const exceedsBy = serviceEndMinutes - closeMinutes;
      return {
        canBook: false,
        reason: `O serviço de ${serviceDuration} minutos ultrapassa o horário de funcionamento em ${exceedsBy} minutos.`,
        suggestion: `Escolha outro dia ou um serviço com duração de até ${closeMinutes - slotStartMinutes + CLOSING_TOLERANCE_MINUTES} minutos.`
      };
    }

    return { canBook: true };
  };

  /**
   * Retorna os slots disponíveis para agendamento considerando:
   * - Horário de funcionamento
   * - Tolerância de 20 minutos após o fechamento
   */
  const getAvailableTimeSlots = (date: Date, serviceDuration: number = 30) => {
    const dayOfWeek = date.getDay();
    const hours = getHoursForDay(dayOfWeek);

    if (!hours || !hours.is_open) return [];

    const slots: string[] = [];
    const [openHour, openMin] = hours.open_time.split(':').map(Number);
    const [closeHour, closeMin] = hours.close_time.split(':').map(Number);

    const closeMinutes = closeHour * 60 + closeMin;
    const maxAllowedEndMinutes = closeMinutes + CLOSING_TOLERANCE_MINUTES;

    let currentHour = openHour;
    let currentMin = openMin;

    while (true) {
      const currentMinutes = currentHour * 60 + currentMin;
      const serviceEndMinutes = currentMinutes + serviceDuration;

      // O serviço pode terminar até 20 minutos após o fechamento
      if (serviceEndMinutes > maxAllowedEndMinutes) break;

      slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`);

      currentMin += 30;
      if (currentMin >= 60) {
        currentHour += 1;
        currentMin = 0;
      }
    }

    return slots;
  };

  /**
   * Retorna TODOS os slots do horário de funcionamento, incluindo os que
   * excedem a tolerância. Útil para mostrar visualmente os slots "brancos"
   * (horários que existem mas o serviço ultrapassaria o fechamento).
   */
  const getAllBusinessSlots = (date: Date) => {
    const dayOfWeek = date.getDay();
    const hours = getHoursForDay(dayOfWeek);

    if (!hours || !hours.is_open) return [];

    const slots: string[] = [];
    const [openHour, openMin] = hours.open_time.split(':').map(Number);
    const [closeHour, closeMin] = hours.close_time.split(':').map(Number);

    const closeMinutes = closeHour * 60 + closeMin;

    let currentHour = openHour;
    let currentMin = openMin;

    while (true) {
      const currentMinutes = currentHour * 60 + currentMin;
      // Gera slots até o horário de fechamento (sem considerar duração do serviço)
      if (currentMinutes >= closeMinutes) break;

      slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`);

      currentMin += 30;
      if (currentMin >= 60) {
        currentHour += 1;
        currentMin = 0;
      }
    }

    return slots;
  };

  return {
    businessHours,
    loading,
    isCurrentlyOpen,
    getHoursForDay,
    getAvailableTimeSlots,
    getAllBusinessSlots,
    canBookServiceAtTime,
    refetch: fetchBusinessHours
  };
}
