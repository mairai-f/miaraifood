/** Gera payload Pix copia-e-cola (BR Code estático) para QR manual. */

const formatAmount = (amount: number) => amount.toFixed(2);

const tlv = (id: string, value: string) => {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
};

const crc16 = (payload: string) => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

const sanitizePixKey = (pixKey: string) => pixKey.trim();

const sanitizeName = (name: string, max = 25) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .slice(0, max)
    .toUpperCase() || "HAPPYCASH AGENDA";

export type AgendaPixPayloadInput = {
  pixKey: string;
  amount: number;
  merchantName: string;
  merchantCity?: string;
  txid?: string;
};

export function buildAgendaPixCopyPaste({
  pixKey,
  amount,
  merchantName,
  merchantCity = "SAO PAULO",
  txid,
}: AgendaPixPayloadInput): string | null {
  const key = sanitizePixKey(pixKey);
  if (!key || amount <= 0) return null;

  const gui = tlv("00", "BR.GOV.BCB.PIX");
  const keyField = tlv("01", key);
  const merchantAccount = tlv("26", gui + keyField);
  const additional = tlv(
    "62",
    tlv("05", (txid || `AG${Date.now()}`).replace(/[^a-zA-Z0-9]/g, "").slice(0, 25)),
  );

  const payloadWithoutCrc =
    tlv("00", "01") +
    tlv("01", "11") +
    merchantAccount +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", formatAmount(amount)) +
    tlv("58", "BR") +
    tlv("59", sanitizeName(merchantName)) +
    tlv("60", sanitizeName(merchantCity, 15)) +
    additional +
    "6304";

  return payloadWithoutCrc + crc16(payloadWithoutCrc);
}
