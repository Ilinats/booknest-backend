export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  skip: number,
  take: number,
): { data: T[]; total: number; skip: number; take: number; hasMore: boolean } {
  return {
    data,
    total,
    skip,
    take,
    hasMore: skip + take < total,
  };
}
