import type { ServiceTicket } from '@/types';

// Novas comandas usam a marca MIAR. Os formatos HappyCash continuam válidos
// somente para localizar comandas já impressas antes da migração.
export const SERVICE_TICKET_BARCODE_PREFIX = 'MR';
export const SERVICE_TICKET_BARCODE_MIN_DIGITS = 3;
export const SERVICE_TICKET_BARCODE_MAX_DIGITS = 4;
const LEGACY_SERVICE_TICKET_BARCODE_PREFIX = 'HC-CMD-';
const LEGACY_SERVICE_TICKET_SHORT_PREFIX = 'HC';

export const normalizeServiceTicketLookup = (value: string) => value.trim().toUpperCase();

export const isValidServiceTicketNumber = (value: number) =>
  Number.isInteger(value) && value > 0 && value <= 9999;

const buildServiceTicketDigits = (number: number) =>
  String(number).padStart(number >= 1000 ? SERVICE_TICKET_BARCODE_MAX_DIGITS : SERVICE_TICKET_BARCODE_MIN_DIGITS, '0');

const parseServiceTicketBarcodeNumber = (value: string) => {
  const normalized = normalizeServiceTicketLookup(value);
  if (!isServiceTicketBarcode(normalized)) return null;

  const digits = normalized.startsWith(LEGACY_SERVICE_TICKET_BARCODE_PREFIX)
    ? normalized.slice(LEGACY_SERVICE_TICKET_BARCODE_PREFIX.length)
    : normalized.startsWith(LEGACY_SERVICE_TICKET_SHORT_PREFIX)
      ? normalized.slice(LEGACY_SERVICE_TICKET_SHORT_PREFIX.length)
      : normalized.slice(SERVICE_TICKET_BARCODE_PREFIX.length);
  const parsed = Number.parseInt(digits, 10);
  return isValidServiceTicketNumber(parsed) ? parsed : null;
};

export const buildServiceTicketBarcode = (number: number) =>
  `${SERVICE_TICKET_BARCODE_PREFIX}${buildServiceTicketDigits(number)}`;

export const isCurrentServiceTicketBarcode = (value: string) =>
  new RegExp(
    `^${SERVICE_TICKET_BARCODE_PREFIX}\\d{${SERVICE_TICKET_BARCODE_MIN_DIGITS},${SERVICE_TICKET_BARCODE_MAX_DIGITS}}$`
  ).test(normalizeServiceTicketLookup(value));

export const isServiceTicketBarcode = (value: string) => {
  const normalized = normalizeServiceTicketLookup(value);

  const currentFormat = isCurrentServiceTicketBarcode(normalized);
  if (currentFormat) return true;

  return /^HC(?:-CMD-\d{4}|\d{3,4})$/.test(normalized);
};

export const normalizeServiceTicketBarcode = (number: number, barcode?: string | null) => {
  const normalized = normalizeServiceTicketLookup(barcode ?? '');
  if (isServiceTicketBarcode(normalized)) {
    return normalized;
  }

  return buildServiceTicketBarcode(number);
};

export const normalizeServiceTicketRecord = <T extends Pick<ServiceTicket, 'number' | 'barcode'>>(ticket: T): T => ({
  ...ticket,
  barcode: normalizeServiceTicketBarcode(ticket.number, ticket.barcode),
});

export const isServiceTicketNumberLookup = (value: string) => {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return false;

  const parsed = Number.parseInt(normalized, 10);
  return isValidServiceTicketNumber(parsed);
};

export const isServiceTicketLookup = (value: string) =>
  isServiceTicketBarcode(value) || isServiceTicketNumberLookup(value);

export const findServiceTicketByLookup = (tickets: ServiceTicket[], value: string) => {
  const normalized = normalizeServiceTicketLookup(value);
  if (isServiceTicketBarcode(normalized)) {
    const ticketByBarcode = tickets.find(ticket => ticket.barcode.trim().toUpperCase() === normalized);
    if (ticketByBarcode) return ticketByBarcode;

    const ticketNumber = parseServiceTicketBarcodeNumber(normalized);
    if (ticketNumber === null) return null;

    return tickets.find(ticket => ticket.number === ticketNumber) ?? null;
  }

  if (!isServiceTicketNumberLookup(normalized)) return null;

  const ticketNumber = Number.parseInt(normalized, 10);
  return tickets.find(ticket => ticket.number === ticketNumber) ?? null;
};
