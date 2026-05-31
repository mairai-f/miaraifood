import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function normalizeWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export type AgendaBookingWhatsAppInput = {
  businessName: string;
  clientName: string;
  professionalName: string;
  serviceNames: string[];
  appointmentDate: string;
  appointmentTime: string;
  totalAmount: number;
  paymentStatus: "pending" | "paid";
};

export type AgendaCancellationWhatsAppInput = {
  businessName: string;
  clientName: string;
  professionalName: string;
  serviceNames: string[];
  appointmentDate: string;
  appointmentTime: string;
  totalAmount: number;
};

export type AgendaRescheduleWhatsAppInput = {
  businessName: string;
  clientName: string;
  professionalName: string;
  serviceNames: string[];
  previousAppointmentDate: string;
  previousAppointmentTime: string;
  appointmentDate: string;
  appointmentTime: string;
};

export type AgendaProductOrderWhatsAppInput = {
  businessName: string;
  clientName: string;
  orderDate: Date;
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  paymentMethod: "local" | "pix";
};

export function buildClientPaymentWhatsAppMessage(input: AgendaBookingWhatsAppInput) {
  const dateLabel = format(new Date(`${input.appointmentDate}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
  const timeLabel = input.appointmentTime.slice(0, 5);
  const services = input.serviceNames.join(", ");
  const status = input.paymentStatus === "paid" ? "confirmado" : "aguardando confirmacao";

  return [
    `Ola! Fiz um agendamento na *${input.businessName}*.`,
    "",
    `Cliente: ${input.clientName}`,
    `${input.professionalName}`,
    `Servicos: ${services}`,
    `Data: ${dateLabel} as ${timeLabel}`,
    `Valor: R$ ${input.totalAmount.toFixed(2)}`,
    `Pagamento: ${status}`,
  ].join("\n");
}

export function buildAdminConfirmWhatsAppMessage(input: AgendaBookingWhatsAppInput) {
  const dateLabel = format(new Date(`${input.appointmentDate}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
  const timeLabel = input.appointmentTime.slice(0, 5);
  const services = input.serviceNames.join(", ");

  return [
    `*${input.businessName}* — novo agendamento`,
    "",
    `Cliente: ${input.clientName}`,
    `Profissional: ${input.professionalName}`,
    `Servicos: ${services}`,
    `Horario: ${dateLabel} as ${timeLabel}`,
    `Valor: R$ ${input.totalAmount.toFixed(2)}`,
    "Confirme o horario e o pagamento no painel.",
  ].join("\n");
}

export function buildAppointmentCancellationWhatsAppMessage(input: AgendaCancellationWhatsAppInput) {
  const dateLabel = format(new Date(`${input.appointmentDate}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
  const timeLabel = input.appointmentTime.slice(0, 5);
  const services = input.serviceNames.join(", ");

  return [
    `*${input.businessName}* - agendamento cancelado`,
    "",
    `Cliente: ${input.clientName}`,
    `Profissional: ${input.professionalName}`,
    `Servicos: ${services}`,
    `Horario cancelado: ${dateLabel} as ${timeLabel}`,
    `Valor: R$ ${input.totalAmount.toFixed(2)}`,
    "Cancelamento feito pelo cliente.",
  ].join("\n");
}

export function buildAppointmentRescheduleWhatsAppMessage(input: AgendaRescheduleWhatsAppInput) {
  const previousDateLabel = format(new Date(`${input.previousAppointmentDate}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
  const previousTimeLabel = input.previousAppointmentTime.slice(0, 5);
  const nextDateLabel = format(new Date(`${input.appointmentDate}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
  const nextTimeLabel = input.appointmentTime.slice(0, 5);
  const services = input.serviceNames.join(", ");

  return [
    `*${input.businessName}* - agendamento remarcado`,
    "",
    `Cliente: ${input.clientName}`,
    `Profissional: ${input.professionalName}`,
    `Servicos: ${services}`,
    `Horario anterior: ${previousDateLabel} as ${previousTimeLabel}`,
    `Novo horario: ${nextDateLabel} as ${nextTimeLabel}`,
    "Remarcacao feita pelo cliente.",
  ].join("\n");
}

export function buildProductOrderWhatsAppMessage(input: AgendaProductOrderWhatsAppInput) {
  const dateLabel = format(input.orderDate, "dd/MM/yyyy", { locale: ptBR });
  const timeLabel = format(input.orderDate, "HH:mm", { locale: ptBR });
  const paymentLabel =
    input.paymentMethod === "pix"
      ? "Pix informado como pago, aguardando confirmacao da empresa"
      : "Pagar no local";
  const items = input.items
    .map((item) => `- ${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}`)
    .join("\n");

  return [
    `*${input.businessName}* - pedido de produto`,
    "",
    `Cliente: ${input.clientName}`,
    `Data: ${dateLabel}`,
    `Hora: ${timeLabel}`,
    "Itens:",
    items,
    `Total: R$ ${input.totalAmount.toFixed(2)}`,
    `Pagamento: ${paymentLabel}`,
  ].join("\n");
}

export function openAgendaWhatsAppTargets(options: {
  professionalPhone?: string | null;
  adminPhone?: string | null;
  clientMessage: string;
  adminMessage: string;
}) {
  const professionalUrl = options.professionalPhone
    ? buildWhatsAppUrl(options.professionalPhone, options.clientMessage)
    : null;
  const adminUrl = options.adminPhone
    ? buildWhatsAppUrl(options.adminPhone, options.adminMessage)
    : null;

  if (professionalUrl) {
    window.open(professionalUrl, "_blank", "noopener,noreferrer");
  }

  if (adminUrl) {
    window.setTimeout(() => {
      window.open(adminUrl, "_blank", "noopener,noreferrer");
    }, professionalUrl ? 700 : 0);
  }
}
