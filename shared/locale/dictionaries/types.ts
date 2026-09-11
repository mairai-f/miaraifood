/** Regra de traducao por expressao regular, para textos com parte variavel. */
export type PatternRule = {
  pattern: RegExp;
  replace: string;
};

export type LocaleDictionary = {
  /** Traducao por texto exato (apos aparar espacos das bordas). */
  exact: Record<string, string>;
  /** Aplicadas apenas quando nenhuma traducao exata casa. */
  patterns: PatternRule[];
};

export const emptyDictionary: LocaleDictionary = { exact: {}, patterns: [] };
