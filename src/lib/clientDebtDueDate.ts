const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const getLocalIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeClientDebtDueDate = (value: string | null | undefined) => {
  const normalized = value?.trim() || '';
  const match = ISO_DATE_PATTERN.exec(normalized);
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return getLocalIsoDate(parsed) === normalized ? normalized : null;
};

export const formatClientDebtDueDate = (value: string | null | undefined) => {
  const normalized = normalizeClientDebtDueDate(value);
  if (!normalized) return '';

  const [year, month, day] = normalized.split('-');
  return `${day}/${month}/${year}`;
};

export const isClientDebtOverdue = (
  dueDate: string | null | undefined,
  balance: number,
  today = getLocalIsoDate(),
) => Boolean(balance > 0 && dueDate && normalizeClientDebtDueDate(dueDate) && dueDate < today);
