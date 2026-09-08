const PRODUCT_CODE_PREFIX = 'P';
const PRODUCT_CODE_MIN_DIGITS = 2;

const normalizeProductCodeDigits = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '';

  const normalized = String(value).trim().toUpperCase();
  const digits = normalized.startsWith(PRODUCT_CODE_PREFIX)
    ? normalized.slice(PRODUCT_CODE_PREFIX.length)
    : normalized;

  return digits.replace(/\D/g, '');
};

export const formatProductCode = (value: string | number | null | undefined) => {
  const digits = normalizeProductCodeDigits(value);
  if (!digits) return '';

  return `${PRODUCT_CODE_PREFIX}${digits.padStart(PRODUCT_CODE_MIN_DIGITS, '0')}`;
};

export const isProductCodeQuery = (value: string) =>
  /^P\d+$/i.test(value.trim());
