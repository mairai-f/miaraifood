import type { Client } from '@/types';

export const toClientSlug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const normalizeClientRef = (value: string) =>
  decodeURIComponent(value ?? '').trim().toLowerCase();

const getClientsWithSameBaseSlug = (clients: Client[], baseSlug: string) =>
  clients
    .filter(c => toClientSlug(c.name) === baseSlug)
    .sort((a, b) => {
      const dateDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id.localeCompare(b.id);
    });

export const getClientUniqueSlug = (client: Client, clients: Client[]) => {
  const baseSlug = toClientSlug(client.name);
  const sameBase = getClientsWithSameBaseSlug(clients, baseSlug);
  const position = sameBase.findIndex(c => c.id === client.id);
  if (position <= 0) return baseSlug;
  return `${baseSlug}-${position + 1}`;
};

export const findClientByRef = (clients: Client[], rawRef: string) => {
  const ref = normalizeClientRef(rawRef);
  if (!ref) return undefined;

  const byId = clients.find(c => c.id === ref);
  if (byId) return byId;

  const match = ref.match(/^(.*?)-(\d+)$/);
  if (match) {
    const baseSlug = match[1];
    const suffix = Number(match[2]);
    if (suffix > 1) {
      const sameBase = getClientsWithSameBaseSlug(clients, baseSlug);
      return sameBase[suffix - 1];
    }
  }

  const sameBase = getClientsWithSameBaseSlug(clients, ref);
  return sameBase[0];
};
