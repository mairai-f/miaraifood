import {
  endOfDay,
  format,
  isThisMonth,
  isToday,
  isValid,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { getDateFnsLocale } from '../../shared/locale/dateFnsLocale';

const CLIENT_TIME_ZONE = 'America/Sao_Paulo';

const resolveDate = (value: string) => {
  const parsed = parseISO(value);
  if (isValid(parsed)) return toZonedTime(parsed, CLIENT_TIME_ZONE);

  return toZonedTime(new Date(value), CLIENT_TIME_ZONE);
};

export const parseClientDate = (value: string) => resolveDate(value);

export const formatClientDateTime = (value: string) =>
  format(resolveDate(value), 'Pp', { locale: getDateFnsLocale() });

export const toClientDateTimeInputValue = (value: string) =>
  format(resolveDate(value), "yyyy-MM-dd'T'HH:mm");

export const toUtcIsoString = (value: string | Date) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return fromZonedTime(value, CLIENT_TIME_ZONE).toISOString();
};

export const isClientDateToday = (value: string) => isToday(resolveDate(value));

export const isClientDateInLastSevenDays = (value: string) => {
  const now = toZonedTime(new Date(), CLIENT_TIME_ZONE);

  return isWithinInterval(resolveDate(value), {
    start: startOfDay(subDays(now, 6)),
    end: endOfDay(now),
  });
};

export const isClientDateThisMonth = (value: string) => isThisMonth(resolveDate(value));
