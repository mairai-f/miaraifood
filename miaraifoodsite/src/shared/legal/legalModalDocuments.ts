import {
  LEGAL_PATHS,
  LEGAL_SUPPORT_EMAIL,
} from "./legalAcceptance";

export const LEGAL_MODAL_DOCUMENTS = {
  privacy: {
    title: "Política de Privacidade",
    path: LEGAL_PATHS.privacy,
    description: "Como o MIAR AI/FOOD trata dados pessoais no site, cadastro, área do cliente, PDV, fiado, estoque, RH e recursos relacionados.",
    sections: [
      {
        title: "Dados tratados",
        text: "Podemos tratar dados do responsável e da empresa, como nome completo, email, telefone, CPF ou CNPJ, nome do estabelecimento, tipo de atividade, CEP, rua, número, complemento, bairro, cidade e estado. Também tratamos dados inseridos no sistema pela loja, incluindo nome, CPF, CNPJ, telefone, endereço, fiado, vendas, pagamentos, produtos, estoque, despesas, colaboradores, documentos de RH, observações e demais dados cadastrais, operacionais ou financeiros lançados na operação.",
      },
      {
        title: "Finalidades",
        text: "Usamos esses dados para criar e proteger contas, liberar recursos contratados, operar o sistema, processar assinaturas, prestar suporte, prevenir fraude, melhorar o produto e cumprir obrigações legais.",
      },
      {
        title: "Direitos e contato",
        text: `O titular pode solicitar acesso, correção, eliminação, confirmação de tratamento e outras informações previstas na LGPD pelo email ${LEGAL_SUPPORT_EMAIL}.`,
      },
    ],
  },
  terms: {
    title: "Termos de Uso",
    path: LEGAL_PATHS.terms,
    description: "Condições principais para uso do MIAR AI/FOOD, incluindo planos, teste gratuito, conta, suporte, desktop, offline, relatórios e responsabilidades do usuário.",
    sections: [
      {
        title: "Uso da conta",
        text: "Ao criar conta, contratar plano, usar teste grátis ou acessar produtos MIAR AI/FOOD, o usuário concorda em manter dados verdadeiros, proteger senha, PINs, operadores e dispositivos.",
      },
      {
        title: "Dados e operação",
        text: "O uso do MIAR AI/FOOD pode envolver dados do responsável e da empresa, como nome, email, telefone, CPF ou CNPJ e endereço do estabelecimento, além de dados operacionais inseridos pela loja, como cadastro de clientes e terceiros, CPF ou CNPJ quando informados, vendas, fiado, pagamentos, produtos, estoque, despesas, relatórios e observações.",
      },
      {
        title: "Responsabilidades",
        text: "O usuário deve usar o sistema conforme a lei, obter autorização para cadastrar dados de terceiros e não utilizar o MIAR AI/FOOD para fraude, abuso, atividade ilegal ou violação de direitos.",
      },
    ],
  },
  lgpd: {
    title: "LGPD",
    path: LEGAL_PATHS.lgpd,
    description: "Compromissos práticos do MIAR AI/FOOD para tratamento de dados, direitos dos titulares, segregação por empresa e responsabilização conforme a LGPD.",
    sections: [
      {
        title: "Compromisso operacional",
        text: "O mais importante: não é só ter texto no site. O sistema precisa controlar acesso, separar dados por empresa, permitir exclusão e correção quando possível, guardar logs e deixar claro o que faz com os dados.",
      },
      {
        title: "Dados e direitos",
        text: "Quando o sistema tratar nome, CPF, CNPJ, telefone, endereço, vendas, fiado, estoque, pagamentos ou outros dados operacionais, o titular pode solicitar confirmação de tratamento, acesso, correção, eliminação, portabilidade e demais direitos previstos na LGPD, sem prejuízo da responsabilidade da loja controladora quando os dados tiverem sido cadastrados por ela.",
      },
      {
        title: "ANPD e sanções",
        text: "A ANPD pode aplicar sanções em caso de descumprimento da LGPD, e o regulamento de dosimetria orienta como as penalidades são calculadas quando cabíveis.",
      },
    ],
  },
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_MODAL_DOCUMENTS;
