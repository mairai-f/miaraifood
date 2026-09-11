/*
  gn.ts - dicionario PT -> Guarani (Avañe'ẽ).

  INTENCIONALMENTE VAZIO NESTA FASE.

  O guarani do dia a dia no Paraguai e o jopara (guarani misturado com espanhol),
  e o vocabulario de PDV/fiado/estoque nao tem terminologia consolidada - traduzir
  por maquina aqui inventaria termos que nenhum operador reconhece. O catalogo so
  deve ser preenchido depois que a Fase 2 travar o glossario (~150 termos) com um
  falante nativo.

  Ate la o idioma fica selecionavel e todo texto sem traducao cai em portugues,
  que e o comportamento de fallback do motor. Preencher este arquivo com chutes
  seria pior do que deixar o fallback aparecer.
*/

import type { LocaleDictionary } from "./types";

export const gnDictionary: LocaleDictionary = {
  exact: {},
  patterns: [],
};
