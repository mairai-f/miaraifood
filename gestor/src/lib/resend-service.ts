import { Resend } from 'resend';

// Inicialização do cliente Resend via chave de API no servidor
const resendApiKey = process.env.RESEND_API_KEY || '';
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'MIAR Platform <atendimento@miar.app>';

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Função utilitária para envio seguro de e-mails transacionais via Resend.
 */
export async function sendResendEmail({ to, subject, html }: SendEmailPayload) {
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY não configurada. E-mail simulado no console:', { to, subject });
    return { success: true, simulated: true };
  }

  try {
    const response = await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to,
      subject,
      html,
    });
    return { success: true, id: response.data?.id };
  } catch (error) {
    console.error('❌ Erro no disparo de e-mail via Resend:', error);
    return { success: false, error };
  }
}

// ============================================================================
// TEMPLATES DE E-MAIL (HTML RESPONSIVO DARK MODE / PREMIUM)
// ============================================================================

/**
 * Template 1: Boas-vindas ao Dono do Restaurante (Supergestora -> Novo Restaurante)
 */
export function generateWelcomeEmailHtml(params: { companyName: string; ownerName: string; loginUrl: string }): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Bem-vindo ao MIAR</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; margin: 0; padding: 40px 20px; }
        .card { max-width: 580px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .logo { font-size: 26px; font-weight: 900; color: #9EF01A; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px; }
        .badge { background: #9EF01A20; color: #9EF01A; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; display: inline-block; }
        h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 16px; margin-bottom: 12px; }
        p { font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
        .highlight-box { background: #1e293b; border-left: 4px solid #38B000; padding: 16px; border-radius: 8px; margin: 24px 0; }
        .btn { display: inline-block; background-color: #38B000; color: #ffffff; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 15px; margin-top: 16px; }
        .footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid #1f2937; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">⚡ MIAR PLATFORM</div>
        <span class="badge">Conta Ativada</span>
        <h1>Seja bem-vindo, ${params.ownerName}! 👋</h1>
        <p>A conta do seu estabelecimento <strong>${params.companyName}</strong> foi criada e ativada com sucesso na plataforma MIAR.</p>
        
        <div class="highlight-box">
          <p style="margin: 0; color: #F2F7F3; font-size: 14px;">
            <strong>O que você tem acesso a partir de agora:</strong><br/>
            • Central Multi-Monitor & KDS de Cozinha em tempo real<br/>
            • Operação de Caixa & PDV com tolerancia a queda de internet<br/>
            • Inteligência Artificial Ária para análises de margem e estoque
          </p>
        </div>

        <a href="${params.loginUrl}" class="btn">Acessar Painel da Loja</a>

        <div class="footer">
          <p>© 2026 MIAR Platform. Todos os direitos reservados.<br/>Supergestora SaaS — Foodservice Intelligence</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Template 2: Fechamento Diário de Caixa, Faturamento & Alerta de Estoque Mínimo
 */
export function generateDailyClosingEmailHtml(params: {
  companyName: string;
  date: string;
  totalSales: number;
  pixTotal: number;
  cardTotal: number;
  cashTotal: number;
  lowStockItems: Array<{ name: string; current: number; min: number; unit: string }>;
}): string {
  const formattedTotal = params.totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedPix = params.pixTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedCard = params.cardTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedCash = params.cashTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const stockAlertsHtml = params.lowStockItems.length > 0
    ? params.lowStockItems.map(i => `
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px; color: #F2F7F3; font-size: 13px;">${i.name}</td>
          <td style="padding: 10px; color: #ef4444; font-weight: 700; font-size: 13px;">${i.current} ${i.unit}</td>
          <td style="padding: 10px; color: #94a3b8; font-size: 13px;">Mín: ${i.min} ${i.unit}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="3" style="padding: 12px; color: #10b981; font-size: 13px; text-align: center;">Nenhum insumo em nível crítico hoje 🎉</td></tr>`;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Fechamento Diário — ${params.companyName}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; margin: 0; padding: 40px 20px; }
        .card { max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 40px; }
        .header { text-align: center; border-bottom: 1px solid #1f2937; padding-bottom: 24px; margin-bottom: 24px; }
        .company { font-size: 20px; font-weight: 800; color: #ffffff; }
        .date { font-size: 13px; color: #94a3b8; }
        .total-box { background: #38B00015; border: 1px solid #38B00040; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 28px; }
        .total-title { font-size: 13px; color: #38B000; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .total-amount { font-size: 36px; font-weight: 900; color: #ffffff; margin-top: 4px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 28px; }
        .metric-card { background: #1e293b; padding: 14px; border-radius: 10px; }
        .metric-label { font-size: 12px; color: #94a3b8; }
        .metric-value { font-size: 16px; font-weight: 700; color: #ffffff; margin-top: 2px; }
        .section-title { font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 12px; margin-top: 24px; }
        table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 10px; overflow: hidden; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #1f2937; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="company">${params.companyName}</div>
          <div class="date">Relatório Executivo de Fechamento • ${params.date}</div>
        </div>

        <div class="total-box">
          <div class="total-title">Faturamento Total do Dia</div>
          <div class="total-amount">${formattedTotal}</div>
        </div>

        <div class="section-title">💳 Detalhamento de Entradas por Meio de Pagamento</div>
        <div class="grid">
          <div class="metric-card"><div class="metric-label">⚡ PIX</div><div class="metric-value">${formattedPix}</div></div>
          <div class="metric-card"><div class="metric-label">💳 Cartões (Crédito/Débito)</div><div class="metric-value">${formattedCard}</div></div>
          <div class="metric-card"><div class="metric-label">💵 Dinheiro</div><div class="metric-value">${formattedCash}</div></div>
        </div>

        <div class="section-title">⚠️ Insumos em Nível Crítico (Estoque Mínimo)</div>
        <table>
          <thead>
            <tr style="background: #0f172a; text-align: left;">
              <th style="padding: 10px; color: #94a3b8; font-size: 12px;">Insumo</th>
              <th style="padding: 10px; color: #94a3b8; font-size: 12px;">Saldo Atual</th>
              <th style="padding: 10px; color: #94a3b8; font-size: 12px;">Estoque Mín.</th>
            </tr>
          </thead>
          <tbody>
            ${stockAlertsHtml}
          </tbody>
        </table>

        <div class="footer">
          <p>Relatório gerado automaticamente pelo MIAR Platform ao encerrar o turno de caixa.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Template 3: Redefinição de Senha (Expiração Ultra-Segura de 30 Segundos)
 */
export function generatePasswordResetEmailHtml(params: { name: string; resetUrl: string }): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Redefinição de Senha</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; margin: 0; padding: 40px 20px; }
        .card { max-width: 540px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 36px; }
        .alert-badge { background-color: #ef444420; color: #ef4444; border: 1px solid #ef444440; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-block; margin-bottom: 12px; }
        h2 { color: #ffffff; font-size: 20px; margin-top: 8px; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
        .btn { display: inline-block; background-color: #3b82f6; color: #ffffff; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 10px; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="alert-badge">⚡ Expiração em 30 Segundos</span>
        <h2>Solicitação de Nova Senha 🔐</h2>
        <p>Olá, <strong>${params.name}</strong>!</p>
        <p>Recebemos uma solicitação para redefinir a senha do seu usuário no MIAR.</p>
        <p>Por medidas de alta segurança, este link é válido por <strong>apenas 30 segundos</strong>.</p>
        <a href="${params.resetUrl}" class="btn">Redefinir Minha Senha Agora</a>
        <p style="margin-top: 24px; font-size: 12px; color: #64748b;">Se não foi você quem solicitou, nenhuma ação é necessária.</p>
      </div>
    </body>
    </html>
  `;
}
