import {
  PaginationParams,
  PaginationResult,
} from '../interfaces/pagination.interface';

export class PaginationBuilder {
  static build<T>(
    items: T[],
    totalItems: number,
    params: PaginationParams,
  ): PaginationResult<T> {
    const itemsPerPage = params.limit || 10;
    const currentPage = params.page || 1;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return {
      items,
      totalItems,
      currentPage,
      itemsPerPage,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    };
  }
}
