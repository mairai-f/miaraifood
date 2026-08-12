import LegalDocumentPage from "@/components/landing/LegalDocumentPage";
import { createSiteUrl } from "@/lib/siteSeo";
import { LEGAL_SUPPORT_EMAIL, LEGAL_UPDATED_AT_LABEL } from "../../../shared/legal/legalAcceptance";

const path = "/lgpd";

const Lgpd = () => (
  <LegalDocumentPage
    seo={{
      title: "LGPD | HappyCash",
      description: "Veja como o HappyCash aplica controles de acesso, separação por empresa, logs e atendimento aos direitos dos titulares para operar conforme a LGPD.",
      path,
      keywords: ["LGPD HappyCash", "ANPD HappyCash", "privacidade PDV", "dados por empresa"],
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "LGPD no HappyCash",
        url: createSiteUrl(path),
      },
    }}
    eyebrow="LGPD"
    title="LGPD no HappyCash"
    description="Mais do que publicar textos legais, o HappyCash precisa operar com controles reais de acesso, segregação por empresa, logs e rotinas para atender direitos dos titulares."
    updatedAt={LEGAL_UPDATED_AT_LABEL}
    sections={[
      {
        title: "1. O que realmente importa",
        paragraphs: [
          "O mais importante: não é só ter texto no site. Você precisa que o sistema realmente respeite isso: controlar acesso, separar dados por empresa, permitir exclusão/correção quando possível, guardar logs e deixar claro o que faz com os dados.",
          "No HappyCash, o acesso a módulos e rotinas depende de autenticação, perfil, permissões, contexto do produto e vínculo com a empresa ativada. Também mantemos separação de dados por conta e por contexto operacional sempre que aplicável.",
        ],
      },
      {
        title: "2. Direitos dos titulares",
        paragraphs: [
          "A LGPD garante direitos como confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informação sobre compartilhamento e revisão do consentimento quando aplicável.",
          `Solicitações relacionadas a dados tratados diretamente pelo HappyCash podem ser encaminhadas para ${LEGAL_SUPPORT_EMAIL}. Quando os dados tiverem sido cadastrados por uma loja cliente, a empresa controladora pode precisar participar do atendimento à solicitação.`,
        ],
      },
      {
        title: "3. Medidas operacionais",
        bullets: [
          "Controle de acesso por usuário, perfil, empresa e permissões operacionais.",
          "Separação de dados por empresa e por contexto de produto quando aplicável.",
          "Registros de acesso, monitoramento e trilhas de auditoria para ações relevantes.",
          "Correção, exclusão lógica e atualização de dados quando tecnicamente possível e juridicamente cabível.",
          "Documentação pública sobre finalidades de tratamento, suporte e canais de contato.",
        ],
      },
      {
        title: "4. ANPD e responsabilização",
        paragraphs: [
          "A ANPD pode aplicar sanções em caso de descumprimento da LGPD, e o regulamento de dosimetria orienta como as penalidades são calculadas quando cabíveis.",
          "Por isso, além dos documentos públicos, tratamos privacidade como requisito operacional do sistema e revisamos fluxos de autenticação, segregação, retenção e suporte sempre que necessário.",
        ],
      },
    ]}
  />
);

export default Lgpd;
