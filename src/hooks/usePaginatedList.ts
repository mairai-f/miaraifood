import { useMemo, useState } from 'react';

export interface UsePaginatedListOptions<T> {
  pageSize?: number;
  initialPage?: number;
}

export interface PaginatedListResult<T> {
  /** Itens da página atual */
  pageItems: T[];
  /** Página atual (1-indexed) */
  currentPage: number;
  /** Total de páginas disponíveis */
  totalPages: number;
  /** Total de itens na lista original */
  totalItems: number;
  /** Tamanho da página */
  pageSize: number;
  /** Avança para a próxima página */
  nextPage: () => void;
  /** Volta para a página anterior */
  prevPage: () => void;
  /** Define diretamente a página desejada */
  setPage: (page: number) => void;
  /** Altera o número de itens por página */
  setPageSize: (size: number) => void;
  /** Se possui próxima página */
  hasNextPage: boolean;
  /** Se possui página anterior */
  hasPrevPage: boolean;
}

/**
 * Hook de paginação profunda (Deep Module Architecture).
 * Oculta a complexidade de cálculo de limites, fatiamento de array e controle de páginas
 * sob uma interface simples e totalmente testável.
 */
export function usePaginatedList<T>(
  items: T[],
  options: UsePaginatedListOptions<T> = {},
): PaginatedListResult<T> {
  const [pageSize, setPageSizeState] = useState<number>(options.pageSize ?? 25);
  const [page, setPageState] = useState<number>(options.initialPage ?? 1);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Ajusta a página caso o filtro reduza o total de itens abaixo da página atual
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, currentPage, pageSize]);

  const setPage = (nextPage: number) => {
    setPageState(Math.max(1, Math.min(nextPage, totalPages)));
  };

  const nextPage = () => setPage(currentPage + 1);
  const prevPage = () => setPage(currentPage - 1);

  const setPageSize = (size: number) => {
    setPageSizeState(Math.max(1, size));
    setPageState(1);
  };

  return {
    pageItems,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    nextPage,
    prevPage,
    setPage,
    setPageSize,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}
