import LegalDocumentPage from "@/components/landing/LegalDocumentPage";
import { createSiteUrl } from "@/lib/siteSeo";
import { LEGAL_SUPPORT_EMAIL, LEGAL_UPDATED_AT_LABEL } from "../../../shared/legal/legalAcceptance";

const path = "/politica-de-privacidade";
const updatedAt = LEGAL_UPDATED_AT_LABEL;
const supportEmail = LEGAL_SUPPORT_EMAIL;

const PoliticaDePrivacidade = () => (
  <LegalDocumentPage
    seo={{
      title: "Política de Privacidade | HappyCash",
      description: "Entenda como o HappyCash coleta, usa, protege e compartilha dados pessoais no site, no sistema PDV, no controle de fiado e nos produtos relacionados.",
      path,
      keywords: ["política de privacidade happycash", "LGPD happycash", "privacidade sistema pdv", "privacidade controle de fiado"],
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Política de Privacidade do HappyCash",
        url: createSiteUrl(path),
      },
    }}
    eyebrow="Privacidade"
    title="Política de Privacidade"
    description="Esta política explica como tratamos dados pessoais no HappyCash, incluindo site, cadastro, área do cliente, sistema PDV, controle de fiado, estoque, HappyCash Agenda e recursos relacionados."
    updatedAt={updatedAt}
    sections={[
      {
        title: "1. Quem somos e como falar conosco",
        paragraphs: [
          "O HappyCash é uma plataforma para gestão comercial, controle de fiado, PDV, estoque, agenda e produtos relacionados. Para assuntos de privacidade, suporte ou exercício de direitos de titular, entre em contato pelo email happycashsupport@gmail.com.",
          "Quando uma loja usa o HappyCash para cadastrar seus próprios clientes, produtos, vendas, dívidas ou agendamentos, a loja é responsável pela decisão sobre esses dados. O HappyCash atua como fornecedor da tecnologia usada para armazenar e processar essas informações conforme a configuração feita pelo usuário da conta.",
        ],
      },
      {
        title: "2. Dados que podemos coletar",
        bullets: [
          "Dados de cadastro da conta e do responsável: nome completo, email, telefone, senha protegida, CPF ou CNPJ do responsável, plano escolhido, nome do estabelecimento, tipo de estabelecimento, CEP, rua, número, complemento, bairro, cidade, estado e demais informações da loja.",
          "Dados operacionais inseridos pelo usuário ou pela loja: nome, CPF, CNPJ, telefone, endereço, histórico de fiado, vendas, pagamentos, produtos, estoque, despesas, agendamentos, observações e demais dados cadastrais, comerciais ou financeiros lançados no sistema.",
          "Dados de pagamento e assinatura: plano, status de cobrança, período contratado, meio de pagamento e referências de transação retornadas por provedores de pagamento.",
          "Dados técnicos: endereço IP, navegador, sistema operacional, dispositivo, registros de acesso, cookies, identificadores de sessão e eventos de segurança.",
          "Dados de atendimento: mensagens enviadas por email, informações necessárias para suporte e histórico de tratativas.",
        ],
      },
      {
        title: "3. Para que usamos os dados",
        bullets: [
          "Criar e proteger contas de usuário.",
          "Liberar acesso aos produtos contratados, planos, testes gratuitos e área do cliente.",
          "Executar funcionalidades do sistema, como PDV, fiado, estoque, agenda, relatórios e cobranças.",
          "Sincronizar dados entre web, desktop e recursos offline quando disponíveis.",
          "Processar pagamentos, assinaturas, renovações, cancelamentos e comprovantes.",
          "Prestar suporte, investigar erros, prevenir fraude, proteger a segurança da plataforma e cumprir obrigações legais.",
          "Melhorar a experiência do produto, medir desempenho e entender quais recursos precisam de ajuste.",
        ],
      },
      {
        title: "4. Bases legais",
        paragraphs: [
          "Tratamos dados pessoais conforme bases previstas na LGPD, incluindo execução de contrato, cumprimento de obrigação legal ou regulatória, legítimo interesse, exercício regular de direitos e consentimento quando aplicável.",
          "Quando o usuário cadastra dados de clientes da própria loja, ele deve garantir que possui base legal adequada para coletar e usar essas informações no seu negócio.",
        ],
      },
      {
        title: "5. Compartilhamento de dados",
        paragraphs: [
          "Podemos compartilhar dados com fornecedores necessários para operar o HappyCash, como infraestrutura de hospedagem, banco de dados, autenticação, pagamentos, envio de emails, análise de erros e suporte. Esses fornecedores devem tratar as informações apenas conforme necessário para prestar os serviços.",
          "Também podemos compartilhar informações quando exigido por lei, ordem de autoridade competente, proteção de direitos do HappyCash, prevenção de fraude ou segurança dos usuários.",
        ],
      },
      {
        title: "6. Cookies e tecnologias similares",
        paragraphs: [
          "Usamos cookies, armazenamento local e identificadores de sessão para manter login, lembrar preferências, proteger a conta e melhorar a navegação. Alguns recursos, como login, área do cliente e modo offline, podem depender dessas tecnologias para funcionar corretamente.",
        ],
      },
      {
        title: "7. Retenção e exclusão",
        paragraphs: [
          "Mantemos dados pelo tempo necessário para prestar o serviço, cumprir obrigações legais, resolver disputas, prevenir fraude e manter registros de segurança. O usuário pode solicitar exclusão da conta ou de dados pessoais pelo suporte, respeitados prazos legais e backups técnicos.",
          "Dados inseridos pela loja sobre seus clientes devem ser gerenciados pela própria loja dentro do sistema ou mediante solicitação ao suporte quando necessário.",
        ],
      },
      {
        title: "8. Segurança",
        paragraphs: [
          "Adotamos medidas técnicas e administrativas para proteger os dados, incluindo autenticação, controle de acesso por perfil, segregação de dados por empresa, armazenamento protegido, registros de segurança e boas práticas de desenvolvimento. Ainda assim, nenhum sistema conectado à internet é totalmente imune a riscos.",
          "O usuário também precisa proteger suas credenciais, usar senhas fortes, controlar acessos de operadores e manter seus dispositivos seguros.",
        ],
      },
      {
        title: "9. Direitos dos titulares",
        paragraphs: [
          "Nos termos da LGPD, titulares podem solicitar confirmação de tratamento, acesso, correção, eliminação, portabilidade, informações sobre compartilhamento, revisão de consentimento e oposição quando aplicável.",
          `Para exercer direitos relacionados a dados tratados diretamente pelo HappyCash, envie uma solicitação para ${supportEmail}. Quando os dados foram cadastrados por uma loja usuária do sistema, a solicitação pode precisar ser encaminhada ao responsável por essa loja.`,
          "Quando tecnicamente possível e compatível com exigências legais, o sistema permite correção, exclusão lógica, revisão de dados e rastreabilidade mínima das ações administrativas realizadas na conta.",
        ],
      },
      {
        title: "10. Crianças e adolescentes",
        paragraphs: [
          "O HappyCash é destinado a uso comercial por maiores de idade e empresas. Não direcionamos nossos serviços a crianças. Se identificarmos dados de menores tratados sem base adequada, poderemos remover ou restringir o uso dessas informações.",
        ],
      },
      {
        title: "11. Transferências internacionais",
        paragraphs: [
          "Alguns fornecedores de tecnologia podem processar ou armazenar dados fora do Brasil. Nesses casos, buscamos utilizar provedores com padrões de segurança e compromissos compatíveis com a proteção de dados aplicável.",
        ],
      },
      {
        title: "12. Alterações desta política",
        paragraphs: [
          "Podemos atualizar esta Política de Privacidade para refletir mudanças no produto, na lei ou em nossas práticas. A versão vigente será publicada nesta página com a data de atualização.",
        ],
      },
    ]}
  />
);

export default PoliticaDePrivacidade;
