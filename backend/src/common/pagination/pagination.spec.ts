import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQuery,
  pageWindow,
  toPage,
} from './pagination';

function errorsFor(raw: Record<string, unknown>): string[] {
  return validateSync(plainToInstance(PaginationQuery, raw)).map(
    (error) => error.property,
  );
}

describe('PaginationQuery', () => {
  it('accepts numeric strings from the query', () => {
    expect(errorsFor({ page: '2', pageSize: '100' })).toEqual([]);
    expect(errorsFor({})).toEqual([]);
  });

  it('rejects out-of-range values', () => {
    expect(errorsFor({ page: '0' })).toEqual(['page']);
    expect(errorsFor({ pageSize: '101' })).toEqual(['pageSize']);
    expect(errorsFor({ page: 'x' })).toEqual(['page']);
  });
});

describe('pageWindow', () => {
  it('defaults to the first page', () => {
    expect(pageWindow({})).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
    });
  });

  it('computes the offset', () => {
    expect(pageWindow({ page: 3, pageSize: 10 })).toEqual({
      page: 3,
      pageSize: 10,
      skip: 20,
    });
  });
});

describe('toPage', () => {
  it('wraps items with paging info', () => {
    expect(toPage(['a'], 11, { page: 2, pageSize: 10, skip: 10 })).toEqual({
      items: ['a'],
      total: 11,
      page: 2,
      pageSize: 10,
    });
  });
});
