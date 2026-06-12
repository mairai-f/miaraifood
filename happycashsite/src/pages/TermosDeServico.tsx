import LegalDocumentPage from "@/components/landing/LegalDocumentPage";
import { createSiteUrl } from "@/lib/siteSeo";

const path = "/termos-de-servico";
const updatedAt = "12 de junho de 2026";
const supportEmail = "happycashsupport@gmail.com";

const TermosDeServico = () => (
  <LegalDocumentPage
    seo={{
      title: "Termos de Serviço | HappyCash",
      description: "Conheça as condições de uso do HappyCash para controle de fiado, PDV, estoque, desktop, Food, Agenda, planos, suporte e cancelamento.",
      path,
      keywords: ["termos de serviço happycash", "termos de uso happycash", "contrato sistema pdv", "termos controle de fiado"],
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Termos de Serviço do HappyCash",
        url: createSiteUrl(path),
      },
    }}
    eyebrow="Termos"
    title="Termos de Serviço"
    description="Estes Termos regulam o uso do site, área do cliente, sistema HappyCash, HappyCashFood, HappyCash Agenda, recursos de desktop, planos, testes gratuitos e funcionalidades relacionadas."
    updatedAt={updatedAt}
    sections={[
      {
        title: "1. Aceite dos termos",
        paragraphs: [
          "Ao criar uma conta, acessar o site, contratar um plano, usar o teste gratuito ou utilizar qualquer produto HappyCash, você concorda com estes Termos de Serviço e com a Política de Privacidade.",
          "Se você usa o HappyCash em nome de uma empresa ou estabelecimento, declara que possui autorização para aceitar estes termos em nome desse negócio.",
        ],
      },
      {
        title: "2. O que o HappyCash oferece",
        paragraphs: [
          "O HappyCash fornece ferramentas digitais para gestão comercial, incluindo controle de fiado, cadastro de clientes, PDV, estoque, relatórios, operadores, recursos desktop e modo offline em planos compatíveis. Produtos relacionados podem incluir HappyCashFood, HappyCash Agenda e outros recursos publicados no site.",
          "As funcionalidades disponíveis variam conforme plano, produto, ambiente, configuração da conta e disponibilidade técnica.",
        ],
      },
      {
        title: "3. Cadastro e segurança da conta",
        bullets: [
          "Você deve fornecer informações verdadeiras e manter seus dados atualizados.",
          "Você é responsável por proteger email, senha, PINs, operadores e dispositivos usados para acessar o sistema.",
          "Ações realizadas por usuários, operadores ou pessoas com acesso à sua conta podem ser consideradas realizadas por você ou pelo estabelecimento titular da conta.",
          "Podemos bloquear, suspender ou limitar acessos quando houver suspeita de fraude, abuso, risco de segurança ou violação destes Termos.",
        ],
      },
      {
        title: "4. Planos, teste gratuito e pagamentos",
        paragraphs: [
          "O HappyCash pode oferecer teste gratuito, planos mensais, planos anuais, pagamentos por Pix, boleto, crédito, débito ou outros meios indicados no checkout. Valores, benefícios e limites são apresentados nas páginas de planos ou na área do cliente.",
          "A liberação, renovação, expiração ou bloqueio de recursos pode depender da confirmação do pagamento e do status da assinatura. Em caso de atraso, cancelamento, chargeback ou falha de cobrança, o acesso a recursos pagos pode ser limitado.",
          "Promoções, valores e condições podem mudar para novas contratações. Quando aplicável, comunicaremos mudanças relevantes pelos canais disponíveis.",
        ],
      },
      {
        title: "5. Cancelamento e exclusão",
        paragraphs: [
          "Você pode solicitar cancelamento pelo canal de suporte ou por recursos disponíveis na área do cliente. O cancelamento interrompe renovações futuras, mas não apaga automaticamente todos os dados necessários para registros legais, segurança, suporte, comprovação de pagamento ou cumprimento de obrigações.",
          "A exclusão de conta e dados pode ser solicitada pelo suporte, observados prazos legais, backups técnicos e a necessidade de preservar informações para defesa de direitos, prevenção de fraude ou cumprimento de lei.",
        ],
      },
      {
        title: "6. Responsabilidades do usuário",
        bullets: [
          "Usar o sistema conforme a lei e estes Termos.",
          "Conferir vendas, valores, pagamentos, estoque, fiado, relatórios, comandas e informações fiscais antes de tomar decisões comerciais.",
          "Obter autorização adequada para cadastrar e tratar dados de clientes, funcionários, operadores e terceiros.",
          "Manter backups, conferências e controles internos quando sua operação exigir.",
          "Não usar o HappyCash para fraude, lavagem de dinheiro, atividade ilegal, envio abusivo de mensagens, violação de direitos de terceiros ou tentativa de acessar sistemas sem autorização.",
        ],
      },
      {
        title: "7. Recursos fiscais, financeiros e relatórios",
        paragraphs: [
          "Informações de caixa, lucro, estoque, relatórios, cobranças, documentos fiscais em homologação ou outros indicadores são ferramentas de apoio operacional. O usuário deve conferir os dados e buscar orientação contábil, fiscal ou jurídica quando necessário.",
          "O HappyCash não substitui contador, advogado, consultor financeiro ou autoridade fiscal. Qualquer emissão fiscal, configuração tributária ou decisão comercial continua sob responsabilidade do estabelecimento.",
        ],
      },
      {
        title: "8. Desktop, offline e dispositivos",
        paragraphs: [
          "Alguns planos podem permitir uso em desktop, validação de máquina, acesso offline, usuários locais, PINs ou sincronização posterior. Esses recursos dependem de configuração correta, dispositivo compatível, armazenamento local e validações periódicas.",
          "O usuário deve proteger o computador, controlar quem usa a máquina, manter internet quando necessária e conferir dados sincronizados. Operações feitas offline podem depender de reconciliação posterior com o servidor.",
        ],
      },
      {
        title: "9. Disponibilidade e suporte",
        paragraphs: [
          `Buscamos manter o HappyCash disponível e seguro, mas podem ocorrer interrupções por manutenção, atualizações, falhas de internet, serviços de terceiros, indisponibilidade de provedores ou eventos fora do nosso controle. O suporte pode ser solicitado pelo email ${supportEmail}.`,
          "O atendimento pode variar conforme plano, complexidade do problema, informações fornecidas pelo usuário e disponibilidade dos canais oficiais.",
        ],
      },
      {
        title: "10. Propriedade intelectual",
        paragraphs: [
          "Marca, layout, código, textos, telas, fluxos, identidade visual, documentação e demais elementos do HappyCash pertencem ao HappyCash ou a seus licenciadores. O uso do sistema não transfere propriedade intelectual ao usuário.",
          "Você não deve copiar, revender, sublicenciar, modificar, desmontar, tentar extrair código-fonte ou explorar comercialmente partes do HappyCash sem autorização expressa.",
        ],
      },
      {
        title: "11. Conteúdo e dados cadastrados",
        paragraphs: [
          "Os dados que você cadastra no sistema continuam relacionados ao seu estabelecimento e à sua operação. Ao usar o HappyCash, você nos autoriza a hospedar, processar e transmitir esses dados somente na medida necessária para prestar o serviço, proteger a plataforma e cumprir estes Termos.",
        ],
      },
      {
        title: "12. Limitação de responsabilidade",
        paragraphs: [
          "Na máxima extensão permitida pela lei, o HappyCash não será responsável por perdas indiretas, lucros cessantes, perda de oportunidade, erro de lançamento feito pelo usuário, falha de equipamento, indisponibilidade de internet, serviços de terceiros ou decisão comercial tomada com base em informações não conferidas.",
          "Nada nestes Termos exclui direitos que não possam ser limitados pela legislação aplicável.",
        ],
      },
      {
        title: "13. Alterações dos termos",
        paragraphs: [
          "Podemos atualizar estes Termos para refletir mudanças no produto, nos planos, na lei ou na forma de operação. A versão vigente será publicada nesta página com a data de atualização. O uso contínuo do HappyCash após alterações indica concordância com os novos termos.",
        ],
      },
      {
        title: "14. Lei aplicável e contato",
        paragraphs: [
          `Estes Termos são regidos pela legislação brasileira. Para dúvidas, suporte, privacidade, cancelamento ou assuntos relacionados a estes Termos, entre em contato pelo email ${supportEmail}.`,
        ],
      },
    ]}
  />
);

export default TermosDeServico;
