import screenshotGestaoRh from "@/assets/pdv-principal-carrinho.webp";
import SolutionPage from "@/components/landing/SolutionPage";

const SistemaGestaoRh = () => {
  return (
    <SolutionPage
      seo={{
        title: "Sistema de gestão de RH | HappyCash ERP para comércio",
        description:
          "Sistema de gestão de RH no HappyCash ERP para comércio pequeno, médio e grande: funcionários, permissões, ponto, escalas, férias, documentos e histórico.",
        path: "/sistema-de-gestao-rh",
        image: screenshotGestaoRh,
        keywords: [
          "sistema de gestão de RH",
          "sistema de gestao rh",
          "gestão de recursos humanos",
          "gestao de recursos humanos",
          "ERP com RH",
          "erp sistema",
          "sistema erp para comércio",
          "sistema de gestão para comércio",
          "sistema para comércio pequeno médio e grande porte",
          "controle de funcionários",
          "controle de ponto",
          "escala de trabalho",
          "documentos de funcionários",
          "portal do funcionário",
          "HappyCash RH",
        ],
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "HappyCash RH",
            alternateName: ["Sistema de gestão de RH HappyCash", "HappyCash ERP com RH"],
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web, Windows, Linux",
            url: "https://www.happycashsite.com.br/sistema-de-gestao-rh",
            description:
              "Módulo de gestão de RH do HappyCash ERP para organizar funcionários, acessos, permissões, ponto, escalas, férias, documentos e histórico por colaborador.",
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "O HappyCash tem sistema de gestão de RH?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Sim. O HappyCash inclui gestão de RH para centralizar funcionários, permissões, ponto, escalas, férias, documentos e histórico por colaborador.",
                },
              },
              {
                "@type": "Question",
                name: "O módulo de RH serve para comércio pequeno, médio e grande?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "A proposta do módulo é começar simples para lojas menores e crescer com controle de acesso, documentos, portal do funcionário e rotinas de RH para operações maiores.",
                },
              },
            ],
          },
        ],
      }}
      eyebrow="Gestão de RH"
      title="Sistema de gestão de RH dentro do HappyCash ERP"
      description="Além de fiado, PDV, estoque e caixa, o HappyCash também organiza a gestão de pessoas: funcionários, permissões, ponto, escalas, férias, documentos, histórico e portal do funcionário em uma estrutura pensada para comércio pequeno, médio e grande porte."
      highlightItems={[
        "Funcionários e permissões",
        "Ponto, escalas e férias",
        "Documentos e histórico",
        "Portal do funcionário",
      ]}
      imageSrc={screenshotGestaoRh}
      imageAlt="Tela do HappyCash ERP com gestão para comércio"
      promiseTitle="RH organizado por funcionário, com controle e leitura fácil"
      promiseDescription="O módulo de RH foi pensado para tirar informações de planilhas soltas e colocar tudo em uma pasta digital por colaborador, com dados salvos, permissões claras e histórico de alterações."
      promiseCards={[
        {
          title: "Pasta por colaborador",
          description: "Dados pessoais, contato, endereço, função, documentos, férias, afastamentos, escala e informações do vínculo ficam reunidos no perfil do funcionário.",
        },
        {
          title: "Permissões com segurança",
          description: "O administrador define quem pode acessar RH, alterar permissões, trocar senha ou consultar dados sensíveis, com foco em controle por empresa.",
        },
        {
          title: "Portal do funcionário",
          description: "Cada colaborador pode ter acesso ao próprio portal para visualizar dados, consultar comunicados e acompanhar informações liberadas pela empresa.",
        },
      ]}
      workflowTitle="Como funciona a gestão de RH no HappyCash"
      workflowDescription="O fluxo concentra cadastro, acesso e acompanhamento para o administrador ou equipe de RH autorizada."
      workflowSteps={[
        {
          title: "Cadastre o funcionário",
          description: "Inclua dados pessoais, função, setor, unidade, endereço, contato de emergência, contrato e informações importantes do vínculo.",
        },
        {
          title: "Defina acesso e rotina",
          description: "Configure permissões, PIN, senha, escala por dia, ponto, férias, afastamentos, documentos e comunicados internos.",
        },
        {
          title: "Acompanhe histórico",
          description: "Consulte alterações, arquivos, eventos, férias próximas, atrasos, faltas, banco de horas e dados do colaborador em um só lugar.",
        },
      ]}
      featureTitle="Recursos de RH para crescer com mais controle"
      featureEyebrow="Gestão de pessoas"
      featureDescription="A base do módulo cobre o essencial para comércio que precisa sair do improviso e preparar uma operação mais profissional."
      featureCards={[
        {
          title: "Cadastro completo de funcionários",
          description: "Dados pessoais, cargo, setor, admissão, tipo de contrato, salário, jornada, endereço, documentos, dados bancários e contato de emergência.",
        },
        {
          title: "Controle de ponto e escalas",
          description: "Entrada, saída, intervalos, horários diferentes por dia da semana, atrasos, faltas, banco de horas, justificativas e aprovações.",
        },
        {
          title: "Férias, ausências e afastamentos",
          description: "Solicitações, aprovações, atestados, licenças, calendário de ausências e acompanhamento de períodos disponíveis.",
        },
        {
          title: "Documentos e relatórios",
          description: "Contratos, termos, atestados, advertências, certificados, histórico de ações e relatórios básicos para apoiar o RH e o administrador.",
        },
      ]}
      faqs={[
        {
          question: "O sistema de gestão de RH substitui um contador?",
          answer: "Não. O módulo organiza dados e rotinas de RH, mas folha completa, encargos e obrigações trabalhistas exigem conferência contábil e podem precisar de integração especializada.",
        },
        {
          question: "Funcionário comum também acessa o RH?",
          answer: "Não. Funcionário comum acessa o portal do funcionário com informações liberadas. O RH completo fica para administrador ou usuário autorizado.",
        },
        {
          question: "O RH faz parte do ERP do HappyCash?",
          answer: "Sim. O RH entra como módulo do HappyCash ERP junto com PDV, fiado, estoque, clientes, caixa, relatórios e gestão da operação.",
        },
      ]}
    />
  );
};

export default SistemaGestaoRh;
