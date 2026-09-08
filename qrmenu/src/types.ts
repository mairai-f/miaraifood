export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  prepTime: number;
  imageUrl?: string;
  /** Nomes reais dos ingredientes (resolvidos da ficha técnica cadastrada no Gestor) — usados pra montar os checkboxes "tirar X" no modal do item. Vazio = sem ficha técnica cadastrada, nenhum checkbox aparece. */
  ingredientes?: string[];
}

export interface CartItem extends MenuItem {
  qty: number;
  note: string;
  /** Ingredientes que o cliente desmarcou (quer remover) neste item específico do carrinho. */
  removedIngredients?: string[];
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine?: string;
  segment?: string;
}

export interface TableInfo {
  id: string;
  restaurantId: string;
  number: number;
}

/** Answers to the optional 3-question stepper — used for the AI recommendation and later for bill splitting. */
export interface StepperAnswers {
  hunger: 'pouca' | 'moderada' | 'muita';
  mood: 'tranquilo' | 'com-pressa' | 'irritado';
  headcount: number;
}

export interface Recommendation {
  itemId: string | null;
  itemName: string | null;
  reasoning: string;
  provider: string;
}
