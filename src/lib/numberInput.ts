const normalizeDecimalText = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const numericText = trimmed
    .replace(/[^\d,.-]/g, '')
    .replace(/(?!^)-/g, '');

  const lastComma = numericText.lastIndexOf(',');
  const lastDot = numericText.lastIndexOf('.');
  const decimalSeparatorIndex = Math.max(lastComma, lastDot);

  if (decimalSeparatorIndex === -1) {
    return numericText.replace(/[,.]/g, '');
  }

  const integerPart = numericText.slice(0, decimalSeparatorIndex).replace(/[,.]/g, '');
  const decimalPart = numericText.slice(decimalSeparatorIndex + 1).replace(/[,.]/g, '');
  return `${integerPart || '0'}.${decimalPart}`;
};

export const parseDecimalInput = (value: string | number | null | undefined, fallback = 0) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  const normalized = normalizeDecimalText(String(value ?? ''));
  if (!normalized || normalized === '-' || normalized === '-.') {
    return fallback;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseOptionalDecimalInput = (value: string | number | null | undefined) => {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const parsed = parseDecimalInput(text, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
};
