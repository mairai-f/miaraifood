import {
  format,
  isThisMonth,
  isThisWeek,
  isToday,
  isValid,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const resolveDate = (value: string) => {
  const parsed = parseISO(value);
  if (isValid(parsed)) return parsed;

  return new Date(value);
};

export const parseClientDate = (value: string) => resolveDate(value);

export const formatClientDateTime = (value: string) =>
  format(resolveDate(value), 'dd/MM/yyyy HH:mm', { locale: ptBR });

export const toClientDateTimeInputValue = (value: string) =>
  format(resolveDate(value), "yyyy-MM-dd'T'HH:mm");

export const toUtcIsoString = (value: string | Date) => {
  const resolved = value instanceof Date ? value : new Date(value);
  return resolved.toISOString();
};

export const isClientDateToday = (value: string) => isToday(resolveDate(value));

export const isClientDateThisWeek = (value: string) =>
  isThisWeek(resolveDate(value), {
    locale: ptBR,
    weekStartsOn: 1,
  });

export const isClientDateThisMonth = (value: string) => isThisMonth(resolveDate(value));
