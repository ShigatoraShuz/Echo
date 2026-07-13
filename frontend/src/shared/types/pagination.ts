export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
}

export function calculatePagination(
  page: number,
  pageSize: number,
  totalItems: number
): PaginationState {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
  };
}

export function calculateOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
