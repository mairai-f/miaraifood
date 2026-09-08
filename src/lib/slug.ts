import type { Client } from '@/types';

/** Generate a URL-friendly slug from a client name, ensuring uniqueness */
export function clientSlug(client: Client, allClients: Client[]): string {
  const base = client.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'cliente';

  const sameSlug = allClients.filter(
    c => c.id !== client.id && makeBase(c.name) === base
  );

  if (sameSlug.length === 0) return base;

  // Add a suffix number
  const index = allClients
    .filter(c => makeBase(c.name) === base)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .findIndex(c => c.id === client.id);

  return index > 0 ? `${base}-${index + 1}` : base;
}

function makeBase(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'cliente';
}

/** Find a client by slug from the list */
export function findClientBySlug(slug: string, clients: Client[]): Client | undefined {
  for (const c of clients) {
    if (clientSlug(c, clients) === slug) return c;
  }
  return undefined;
}
