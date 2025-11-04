export interface PaginationData<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
}