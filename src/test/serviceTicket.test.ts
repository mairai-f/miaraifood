import { describe, expect, it } from 'vitest';
import type { ServiceTicket } from '@/types';
import {
  buildServiceTicketBarcode,
  findServiceTicketByLookup,
  isServiceTicketBarcode,
  isServiceTicketLookup,
  isValidServiceTicketNumber,
} from '@/lib/serviceTicket';

const makeTicket = (overrides: Partial<ServiceTicket> = {}): ServiceTicket => ({
  id: 'ticket-1',
  owner_user_id: 'owner-1',
  number: 1,
  barcode: 'HC001',
  label: 'Comanda 1',
  status: 'available',
  created_at: '2026-06-24T00:00:00.000Z',
  updated_at: '2026-06-24T00:00:00.000Z',
  ...overrides,
});

describe('service ticket helpers', () => {
  it('builds the happycash barcode with HC prefix', () => {
    expect(buildServiceTicketBarcode(1)).toBe('HC001');
    expect(buildServiceTicketBarcode(25)).toBe('HC025');
    expect(buildServiceTicketBarcode(1000)).toBe('HC1000');
  });

  it('accepts only HC barcodes as commanda lookup', () => {
    expect(isServiceTicketLookup('HC001')).toBe(true);
    expect(isServiceTicketLookup('hc025')).toBe(true);
    expect(isServiceTicketLookup('HC-CMD-0001')).toBe(true);
    expect(isServiceTicketLookup('1')).toBe(true);
    expect(isServiceTicketLookup('9999')).toBe(true);
    expect(isServiceTicketLookup('7891234567890')).toBe(false);
    expect(isServiceTicketLookup('10000')).toBe(false);
  });

  it('validates supported commanda barcode formats', () => {
    expect(isServiceTicketBarcode('HC001')).toBe(true);
    expect(isServiceTicketBarcode('HC9999')).toBe(true);
    expect(isServiceTicketBarcode('HC-CMD-0001')).toBe(true);
    expect(isServiceTicketBarcode('001')).toBe(false);
    expect(isServiceTicketBarcode('HC00001')).toBe(false);
  });

  it('finds commanda only by HC barcode', () => {
    const tickets = [makeTicket(), makeTicket({ id: 'ticket-2', number: 12, barcode: 'HC012' })];

    expect(findServiceTicketByLookup(tickets, 'HC012')?.id).toBe('ticket-2');
    expect(findServiceTicketByLookup(tickets, '12')?.id).toBe('ticket-2');
  });

  it('falls back to the ticket number when the base still has an old barcode', () => {
    const tickets = [makeTicket({ number: 7, barcode: '00007' })];

    expect(findServiceTicketByLookup(tickets, 'HC007')?.number).toBe(7);
  });

  it('opens legacy HC-CMD ticket barcodes', () => {
    const tickets = [makeTicket({ number: 1, barcode: 'HC-CMD-0001' })];

    expect(findServiceTicketByLookup(tickets, 'HC-CMD-0001')?.number).toBe(1);
  });

  it('limits commanda number to 9999', () => {
    expect(isValidServiceTicketNumber(1)).toBe(true);
    expect(isValidServiceTicketNumber(9999)).toBe(true);
    expect(isValidServiceTicketNumber(10000)).toBe(false);
  });
});
