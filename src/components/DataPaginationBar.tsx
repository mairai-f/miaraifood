import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginatedListResult } from '@/hooks/usePaginatedList';

interface DataPaginationBarProps<T> {
  pagination: PaginatedListResult<T>;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
}

export function DataPaginationBar<T>({
  pagination,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelector = true,
}: DataPaginationBarProps<T>) {
  const {
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    nextPage,
    prevPage,
    setPageSize,
    hasNextPage,
    hasPrevPage,
  } = pagination;

  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 border-t text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>
          Exibindo <strong>{startItem}</strong> a <strong>{endItem}</strong> de <strong>{totalItems}</strong> registros
        </span>
        {showPageSizeSelector && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs">Por página:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => setPageSize(Number(val))}
            >
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs mr-1">
            Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={prevPage}
            disabled={!hasPrevPage}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={nextPage}
            disabled={!hasNextPage}
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
