import { useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalRows,
  onPageChange,
}: PaginationProps) {
  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalRows);

  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const handleFirst = useCallback(() => {
    onPageChange(1);
  }, [onPageChange]);

  const handleLast = useCallback(() => {
    onPageChange(totalPages);
  }, [totalPages, onPageChange]);

  // Calculate visible page numbers
  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }

    return pages;
  }, [currentPage, totalPages]);

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 h-11",
        "select-none font-mono"
      )}
    >
      {/* Left: Row info */}
      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] min-w-[140px]">
        <span className="text-[var(--text-secondary)] font-medium">
          {startRow.toLocaleString()}-{endRow.toLocaleString()}
        </span>
        <span>of</span>
        <span className="text-[var(--text-secondary)] font-medium">
          {totalRows.toLocaleString()}
        </span>
      </div>

      {/* Center: Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First page */}
          <button
            onClick={handleFirst}
            disabled={currentPage === 1}
            className={cn(
              "p-1.5 rounded-[4px] transition-colors",
              currentPage === 1
                ? "text-[var(--text-muted)]/40 cursor-not-allowed"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
            )}
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Previous page */}
          <button
            onClick={handlePrevious}
            disabled={currentPage === 1}
            className={cn(
              "p-1.5 rounded-[4px] transition-colors",
              currentPage === 1
                ? "text-[var(--text-muted)]/40 cursor-not-allowed"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
            )}
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1 mx-2">
            {pageNumbers.map((page, idx) =>
              page === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-8 text-center text-xs text-[var(--text-muted)]"
                >
                  ···
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={cn(
                    "min-w-[28px] h-7 px-1.5 rounded-[4px] text-xs font-medium transition-all cursor-pointer",
                    page === currentPage
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {page}
                </button>
              )
            )}
          </div>

          {/* Next page */}
          <button
            onClick={handleNext}
            disabled={currentPage === totalPages}
            className={cn(
              "p-1.5 rounded-[4px] transition-colors",
              currentPage === totalPages
                ? "text-[var(--text-muted)]/40 cursor-not-allowed"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
            )}
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Last page */}
          <button
            onClick={handleLast}
            disabled={currentPage === totalPages}
            className={cn(
              "p-1.5 rounded-[4px] transition-colors",
              currentPage === totalPages
                ? "text-[var(--text-muted)]/40 cursor-not-allowed"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
            )}
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Right: Page indicator with keyboard hint */}
      <div className="flex items-center gap-2 min-w-[140px] justify-end">
        <span className="text-xs text-[var(--text-muted)]">
          Page{" "}
          <span className="text-[var(--text-secondary)] font-medium">{currentPage}</span>
          {" / "}
          <span className="text-[var(--text-secondary)]">{totalPages}</span>
        </span>
      </div>
    </div>
  );
}
