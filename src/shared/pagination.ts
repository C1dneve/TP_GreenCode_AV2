export interface PageInput { page?: number; pageSize?: number }
export function pageValues(input: PageInput = {}) {
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize ?? 20)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
export function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
