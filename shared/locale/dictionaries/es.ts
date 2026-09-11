/*
  es.ts - dicionario PT -> ES.

  Semente da Fase 1: navegacao, acoes comuns e mensagens de sessao - ou seja, a
  camada visual que o usuario ve primeiro. O restante do catalogo entra na Fase 3,
  quando as strings deixarem de ser literais no JSX e virarem chaves.

  As chaves precisam casar o texto PT exatamente como ele aparece na tela. Como a
  base ainda tem variantes com e sem acento, ambas ficam mapeadas.
*/

import type { LocaleDictionary } from "./types";

export const esDictionary: LocaleDictionary = {
  exact: {
    // Navegacao principal
    "Painel": "Panel",
    "PDV Rápido": "POS Rápido",
    "PDV Rapido": "POS Rápido",
    "PDV 🧾": "POS 🧾",
    "Clientes": "Clientes",
    "Produtos": "Productos",
    "Estoque": "Inventario",
    "Relatórios": "Informes",
    "Relatorios": "Informes",
    "Financeiro": "Finanzas",
    "Notas": "Notas",
    "Recompensas": "Recompensas",
    "Excluídos": "Eliminados",
    "Excluidos": "Eliminados",
    "Configurações": "Configuración",
    "Configuracoes": "Configuración",
    "Operadores": "Operadores",

    // Acoes recorrentes
    "Salvar": "Guardar",
    "Salvar dados": "Guardar datos",
    "Cancelar": "Cancelar",
    "Confirmar": "Confirmar",
    "Excluir": "Eliminar",
    "Editar": "Editar",
    "Buscar": "Buscar",
    "Adicionar": "Agregar",
    "Voltar": "Volver",
    "Fechar": "Cerrar",
    "Entrar": "Iniciar sesión",
    "Sair": "Salir",
    "Carregando...": "Cargando...",

    // Sessao e autenticacao
    "Sua sessão expirou. Entre novamente para continuar.": "Tu sesión expiró. Inicia sesión de nuevo para continuar.",
    "Sua sessao expirou. Entre novamente para continuar.": "Tu sesión expiró. Inicia sesión de nuevo para continuar.",
    "Sua sessão expirou. Faça login novamente.": "Tu sesión expiró. Inicia sesión de nuevo.",
    "Sua sessao expirou. Faça login novamente.": "Tu sesión expiró. Inicia sesión de nuevo.",
    "Sua sessao expirou. Faca login novamente.": "Tu sesión expiró. Inicia sesión de nuevo.",
    "Informe login e senha do administrador.": "Ingresa el usuario y la contraseña del administrador.",
    "A senha do operador precisa ter pelo menos 6 caracteres.": "La contraseña del operador debe tener al menos 6 caracteres.",
    "Preencha usuario e senha para criar o operador.": "Completa usuario y contraseña para crear el operador.",
    "Preencha usuário e senha para criar o operador.": "Completa usuario y contraseña para crear el operador.",

    // Cadastro da empresa
    "Cadastrar empresa": "Registrar empresa",
    "Cadastro da empresa": "Registro de la empresa",
    "Razao social": "Razón social",
    "Nome fantasia": "Nombre comercial",
    "Dados atuais": "Datos actuales",
    "Nao informado": "No informado",
    "Cadastro incompleto": "Registro incompleto",
    "Empresa nao cadastrada": "Empresa no registrada",
    "Dados da empresa atualizados.": "Datos de la empresa actualizados.",

    // Assinatura
    "Carregando status da assinatura...": "Cargando estado de la suscripción...",
    "Sem prazo ativo": "Sin plazo activo",
    "Marcador": "Indicador",
  },
  patterns: [],
};
